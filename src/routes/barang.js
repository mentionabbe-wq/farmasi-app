const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  res.json(read('barang').sort((a, b) => a.nama.localeCompare(b.nama)))
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

module.exports = router
