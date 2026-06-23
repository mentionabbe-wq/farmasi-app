const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  const { no_po } = req.query
  let data = read('realisasi').sort((a, b) => (b.tgl_po || '').localeCompare(a.tgl_po || '') || b.id - a.id)
  if (no_po) data = data.filter(d => d.no_po === no_po)
  res.json(data)
})

router.post('/', (req, res) => {
  const { no_po = '', tgl_po, barang = '', jumlah, harga_satuan } = req.body
  if (!no_po) return res.status(400).json({ error: 'No PO wajib diisi' })
  if (!barang) return res.status(400).json({ error: 'nama barang wajib diisi' })
  const j = +(jumlah || 0), h = +(harga_satuan || 0)
  const item = {
    id: Date.now(),
    no_po,
    tgl_po: tgl_po || new Date().toISOString().slice(0, 10),
    barang,
    jumlah: j,
    harga_satuan: h,
    harga_total: j * h,
    created_at: new Date().toISOString()
  }
  const data = read('realisasi')
  data.push(item)
  write('realisasi', data)
  res.status(201).json(item)
})

router.delete('/:id', (req, res) => {
  write('realisasi', read('realisasi').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
