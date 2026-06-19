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

module.exports = router
