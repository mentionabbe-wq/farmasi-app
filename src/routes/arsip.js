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
    const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png']
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()))
  }
})

router.get('/', (req, res) => {
  const { kat, dari, sampai } = req.query
  let data = read('arsip').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
  if (kat)    data = data.filter(d => d.kat === kat)
  if (dari)   data = data.filter(d => d.tgl >= dari)
  if (sampai) data = data.filter(d => d.tgl <= sampai)
  res.json(data)
})

router.post('/', upload.array('files', 10), (req, res) => {
  const { judul, kat, tgl, no = '', deskripsi = '' } = req.body
  if (!judul || !kat || !tgl) return res.status(400).json({ error: 'judul, kat, tgl wajib diisi' })
  const files = (req.files || []).map(f => ({ filename: f.filename, originalname: f.originalname, size: f.size }))
  const item = { id: Date.now(), judul, kat, tgl, no, deskripsi, files, created_at: new Date().toISOString() }
  const data = read('arsip')
  data.push(item)
  write('arsip', data)
  res.status(201).json(item)
})

router.delete('/:id', (req, res) => {
  const data = read('arsip')
  const item = data.find(d => String(d.id) === req.params.id)
  if (item) {
    (item.files || []).forEach(f => { try { fs.unlinkSync(path.join(UPLOAD_DIR, f.filename)) } catch {} })
  }
  write('arsip', data.filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
