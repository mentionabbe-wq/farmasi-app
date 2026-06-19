const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => res.json(read('kat_arsip')))

router.post('/', (req, res) => {
  const { label } = req.body
  if (!label) return res.status(400).json({ error: 'label wajib diisi' })
  const data = read('kat_arsip')
  if (data.find(k => k.label.toLowerCase() === label.toLowerCase())) return res.status(400).json({ error: 'Kategori sudah ada' })
  const item = { id: `ka_${Date.now()}`, label, is_default: false }
  data.push(item)
  write('kat_arsip', data)
  res.status(201).json(item)
})

router.delete('/:id', (req, res) => {
  const data = read('kat_arsip')
  const item = data.find(d => d.id === req.params.id)
  if (item?.is_default) return res.status(400).json({ error: 'Kategori default tidak bisa dihapus' })
  write('kat_arsip', data.filter(d => d.id !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
