const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  const { dari, sampai, bulan, jenis } = req.query
  let data = read('pinjaman').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
  if (bulan) data = data.filter(d => d.tgl.slice(0, 7) === bulan)
  else {
    if (dari) data = data.filter(d => d.tgl >= dari)
    if (sampai) data = data.filter(d => d.tgl <= sampai)
  }
  if (jenis) data = data.filter(d => d.jenis === jenis)
  res.json(data)
})

router.post('/', (req, res) => {
  const { tgl, jenis = 'pinjam', rs = '', barang = '', jumlah = '', ket = '' } = req.body
  if (!rs) return res.status(400).json({ error: 'nama RS wajib diisi' })
  if (!barang) return res.status(400).json({ error: 'nama barang wajib diisi' })
  const item = {
    id: Date.now(),
    tgl: tgl || new Date().toISOString().slice(0, 10),
    jenis,
    rs,
    barang,
    jumlah,
    ket,
    created_at: new Date().toISOString()
  }
  const data = read('pinjaman')
  data.push(item)
  write('pinjaman', data)
  res.status(201).json(item)
})

router.delete('/:id', (req, res) => {
  write('pinjaman', read('pinjaman').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
