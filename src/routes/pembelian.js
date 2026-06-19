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
  const { tgl, supplier = '', jml, anggaran = '', ket = '', no_faktur = '', tgl_faktur = '', tgl_jatuh_tempo = '' } = req.body
  if (!jml) return res.status(400).json({ error: 'total belanja wajib diisi' })
  const item = { id: Date.now(), tgl: tgl || new Date().toISOString().slice(0,10), no_faktur, tgl_faktur, tgl_jatuh_tempo, supplier, total: +jml, anggaran, ket, created_at: new Date().toISOString() }
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
