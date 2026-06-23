const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  res.json(read('bpjs_prb').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id))
})

router.post('/', (req, res) => {
  const { tgl, jumlah_resep, total_klaim, resep_gagal, ket = '' } = req.body
  const rec = {
    id: Date.now(),
    tgl: tgl || new Date().toISOString().slice(0, 10),
    jumlah_resep: +(jumlah_resep || 0),
    total_klaim: +(total_klaim || 0),
    resep_gagal: +(resep_gagal || 0),
    ket,
    created_at: new Date().toISOString()
  }
  const data = read('bpjs_prb')
  data.push(rec)
  write('bpjs_prb', data)
  res.status(201).json(rec)
})

router.delete('/:id', (req, res) => {
  write('bpjs_prb', read('bpjs_prb').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
