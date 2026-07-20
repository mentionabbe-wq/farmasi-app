const router = require('express').Router()
const { read, write } = require('../db')
const XLSX = require('xlsx')

router.get('/', (req, res) => {
  res.json(read('permintaan').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id))
})

router.post('/', (req, res) => {
  const { tgl, no = '', tujuan = '', items = [], ket = '', diserahkan_oleh = '', diterima_oleh = '' } = req.body
  if (!tujuan) return res.status(400).json({ error: 'unit/ruangan tujuan wajib diisi' })
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'daftar barang masih kosong' })
  const rec = {
    id: Date.now(), dibuat_oleh: (req.authUser && req.authUser.nama) || '',
    tgl: tgl || new Date().toISOString().slice(0, 10),
    no, tujuan,
    items: items.map(it => ({ barang: it.barang || '', jumlah: it.jumlah || '', satuan: it.satuan || '' })),
    ket, diserahkan_oleh, diterima_oleh,
    created_at: new Date().toISOString()
  }
  const data = read('permintaan')
  data.push(rec)
  write('permintaan', data)
  res.status(201).json(rec)
})

router.put('/:id', (req, res) => {
  const data = read('permintaan')
  const i = data.findIndex(d => String(d.id) === req.params.id)
  if (i < 0) return res.status(404).json({ error: 'data tidak ditemukan' })
  const cur = data[i]
  const { tgl, no, tujuan, items, ket, diserahkan_oleh, diterima_oleh } = req.body
  data[i] = {
    ...cur,
    tgl: tgl ?? cur.tgl, no: no ?? cur.no, tujuan: tujuan ?? cur.tujuan,
    items: Array.isArray(items) && items.length ? items.map(it => ({ barang: it.barang || '', jumlah: it.jumlah || '', satuan: it.satuan || '' })) : cur.items,
    ket: ket ?? cur.ket,
    diserahkan_oleh: diserahkan_oleh ?? cur.diserahkan_oleh,
    diterima_oleh: diterima_oleh ?? cur.diterima_oleh
  }
  write('permintaan', data)
  res.json(data[i])
})

router.delete('/:id', (req, res) => {
  write('permintaan', read('permintaan').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

// Dokumen Serah Terima (Excel) per permintaan
router.get('/:id/serah-terima', (req, res) => {
  const d = read('permintaan').find(x => String(x.id) === req.params.id)
  if (!d) return res.status(404).json({ error: 'data tidak ditemukan' })
  const rs = (read('settings') || {}).rs_name || 'RS Medika'

  const aoa = [
    ['BERITA ACARA SERAH TERIMA BARANG'],
    [rs],
    [],
    ['No. Permintaan', ':', d.no || '-'],
    ['Tanggal', ':', d.tgl],
    ['Unit / Ruangan', ':', d.tujuan],
    [],
    ['No', 'Nama Barang', 'Jumlah', 'Satuan'],
    ...(d.items || []).map((it, i) => [i + 1, it.barang, it.jumlah, it.satuan || '']),
    [],
    ['Keterangan', ':', d.ket || '-'],
    [],
    ['', 'Yang Menyerahkan,', '', 'Yang Menerima,'],
    [], [], [],
    ['', `( ${d.diserahkan_oleh || '...................'} )`, '', `( ${d.diterima_oleh || '...................'} )`]
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 16 }, { wch: 34 }, { wch: 10 }, { wch: 26 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Serah Terima')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', `attachment; filename="Serah_Terima_${(d.no || d.tgl).replace(/[^\w-]/g, '_')}.xlsx"`)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

module.exports = router
