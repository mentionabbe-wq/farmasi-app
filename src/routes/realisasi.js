const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  const { no_po } = req.query
  let data = read('realisasi').sort((a, b) => (b.tgl_po || '').localeCompare(a.tgl_po || '') || b.id - a.id)
  if (no_po) data = data.filter(d => d.no_po === no_po)
  res.json(data)
})

router.post('/', (req, res) => {
  const { no_po = '', tgl_po, supplier = '', principle = '', anggaran = '', barang = '', jumlah, harga_satuan } = req.body
  if (!no_po) return res.status(400).json({ error: 'No PO wajib diisi' })
  if (!barang) return res.status(400).json({ error: 'nama barang wajib diisi' })
  const j = +(jumlah || 0), h = +(harga_satuan || 0)
  const item = {
    id: Date.now(), dibuat_oleh: (req.authUser && req.authUser.nama) || '',
    no_po,
    tgl_po: tgl_po || new Date().toISOString().slice(0, 10),
    supplier,
    principle,
    anggaran,
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

router.put('/:id', (req, res) => {
  const data = read('realisasi')
  const i = data.findIndex(d => String(d.id) === req.params.id)
  if (i < 0) return res.status(404).json({ error: 'data tidak ditemukan' })
  const cur = data[i]
  const { no_po, tgl_po, supplier, principle, anggaran, barang, jumlah, harga_satuan } = req.body
  const j = jumlah !== undefined ? +jumlah : cur.jumlah
  const h = harga_satuan !== undefined ? +harga_satuan : cur.harga_satuan
  data[i] = { ...cur, no_po: no_po ?? cur.no_po, tgl_po: tgl_po ?? cur.tgl_po, supplier: supplier ?? cur.supplier, principle: principle ?? cur.principle, anggaran: anggaran ?? cur.anggaran, barang: barang ?? cur.barang, jumlah: j, harga_satuan: h, harga_total: j * h }
  write('realisasi', data)
  res.json(data[i])
})

module.exports = router
