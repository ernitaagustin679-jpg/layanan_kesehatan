# SehatDekat — Layanan Kesehatan

SehatDekat adalah aplikasi pencarian informasi fasilitas kesehatan. Frontend memakai React dan Vite, API memakai Express, dan data disimpan di MySQL.

## Status project

Project memiliki beranda publik dengan pencarian dan peta fasilitas, ringkasan layanan, informasi dan artikel kesehatan, serta tautan WhatsApp. Dashboard admin mengelola fasilitas, jadwal, konten, akun pengguna, dan pengaturan website.

Project ini sebelumnya belum menyertakan skema database dasar yang dibutuhkan backend. Skrip `backend/migrations/000_initial_schema.sql` membuat tabel fasilitas, layanan, dan pengguna. Lanjutkan berurutan dengan migrasi jadwal `backend/migrations/001_operating_hours.sql`, pengaturan/konten website `backend/migrations/002_site_content.sql`, dan tiga fasilitas Pangkalpinang `backend/migrations/003_pangkalpinang_facilities.sql`.

Migrasi fasilitas menambahkan RSUD Depati Hamzah, RSU Mitra Medika Pangkalpinang, dan Primaya Hospital Bhakti Wara berdasarkan daftar lokasi publik. Statusnya tetap **Perlu Verifikasi** sampai layanan dan jam operasional dikonfirmasi; tinjau alamat dan titik peta sebelum menandainya aktif.

## Persiapan

Pasang:

- Node.js 20.19+ atau 22.12+, beserta npm.
- MySQL Server 8.0.16+. MySQL command-line client (`mysql`) hanya diperlukan jika migrasi dijalankan manual.

Pastikan layanan MySQL sedang berjalan. Buka PowerShell pada folder project:

```powershell
Set-Location "C:\Users\ernit\Downloads\Layanan kesehatan"
```

Secara default, backend membuat database yang ditentukan oleh `DB_NAME` bila belum ada, lalu menerapkan migrasi `000` sampai `003` berurutan saat API dimulai atau saat `npm run create-admin` dijalankan. Nama migrasi yang sudah diterapkan dicatat di tabel `schema_migrations`, jadi restart berikutnya tidak mengulang perubahan. Proses ini menambahkan tabel dan data awal tanpa menghapus data yang ada.

Akun MySQL di `backend\.env` perlu izin membuat database jika belum ada serta membuat/mengubah tabel dan menambah data. Jika akun database tidak memiliki izin tersebut, jalankan skrip berikut secara manual memakai akun database berizin. MySQL akan meminta kata sandi akun database:

```powershell
Get-Content .\backend\migrations\000_initial_schema.sql | mysql -u root -p
Get-Content .\backend\migrations\001_operating_hours.sql | mysql -u root -p
Get-Content .\backend\migrations\002_site_content.sql | mysql -u root -p
Get-Content .\backend\migrations\003_pangkalpinang_facilities.sql | mysql -u root -p
```

Skrip pertama membuat database `bpjs_kesehatan` serta tabel awal. Skrip kedua menambahkan tabel jadwal. Skrip ketiga menambahkan pengaturan situs dan konten informasi/artikel awal, termasuk nomor WhatsApp `081373418699`. Skrip keempat menambahkan tiga fasilitas awal dengan status **Perlu Verifikasi**. Skrip migrasi tidak membuat akun admin.

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

Buat akun admin setelah mengisi `backend\.env`:

```powershell
Set-Location "C:\Users\ernit\Downloads\Layanan kesehatan\backend"
npm ci
npm run create-admin
```

Perintah tersebut menjalankan migrasi yang belum diterapkan, lalu membuat atau memperbarui akun admin dan menyimpan kata sandi dalam bentuk hash. Tidak ada kata sandi admin bawaan.

## Menjalankan website

Website memerlukan dua terminal PowerShell yang tetap terbuka.

**Terminal 1 — backend API**

```powershell
Set-Location "C:\Users\ernit\Downloads\Layanan kesehatan\backend"
npm run dev
```

API menerapkan migrasi dan menguji koneksi database sebelum mulai mendengarkan pada `http://localhost:4000`. Jika koneksi atau migrasi gagal, backend menampilkan error di terminal dan tidak mulai melayani request. Untuk mengecek API sekaligus koneksi database, buka `http://localhost:4000/api/health`; jika berhasil, hasilnya adalah `{"status":"ok"}`.

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
- Beranda menampilkan ringkasan layanan fasilitas aktif, informasi kesehatan, artikel, dan tautan WhatsApp.
- Dashboard admin dapat mengelola akun admin/masyarakat, menerbitkan atau menyimpan draf konten, dan mengubah nama, tagline, deskripsi beranda, serta nomor WhatsApp.
- Tiga fasilitas awal Pangkalpinang tersedia di peta; verifikasi rincian dan jam operasional melalui dashboard sebelum mengubah statusnya menjadi aktif.
- Tampilan responsif untuk layar komputer maupun ponsel.

## Pemeriksaan sebelum digunakan

Build frontend dapat diperiksa dari folder `frontend`:

```powershell
npm run build
```

Informasi lokasi, layanan, status, dan jam operasional perlu diperiksa kebenarannya sebelum dipublikasikan.
