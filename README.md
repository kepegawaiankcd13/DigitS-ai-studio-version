# DigitS - AI Studio Version

> **Sistem Informasi Penomoran Surat, Surat Masuk, Buku Tamu & Transaksi Berkas**  
> Cabang Dinas Pendidikan Wilayah XIII Provinsi Jawa Barat (Kabupaten Ciamis, Kota Banjar, Kabupaten Pangandaran).

---

## 💻 Panduan Menjalankan di Mac (MySQL)

Aplikasi ini sudah dilengkapi dengan **Dual-Mode Database Engine**:
- Di komputer **Mac Anda**, aplikasi akan langsung terhubung ke database **MySQL lokal** (`127.0.0.1:3306`).
- Di lingkungan **Google AI Studio (Cloud)**, jika MySQL tidak aktif, aplikasi otomatis beralih ke mode *standalone in-memory* sehingga tidak pernah crash.

### 1. Persiapan Database di Mac (XAMPP / MAMP / Homebrew MySQL)
1. Pastikan service MySQL di Mac Anda sudah berjalan (misal via XAMPP/MAMP atau `brew services start mysql`).
2. Buat database bernama `db_nomor_surat` di MySQL/phpMyAdmin:
   ```sql
   CREATE DATABASE IF NOT EXISTS db_nomor_surat;
   ```
3. Import file database yang sudah disediakan (`db_nomor_surat.sql`):
   ```bash
   mysql -u root -p db_nomor_surat < db_nomor_surat.sql
   ```

### 2. Konfigurasi Lingkungan (`.env`)
Salin atau buat file `.env` di folder proyek Anda:
```env
PORT=3000
NODE_ENV=development

# Sesuaikan dengan pengaturan MySQL di Mac Anda
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=db_nomor_surat
DB_USER=root
DB_PASS=
```
*(Catatan: Gunakan `127.0.0.1` daripada `localhost` untuk menghindari konflik IPv6 di macOS).*

### 3. Jalankan Aplikasi di Mac
```bash
# 1. Install dependencies
npm install

# 2. Jalankan server pengembang
npm run dev
# atau
npm start
```
Buka browser di: **`http://localhost:3000`**

---

## 🏛️ Fitur Lengkap Aplikasi

1. **Nomor Surat Keluar (Penomoran Naskah Dinas)**:
   - Format standar Jawa Barat: `[No Urut]/[Kode Klasifikasi]/KCD XIII`
   - Fitur **Booking Nomor** untuk memesan nomor urut terlebih dahulu
   - Unggah berkas dokumen surat PDF
   - Ekspor agenda nomor surat ke format Excel (`.xlsx`)

2. **Buku Agenda Surat Masuk & Lembar Disposisi**:
   - Pencatatan dokumen surat masuk (tgl terima, tgl surat, nomor surat, pengirim, perihal, urgensi, dan sifat)
   - Pembaca dokumen PDF langsung dari arsip digital
   - Lembar Disposisi pimpinan (tujuan pejabat, instruksi, dan catatan tindak lanjut)
   - **Cetak Lembar Disposisi Resmi** siap cetak dengan Kop Surat Dinas Pendidikan Jabar KCD XIII
   - Ekspor agenda surat masuk ke Excel

3. **Buku Tamu Front Office**:
   - Registrasi pengunjung (nama, NIP, jabatan, pekerjaan, asal unit kerja/sekolah, no kontak)
   - Tombol pintas kirim pesan / kontak WhatsApp langsung
   - Riwayat berkas yang pernah diserahkan oleh setiap tamu

4. **Transaksi Penyerahan Berkas Tamu**:
   - Penerimaan berkas fisik dari tamu untuk berbagai bidang (Kepegawaian, SMA, SMK, PKLK, Aset, Keuangan)
   - **Cetak Bukti Tanda Terima Berkas** resmi ukuran A5 landscape untuk tamu

5. **Kode Klasifikasi Arsip**:
   - Lebih dari 5.400+ kode klasifikasi surat dinas (Permendagri / Arsip Jabar) dengan pencarian instan dan pagination

6. **Manajemen Pengguna (Administrator)**:
   - Tambah, ubah data, atur role/hak akses pengguna, dan ganti password

---

## 🔑 Akun Bawaan

| Username | Password | Role | Nama Lengkap |
| :--- | :--- | :--- | :--- |
| `admin` | `123` | Administrator | Nira Kania Putri R |
| `lisna` | `lisna123` | Front Office | Lisna Nurhasanah P |
| `user2` | `123` | Persuratan | Lukman |
