const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  const { no_po, dari, sampai } = req.query
  let data = read('penerimaan').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
  if (dari) data = data.filter(d => d.tgl >= dari)
  if (sampai) data = data.filter(d => d.tgl <= sampai)
  if (no_po) data = data.filter(d => d.no_po === no_po)
  res.json(data)
})

router.post('/', (req, res) => {
  const { tgl, no_po = '', no_faktur = '', tgl_faktur = '', tgl_jatuh_tempo = '', supplier = '', principle = '', anggaran = '', harga, pajak, items = [] } = req.body
  if (!no_po) return res.status(400).json({ error: 'No PO wajib dipilih' })
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'tidak ada item untuk diterima' })
  const t = tgl || new Date().toISOString().slice(0, 10)

  const cleanItems = items.map(it => {
    const status = ['datang', 'sebagian', 'tidak'].includes(it.status) ? it.status : 'datang'
    const jumlah = +(it.jumlah || 0)
    let terima = status === 'datang' ? jumlah : status === 'tidak' ? 0 : +(it.jumlah_terima || 0)
    if (terima > jumlah) terima = jumlah
    if (terima < 0) terima = 0
    return { real_id: it.real_id != null ? it.real_id : null, barang: it.barang || '', jumlah, jumlah_terima: terima, harga_terima: +(it.harga_terima || 0), diskon: +(it.diskon || 0), status }
  })

  const h = +(harga || 0), p = +(pajak || 0)
  const rec = {
    id: Date.now(), dibuat_oleh: (req.authUser && req.authUser.nama) || '',
    tgl: t, no_po, no_faktur, tgl_faktur, tgl_jatuh_tempo, supplier, principle, anggaran,
    harga: h, pajak: p, total: h + p,
    items: cleanItems,
    created_at: new Date().toISOString()
  }
  const data = read('penerimaan')
  data.push(rec)
  write('penerimaan', data)

  // Auto-catat ke Obat Tidak Datang untuk yang tidak datang / kurang
  const td = read('tidak_datang')
  const now = Date.now()
  cleanItems.forEach((it, i) => {
    if (it.status === 'tidak') {
      td.push({ id: now + 1 + i, tgl: t, nama: it.barang, supplier, ket: `Tidak datang dari PO ${no_po}`, created_at: new Date().toISOString() })
    } else if (it.status === 'sebagian' && it.jumlah_terima < it.jumlah) {
      td.push({ id: now + 1 + i, tgl: t, nama: it.barang, supplier, ket: `Datang sebagian PO ${no_po} (diterima ${it.jumlah_terima} dari ${it.jumlah})`, created_at: new Date().toISOString() })
    }
  })
  write('tidak_datang', td)

  res.status(201).json(rec)
})

router.put('/:id', (req, res) => {
  const data = read('penerimaan')
  const i = data.findIndex(d => String(d.id) === req.params.id)
  if (i < 0) return res.status(404).json({ error: 'data tidak ditemukan' })
  const cur = data[i]
  const { tgl, no_po, no_faktur, tgl_faktur, tgl_jatuh_tempo, supplier, principle, anggaran, harga, pajak, items } = req.body
  let cleanItems = cur.items
  if (Array.isArray(items) && items.length) {
    cleanItems = items.map(it => {
      const status = ['datang', 'sebagian', 'tidak'].includes(it.status) ? it.status : 'datang'
      const jumlah = +(it.jumlah || 0)
      let terima = status === 'datang' ? jumlah : status === 'tidak' ? 0 : +(it.jumlah_terima || 0)
      if (terima > jumlah) terima = jumlah
      if (terima < 0) terima = 0
      return { real_id: it.real_id != null ? it.real_id : null, barang: it.barang || '', jumlah, jumlah_terima: terima, harga_terima: +(it.harga_terima || 0), diskon: +(it.diskon || 0), status }
    })
  }
  const h = harga !== undefined ? +harga : cur.harga
  const p = pajak !== undefined ? +pajak : cur.pajak
  data[i] = {
    ...cur,
    tgl: tgl ?? cur.tgl, no_po: no_po ?? cur.no_po,
    no_faktur: no_faktur ?? cur.no_faktur, tgl_faktur: tgl_faktur ?? cur.tgl_faktur,
    tgl_jatuh_tempo: tgl_jatuh_tempo ?? cur.tgl_jatuh_tempo,
    supplier: supplier ?? cur.supplier, principle: principle ?? cur.principle, anggaran: anggaran ?? cur.anggaran,
    harga: h, pajak: p, total: h + p,
    items: cleanItems
  }
  write('penerimaan', data)
  res.json(data[i])
})

router.delete('/:id', (req, res) => {
  write('penerimaan', read('penerimaan').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

const { sendSheet } = require('../xlsxutil')
router.get('/excel', (req, res) => {
  const { dari, sampai } = req.query
  const data = read('penerimaan').filter(d => (!dari || d.tgl >= dari) && (!sampai || d.tgl <= sampai)).sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
  const rows = []
  data.forEach(d => {
    const items = d.items || []
    if (!items.length) rows.push([d.tgl, d.no_po, d.no_faktur || '', d.tgl_faktur || '', d.tgl_jatuh_tempo || '', d.supplier || '', d.anggaran || '', '', '', '', '', '', '', d.dibuat_oleh || ''])
    items.forEach(it => rows.push([
      d.tgl, d.no_po, d.no_faktur || '', d.tgl_faktur || '', d.tgl_jatuh_tempo || '', d.supplier || '', d.anggaran || '',
      it.barang || '', it.jumlah || 0, it.jumlah_terima || 0, it.harga_terima || 0, it.diskon || 0, it.status || '', d.dibuat_oleh || ''
    ]))
  })
  sendSheet(res, 'Penerimaan.xlsx', [{
    name: 'Penerimaan',
    header: ['Tanggal', 'No PO', 'No Faktur', 'Tgl Faktur', 'Jatuh Tempo', 'Distributor', 'Anggaran', 'Nama Barang', 'Jml PO', 'Jml Diterima', 'Harga Penerimaan', 'Diskon %', 'Status', 'Dibuat Oleh'],
    rows,
    cols: [{ wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 26 }, { wch: 9 }, { wch: 11 }, { wch: 16 }, { wch: 9 }, { wch: 14 }, { wch: 16 }]
  }])
})

module.exports = router
