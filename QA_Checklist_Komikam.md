# Dokumen Quality Assurance (QA) Komikam

**Rencana Pengujian, Skenario, & Checklist Fungsional**
Dokumen ini berisi panduan skenario pengujian untuk **Komikam** di sisi Backend REST API (Laravel) dan Frontend Mobile App (React Native/Expo).

---

## 1. Skenario Pengujian API Backend

### A. Modul Autentikasi (Auth)

| Fitur         | Method & Endpoint         | Parameter Input             | Ekspektasi Hasil / Validasi                                                                                                                                        |
| :------------ | :------------------------ | :-------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Register**  | `POST /api/auth/register` | `name`, `email`, `password` | **Sukses (201):** Akun terbuat, mengembalikan token & data user.<br>**Gagal (422):** Jika email duplikat atau password < 8 karakter/tanpa huruf besar-kecil-angka. |
| **Login**     | `POST /api/auth/login`    | `email`, `password`         | **Sukses (200):** Token didapat, menghapus token sesi lama (single device session).<br>**Gagal (401):** Jika kredensial salah.                                     |
| **Logout**    | `POST /api/auth/logout`   | _Bearer Token_              | **Sukses (200):** Token Sanctum dihapus dari database server.                                                                                                      |
| **Profil Me** | `GET /api/auth/me`        | _Bearer Token_              | **Sukses (200):** Mengembalikan data profil (ID, nama, email) user aktif.                                                                                          |

### B. Modul Bookmarks

| Fitur        | Method & Endpoint                 | Parameter Input                  | Ekspektasi Hasil / Validasi                                                                            |
| :----------- | :-------------------------------- | :------------------------------- | :----------------------------------------------------------------------------------------------------- |
| **Get List** | `GET /api/bookmarks`              | _Bearer Token_                   | **Sukses (200):** Mengembalikan array daftar bookmark komik user (urut terbaru).                       |
| **Toggle**   | `POST /api/bookmarks`             | `manga_id`, `title`, `cover_url` | **Sukses (201/200):** Menambah bookmark baru jika belum ada, atau menghapusnya jika sudah di-bookmark. |
| **Check**    | `GET /api/bookmarks/{mangaId}`    | _Bearer Token_                   | **Sukses (200):** Mengembalikan boolean status status bookmark `{ "bookmarked": true/false }`.         |
| **Delete**   | `DELETE /api/bookmarks/{mangaId}` | _Bearer Token_                   | **Sukses (200):** Menghapus bookmark komik spesifik.                                                   |

### C. Modul Riwayat Membaca (Reading History)

- **Upsert History (`PUT /api/history/{mangaId}`)**
  - **Input:** `chapter_id`, `chapter_number`, `page_index`, `total_pages`, `manga_title`, `cover_url`
  - **Ekspektasi (200):** Riwayat membaca berhasil disimpan/diperbarui.
- **Get History (`GET /api/history`)**
  - **Ekspektasi (200):** Mengembalikan array riwayat membaca diurutkan berdasarkan update terbaru.
- **Clear History (`DELETE /api/history`)**
  - **Ekspektasi (200):** Menghapus salah satu atau seluruh riwayat membaca milik user.

### D. Modul Pengaturan (Settings)

- **Get Settings (`GET /api/settings`)** -> Mengambil konfigurasi visual user.
- **Patch Settings (`PATCH /api/settings`)**
  - **Input:** `reader_image_quality` (high/low), `reader_bg` (black/dark/white), `theme_mode` (light/dark/system), `reading_mode` (scroll/slide).
  - **Ekspektasi (200):** Setelan ter-update. Nilai di luar daftar di atas akan ditolak otomatis (422).

### E. Modul Update Chapter (Manga Updates)

- **Check Update (`POST /api/updates/check`)**
  - **Input:** `manga_id`, `chapter_number`
  - **Logika:** Jika `chapter_number` input > `last_seen_chapter_number` di DB, backend memicu notifikasi update pending (`has_new_chapter: true`).
- **Get Pending (`GET /api/updates/pending`)** -> Menampilkan daftar update chapter terbaru yang belum dibaca.
- **Dismiss (`DELETE /api/updates/{mangaId}`)** -> Menandai update bab tertentu telah dibaca.

### F. Modul Komentar (Comments)

