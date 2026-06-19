const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  const data = read('tidak_datang').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
  res.json(data)
})

router.post('/', (req, res) => {
  const { tgl, nama, supplier = '', ket = '' } = req.body
  if (!nama) return res.status(400).json({ error: 'nama obat wajib diisi' })
  const item = { id: Date.now(), tgl: tgl || new Date().toISOString().slice(0, 10), nama, supplier, ket, created_at: new Date().toISOString() }
  const data = read('tidak_datang')
  data.push(item)
  write('tidak_datang', data)
  res.status(201).json(item)
})

router.delete('/:id', (req, res) => {
  write('tidak_datang', read('tidak_datang').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
