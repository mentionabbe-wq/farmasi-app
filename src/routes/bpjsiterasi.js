const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  res.json(read('bpjs_iterasi').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id))
})

router.post('/', (req, res) => {
  const { tgl, pasien = '', no_rm = '' } = req.body
  if (!pasien) return res.status(400).json({ error: 'nama pasien wajib diisi' })
  const rec = {
    id: Date.now(),
    tgl: tgl || new Date().toISOString().slice(0, 10),
    pasien, no_rm,
    created_at: new Date().toISOString()
  }
  const data = read('bpjs_iterasi')
  data.push(rec)
  write('bpjs_iterasi', data)
  res.status(201).json(rec)
})

router.delete('/:id', (req, res) => {
  write('bpjs_iterasi', read('bpjs_iterasi').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
