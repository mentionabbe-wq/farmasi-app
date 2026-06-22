const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  const { dari, sampai, bulan, supplier } = req.query
  let data = read('po').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
  if (bulan) data = data.filter(d => d.tgl.slice(0, 7) === bulan)
  else {
    if (dari) data = data.filter(d => d.tgl >= dari)
    if (sampai) data = data.filter(d => d.tgl <= sampai)
  }
  if (supplier) data = data.filter(d => d.supplier === supplier)
  res.json(data)
})

router.post('/', (req, res) => {
  const { tgl, supplier = '', nominal, principle = '' } = req.body
  if (!supplier) return res.status(400).json({ error: 'distributor/supplier wajib dipilih' })
  if (!nominal) return res.status(400).json({ error: 'nominal PO wajib diisi' })
  const item = {
    id: Date.now(),
    tgl: tgl || new Date().toISOString().slice(0, 10),
    supplier,
    nominal: +nominal,
    principle,
    created_at: new Date().toISOString()
  }
  const data = read('po')
  data.push(item)
  write('po', data)
  res.status(201).json(item)
})

router.delete('/:id', (req, res) => {
  write('po', read('po').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
