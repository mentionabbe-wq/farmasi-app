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

  const pembelian  = filterDate(read('penerimaan'), dari, sampai)
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

  // Rekap penerimaan per principle (fallback: ambil principle dari realisasi via No PO)
  const realisasi = read('realisasi')
  const prinByPo = {}
  realisasi.forEach(r => { if (r.no_po && r.principle && !prinByPo[r.no_po]) prinByPo[r.no_po] = r.principle })
  const prinMap = {}
  pembelian.forEach(p => {
    const nama = p.principle || prinByPo[p.no_po] || '(Tanpa Principle)'
    if (!prinMap[nama]) prinMap[nama] = { principle: nama, count: 0, harga: 0, pajak: 0, total: 0 }
    prinMap[nama].count++
    prinMap[nama].harga += p.harga || 0
    prinMap[nama].pajak += p.pajak || 0
    prinMap[nama].total += p.total != null ? p.total : (p.harga || 0) + (p.pajak || 0)
  })
  const terimaByPrinciple = Object.values(prinMap).sort((a, b) => b.total - a.total)

  res.json({ totalBeli, totalMut, totalPjN, totalPjR, mutByTujuan, pjByKat, terimaByPrinciple, arsipCount: arsip.length })
})

/* ── LAPORAN BULANAN (PowerPoint) ──────────────────────────────────────── */
// Di-require saat dipakai saja: kalau dependency belum terpasang (mis. image
// belum di-rebuild), hanya fitur PPT yang gagal — aplikasi tetap jalan normal.
function getPptx() {
  try { return require('pptxgenjs') }
  catch (e) { return null }
}

const BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const rp = n => 'Rp ' + Math.round(+n || 0).toLocaleString('id-ID')
const angka = n => Math.round(+n || 0).toLocaleString('id-ID')

function labelPeriode(dari, sampai) {
  if (!dari && !sampai) return 'Seluruh Periode'
  const f = t => { const [y, m, d] = String(t).split('-'); return `${+d} ${BULAN_ID[+m - 1]} ${y}` }
  if (dari && sampai) {
    const [y1, m1] = dari.split('-'), [y2, m2] = sampai.split('-')
    const akhirBulan = new Date(+y2, +m2, 0).getDate()
    if (y1 === y2 && m1 === m2 && +dari.split('-')[2] === 1 && +sampai.split('-')[2] === akhirBulan)
      return `Bulan ${BULAN_ID[+m1 - 1]} ${y1}`
    return `${f(dari)} s.d. ${f(sampai)}`
  }
  return dari ? `Sejak ${f(dari)}` : `s.d. ${f(sampai)}`
}

const HIJAU = '1D9E75', HIJAU_TUA = '0F6E56', TEKS = '1C1B18', ABU = '6B6966', BG_ABU = 'F6F5F3'

function slideJudul(pptx, judul, sub) {
  const s = pptx.addSlide()
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.62, fill: { color: HIJAU_TUA } })
  s.addText(judul, { x: 0.4, y: 0.06, w: 9.2, h: 0.5, fontSize: 20, bold: true, color: 'FFFFFF' })
  if (sub) s.addText(sub, { x: 0.4, y: 0.68, w: 9.2, h: 0.3, fontSize: 11, color: ABU })
  return s
}

function tabelSlide(pptx, s, header, baris, opsi = {}) {
  if (!baris.length) {
    s.addText('Tidak ada data pada periode ini', { x: 0.4, y: 2.4, w: 9.2, h: 0.5, fontSize: 14, color: ABU, align: 'center', italic: true })
    return
  }
  const head = header.map(h => ({ text: h.t, options: { bold: true, color: 'FFFFFF', fill: { color: HIJAU }, align: h.a || 'left' } }))
  const rows = baris.map(r => r.map((c, i) => ({ text: String(c), options: { align: header[i].a || 'left', color: TEKS } })))
  s.addTable([head, ...rows], {
    x: 0.4, y: opsi.y || 1.05, w: 9.2,
    colW: opsi.colW, fontSize: opsi.fontSize || 11,
    border: { type: 'solid', pt: 0.5, color: 'DDDDDD' },
    fill: { color: 'FFFFFF' }, valign: 'middle', rowH: 0.3, autoPage: true,
    autoPageRepeatHeader: true, autoPageSlideStartY: 1.05
  })
}

