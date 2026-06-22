const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  const { dari, sampai, bulan, ruangan, kategori } = req.query
  let data = read('stok_opname')
  if (bulan) data = data.filter(d => d.tgl.slice(0, 7) === bulan)
  else {
    if (dari) data = data.filter(d => d.tgl >= dari)
    if (sampai) data = data.filter(d => d.tgl <= sampai)
  }
  if (ruangan) data = data.filter(d => d.ruangan === ruangan)
  if (kategori) data = data.filter(d => d.kategori === kategori)
  data.sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
  res.json(data)
})

router.post('/', (req, res) => {
  const { tgl, kategori = '', ruangan = '', nilai_sebelum, nilai_sesudah, ket = '' } = req.body
  const sb = +(nilai_sebelum || 0), ss = +(nilai_sesudah || 0)
  const item = { id: Date.now(), tgl: tgl || new Date().toISOString().slice(0, 10), kategori, ruangan, nilai_sebelum: sb, nilai_sesudah: ss, selisih: ss - sb, ket, created_at: new Date().toISOString() }
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
