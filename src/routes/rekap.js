const router = require('express').Router()
const { read } = require('../db')
const XLSX = require('xlsx')

const filterDate = (data, dari, sampai) => data.filter(d => {
  if (dari   && d.tgl < dari)   return false
  if (sampai && d.tgl > sampai) return false
  return true
})

router.get('/summary', (req, res) => {
  const { dari, sampai } = req.query

  const pembelian  = filterDate(read('pembelian'),  dari, sampai)
  const mutasi     = filterDate(read('mutasi'),     dari, sampai)
  const penjualan  = filterDate(read('penjualan'),  dari, sampai)
  const arsip      = filterDate(read('arsip'),      dari, sampai)
  const tujuan     = read('tujuan').sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
  const kats       = read('kategori_pj').sort((a, b) => (a.urutan || 0) - (b.urutan || 0))

  const totalBeli  = pembelian.reduce((s, r) => s + (r.total || 0), 0)
  const totalMut   = mutasi.reduce((s, r) => s + (r.jml || 0), 0)
  const totalPjN   = penjualan.reduce((s, r) => s + r.total_nominal, 0)
  const totalPjR   = penjualan.reduce((s, r) => s + r.total_resep, 0)

  const mutByTujuan = tujuan.map(t => {
    const rows = mutasi.filter(d => d.tujuan === t.id)
    return { ...t, total: rows.reduce((s, r) => s + (r.jml || 0), 0), count: rows.length }
  })

  const pjByKat = kats.map(k => {
    let resep = 0, nominal = 0
    penjualan.forEach(row => {
      const d = (row.detail || {})[k.id] || {}
      resep   += +(d.resep   || 0)
      nominal += +(d.nominal || 0)
    })
    return { ...k, resep, nominal }
  })

  res.json({ totalBeli, totalMut, totalPjN, totalPjR, mutByTujuan, pjByKat, arsipCount: arsip.length })
})

router.get('/excel', (req, res) => {
  const { dari, sampai } = req.query

  const pembelian = filterDate(read('pembelian'), dari, sampai).sort((a, b) => b.tgl.localeCompare(a.tgl))
  const mutasiAll = filterDate(read('mutasi'),    dari, sampai).sort((a, b) => b.tgl.localeCompare(a.tgl))
  const penjualan = filterDate(read('penjualan'), dari, sampai).sort((a, b) => b.tgl.localeCompare(a.tgl))
  const arsipAll  = filterDate(read('arsip'),     dari, sampai).sort((a, b) => b.tgl.localeCompare(a.tgl))
  const anggaran  = read('anggaran').sort((a, b) => b.bulan.localeCompare(a.bulan))
  const tujuan    = read('tujuan').sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
  const kats      = read('kategori_pj').sort((a, b) => (a.urutan || 0) - (b.urutan || 0))

  const tujuanMap = Object.fromEntries(tujuan.map(t => [t.id, t.label]))
  const pemakaianMap = {}
  pembelian.forEach(p => { pemakaianMap[p.anggaran] = (pemakaianMap[p.anggaran] || 0) + p.total })

  const wb = XLSX.utils.book_new()

  // Sheet Penjualan
  const pjHeader = ['Tanggal', 'Shift', 'Total Resep', 'Total Nominal (Rp)', ...kats.flatMap(k => [k.label + ' Resep', k.label + ' Nominal (Rp)'])]
  const pjData = penjualan.map(d => [
    d.tgl, d.shift || '', d.total_resep, d.total_nominal,
    ...kats.flatMap(k => [(d.detail || {})[k.id]?.resep || 0, (d.detail || {})[k.id]?.nominal || 0])
  ])
  const wsPj = XLSX.utils.aoa_to_sheet([pjHeader, ...pjData])
  wsPj['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, ...kats.flatMap(() => [{ wch: 14 }, { wch: 20 }])]
  XLSX.utils.book_append_sheet(wb, wsPj, 'Penjualan')

  // Sheet Anggaran
  const wsAng = XLSX.utils.aoa_to_sheet([
    ['Periode', 'Total (Rp)', 'Ranap (Rp)', 'Ralan (Rp)', 'Terpakai (Rp)', 'Sisa (Rp)', 'Keterangan'],
    ...anggaran.map(d => [d.bulan, d.total, d.ranap || 0, d.ralan || 0, pemakaianMap[d.bulan] || 0, d.total - (pemakaianMap[d.bulan] || 0), d.ket || ''])
  ])
  wsAng['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsAng, 'Anggaran')

  // Sheet Pembelian
  const wsBeli = XLSX.utils.aoa_to_sheet([
    ['Tanggal', 'Supplier', 'Total Belanja (Rp)', 'Periode Anggaran', 'Keterangan'],
    ...pembelian.map(d => [d.tgl, d.supplier || '', d.total, d.anggaran || '', d.ket || ''])
  ])
  wsBeli['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 16 }, { wch: 35 }]
  XLSX.utils.book_append_sheet(wb, wsBeli, 'Pembelian')

  // Sheet Mutasi (semua)
  const wsMut = XLSX.utils.aoa_to_sheet([
    ['Tanggal', 'No. Mutasi', 'Tujuan', 'Jumlah Nominal (Rp)', 'Petugas', 'Keterangan'],
    ...mutasiAll.map(d => [d.tgl, d.no || '', tujuanMap[d.tujuan] || d.tujuan, d.jml, d.petugas || '', d.ket || ''])
  ])
  wsMut['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 35 }]
  XLSX.utils.book_append_sheet(wb, wsMut, 'Mutasi')

  // Sheet Mutasi per tujuan
  tujuan.forEach(t => {
    const items = mutasiAll.filter(d => d.tujuan === t.id)
    if (!items.length) return
    const ws = XLSX.utils.aoa_to_sheet([
      ['Tanggal', 'No.', 'Jumlah Nominal (Rp)', 'Petugas', 'Keterangan'],
      ...items.map(d => [d.tgl, d.no || '', d.jml, d.petugas || '', d.ket || ''])
    ])
    ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 35 }]
    XLSX.utils.book_append_sheet(wb, ws, t.label.substring(0, 31).replace(/[:\\/?\*[\]]/g, ''))
  })

  // Sheet Arsip
  const wsA = XLSX.utils.aoa_to_sheet([
    ['Tanggal', 'No. Dokumen', 'Judul', 'Kategori', 'Deskripsi', 'File'],
    ...arsipAll.map(d => [d.tgl, d.no || '', d.judul, d.kat, d.deskripsi || '', (d.files || []).map(f => f.originalname).join(', ')])
  ])
  wsA['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 35 }, { wch: 35 }]
  XLSX.utils.book_append_sheet(wb, wsA, 'Arsip')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const periode = (dari || 'awal') + '_sd_' + (sampai || 'sekarang')
  res.setHeader('Content-Disposition', `attachment; filename="Rekap_Farmasi_${periode}.xlsx"`)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

module.exports = router
