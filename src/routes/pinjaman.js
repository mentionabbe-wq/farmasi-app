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
    id: Date.now(), dibuat_oleh: (req.authUser && req.authUser.nama) || '',
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

router.put('/:id', (req, res) => {
  const data = read('pinjaman')
  const i = data.findIndex(d => String(d.id) === req.params.id)
  if (i < 0) return res.status(404).json({ error: 'data tidak ditemukan' })
  const cur = data[i]
  const { tgl, jenis, rs, barang, jumlah, ket } = req.body
  data[i] = { ...cur, tgl: tgl ?? cur.tgl, jenis: jenis ?? cur.jenis, rs: rs ?? cur.rs, barang: barang ?? cur.barang, jumlah: jumlah ?? cur.jumlah, ket: ket ?? cur.ket }
  write('pinjaman', data)
  res.json(data[i])
})

module.exports = router
