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
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()))
  }
})

router.get('/', (req, res) => {
  res.json(read('bpjs_alkes').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id))
})

router.post('/', upload.array('dok', 5), (req, res) => {
  const { tgl, pasien = '', no_rm = '', jenis = '', jumlah, ket = '' } = req.body
  if (!pasien) return res.status(400).json({ error: 'nama pasien wajib diisi' })
  const t = tgl || new Date().toISOString().slice(0, 10)
  const files = (req.files || []).map(f => ({ filename: f.filename, originalname: f.originalname, size: f.size }))
  const rec = {
    id: Date.now(), dibuat_oleh: (req.authUser && req.authUser.nama) || '',
    tgl: t, pasien, no_rm, jenis, jumlah: +(jumlah || 0), ket, files,
    created_at: new Date().toISOString()
  }
  const data = read('bpjs_alkes')
  data.push(rec)
  write('bpjs_alkes', data)

  // Dokumen otomatis masuk ke Arsip
  if (files.length) {
    const arsip = read('arsip')
    arsip.push({
      id: Date.now() + 1,
      judul: `Alkes BPJS - ${pasien}${jenis ? ' (' + jenis + ')' : ''}`,
      kat: 'Alkes BPJS',
      tgl: t,
      no: no_rm,
      deskripsi: `Alkes BPJS jenis ${jenis || '-'}, jumlah ${+(jumlah || 0)}` + (ket ? `. ${ket}` : ''),
      files,
      created_at: new Date().toISOString()
    })
    write('arsip', arsip)
  }

  res.status(201).json(rec)
})

router.delete('/:id', (req, res) => {
  // Hapus record alkes saja; file dikelola lewat menu Arsip
  write('bpjs_alkes', read('bpjs_alkes').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
