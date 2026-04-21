# Komikam

Aplikasi baca komik berbasis Expo + React Native dengan fokus pada performa baca, penyimpanan lokal, dan navigasi sederhana.

## Fitur Utama

- Feed komik (tab `project` dan `mirror`).
- Rekomendasi berdasarkan format: manhwa, manga, manhua.
- Pencarian judul dari halaman home.
- Halaman detail manga + daftar chapter (pagination).
- Reader chapter dengan:
  - simpan progress baca otomatis,
  - resume progress,
  - prev/next chapter,
  - slider lompat halaman,
  - tap untuk show/hide controls, double tap untuk zoom.
- Bookmark + cek update chapter bookmark.
- Riwayat baca.
- Tema `light`, `dark`, `system`.
- Profil akun lokal + sync upload/download berbasis AsyncStorage.

## Tech Stack

- Expo SDK 54
- React Native 0.81
- Expo Router
- TypeScript
- AsyncStorage

## Prasyarat

- Node.js 18+ (disarankan)
- npm
- Expo Go / Android Emulator / iOS Simulator

## Menjalankan Proyek

```bash
npm install
npm run start
```

Perintah lain:

- `npm run android` menjalankan di Android
- `npm run ios` menjalankan di iOS
- `npm run web` menjalankan di web
- `npm run lint` menjalankan lint

## Struktur Folder

- `app/` route dan screen utama (Expo Router)
- `components/` komponen UI reusable
- `src/api/` client API (`shngmClient.ts`)
- `src/store/` state/persistensi lokal (bookmark, history, theme, account, updates)
- `src/theme/` theme context aplikasi
- `assets/` aset gambar/icon

## API

- Base URL: `https://api.shngm.io`
- Implementasi client: `src/api/shngmClient.ts`
- Sudah termasuk timeout, retry dengan backoff, cache memory, dan cache persist (AsyncStorage) untuk request GET.

## Persistensi Lokal

Data penting disimpan di AsyncStorage, termasuk:

- Bookmark
- Reading history/progress
- Mode tema
- Profil akun lokal
- Simulasi data cloud untuk fitur sync
- Cache respons API

## Catatan Pengembangan

- Beberapa screen detail masih mengambil metadata manga dari list endpoint (belum endpoint detail by id khusus).
- Koneksi internet dibutuhkan untuk memuat data manga/chapter terbaru.
