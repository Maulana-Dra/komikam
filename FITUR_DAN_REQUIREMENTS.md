# Fitur & Requirements - Komikam

## Dokumen ini menjelaskan daftar fitur lengkap yang tersedia di aplikasi **Komikam** beserta dengan spesifikasi kebutuhan teknologi (_tech stack & requirements_) yang digunakan untuk menjalankan proyek ini.

## 1. Fitur Utama Aplikasi (Core Features)

### A. Autentikasi & Akun Pengguna

- **Registrasi Akun:** Membuat akun baru menggunakan nama, email unik, dan kata sandi.
- **Login Sesi Tunggal (_Single Session_):** Masuk ke aplikasi dan mendapatkan token otentikasi. Menggunakan keamanan sesi tunggal; jika user login kembali di perangkat baru, token sesi lama otomatis dihapus dari server.
- **Profil Pengguna (_Me_):** Mengambil detail profil user aktif (ID, nama, email) secara aman.
- **Logout:** Menghapus token otentikasi dari database server.

### B. Penjelajahan & Pembacaan Komik (Manga Reader)

- **Sumber Data Komik:** Data komik dan bab diambil langsung secara real-time dari API Eksternal (`https://api.shngm.io`).
- **Mode Membaca Ganda:**
  - **Scroll Mode (Vertikal):** Menyusun gambar komik secara memanjang ke bawah (webtoon-style).
  - **Slide Mode (Horizontal):** Menggeser gambar komik ke kiri atau kanan halaman per halaman.
- **Pengaturan Reader:**
  - **Kualitas Gambar:** Memilih resolusi gambar komik (`high` atau `low`) untuk hemat kuota.
  - **Warna Latar Belakang:** Mengatur kontras layar pembaca (`black`, `dark`, atau `white`).
- **Autosave Progress Membaca:** Aplikasi mencatat secara otomatis halaman terakhir yang dibaca, nomor bab, dan jumlah halaman, lalu menyinkronkannya ke server backend.

### C. Perpustakaan & Sinkronisasi (Library)

- **Bookmarks (Favorit):** Menandai komik favorit untuk disimpan di halaman perpustakaan. Fitur toggle sekali klik.
- **Reading History (Riwayat):** Menyusun daftar komik yang pernah dibaca, diurutkan berdasarkan aktivitas membaca terbaru (_last read_).
- **Lanjutkan Membaca:** Tombol cepat yang mengarahkan pembaca langsung ke bab dan nomor halaman terakhir yang mereka tinggalkan.

### D. Notifikasi Chapter Baru (Manga Updates)

- **Deteksi Bab Baru:** Sistem membandingkan nomor bab terbaru yang dibaca dengan yang tertera di server backend.
- **Pending Updates:** Jika terdeteksi bab baru (misal bab komik bertambah), manga tersebut akan masuk ke halaman "Updates" untuk memberi tahu pengguna.
- **Dismiss Update:** Pengguna dapat menghapus tanda notifikasi update setelah selesai membaca bab baru tersebut.

### E. Sistem Sosial & Interaksi (Comments)

- **Komentar Manga:** Pengguna dapat melihat daftar komentar publik per judul komik, diurutkan berdasarkan yang "Terbaru" atau "Terpopuler" (jumlah like terbanyak).
- **Tulis Komentar & Balasan (Replies):** Menulis opini baru atau membalas komentar pengguna lain lengkap dengan mention username.
- **Pintar Menyaring Mention:** Validasi panjang komentar maksimal 200 karakter, secara otomatis mengabaikan panjang teks awalan nama pengguna `@username` (hanya menghitung panjang teks isi asli).
- **Suka Komentar (Like/Unlike Toggle):** Menyukai komentar pembaca lain untuk menaikkan popularitas komentar.
- **Laporkan Komentar (Report):** Melaporkan komentar tidak layak/kasar. Komentar berstatus `reported` disembunyikan dari daftar publik secara otomatis.

---

## 2. Requirements & Tech Stack

Aplikasi Komikam dirancang menggunakan arsitektur monorepo sederhana yang memisahkan backend server dan mobile client.

### A. Backend Server Requirements

- **Framework Utama:** Laravel 11.x / 13.x (PHP framework).
- **Bahasa Pemrograman:** PHP 8.3 atau lebih tinggi.
- **Basis Data (Database):**
  - **MySQL (Development/Production):** Menyimpan data relasional pengguna, bookmark, riwayat membaca, pengaturan, update bab, komentar, dan like komentar.
  - **SQLite In-Memory (Testing):** Digunakan otomatis untuk pengujian fungsionalitas agar unit testing berjalan cepat tanpa merusak data MySQL.
- **Otentikasi Token:** Laravel Sanctum (Bearer Token) untuk perlindungan endpoint REST API.
- **Proteksi API (Rate Limiting):** Menggunakan middleware throttle bawaan Laravel untuk membatasi request spam pada endpoint `login` dan `register` (maksimal 5 kali percobaan per menit).

### B. Frontend Mobile Client Requirements

- **Framework Utama:** React Native dengan **Expo SDK 54**.
- **Bahasa Pemrograman:** TypeScript.
- **Navigasi Layar:** Expo Router (File-based Routing seperti Next.js, menggunakan folder `app/`).
- **Penyimpanan Lokal (Offline Storage):** `@react-native-async-storage/async-storage` untuk menyimpan Bearer token secara lokal serta penanganan status offline.
- **Optimalisasi Media:** `expo-image` untuk memuat cover komik dan halaman komik secara asinkron dengan efek transisi halus (_fade-in_), guna mencegah lag layar dan menghemat penggunaan memori.
- **Haptic Feedback:** `expo-haptics` untuk memicu respon getaran fisik halus saat navigasi menu.
- **Styling UI:** Vanilla CSS/React Native StyleSheet untuk fleksibilitas performa tinggi.
