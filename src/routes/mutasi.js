const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  const { dari, sampai, tujuan } = req.query
  let data = read('mutasi').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
  if (dari)   data = data.filter(d => d.tgl >= dari)
  if (sampai) data = data.filter(d => d.tgl <= sampai)
  if (tujuan) data = data.filter(d => d.tujuan === tujuan)
  res.json(data)
})

router.post('/', (req, res) => {
  const { tgl, no = '', tujuan, jml, petugas = '', ket = '' } = req.body
  if (!jml || !tujuan) return res.status(400).json({ error: 'jml dan tujuan wajib diisi' })
  const item = {
    id: Date.now(), dibuat_oleh: (req.authUser && req.authUser.nama) || '',
    tgl: tgl || new Date().toISOString().slice(0, 10),
    no, tujuan,
    jml: +jml,
    petugas, ket,
    created_at: new Date().toISOString()
  }
  const data = read('mutasi')
  data.push(item)
  write('mutasi', data)
  res.status(201).json(item)
})

router.delete('/:id', (req, res) => {
  write('mutasi', read('mutasi').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

router.put('/:id', (req, res) => {
  const data = read('mutasi')
  const i = data.findIndex(d => String(d.id) === req.params.id)
  if (i < 0) return res.status(404).json({ error: 'data tidak ditemukan' })
  const cur = data[i]
  const { tgl, no, tujuan, jml, petugas, ket } = req.body
  data[i] = { ...cur, tgl: tgl ?? cur.tgl, no: no ?? cur.no, tujuan: tujuan ?? cur.tujuan, jml: jml !== undefined ? +jml : cur.jml, petugas: petugas ?? cur.petugas, ket: ket ?? cur.ket }
  write('mutasi', data)
  res.json(data[i])
})

module.exports = router
