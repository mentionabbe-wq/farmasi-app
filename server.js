require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(express.static(path.join(__dirname, 'public')))
app.use('/uploads', express.static(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads')))

app.use('/api/anggaran',  require('./src/routes/anggaran'))
app.use('/api/pembelian', require('./src/routes/pembelian'))
app.use('/api/mutasi',    require('./src/routes/mutasi'))
app.use('/api/penjualan', require('./src/routes/penjualan'))
app.use('/api/arsip',     require('./src/routes/arsip'))
app.use('/api/tujuan',    require('./src/routes/tujuan'))
app.use('/api/kategori',  require('./src/routes/kategori'))
app.use('/api/rekap',     require('./src/routes/rekap'))

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')))

app.listen(PORT, '0.0.0.0', () => console.log(`Farmasi App → http://localhost:${PORT}`))
