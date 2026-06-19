const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  let data = read('stok_opname')
  if (req.query.bulan) data = data.filter(d => d.tgl.startsWith(req.query.bulan))
  data.sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
  res.json(data)
})

router.post('/', (req, res) => {
  const { tgl, nama, satuan = '', stok_sistem, stok_fisik, ket = '' } = req.body
  if (!nama) return res.status(400).json({ error: 'nama item wajib diisi' })
  const ss = +(stok_sistem || 0), sf = +(stok_fisik || 0)
  const item = { id: Date.now(), tgl: tgl || new Date().toISOString().slice(0, 10), nama, satuan, stok_sistem: ss, stok_fisik: sf, selisih: sf - ss, ket, created_at: new Date().toISOString() }
  const data = read('stok_opname')
  data.push(item)
  write('stok_opname', data)
  res.status(201).json(item)
})

router.delete('/:id', (req, res) => {
  write('stok_opname', read('stok_opname').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
