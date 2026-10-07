const router = require('express').Router()
const { read, write } = require('../db')
const XLSX = require('xlsx')

const STATUS = ['penuh', 'sebagian', 'tidak']
const STATUS_TEKS = { penuh: 'Terpenuhi', sebagian: 'Dipenuhi sebagian', tidak: 'Tidak terpenuhi' }

const toNum = v => {
  const n = +String(v == null ? '' : v).replace(/[^\d.-]/g, '')
  return isFinite(n) ? n : 0
}

function normItems(items) {
  return items.map(it => {
    const jumlah = toNum(it.jumlah)
    const status = STATUS.includes(it.status) ? it.status : 'penuh'
    let penuhi = toNum(it.jumlah_penuhi)
    if (status === 'penuh') penuhi = jumlah
    else if (status === 'tidak') penuhi = 0
    else { if (penuhi > jumlah) penuhi = jumlah; if (penuhi < 0) penuhi = 0 }
    return { barang: it.barang || '', jumlah, satuan: it.satuan || '', jumlah_penuhi: penuhi, status, ket: it.ket || '' }
  })
}

function statusRekap(items) {
  if (!items.length) return 'tidak'
  if (items.every(i => i.status === 'penuh')) return 'penuh'
  if (items.every(i => i.status === 'tidak')) return 'tidak'
  return 'sebagian'
}

const labelRuangan = id => {
  const t = read('tujuan').find(x => x.id === id)
  return t ? t.label : (id || '-')
}

/* Setiap serah terima otomatis tercatat di Mutasi (tertaut lewat dari_permintaan) */
function syncMutasi(rec) {
  const mutasi = read('mutasi')
  const rincian = (rec.items || [])
    .map(it => `${it.barang} ${it.jumlah_penuhi}/${it.jumlah}${it.satuan ? ' ' + it.satuan : ''}${it.ket ? ` (${it.ket})` : ''}`)
    .join('; ')
  const ket = `[Serah terima ${rec.no || '-'}] ${labelRuangan(rec.dari)} → ${labelRuangan(rec.tujuan)}. `
    + `${STATUS_TEKS[rec.status_pemenuhan]}. ${rincian}${rec.ket ? ` — ${rec.ket}` : ''}`
  const isi = {
    tgl: rec.tgl, no: rec.no || '', tujuan: rec.tujuan, jml: toNum(rec.nilai),
    petugas: rec.diserahkan_oleh || '', ket,
    dari_permintaan: rec.id, dibuat_oleh: rec.dibuat_oleh || ''
  }
  const i = mutasi.findIndex(m => String(m.dari_permintaan) === String(rec.id))
  if (i >= 0) mutasi[i] = { ...mutasi[i], ...isi }
  else {
    let nid = Date.now()
    while (mutasi.some(m => m.id === nid)) nid++
    mutasi.push({ id: nid, ...isi, created_at: new Date().toISOString() })
  }
  write('mutasi', mutasi)
}

function hapusMutasiTertaut(id) {
  const mutasi = read('mutasi')
  const sisa = mutasi.filter(m => String(m.dari_permintaan) !== String(id))
  if (sisa.length !== mutasi.length) write('mutasi', sisa)
}

router.get('/', (req, res) => {
  res.json(read('permintaan').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id))
})

router.post('/', (req, res) => {
  const { tgl, no = '', dari = '', tujuan = '', items = [], ket = '', nilai, diserahkan_oleh = '', diterima_oleh = '' } = req.body
  if (!dari)   return res.status(400).json({ error: 'ruangan asal wajib dipilih' })
  if (!tujuan) return res.status(400).json({ error: 'ruangan tujuan wajib dipilih' })
  if (dari === tujuan) return res.status(400).json({ error: 'ruangan asal dan tujuan tidak boleh sama' })
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'daftar barang masih kosong' })

  const isiItems = normItems(items)
  const rec = {
    id: Date.now(), dibuat_oleh: (req.authUser && req.authUser.nama) || '',
    tgl: tgl || new Date().toISOString().slice(0, 10),
    no, dari, tujuan,
    items: isiItems,
    status_pemenuhan: statusRekap(isiItems),
    nilai: toNum(nilai),
    ket, diserahkan_oleh, diterima_oleh,
    created_at: new Date().toISOString()
  }
  const data = read('permintaan')
  data.push(rec)
  write('permintaan', data)
  syncMutasi(rec)
  res.status(201).json(rec)
})

