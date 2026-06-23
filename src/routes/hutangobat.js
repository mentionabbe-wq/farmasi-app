const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  res.json(read('hutang_obat').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id))
})

router.post('/', (req, res) => {
  const { tgl, item = '', jumlah, jumlah_pasien, ket = '' } = req.body
  if (!item) return res.status(400).json({ error: 'nama item wajib diisi' })
  const rec = {
    id: Date.now(),
    tgl: tgl || new Date().toISOString().slice(0, 10),
    item,
    jumlah: +(jumlah || 0),
    jumlah_pasien: +(jumlah_pasien || 0),
    ket,
    created_at: new Date().toISOString()
  }
  const data = read('hutang_obat')
  data.push(rec)
  write('hutang_obat', data)
  res.status(201).json(rec)
})

router.delete('/:id', (req, res) => {
  write('hutang_obat', read('hutang_obat').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
