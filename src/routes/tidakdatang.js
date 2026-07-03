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

const { sendSheet } = require('../xlsxutil')
router.get('/excel', (req, res) => {
  const { dari, sampai } = req.query
  const data = read('tidak_datang').filter(d => (!dari || d.tgl >= dari) && (!sampai || d.tgl <= sampai)).sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
  const rows = data.map(d => [d.tgl, d.nama || '', d.supplier || '', d.ket || ''])
  sendSheet(res, 'Obat_Tidak_Datang.xlsx', [{ name: 'Tidak Datang', header: ['Tanggal', 'Nama Obat', 'Supplier', 'Keterangan'], rows, cols: [{ wch: 12 }, { wch: 28 }, { wch: 22 }, { wch: 35 }] }])
})

module.exports = router
