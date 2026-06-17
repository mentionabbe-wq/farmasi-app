# Aplikasi Catatan Harian Farmasi

Aplikasi web untuk pencatatan harian instalasi farmasi rumah sakit — anggaran, pembelian, mutasi stok, penjualan, arsip dokumen, dan rekap Excel.

---

## Fitur

| Menu | Fungsi |
|------|--------|
| **Anggaran** | Input & pantau anggaran per periode dengan progress terpakai/sisa |
| **Pembelian** | Catat pembelian obat/alkes, terhubung ke anggaran |
| **Mutasi** | Mutasi stok dari gudang ke farmasi ranap/ralan (tujuan dapat ditambah) |
| **Penjualan** | Input resep & nominal per kategori (BPJS, Umum, Asuransi — dapat dikustomisasi) |
| **Arsip** | Upload & kelola dokumen (SPO, kronologi, laporan, SK) |
| **Rekap** | Ringkasan semua data + **download Excel** |

---

## Instalasi

### Cara 1 — CasaOS (paling mudah)

1. Buka CasaOS → **App Store** → **Custom Install**
2. Paste URL berikut:
   ```
   https://raw.githubusercontent.com/mentionabbe-wq/farmasi-app/main/docker-compose.casaos.yml
   ```
3. Klik **Install** → tunggu download selesai
4. Buka di browser: `http://<ip-casaos>:3000`

> Data tersimpan otomatis di `/DATA/AppData/farmasi-app/` dan tidak hilang saat update.

---

### Cara 2 — Docker Compose

```bash
git clone https://github.com/mentionabbe-wq/farmasi-app.git
cd farmasi-app
docker compose up -d
```

Buka: **http://localhost:3000**

---

### Cara 3 — Node.js langsung

```bash
git clone https://github.com/mentionabbe-wq/farmasi-app.git
cd farmasi-app
npm install
cp .env.example .env
npm start
```

Buka: **http://localhost:3000**

---

### Cara 4 — Railway / Render (cloud gratis)

1. Fork repo ini ke akun GitHub Anda
2. Buat project baru di [Railway](https://railway.app) atau [Render](https://render.com)
3. Hubungkan ke repo → deploy otomatis

---

## Stack Teknologi

- **Backend**: Node.js + Express.js
- **Database**: JSON file storage (tanpa instalasi database)
- **Frontend**: Vanilla HTML/CSS/JS (SPA)
- **File upload**: Multer
- **Excel export**: SheetJS (xlsx)
- **Container**: Docker multi-arch (amd64 + arm64)

---

## API Endpoints

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET/POST/DELETE | `/api/anggaran` | Anggaran periode |
| GET/POST/DELETE | `/api/pembelian` | Data pembelian |
| GET/POST/DELETE | `/api/mutasi` | Mutasi stok |
| GET/POST/DELETE | `/api/penjualan` | Penjualan harian |
| GET/POST/DELETE | `/api/arsip` | Arsip + upload file |
| GET/POST/DELETE | `/api/tujuan` | Kelola tujuan mutasi |
| GET/POST/DELETE | `/api/kategori` | Kelola kategori penjualan |
| GET | `/api/rekap/summary` | Ringkasan rekap |
| GET | `/api/rekap/excel` | Download Excel |

---

## Struktur Folder

```
farmasi-app/
├── server.js                 ← Express server
├── src/
│   ├── db.js                 ← JSON file storage
│   └── routes/               ← API route handlers
├── public/
│   ├── index.html            ← SPA frontend
│   ├── css/style.css
│   └── js/
│       ├── api.js            ← fetch wrapper
│       └── app.js            ← UI logic
├── data/                     ← JSON data files (auto-dibuat)
├── uploads/                  ← File arsip yang diupload
├── Dockerfile
├── docker-compose.yml        ← Untuk development lokal
└── docker-compose.casaos.yml ← Untuk instalasi CasaOS
```

---

## Environment Variables

| Variable | Default | Keterangan |
|----------|---------|------------|
| `PORT` | `3000` | Port server |
| `DATA_DIR` | `./data` | Direktori data JSON |
| `UPLOAD_DIR` | `./uploads` | Direktori file upload |
| `MAX_FILE_SIZE` | `10485760` | Ukuran maks file (10MB) |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |
