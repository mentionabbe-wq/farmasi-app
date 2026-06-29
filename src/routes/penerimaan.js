const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  const { no_po } = req.query
  let data = read('penerimaan').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
  if (no_po) data = data.filter(d => d.no_po === no_po)
  res.json(data)
})

router.post('/', (req, res) => {
  const { tgl, no_po = '', no_faktur = '', tgl_faktur = '', tgl_jatuh_tempo = '', supplier = '', anggaran = '', harga, pajak, items = [] } = req.body
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
    id: Date.now(),
    tgl: t, no_po, no_faktur, tgl_faktur, tgl_jatuh_tempo, supplier, anggaran,
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

router.delete('/:id', (req, res) => {
  write('penerimaan', read('penerimaan').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
