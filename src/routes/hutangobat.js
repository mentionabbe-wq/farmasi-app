const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  res.json(read('hutang_obat').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id))
})

router.post('/', (req, res) => {
  const { tgl, item = '', jumlah, jumlah_pasien, ket = '' } = req.body
  if (!item) return res.status(400).json({ error: 'nama item wajib diisi' })
  const rec = {
    id: Date.now(),
    tgl: tgl || new Date().toISOString().slice(0, 10),
    item,
    jumlah: +(jumlah || 0),
    jumlah_pasien: +(jumlah_pasien || 0),
    ket,
    created_at: new Date().toISOString()
  }
  const data = read('hutang_obat')
  data.push(rec)
  write('hutang_obat', data)
  res.status(201).json(rec)
})

router.delete('/:id', (req, res) => {
  write('hutang_obat', read('hutang_obat').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

router.put('/:id', (req, res) => {
  const data = read('hutang_obat')
  const i = data.findIndex(d => String(d.id) === req.params.id)
  if (i < 0) return res.status(404).json({ error: 'data tidak ditemukan' })
  const cur = data[i]
  const { tgl, item, jumlah, jumlah_pasien, ket } = req.body
  data[i] = { ...cur, tgl: tgl ?? cur.tgl, item: item ?? cur.item, jumlah: jumlah !== undefined ? +jumlah : cur.jumlah, jumlah_pasien: jumlah_pasien !== undefined ? +jumlah_pasien : cur.jumlah_pasien, ket: ket ?? cur.ket }
  write('hutang_obat', data)
  res.json(data[i])
})

module.exports = router