- **Get Comments (`GET /api/comments/{mangaId}`)** -> Mengambil komentar manga terpaginasi (sortir `latest` atau `popular`).
- **Post Comment & Reply (`POST`)**
  - **Validasi:** Panjang isi komentar murni maksimal 200 karakter (mengabaikan prefix mention `@username `).
- **Like Comment (`POST /api/comments/{commentId}/like`)** -> Toggle status like (+1 / -1).
- **Report Comment (`POST /api/comments/{commentId}/report`)** -> Mengubah status menjadi `reported` dan menyembunyikannya dari list publik.

---

## 2. Skenario Pengujian Mobile App Frontend

- **UI-BOOT:** Transisi lancar Splash Screen menuju Home tab diikuti Haptic getaran halus.
- **UI-HOME:** Menampilkan banner gradien terpopuler & list komik menggunakan `expo-image` (mencegah kedipan gambar).
- **UI-SEARCH:** Mengetik pencarian manga, menampilkan indikator loading, dan menangani state "Manga tidak ditemukan".
- **UI-LIBRARY:** Navigasi tab Bookmarks vs History secara instan. Otomatis sinkronisasi dengan server begitu user login.
- **UI-READER:** Tap area tengah layar untuk memicu menu bar, swipe kiri-kanan (Slide) atau scroll bawah (Scroll), serta ganti chapter (prev/next).
- **UI-SETTINGS:** Mengganti tema gelap/terang secara dinamis pada runtime tanpa lag atau crash.

---

## 3. Pengujian Edge Cases & Keamanan

> [!IMPORTANT]
> **API Throttle (Rate Limiting)**
> Endpoint `register` dan `login` diproteksi middleware throttle (maksimal 5 request per 1 menit). Request ke-6 wajib diblokir dengan status HTTP 429.
> [!WARNING]
> **Offline Fallback**
> Ketika koneksi internet dinonaktifkan (Airplane mode), aplikasi tidak boleh force-close. Harus menampilkan pesan informasi offline secara aman.
> [!CAUTION]
> **Sanitasi Komentar (XSS/SQLi)**
> Input tag HTML/JS (misal: `<script>alert('xss')</script>`) pada kolom komentar harus disanitasi di backend dan ditampilkan berupa teks murni (bukan dijalankan) di aplikasi.

---

## 4. Lembar Checklist Pengujian Manual

### 1. Autentikasi & Akun

- [ ] Register berhasil menggunakan email unik & password kuat.
- [ ] Register ditolak jika email duplikat atau password lemah.
- [ ] Login sukses dengan email terdaftar & Login ditolak jika password salah.
- [ ] Halaman akun menampilkan profil pengguna ter-otentikasi.
- [ ] Logout membersihkan token sesi lokal & server secara permanen.

### 2. Penjelajahan & Pembaca Komik (Reader)

- [ ] Layar Home berhasil memuat grid komik dengan cover yang rapi.
- [ ] Cari manga responsif terhadap input ketik.
- [ ] Membuka Reader berhasil memuat seluruh gambar chapter.
- [ ] Mengubah mode baca (Scroll / Slide) dan kualitas gambar di Reader.
- [ ] Pindah chapter (sebelumnya / berikutnya) berjalan lancar.

### 3. Perpustakaan & Riwayat (Library)

- [ ] Menambahkan bookmark manga -> manga muncul di tab Bookmarks.
- [ ] Membaca bab komik -> progress tersimpan otomatis di latar belakang (autosave).
- [ ] Tombol "Lanjutkan Membaca" membuka halaman terakhir dengan tepat.
- [ ] Menghapus riwayat membaca berhasil ter-update.

### 4. Fitur Sosial & Interaksi (Komentar)

- [ ] Membuka daftar komentar manga & memposting komentar baru.
- [ ] Membalas komentar (Reply) pengguna lain dengan mention username.
- [ ] Menyukai komentar (Like/Unlike toggle) memengaruhi jumlah counter.
- [ ] Melaporkan komentar kasar -> komentar disembunyikan dari list publik.

### 5. Keamanan & Sistem

- [ ] Berpindah tema gelap (dark mode) & terang (light mode) secara real-time.
- [ ] Uji coba login berulang kali berturut-turut memicu rate-limit (HTTP 429).
- [ ] Matikan koneksi internet -> aplikasi menampilkan pesan fallback offline secara aman.
