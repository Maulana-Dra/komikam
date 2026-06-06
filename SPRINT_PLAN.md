# Rencana & Durasi Sprint Development: Pembuatan Aplikasi Komikam

_Gaya Kerja: Programmer Normal (Santai tapi Selesai, Kerja ~4 Jam/Hari)_

Dokumen ini berisi rencana kerja bertahap (_sprint plan_) beserta **estimasi waktu pengerjaan** yang realistis bagi seorang programmer normal (bukan mesin coding 24/7). Rencana didasarkan pada asumsi waktu pengerjaan santai sekitar **3-4 jam per hari** (part-time/sambilan) atau setara dengan **15-20 jam per minggu**.

---

## 📅 Ringkasan Total Durasi Proyek

- **Total Waktu Kalender:** 6 - 8 Minggu (Sekitar 1,5 - 2 Bulan)
- **Total Jam Kerja Bersih:** ~150 - 180 Jam Kerja

```text
+-------------------------------------------------------------------------+
| Sprint 1: Setup & Dummy UI      | 7 Hari Kerja  | ~25 Jam Kerja         |
| Sprint 2: External API & Auth   | 10 Hari Kerja | ~35 Jam Kerja         |
| Sprint 3: Reader & Library      | 12 Hari Kerja | ~45 Jam Kerja         |
| Sprint 4: Reader UI & Comments  | 10 Hari Kerja | ~35 Jam Kerja         |
| Sprint 5: Updates & Bug Fixing  | 7 Hari Kerja  | ~25 Jam Kerja         |
+-------------------------------------------------------------------------+
```

---

## 📌 Sprint 1: Inisialisasi Proyek & Layout Kasaran (UI Dummy)

- **Durasi Kalender:** 1 Minggu (7 Hari Kerja)
- **Estimasi Jam Kerja:** ~25 Jam (Paling banyak habis untuk setting environment)
- **Target:** Aplikasi bisa berjalan di emulator dengan navigasi tab dasar dan database backend terkoneksi.

### 🛠️ Backend (Laravel) - 8 Jam

- [ ] Install Laravel baru dan jalankan server lokal (~2 jam).
- [ ] Konfigurasi database MySQL (buat database kosong, setting `.env`, testing koneksi) (~2 jam).
- [ ] Buat Migration & Model untuk tabel dasar `User` (~4 jam).

### 📱 Frontend (React Native / Expo) - 17 Jam

- [ ] Inisialisasi proyek Expo dengan TypeScript, perbaiki error dependensi awal jika ada (~4 jam).
- [ ] Install Expo Router dan buat navigasi 3 Tab dasar (Home, Library, Account) (~5 jam).
- [ ] Buat layout Home dummy (daftar komik kotak-kotak dengan cover & judul hardcoded) (~4 jam).
- [ ] Buat routing ke detail manga dummy saat cover diklik (~4 jam).

---

## 📌 Sprint 2: Integrasi Komik (API Eksternal) & Autentikasi Dasar

- **Durasi Kalender:** 1,5 Minggu (10 Hari Kerja)
- **Estimasi Jam Kerja:** ~35 Jam (Fokus pada koneksi API dan troubleshooting CORS)
- **Target:** Pengguna bisa browsing komik asli dari internet dan melakukan register/login akun.

### 🛠️ Backend (Laravel) - 15 Jam

- [ ] Install Laravel Sanctum dan buat sistem otentikasi token (~4 jam).
- [ ] Buat `AuthController` untuk endpoint `/register` dan `/login` dengan validasi standar (~6 jam).
- [ ] Testing API dengan Postman/Thunder Client untuk memastikan token kembali (~5 jam).

### 📱 Frontend (React Native / Expo) - 20 Jam

- [ ] Buat helper `shngmClient.ts` untuk memanggil data komik dari API eksternal `api.shngm.io` (~5 jam).
- [ ] Hubungkan UI Home dengan data API asli (mengganti item dummy menjadi list dinamis) (~5 jam).
- [ ] Bikin input pencarian (Search Screen) real-time dengan loading indicator (~5 jam).
- [ ] Buat formulir Login & Register di tab Account serta simpan token ke `AsyncStorage` (~5 jam).

---

## 📌 Sprint 3: Layar Reader (Fitur Inti) & Library (Bookmark & History)