router.put('/:id', (req, res) => {
  const data = read('permintaan')
  const i = data.findIndex(d => String(d.id) === req.params.id)
  if (i < 0) return res.status(404).json({ error: 'data tidak ditemukan' })
  const cur = data[i]
  const { tgl, no, dari, tujuan, items, ket, nilai, diserahkan_oleh, diterima_oleh } = req.body
  const isiItems = Array.isArray(items) && items.length ? normItems(items) : cur.items
  const rec = {
    ...cur,
    tgl: tgl ?? cur.tgl, no: no ?? cur.no,
    dari: dari ?? cur.dari, tujuan: tujuan ?? cur.tujuan,
    items: isiItems,
    status_pemenuhan: statusRekap(isiItems),
    nilai: nilai !== undefined ? toNum(nilai) : (cur.nilai || 0),
    ket: ket ?? cur.ket,
    diserahkan_oleh: diserahkan_oleh ?? cur.diserahkan_oleh,
    diterima_oleh: diterima_oleh ?? cur.diterima_oleh
  }
  if (rec.dari && rec.tujuan && rec.dari === rec.tujuan)
    return res.status(400).json({ error: 'ruangan asal dan tujuan tidak boleh sama' })
  data[i] = rec
  write('permintaan', data)
  syncMutasi(rec)
  res.json(rec)
})

router.delete('/:id', (req, res) => {
  write('permintaan', read('permintaan').filter(d => String(d.id) !== req.params.id))
  hapusMutasiTertaut(req.params.id)
  res.json({ ok: true })
})

// Dokumen Serah Terima Antar Ruangan (Excel)
router.get('/:id/serah-terima', (req, res) => {
  const d = read('permintaan').find(x => String(x.id) === req.params.id)
  if (!d) return res.status(404).json({ error: 'data tidak ditemukan' })
  const rs = (read('settings') || {}).rs_name || 'RS Medika'
  const items = d.items || []

  const aoa = [
    ['BERITA ACARA SERAH TERIMA BARANG ANTAR RUANGAN'],
    [rs],
    [],
    ['No. Serah Terima', ':', d.no || '-'],
    ['Tanggal', ':', d.tgl],
    ['Dari Ruangan', ':', labelRuangan(d.dari)],
    ['Ke Ruangan', ':', labelRuangan(d.tujuan)],
    ['Status Pemenuhan', ':', STATUS_TEKS[d.status_pemenuhan] || '-'],
    [],
    ['No', 'Nama Barang', 'Diminta', 'Satuan', 'Dipenuhi', 'Status', 'Catatan'],
    ...items.map((it, i) => [i + 1, it.barang, it.jumlah, it.satuan || '', it.jumlah_penuhi, STATUS_TEKS[it.status] || '', it.ket || '']),
    [],
    ['Keterangan', ':', d.ket || '-'],
    ...(d.nilai ? [['Nilai Barang', ':', d.nilai]] : []),
    [],
    ['', 'Yang Menyerahkan,', '', 'Yang Menerima,'],
    [], [], [],
    ['', `( ${d.diserahkan_oleh || '...................'} )`, '', `( ${d.diterima_oleh || '...................'} )`]
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 18 }, { wch: 32 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 26 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Serah Terima')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', `attachment; filename="Serah_Terima_${(d.no || d.tgl).replace(/[^\w-]/g, '_')}.xlsx"`)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

module.exports = router
