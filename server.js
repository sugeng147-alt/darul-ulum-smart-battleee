const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, app: "Darul Ulum Smart Battle" }));

// Room state lives in memory: keep this single server process running during a game.
const rooms = new Map();
const MAX_PLAYERS = 50;
const TOTAL_QUESTIONS = 40;
const QUESTION_SECONDS = 25;

function code() { return crypto.randomBytes(3).toString("hex").toUpperCase(); }
function cleanName(s) { return String(s || "").trim().replace(/[<>]/g, "").slice(0, 24); }
function publicPlayers(room) {
  return [...room.players.values()].map(p => ({
    id: p.id, name: p.name, score: p.score, answered: p.answered,
    connected: p.connected, isHost: p.id === room.hostId
  })).sort((a,b) => b.score-a.score || a.name.localeCompare(b.name));
}
function emitRoom(room) {
  io.to(room.code).emit("room:update", {
    code: room.code, status: room.status, hostId: room.hostId,
    players: publicPlayers(room), maxPlayers: MAX_PLAYERS,
    questionIndex: room.questionIndex, totalQuestions: TOTAL_QUESTIONS
  });
}
function sendQuestion(room) {
  if (room.timer) clearTimeout(room.timer);
  if (room.questionIndex >= room.order.length) return finishRoom(room);
  const qIndex = room.order[room.questionIndex];
  const q = room.questions[qIndex];
  room.answersThisQuestion.clear();
  room.status = "question";
  room.questionEndsAt = Date.now() + QUESTION_SECONDS * 1000;
  io.to(room.code).emit("game:question", {
    index: room.questionIndex, total: room.order.length, topic: q[0],
    text: q[1], options: q[2], seconds: QUESTION_SECONDS,
    endsAt: room.questionEndsAt
  });
  emitRoom(room);
  room.timer = setTimeout(() => reveal(room, true), QUESTION_SECONDS * 1000);
}
function reveal(room, timedOut = false) {
  if (!room || room.status !== "question") return;
  if (room.timer) clearTimeout(room.timer);
  const q = room.questions[room.order[room.questionIndex]];
  room.status = "reveal";
  io.to(room.code).emit("game:reveal", {
    correctIndex: q[3], explanation: q[4], timedOut,
    leaderboard: publicPlayers(room)
  });
  emitRoom(room);
  room.timer = setTimeout(() => {
    if (room.questionIndex + 1 >= room.order.length) finishRoom(room);
    else { room.questionIndex++; sendQuestion(room); }
  }, 5000);
}
function finishRoom(room) {
  if (room.timer) clearTimeout(room.timer);
  room.status = "finished";
  io.to(room.code).emit("game:finished", { leaderboard: publicPlayers(room) });
  emitRoom(room);
}
io.on("connection", socket => {
  socket.on("room:create", ({ name }, cb = () => {}) => {
    const playerName = cleanName(name);
    if (!playerName) return cb({ error: "Masukkan nama guru." });
    let roomCode;
    do { roomCode = code(); } while (rooms.has(roomCode));
    const room = {
      code: roomCode, hostId: socket.id, players: new Map(),
      status: "lobby", questionIndex: 0, order: [], questions: [],
      answersThisQuestion: new Set(), timer: null, questionEndsAt: null
    };
    room.players.set(socket.id, { id: socket.id, name: playerName, score: 0, answered: false, connected: true });
    rooms.set(roomCode, room); socket.join(roomCode); socket.data.roomCode = roomCode;
    cb({ ok: true, code: roomCode, playerId: socket.id }); emitRoom(room);
  });

  socket.on("room:join", ({ code: rawCode, name }, cb = () => {}) => {
    const roomCode = String(rawCode || "").trim().toUpperCase();
    const room = rooms.get(roomCode), playerName = cleanName(name);
    if (!room) return cb({ error: "Kode ruang tidak ditemukan." });
    if (!playerName) return cb({ error: "Masukkan nama murid." });
    if (room.status !== "lobby") return cb({ error: "Permainan sudah dimulai. Minta kode ruang baru kepada guru." });
    if (room.players.size >= MAX_PLAYERS) return cb({ error: "Ruang sudah penuh (maksimal 50 pemain)." });
    if ([...room.players.values()].some(p => p.name.toLowerCase() === playerName.toLowerCase()))
      return cb({ error: "Nama tersebut sudah dipakai di ruang ini. Tambahkan pembeda." });
    room.players.set(socket.id, { id: socket.id, name: playerName, score: 0, answered: false, connected: true });
    socket.join(roomCode); socket.data.roomCode = roomCode;
    cb({ ok: true, code: roomCode, playerId: socket.id }); emitRoom(room);
  });

  socket.on("game:start", ({ questions }, cb = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return cb({ error: "Hanya guru pembuat ruang yang dapat memulai." });
    if (room.status !== "lobby") return cb({ error: "Permainan sudah berjalan." });
    if (!Array.isArray(questions) || questions.length !== TOTAL_QUESTIONS) return cb({ error: "Bank soal harus berisi 40 soal." });
    room.questions = questions;
    room.order = Array.from({length: questions.length}, (_,i)=>i).sort(()=>Math.random()-.5);
    room.questionIndex = 0;
    for (const p of room.players.values()) { p.score = 0; p.answered = false; }
    room.status = "question";
    cb({ ok: true }); sendQuestion(room);
  });

  socket.on("game:answer", ({ choice }, cb = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.status !== "question") return cb({ error: "Belum ada soal aktif." });
    const p = room.players.get(socket.id);
    if (!p || p.answered) return cb({ error: "Jawaban sudah tercatat atau pemain tidak ditemukan." });
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return cb({ error: "Pilihan tidak valid." });
    const q = room.questions[room.order[room.questionIndex]];
    p.answered = true;
    room.answersThisQuestion.add(socket.id);
    if (choice === q[3]) {
      const timeLeft = Math.max(0, Math.ceil((room.questionEndsAt - Date.now())/1000));
      p.score += 10 + Math.min(5, Math.floor(timeLeft/5)); // speed bonus, maximum +5
    }
    cb({ ok: true });
    io.to(room.code).emit("room:progress", {
      answered: room.answersThisQuestion.size, total: room.players.size
    });
    emitRoom(room);
    if (room.answersThisQuestion.size >= room.players.size) reveal(room, false);
  });

  socket.on("game:next", (cb = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return cb({ error: "Hanya guru yang dapat melanjutkan." });
    if (room.status !== "reveal") return cb({ error: "Tunggu pembahasan soal." });
    if (room.timer) clearTimeout(room.timer);
    room.questionIndex++;
    if (room.questionIndex >= room.order.length) finishRoom(room);
    else sendQuestion(room);
    cb({ ok: true });
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (p) p.connected = false;
    if (room.hostId === socket.id && room.status === "lobby") {
      const next = [...room.players.values()].find(x => x.connected);
      if (next) room.hostId = next.id;
    }
    emitRoom(room);
    // Remove finished/abandoned rooms after the last player leaves.
    if ([...room.players.values()].every(x => !x.connected) && room.status !== "lobby") {
      if (room.timer) clearTimeout(room.timer);
      rooms.delete(room.code);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Darul Ulum Smart Battle running on ${PORT}`));
