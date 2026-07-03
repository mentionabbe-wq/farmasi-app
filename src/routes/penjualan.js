const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  const { dari, sampai, bulan, tujuan } = req.query
  let data = read('penjualan').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
  if (bulan)  data = data.filter(d => d.tgl.slice(0, 7) === bulan)
  else {
    if (dari)   data = data.filter(d => d.tgl >= dari)
    if (sampai) data = data.filter(d => d.tgl <= sampai)
  }
  if (tujuan) data = data.filter(d => d.tujuan === tujuan)
  res.json(data)
})

router.post('/', (req, res) => {
  const { tgl, shift = '', tujuan = '', detail = {}, total_resep, total_nominal, ket = '' } = req.body
  if (!tgl) return res.status(400).json({ error: 'tgl wajib diisi' })
  const totalResep   = total_resep   !== undefined ? +total_resep   : Object.values(detail).reduce((s, k) => s + (+k.resep   || 0), 0)
  const totalNominal = total_nominal !== undefined ? +total_nominal : Object.values(detail).reduce((s, k) => s + (+k.nominal || 0), 0)
  const item = { id: Date.now(), dibuat_oleh: (req.authUser && req.authUser.nama) || '', tgl, shift, tujuan, detail, total_resep: totalResep, total_nominal: totalNominal, ket, created_at: new Date().toISOString() }
  const data = read('penjualan')
  data.push(item)
  write('penjualan', data)
  res.status(201).json(item)
})

router.delete('/:id', (req, res) => {
  write('penjualan', read('penjualan').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

const { sendSheet } = require('../xlsxutil')
router.get('/excel', (req, res) => {
  const tujuanMap = Object.fromEntries(read('tujuan').map(t => [t.id, t.label]))
  const kats = read('kategori_pj').sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
  const data = read('penjualan').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
  const header = ['Tanggal', 'Shift', 'Farmasi', 'Total Resep', 'Total Nominal', ...kats.flatMap(k => [k.label + ' Resep', k.label + ' Nominal']), 'Dibuat Oleh']
  const rows = data.map(d => [
    d.tgl, d.shift || '', tujuanMap[d.tujuan] || d.tujuan || '', d.total_resep || 0, d.total_nominal || 0,
    ...kats.flatMap(k => [(d.detail || {})[k.id]?.resep || 0, (d.detail || {})[k.id]?.nominal || 0]),
    d.dibuat_oleh || ''
  ])
  const cols = [{ wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, ...kats.flatMap(() => [{ wch: 12 }, { wch: 16 }]), { wch: 16 }]
  sendSheet(res, 'Penjualan.xlsx', [{ name: 'Penjualan', header, rows, cols }])
})

module.exports = router
