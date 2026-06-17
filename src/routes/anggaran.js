const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  const pembelian = read('pembelian')
  const result = read('anggaran')
    .sort((a, b) => b.bulan.localeCompare(a.bulan))
    .map(a => {
      const terpakai = pembelian.filter(p => p.anggaran === a.bulan).reduce((s, p) => s + p.total, 0)
      return { ...a, terpakai, sisa: a.total - terpakai }
    })
  res.json(result)
})

router.post('/', (req, res) => {
  const { bulan, total, ranap = 0, ralan = 0, ket = '' } = req.body
  if (!bulan || !total) return res.status(400).json({ error: 'bulan dan total wajib diisi' })
  const data = read('anggaran')
  const idx = data.findIndex(d => d.bulan === bulan)
  const item = { id: idx >= 0 ? data[idx].id : Date.now(), bulan, total: +total, ranap: +ranap, ralan: +ralan, ket, created_at: new Date().toISOString() }
  if (idx >= 0) data[idx] = item; else data.push(item)
  write('anggaran', data)
  res.status(201).json(item)
})

router.delete('/:id', (req, res) => {
  write('anggaran', read('anggaran').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
