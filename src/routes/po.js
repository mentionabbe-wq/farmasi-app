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
    id: Date.now(), dibuat_oleh: (req.authUser && req.authUser.nama) || '',
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

router.put('/:id', (req, res) => {
  const data = read('po')
  const i = data.findIndex(d => String(d.id) === req.params.id)
  if (i < 0) return res.status(404).json({ error: 'data tidak ditemukan' })
  const cur = data[i]
  const { tgl, supplier, nominal, principle } = req.body
  data[i] = { ...cur, tgl: tgl ?? cur.tgl, supplier: supplier ?? cur.supplier, nominal: nominal !== undefined ? +nominal : cur.nominal, principle: principle ?? cur.principle }
  write('po', data)
  res.json(data[i])
})

module.exports = router
