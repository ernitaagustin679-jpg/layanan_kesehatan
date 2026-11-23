# SehatDekat — Layanan Kesehatan

SehatDekat adalah aplikasi pencarian informasi fasilitas kesehatan. Frontend memakai React dan Vite, API memakai Express, dan data disimpan di MySQL.

## Status project

Project sudah memiliki tampilan publik, pencarian dan filter fasilitas, peta, halaman detail layanan/jadwal, login admin, serta fitur admin untuk mengelola fasilitas, layanan, jadwal mingguan, dan perubahan tanggal khusus.

Project ini sebelumnya belum menyertakan skema database dasar yang dibutuhkan backend. Skrip `backend/migrations/000_initial_schema.sql` sekarang membuat tabel fasilitas, layanan, dan pengguna. Lanjutkan dengan migrasi jadwal `backend/migrations/001_operating_hours.sql`.

Belum ada data fasilitas contoh di project. Setelah aplikasi berjalan, masuk sebagai admin untuk menambahkan data yang sudah diverifikasi. Jangan gunakan alamat atau jadwal perkiraan sebagai informasi publik resmi.

## Persiapan

Pasang:

- Node.js 20.19+ atau 22.12+, beserta npm.
- MySQL Server 8.0.16+ dan MySQL command-line client (`mysql`).

Pastikan layanan MySQL sedang berjalan. Buka PowerShell pada folder project:

```powershell
Set-Location "C:\Users\ernit\Downloads\Layanan kesehatan"
```

Jalankan dua skrip SQL berikut secara berurutan. MySQL akan meminta kata sandi akun database (contohnya `root`):

```powershell
Get-Content .\backend\migrations\000_initial_schema.sql | mysql -u root -p
Get-Content .\backend\migrations\001_operating_hours.sql | mysql -u root -p
```

Skrip pertama membuat database `bpjs_kesehatan` serta tabel awal. Skrip kedua menambahkan tabel jadwal. Skrip tersebut tidak memasukkan data fasilitas atau akun admin.

## Menyiapkan environment dan akun admin

Dari folder project, salin file contoh konfigurasi:

```powershell
Copy-Item .\backend\.env.example .\backend\.env
Copy-Item .\frontend\.env.example .\frontend\.env
```

Buat secret acak untuk token admin:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Salin hasilnya, lalu buka file konfigurasi:

```powershell
notepad .\backend\.env
notepad .\frontend\.env
```

Di `backend\.env`, sesuaikan `DB_HOST`, `DB_PORT`, `DB_USER`, dan `DB_PASSWORD` dengan MySQL Anda. Tempel secret tadi ke `JWT_SECRET`. Isi `ADMIN_NAME`, `ADMIN_EMAIL`, dan `ADMIN_PASSWORD`; kata sandi admin minimal 12 karakter. Nilai awal pada `.env.example` masih kosong dan belum bisa digunakan sebagai kredensial.

`frontend\.env` biasanya dapat dibiarkan seperti contoh; alamat API default-nya `http://localhost:4000/api`. Jangan membagikan atau mengunggah file `.env`.

Buat akun admin setelah database dan kedua migrasi siap:

```powershell
Set-Location "C:\Users\ernit\Downloads\Layanan kesehatan\backend"
npm ci
npm run create-admin
```

Perintah tersebut membuat atau memperbarui akun admin dan menyimpan kata sandi dalam bentuk hash. Tidak ada kata sandi admin bawaan.

## Menjalankan website

Website memerlukan dua terminal PowerShell yang tetap terbuka.

**Terminal 1 — backend API**

```powershell
Set-Location "C:\Users\ernit\Downloads\Layanan kesehatan\backend"
npm run dev
```

API berjalan pada `http://localhost:4000`. Untuk mengecek API sekaligus koneksi database, buka `http://localhost:4000/api/health`; jika berhasil, hasilnya adalah `{"status":"ok"}`.

**Terminal 2 — frontend**

Buka terminal PowerShell baru:

```powershell
Set-Location "C:\Users\ernit\Downloads\Layanan kesehatan\frontend"
npm ci
npm run dev
```

Buka **http://localhost:5173** di browser. Klik tombol **Admin** untuk masuk dengan email dan kata sandi yang Anda isi di `backend\.env`. Jika port 5173 sedang dipakai aplikasi lain, gunakan alamat alternatif yang ditampilkan Vite di terminal. Peta memakai tile OpenStreetMap sehingga perlu koneksi internet.

Untuk menghentikan salah satu server, tekan `Ctrl+C` pada terminal server tersebut.

## Fitur

- Mencari fasilitas berdasarkan nama/alamat dan memfilter berdasarkan jenis, status, atau layanan.
- Melihat lokasi peta, alamat, telepon, layanan, status verifikasi, jam hari ini dan mingguan, serta perubahan tanggal khusus.
- Membuka petunjuk arah ke fasilitas.
- Login admin untuk menambah, mengubah, dan menghapus fasilitas serta mengelola layanan dan jadwal.
- Tampilan responsif untuk layar komputer maupun ponsel.

## Pemeriksaan sebelum digunakan

Build frontend dapat diperiksa dari folder `frontend`:

```powershell
npm run build
```

Informasi lokasi, layanan, status, dan jam operasional perlu diperiksa kebenarannya sebelum dipublikasikan.
