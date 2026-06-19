const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  let data = read('stok_opname')
  if (req.query.dari) data = data.filter(d => d.tgl >= req.query.dari)
  if (req.query.sampai) data = data.filter(d => d.tgl <= req.query.sampai)
  if (req.query.ruangan) data = data.filter(d => d.ruangan === req.query.ruangan)
  data.sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
  res.json(data)
})

router.post('/', (req, res) => {
  const { tgl, ruangan = '', nilai_sebelum, nilai_sesudah, ket = '' } = req.body
  const sb = +(nilai_sebelum || 0), ss = +(nilai_sesudah || 0)
  const item = { id: Date.now(), tgl: tgl || new Date().toISOString().slice(0, 10), ruangan, nilai_sebelum: sb, nilai_sesudah: ss, selisih: ss - sb, ket, created_at: new Date().toISOString() }
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
