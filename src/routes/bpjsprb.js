const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  res.json(read('bpjs_prb').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id))
})

router.post('/', (req, res) => {
  const { tgl, jumlah_resep, total_klaim, resep_gagal, ket = '' } = req.body
  const rec = {
    id: Date.now(), dibuat_oleh: (req.authUser && req.authUser.nama) || '',
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

router.put('/:id', (req, res) => {
  const data = read('bpjs_prb')
  const i = data.findIndex(d => String(d.id) === req.params.id)
  if (i < 0) return res.status(404).json({ error: 'data tidak ditemukan' })
  const cur = data[i]
  const { tgl, jumlah_resep, total_klaim, resep_gagal, ket } = req.body
  data[i] = { ...cur, tgl: tgl ?? cur.tgl, jumlah_resep: jumlah_resep !== undefined ? +jumlah_resep : cur.jumlah_resep, total_klaim: total_klaim !== undefined ? +total_klaim : cur.total_klaim, resep_gagal: resep_gagal !== undefined ? +resep_gagal : cur.resep_gagal, ket: ket ?? cur.ket }
  write('bpjs_prb', data)
  res.json(data[i])
})

module.exports = router