- **Durasi Kalender:** 2 Minggu (12 Hari Kerja)
- **Estimasi Jam Kerja:** ~45 Jam (Layar Reader adalah bagian tersulit, butuh ketelitian ekstra)
- **Target:** Fitur baca komik berfungsi penuh dan progres membaca user tersinkronisasi ke server.

### 🛠️ Backend (Laravel) - 15 Jam

- [ ] Buat skema migrasi tabel `bookmarks` dan `reading_history` (~5 jam).
- [ ] Buat logic API untuk menyimpan bookmark (toggle) dan meng-update progress membaca (~10 jam).

### 📱 Frontend (React Native / Expo) - 30 Jam

- [ ] **Layar Pembaca Komik (Reader):**
  - [ ] Ambil url gambar per bab komik dari API eksternal (~5 jam).
  - [ ] Render gambar memanjang ke bawah (Scroll Mode) dan tangani lag loading gambar (~10 jam).
  - [ ] Buat pop-up overlay (tap tengah layar) untuk slider halaman & tombol kembali (~5 jam).
- [ ] **Integrasi Library & Autosave:**
  - [ ] Pasang tombol Bookmark di detail komik, hubungkan dengan backend (~5 jam).
  - [ ] Buat fungsi auto-save progress ke API saat user menutup layar pembaca (~5 jam).

---

## 📌 Sprint 4: Pemolesan Reader & Sistem Komentar

- **Durasi Kalender:** 1,5 Minggu (10 Hari Kerja)
- **Estimasi Jam Kerja:** ~35 Jam
- **Target:** Menambahkan pilihan cara membaca dan fitur interaksi komentar antar pengguna.

### 🛠️ Backend (Laravel) - 15 Jam

- [ ] Buat tabel dan API endpoints untuk `comments` dan `comment_likes` (~5 jam).
- [ ] Tambahkan validasi karakter balasan (replies) dan filter filter report komentar (~10 jam).

### 📱 Frontend (React Native / Expo) - 20 Jam

- [ ] **Modifikasi Layar Reader:**
  - [ ] Tambahkan mode membaca Slide (geser horizontal) menggunakan React Native gesture handler (~8 jam).
  - [ ] Pasang pengaturan kualitas gambar (high/low) dan warna latar belakang reader (~4 jam).
- [ ] **Integrasi Fitur Komentar:**
  - [ ] Tampilkan daftar komentar di bawah detail manga & hubungkan input komentar baru ke API (~8 jam).

---

## 📌 Sprint 5: Notifikasi Chapter Baru, Edge Cases, & Bug Fixing

- **Durasi Kalender:** 1 Minggu (7 Hari Kerja)
- **Estimasi Jam Kerja:** ~25 Jam
- **Target:** Sistem notifikasi update bab baru berjalan, aplikasi stabil tanpa crash, dan siap rilis development.

### 🛠️ Backend (Laravel) - 10 Jam

- [ ] Buat sistem deteksi bab baru (`manga_updates`) dengan membandingkan chapter terakhir (~6 jam).
- [ ] Pasang middleware rate-limiting (throttle) pada endpoint sensitif (login/register) (~4 jam).

### 📱 Frontend (React Native / Expo) - 15 Jam

- [ ] Pasang dot merah notifikasi di UI Library jika ada komik yang memiliki chapter baru belum terbaca (~5 jam).
- [ ] Uji coba jaringan: Tangani crash jika koneksi internet terputus mendadak (offline handling) (~5 jam).
- [ ] Lakukan pengetesan manual menyeluruh sesuai [QA_Checklist_Komikam.md](file:///g:/Project/komikam/QA_Checklist_Komikam.md) dan perbaiki bug minor (~5 jam).

---

## 💡 Tips untuk Programmer Normal agar Selesai Tepat Waktu:

1. **Gunakan Boilerplate & UI Library:** Jangan bikin tombol, modal, atau input teks dari nol. Gunakan library UI bawaan React Native atau pustaka ikon Expo.
2. **Jangan Terjebak Styling Terlalu Lama:** Buat fungsionalitas aplikasinya jalan dulu, perbaikan warna dan posisi layout bisa menyusul di sela-sela waktu luang.
3. **Uji Langsung di Device Asli:** Tes menggunakan Expo Go di HP Anda sejak awal Sprint 2. Kadang tampilan di emulator berbeda dengan layar HP asli.