router.get('/ppt', async (req, res) => {
  try {
    const PptxGenJS = getPptx()
    if (!PptxGenJS) return res.status(503).json({ error: 'Fitur PPT belum aktif: dependency pptxgenjs belum terpasang. Rebuild image aplikasi (npm ci) lalu coba lagi.' })
    const { dari, sampai } = req.query
    const rsName = (read('settings') || {}).rs_name || 'Instalasi Farmasi'
    const periode = labelPeriode(dari, sampai)

    const penerimaan = filterDate(read('penerimaan'), dari, sampai)
    const mutasi     = filterDate(read('mutasi'),     dari, sampai)
    const penjualan  = filterDate(read('penjualan'),  dari, sampai)
    const arsip      = filterDate(read('arsip'),      dari, sampai)
    const so         = filterDate(read('stok_opname'), dari, sampai)
    const td         = filterDate(read('tidak_datang'), dari, sampai)
    const tujuan     = read('tujuan').sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
    const kats       = read('kategori_pj').sort((a, b) => (a.urutan || 0) - (b.urutan || 0))

    const totalBeli = penerimaan.reduce((s, r) => s + (r.total != null ? r.total : (r.harga || 0) + (r.pajak || 0)), 0)
    const totalMut  = mutasi.reduce((s, r) => s + (r.jml || 0), 0)
    const totalPjN  = penjualan.reduce((s, r) => s + (r.total_nominal || 0), 0)
    const totalPjR  = penjualan.reduce((s, r) => s + (r.total_resep || 0), 0)

    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_16x9'
    pptx.author = 'Aplikasi Catatan Harian Farmasi'
    pptx.title  = `Laporan Farmasi ${periode}`

    /* 1. Sampul */
    const cover = pptx.addSlide()
    cover.background = { color: HIJAU_TUA }
    cover.addText('LAPORAN BULANAN', { x: 0.6, y: 1.7, w: 9, h: 0.5, fontSize: 16, color: 'A7E8D2', charSpacing: 3 })
    cover.addText('Instalasi Farmasi', { x: 0.6, y: 2.15, w: 9, h: 0.9, fontSize: 40, bold: true, color: 'FFFFFF' })
    cover.addText(rsName, { x: 0.6, y: 3.05, w: 9, h: 0.4, fontSize: 18, color: 'D8F3E8' })
    cover.addShape(pptx.ShapeType.rect, { x: 0.62, y: 3.62, w: 1.6, h: 0.05, fill: { color: HIJAU } })
    cover.addText(periode, { x: 0.6, y: 3.85, w: 9, h: 0.4, fontSize: 16, color: 'FFFFFF' })
    cover.addText('Dicetak: ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      { x: 0.6, y: 4.6, w: 9, h: 0.3, fontSize: 10, color: 'A7E8D2' })

    /* 2. Ringkasan */
    const rk = slideJudul(pptx, 'Ringkasan', periode)
    const kartu = [
      ['Total Penerimaan', rp(totalBeli), `${penerimaan.length} faktur`],
      ['Total Penjualan', rp(totalPjN), `${angka(totalPjR)} resep`],
      ['Total Mutasi', rp(totalMut), `${mutasi.length} transaksi`],
      ['Dokumen Arsip', angka(arsip.length), 'dokumen'],
      ['Stok Opname', angka(so.length), 'kali opname'],
      ['Obat Tidak Datang', angka(td.length), 'item']
    ]
    kartu.forEach((k, i) => {
      const x = 0.4 + (i % 3) * 3.1, y = 1.25 + Math.floor(i / 3) * 1.75
      rk.addShape(pptx.ShapeType.roundRect, { x, y, w: 2.9, h: 1.5, fill: { color: BG_ABU }, line: { color: 'E4E2DD' }, rectRadius: 0.08 })
      rk.addText(k[0].toUpperCase(), { x: x + 0.18, y: y + 0.15, w: 2.5, h: 0.3, fontSize: 9, color: ABU, charSpacing: 1 })
      rk.addText(k[1], { x: x + 0.18, y: y + 0.48, w: 2.6, h: 0.5, fontSize: 18, bold: true, color: HIJAU_TUA })
      rk.addText(k[2], { x: x + 0.18, y: y + 1.02, w: 2.5, h: 0.3, fontSize: 9, color: ABU })
    })

    /* 3. Anggaran & penyerapan */
    const legacy = read('pembelian')
    const semuaTerima = read('penerimaan')
    const bulanDari = dari ? dari.slice(0, 7) : null, bulanSampai = sampai ? sampai.slice(0, 7) : null
    const angRows = read('anggaran')
      .filter(a => (!bulanDari || a.bulan >= bulanDari) && (!bulanSampai || a.bulan <= bulanSampai))
      .sort((a, b) => b.bulan.localeCompare(a.bulan))
      .map(a => {
        const t1 = legacy.filter(p => p.anggaran === a.bulan).reduce((s, p) => s + (p.total || 0), 0)
        const t2 = semuaTerima.filter(p => p.anggaran === a.bulan).reduce((s, p) => s + ((p.harga || 0) + (p.pajak || 0)), 0)
        const dipakai = t1 + t2, sisa = (a.total || 0) - dipakai
        const pct = a.total ? Math.round(dipakai / a.total * 100) : 0
        return [a.bulan, rp(a.total), rp(dipakai), rp(sisa), pct + '%']
      })
    tabelSlide(pptx, slideJudul(pptx, 'Anggaran & Penyerapan', periode),
      [{ t: 'Periode' }, { t: 'Total Anggaran', a: 'right' }, { t: 'Terpakai', a: 'right' }, { t: 'Sisa', a: 'right' }, { t: '%', a: 'right' }],
      angRows, { colW: [1.8, 2.1, 2.1, 2.1, 1.1] })

    /* 4. Penerimaan per distributor */
    const supMap = {}
    penerimaan.forEach(p => {
      const n = p.supplier || '(Tanpa Distributor)'
      if (!supMap[n]) supMap[n] = { n, c: 0, t: 0 }
      supMap[n].c++; supMap[n].t += p.total != null ? p.total : (p.harga || 0) + (p.pajak || 0)
    })
    const supRows = Object.values(supMap).sort((a, b) => b.t - a.t).map(v => [v.n, angka(v.c), rp(v.t)])
    tabelSlide(pptx, slideJudul(pptx, 'Penerimaan per Distributor', periode),
      [{ t: 'Distributor' }, { t: 'Jml Faktur', a: 'right' }, { t: 'Total', a: 'right' }],
      supRows, { colW: [5.0, 1.7, 2.5] })

    /* 5. Penerimaan per principle */
    const prinByPo = {}
    read('realisasi').forEach(r => { if (r.no_po && r.principle && !prinByPo[r.no_po]) prinByPo[r.no_po] = r.principle })
    const prinMap = {}
    penerimaan.forEach(p => {
      const n = p.principle || prinByPo[p.no_po] || '(Tanpa Principle)'
      if (!prinMap[n]) prinMap[n] = { n, c: 0, t: 0 }
      prinMap[n].c++; prinMap[n].t += p.total != null ? p.total : (p.harga || 0) + (p.pajak || 0)
    })
    const prinRows = Object.values(prinMap).sort((a, b) => b.t - a.t).map(v => [v.n, angka(v.c), rp(v.t)])
    tabelSlide(pptx, slideJudul(pptx, 'Penerimaan per Principle', periode),
      [{ t: 'Principle / Pabrik' }, { t: 'Jml Faktur', a: 'right' }, { t: 'Total', a: 'right' }],
      prinRows, { colW: [5.0, 1.7, 2.5] })

    /* 6. Penjualan per kategori */
    const pjRows = kats.map(k => {
      let resep = 0, nominal = 0
      penjualan.forEach(row => { const d = (row.detail || {})[k.id] || {}; resep += +(d.resep || 0); nominal += +(d.nominal || 0) })
      return [k.label, angka(resep), rp(nominal)]
    }).filter(r => r[1] !== '0' || r[2] !== 'Rp 0')
    if (pjRows.length) pjRows.push(['TOTAL', angka(totalPjR), rp(totalPjN)])
    tabelSlide(pptx, slideJudul(pptx, 'Penjualan per Kategori', periode),
      [{ t: 'Kategori' }, { t: 'Jml Resep', a: 'right' }, { t: 'Nominal', a: 'right' }],
      pjRows, { colW: [5.0, 1.7, 2.5] })

    /* 7. Mutasi per tujuan */
    const mutRows = tujuan.map(t => {
      const r = mutasi.filter(d => d.tujuan === t.id)
      return [t.label, angka(r.length), rp(r.reduce((s, d) => s + (d.jml || 0), 0))]
    }).filter(r => r[1] !== '0')
    tabelSlide(pptx, slideJudul(pptx, 'Mutasi per Tujuan', periode),
      [{ t: 'Tujuan' }, { t: 'Jml Transaksi', a: 'right' }, { t: 'Nominal', a: 'right' }],
      mutRows, { colW: [5.0, 1.9, 2.3] })

    /* 8. Stok opname */
    const soMap = {}
    so.forEach(d => {
      const r = d.ruangan || '(Tanpa Ruangan)'
      if (!soMap[r]) soMap[r] = { r, c: 0, sb: 0, ss: 0, sel: 0 }
      soMap[r].c++; soMap[r].sb += d.nilai_sebelum || 0; soMap[r].ss += d.nilai_sesudah || 0; soMap[r].sel += d.selisih || 0
    })
    const soRows = Object.values(soMap).map(v => [v.r, angka(v.c), rp(v.sb), rp(v.ss), (v.sel > 0 ? '+' : '') + rp(v.sel)])
    tabelSlide(pptx, slideJudul(pptx, 'Stok Opname per Ruangan', periode),
      [{ t: 'Ruangan' }, { t: 'Opname', a: 'right' }, { t: 'Nilai Sebelum', a: 'right' }, { t: 'Nilai Sesudah', a: 'right' }, { t: 'Selisih', a: 'right' }],
      soRows, { colW: [2.4, 1.1, 2.0, 2.0, 1.7], fontSize: 10 })

    /* 9. Obat tidak datang */
    const tdRows = td.slice(0, 20).map(d => [d.tgl, d.nama || '-', d.supplier || '-', (d.ket || '-').slice(0, 45)])
    tabelSlide(pptx, slideJudul(pptx, 'Obat Tidak Datang', `${periode} — ${td.length} item`),
      [{ t: 'Tanggal' }, { t: 'Nama Obat' }, { t: 'Supplier' }, { t: 'Keterangan' }],
      tdRows, { colW: [1.3, 3.0, 2.2, 2.7], fontSize: 10 })

    /* 10. Penutup */
    const tutup = pptx.addSlide()
    tutup.background = { color: HIJAU_TUA }
    tutup.addText('Terima Kasih', { x: 0.6, y: 2.1, w: 9, h: 0.8, fontSize: 34, bold: true, color: 'FFFFFF', align: 'center' })
    tutup.addText(`${rsName} — Instalasi Farmasi`, { x: 0.6, y: 2.95, w: 9, h: 0.4, fontSize: 14, color: 'D8F3E8', align: 'center' })

    const buf = await pptx.write({ outputType: 'nodebuffer' })
    const namaFile = `Laporan_Farmasi_${periode.replace(/[^\w]+/g, '_')}.pptx`
    res.setHeader('Content-Disposition', `attachment; filename="${namaFile}"`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
    res.send(buf)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Gagal membuat PPT: ' + err.message })
  }
})

router.get('/excel', (req, res) => {
  const { dari, sampai } = req.query

  const pembelian = filterDate(read('penerimaan'), dari, sampai).sort((a, b) => b.tgl.localeCompare(a.tgl))
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

  // Sheet Penerimaan per Principle
  const prinByPo2 = {}
  read('realisasi').forEach(r => { if (r.no_po && r.principle && !prinByPo2[r.no_po]) prinByPo2[r.no_po] = r.principle })
  const prinMap2 = {}
  pembelian.forEach(p => {
    const nama = p.principle || prinByPo2[p.no_po] || '(Tanpa Principle)'
    if (!prinMap2[nama]) prinMap2[nama] = { count: 0, harga: 0, pajak: 0, total: 0 }
    prinMap2[nama].count++
    prinMap2[nama].harga += p.harga || 0
    prinMap2[nama].pajak += p.pajak || 0
    prinMap2[nama].total += p.total != null ? p.total : (p.harga || 0) + (p.pajak || 0)
  })
  const wsPrin = XLSX.utils.aoa_to_sheet([
    ['Principle / Pabrik', 'Jml Faktur', 'Harga (Rp)', 'Pajak (Rp)', 'Total (Rp)'],
    ...Object.entries(prinMap2).sort((a, b) => b[1].total - a[1].total).map(([nama, v]) => [nama, v.count, v.harga, v.pajak, v.total])
  ])
  wsPrin['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, wsPrin, 'Per Principle')

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
