const router = require('express').Router()
const { read, write } = require('../db')

const filterDate = (data, dari, sampai) => data.filter(d => {
  if (dari && d.tgl < dari) return false
  if (sampai && d.tgl > sampai) return false
  return true
})

router.get('/', (req, res) => {
  const { dari, sampai, anggaran } = req.query
  let data = read('pembelian').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
  data = filterDate(data, dari, sampai)
  if (anggaran) data = data.filter(d => d.anggaran === anggaran)
  res.json(data)
})

router.post('/', (req, res) => {
  const { tgl, faktur = '', supplier = '', nama, jml, satuan = '', harga = 0, anggaran = '', ket = '' } = req.body
  if (!nama || !jml) return res.status(400).json({ error: 'nama dan jml wajib diisi' })
  const item = { id: Date.now(), tgl: tgl || new Date().toISOString().slice(0,10), faktur, supplier, nama, jml: +jml, satuan, harga: +harga, total: +jml * +harga, anggaran, ket, created_at: new Date().toISOString() }
  const data = read('pembelian')
  data.push(item)
  write('pembelian', data)
  res.status(201).json(item)
})

router.delete('/:id', (req, res) => {
  write('pembelian', read('pembelian').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
