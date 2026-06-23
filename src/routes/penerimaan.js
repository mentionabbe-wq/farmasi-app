const router = require('express').Router()
const { read, write } = require('../db')

router.get('/', (req, res) => {
  const { no_po } = req.query
  let data = read('penerimaan').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
  if (no_po) data = data.filter(d => d.no_po === no_po)
  res.json(data)
})

router.post('/', (req, res) => {
  const { tgl, no_po = '', items = [] } = req.body
  if (!no_po) return res.status(400).json({ error: 'No PO wajib dipilih' })
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'tidak ada item untuk diterima' })
  const t = tgl || new Date().toISOString().slice(0, 10)
  const now = Date.now()
  const data = read('penerimaan')
  const td = read('tidak_datang')
  const created = []
  items.forEach((it, i) => {
    const status = it.status === 'tidak' ? 'tidak' : 'datang'
    const rec = { id: now + i, tgl: t, no_po, barang: it.barang || '', jumlah: +(it.jumlah || 0), status, created_at: new Date().toISOString() }
    data.push(rec)
    created.push(rec)
    if (status === 'tidak') {
      td.push({ id: now + 100000 + i, tgl: t, nama: it.barang || '', supplier: '', ket: `Tidak datang dari PO ${no_po}`, created_at: new Date().toISOString() })
    }
  })
  write('penerimaan', data)
  write('tidak_datang', td)
  res.status(201).json(created)
})

router.delete('/:id', (req, res) => {
  write('penerimaan', read('penerimaan').filter(d => String(d.id) !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
