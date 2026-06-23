const router = require('express').Router()
const { read, write } = require('../db')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  }
})
const upload = multer({
  storage,
  limits: { fileSize: +(process.env.MAX_FILE_SIZE || 10485760) },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png']
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()))
  }
})

router.get('/', (req, res) => {
  res.json(read('obat_belum').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id))
})

router.post('/', upload.array('resep', 5), (req, res) => {
  const { tgl, pasien = '', obat = '', ket = '' } = req.body
  if (!pasien) return res.status(400).json({ error: 'nama pasien wajib diisi' })
  if (!obat) return res.status(400).json({ error: 'nama obat wajib diisi' })
  const files = (req.files || []).map(f => ({ filename: f.filename, originalname: f.originalname, size: f.size }))
  const rec = {
    id: Date.now(),
    tgl: tgl || new Date().toISOString().slice(0, 10),
    pasien, obat, ket, files,
    created_at: new Date().toISOString()
  }
  const data = read('obat_belum')
  data.push(rec)
  write('obat_belum', data)
  res.status(201).json(rec)
})

router.delete('/:id', (req, res) => {
  const data = read('obat_belum')
  const item = data.find(d => String(d.id) === req.params.id)
  if (item) (item.files || []).forEach(f => { try { fs.unlinkSync(path.join(UPLOAD_DIR, f.filename)) } catch {} })
  write('obat_belum', data.filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
