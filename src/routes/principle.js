const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  res.json(read('principle').sort((a, b) => a.nama.localeCompare(b.nama)))
})

router.post('/', (req, res) => {
  const { nama } = req.body
  if (!nama) return res.status(400).json({ error: 'nama principle wajib diisi' })
  const data = read('principle')
  if (data.find(p => p.nama.toLowerCase() === nama.toLowerCase())) return res.status(400).json({ error: 'Principle sudah ada' })
  const item = { id: `prn_${Date.now()}`, nama, created_at: new Date().toISOString() }
  data.push(item)
  write('principle', data)
  res.status(201).json(item)
})

router.put('/:id', (req, res) => {
  const { nama } = req.body
  if (!nama) return res.status(400).json({ error: 'nama principle wajib diisi' })
  const data = read('principle')
  const i = data.findIndex(d => d.id === req.params.id)
  if (i < 0) return res.status(404).json({ error: 'tidak ditemukan' })
  if (data.find(p => p.id !== req.params.id && p.nama.toLowerCase() === nama.toLowerCase())) return res.status(400).json({ error: 'Principle sudah ada' })
  data[i].nama = nama
  write('principle', data)
  res.json(data[i])
})

router.delete('/:id', (req, res) => {
  write('principle', read('principle').filter(d => d.id !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
