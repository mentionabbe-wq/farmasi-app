const router = require('express').Router()
const { read, write } = require('../db')
const multer = require('multer')
const XLSX = require('xlsx')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

router.get('/', (req, res) => {
  res.json(read('barang').sort((a, b) => a.nama.localeCompare(b.nama)))
})

// Import banyak nama barang dari file Excel/CSV (kolom pertama = nama barang)
router.post('/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file wajib diunggah' })
  let names = []
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })
    rows.forEach(r => {
      const v = (r[0] !== undefined && r[0] !== null) ? String(r[0]).trim() : ''
      if (v) names.push(v)
    })
  } catch (e) {
    return res.status(400).json({ error: 'gagal membaca file: ' + e.message })
  }
  // buang baris header umum
  if (names.length && /^(nama|barang|nama barang|item|no)$/i.test(names[0])) names.shift()
  const data = read('barang')
  const existing = new Set(data.map(b => b.nama.toLowerCase()))
  const now = Date.now()
  let added = 0, skipped = 0
  names.forEach((nama, i) => {
    const key = nama.toLowerCase()
    if (existing.has(key)) { skipped++; return }
    existing.add(key)
    data.push({ id: `brg_${now}_${i}`, nama, created_at: new Date().toISOString() })
    added++
  })
  write('barang', data)
  res.json({ added, skipped, total: names.length })
})

router.post('/', (req, res) => {
  const { nama } = req.body
  if (!nama) return res.status(400).json({ error: 'nama barang wajib diisi' })
  const data = read('barang')
  if (data.find(b => b.nama.toLowerCase() === nama.toLowerCase())) return res.status(400).json({ error: 'Barang sudah ada' })
  const item = { id: `brg_${Date.now()}`, nama, created_at: new Date().toISOString() }
  data.push(item)
  write('barang', data)
  res.status(201).json(item)
})

router.delete('/:id', (req, res) => {
  write('barang', read('barang').filter(d => d.id !== req.params.id))
  res.json({ ok: true })
})

router.put('/:id', (req, res) => {
  const { nama } = req.body
  if (!nama) return res.status(400).json({ error: 'nama barang wajib diisi' })
  const data = read('barang')
  const i = data.findIndex(d => d.id === req.params.id)
  if (i < 0) return res.status(404).json({ error: 'tidak ditemukan' })
  if (data.find(b => b.id !== req.params.id && b.nama.toLowerCase() === nama.toLowerCase())) return res.status(400).json({ error: 'Barang sudah ada' })
  data[i].nama = nama
  write('barang', data)
  res.json(data[i])
})

module.exports = router
