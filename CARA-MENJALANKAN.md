# Cara Menjalankan Aplikasi Farmasi

## Persyaratan
- **Node.js v18+** — download di https://nodejs.org (pilih LTS)

---

## Langkah Pertama (sekali saja)

1. Install Node.js dari https://nodejs.org, restart terminal setelah install
2. Buka folder `farmasi-app` di terminal (cmd / PowerShell)
3. Jalankan perintah berikut:

```
npm install
copy .env.example .env
```

---

## Menjalankan Aplikasi

```
npm start
```

Lalu buka browser: **http://localhost:3000**

Untuk development (auto-restart saat file berubah):
```
npm run dev
```

---

## Deploy ke Server / VPS

### Cara 1 — Node.js langsung + PM2
```bash
npm install -g pm2
npm install
cp .env.example .env
pm2 start server.js --name farmasi-app
pm2 startup   # auto-start saat server reboot
```

### Cara 2 — Docker
```bash
docker-compose up -d
```
Buka browser: http://localhost:3000

Data tersimpan di Docker volume (tidak hilang saat container restart).

### Cara 3 — Railway / Render (gratis)
1. Push folder ini ke GitHub
2. Buat project baru di https://railway.app atau https://render.com
3. Hubungkan ke repo GitHub
4. Set environment variable: `PORT=3000`
5. Deploy otomatis — Railway/Render mendeteksi Node.js dari `package.json`

---

## Struktur File
```
farmasi-app/
├── server.js          ← titik masuk server
├── src/
│   ├── db.js          ← setup SQLite
│   └── routes/        ← API endpoints
├── public/
│   ├── index.html     ← frontend SPA
│   ├── css/style.css
│   └── js/
│       ├── api.js     ← fungsi panggil API
│       └── app.js     ← logika UI
├── data/              ← database SQLite (auto-dibuat)
├── uploads/           ← file arsip yang diupload
└── Dockerfile
```

## API Endpoints
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET/POST/DELETE | /api/anggaran | CRUD anggaran |
| GET/POST/DELETE | /api/pembelian | CRUD pembelian |
| GET/POST/DELETE | /api/mutasi | CRUD mutasi |
| GET/POST/DELETE | /api/penjualan | CRUD penjualan |
| GET/POST/DELETE | /api/arsip | CRUD arsip + upload file |
| GET/POST/DELETE | /api/tujuan | Kelola tujuan mutasi |
| GET/POST/DELETE | /api/kategori | Kelola kategori penjualan |
| GET | /api/rekap/summary | Ringkasan rekap |
| GET | /api/rekap/excel | Download Excel |
