const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  res.json(read('supplier').sort((a, b) => a.nama.localeCompare(b.nama)))
})

router.post('/', (req, res) => {
  const { nama } = req.body
  if (!nama) return res.status(400).json({ error: 'nama supplier wajib diisi' })
  const data = read('supplier')
  if (data.find(s => s.nama.toLowerCase() === nama.toLowerCase())) return res.status(400).json({ error: 'Supplier sudah ada' })
  const item = { id: `sup_${Date.now()}`, nama, created_at: new Date().toISOString() }
  data.push(item)
  write('supplier', data)
  res.status(201).json(item)
})

router.delete('/:id', (req, res) => {
  write('supplier', read('supplier').filter(d => d.id !== req.params.id))
  res.json({ ok: true })
})

router.put('/:id', (req, res) => {
  const { nama } = req.body
  if (!nama) return res.status(400).json({ error: 'nama supplier wajib diisi' })
  const data = read('supplier')
  const i = data.findIndex(d => d.id === req.params.id)
  if (i < 0) return res.status(404).json({ error: 'tidak ditemukan' })
  if (data.find(s => s.id !== req.params.id && s.nama.toLowerCase() === nama.toLowerCase())) return res.status(400).json({ error: 'Supplier sudah ada' })
  data[i].nama = nama
  write('supplier', data)
  res.json(data[i])
})

module.exports = router
