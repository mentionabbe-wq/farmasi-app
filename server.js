require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const { read } = require('./src/db')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(express.static(path.join(__dirname, 'public')))
app.use('/uploads', express.static(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads')))

// ── AUTH GATE ── semua /api butuh login, kecuali login/register
function authFromToken(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return null
  const s = read('sessions').find(x => x.token === token)
  if (!s) return null
  const u = read('users').find(x => x.username === s.username)
  return u ? { username: u.username, nama: u.nama } : null
}
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next()
  req.authUser = authFromToken(req)
  if (req.path === '/api/auth/login' || req.path === '/api/auth/register') return next()
  if (!req.authUser) return res.status(401).json({ error: 'Silakan login dulu' })
  next()
})

app.use('/api/auth',     require('./src/routes/auth'))
app.use('/api/anggaran',  require('./src/routes/anggaran'))
app.use('/api/pembelian', require('./src/routes/pembelian'))
app.use('/api/po',        require('./src/routes/po'))
app.use('/api/realisasi', require('./src/routes/realisasi'))
app.use('/api/penerimaan',require('./src/routes/penerimaan'))
app.use('/api/barang',    require('./src/routes/barang'))
app.use('/api/petugas',   require('./src/routes/petugas'))
app.use('/api/principle', require('./src/routes/principle'))
app.use('/api/hutang-obat', require('./src/routes/hutangobat'))
app.use('/api/obat-belum',  require('./src/routes/obatbelum'))
app.use('/api/bpjs-prb',    require('./src/routes/bpjsprb'))
app.use('/api/bpjs-alkes',  require('./src/routes/bpjsalkes'))
app.use('/api/bpjs-iterasi',require('./src/routes/bpjsiterasi'))
app.use('/api/pinjaman',  require('./src/routes/pinjaman'))
app.use('/api/mutasi',    require('./src/routes/mutasi'))
app.use('/api/permintaan',require('./src/routes/permintaan'))
app.use('/api/penjualan', require('./src/routes/penjualan'))
app.use('/api/arsip',     require('./src/routes/arsip'))
app.use('/api/tujuan',    require('./src/routes/tujuan'))
app.use('/api/kategori',  require('./src/routes/kategori'))
app.use('/api/rekap',     require('./src/routes/rekap'))
app.use('/api/settings',  require('./src/routes/settings'))
app.use('/api/tidak-datang', require('./src/routes/tidakdatang'))
app.use('/api/kat-arsip',   require('./src/routes/katarsip'))
app.use('/api/supplier',    require('./src/routes/supplier'))
app.use('/api/stok-opname', require('./src/routes/stokopname'))

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')))

app.listen(PORT, '0.0.0.0', () => console.log(`Farmasi App → http://localhost:${PORT}`))
