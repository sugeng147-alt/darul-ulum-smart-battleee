# Darul Ulum Smart Battle Online

Aplikasi battle quiz IPA Kelas IX multiplayer real-time untuk maksimal 50 pemain dalam satu room. Guru membuat room dan membagikan kode; murid masuk dari perangkat masing-masing. Berisi 40 soal pilihan ganda dari PDF PAS IPA Kelas 9 Semester 1.

## Jalankan lokal
1. Install Node.js 18 atau lebih baru.
2. Ekstrak folder/ZIP.
3. Buka terminal di folder proyek.
4. Jalankan `npm install`
5. Jalankan `npm start`
6. Buka `http://localhost:3000` di browser.
   - Untuk uji beberapa perangkat di Wi-Fi yang sama, gunakan alamat IP komputer host, misalnya `http://192.168.1.10:3000` (pastikan firewall mengizinkan port 3000).

## Publikasikan ke internet (Render)
1. Buat repository GitHub baru dan unggah seluruh isi folder proyek ini.
2. Di Render, pilih **New + → Web Service**, hubungkan repository tersebut.
3. Runtime: Node. Build command: `npm install`. Start command: `npm start`.
4. Deploy. Setelah aktif, Render memberi alamat `https://...onrender.com`.
5. Bagikan alamat itu ke guru dan murid. Guru klik **Buat Ruang Battle**, lalu bagikan kode 6 karakter. Murid buka alamat yang sama dan masukkan nama + kode.
6. Gunakan satu room per kelas/sesi. Maksimum 50 pemain per room.

## Cara main
- Guru membuat room dan menunggu murid bergabung.
- Guru klik **Mulai Battle**.
- Soal tampil serentak, waktu 25 detik.
- Jawaban benar mendapat 10 poin ditambah bonus kecepatan maksimum 5 poin.
- Setelah semua menjawab atau waktu habis, jawaban dan pembahasan tampil.
- Guru menekan **Soal Berikutnya**. Peringkat berjalan dan hasil akhir tampil pada semua perangkat.

## Catatan operasional dan batasan
- Server menyimpan room di memori. Jalankan satu instance/server process; jangan aktifkan autoscaling/multiple instances tanpa menambahkan adapter dan penyimpanan bersama.
- Jika server restart, sesi/room yang sedang berjalan hilang.
- Nama pemain hanya nama tampilan. Tidak ada akun, password, atau penyimpanan data pribadi.
- Gunakan nama panggilan/inisial siswa dan persetujuan sekolah/orang tua sesuai kebijakan sekolah.
- Aplikasi ini adalah battle quiz web 2D responsif dengan dekorasi arena; belum merupakan dunia 3D bebas bergerak seperti Roblox. Multiplayer dan sinkronisasi 50 pemain merupakan fitur utamanya.
- Skor dihitung server-side. Kunci jawaban tidak dikirim ke browser sebelum sesi pembahasan.
