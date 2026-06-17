const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  res.json(read('kategori_pj').sort((a, b) => (a.urutan || 0) - (b.urutan || 0)))
})

router.post('/', (req, res) => {
  const { label } = req.body
  if (!label) return res.status(400).json({ error: 'label wajib diisi' })
  const data = read('kategori_pj')
  const item = { id: `kat_${Date.now()}`, label, is_default: false, urutan: data.length + 1 }
  data.push(item)
  write('kategori_pj', data)
  res.status(201).json(item)
})

router.delete('/:id', (req, res) => {
  const data = read('kategori_pj')
  const item = data.find(d => d.id === req.params.id)
  if (!item) return res.status(404).json({ error: 'tidak ditemukan' })
  if (item.is_default) return res.status(400).json({ error: 'kategori bawaan tidak bisa dihapus' })
  write('kategori_pj', data.filter(d => d.id !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
