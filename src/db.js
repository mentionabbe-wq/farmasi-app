const fs = require('fs')
const path = require('path')

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const fp = name => path.join(DATA_DIR, `${name}.json`)

function read(name) {
  try { return JSON.parse(fs.readFileSync(fp(name), 'utf8')) } catch { return [] }
}

function write(name, data) {
  fs.writeFileSync(fp(name), JSON.stringify(data, null, 2))
}

// Seed defaults
if (!fs.existsSync(fp('tujuan'))) {
  write('tujuan', [
    { id: 'ranap', label: 'Farmasi Ranap', is_default: true, urutan: 1 },
    { id: 'ralan', label: 'Farmasi Ralan', is_default: true, urutan: 2 }
  ])
}
if (!fs.existsSync(fp('kategori_pj'))) {
  write('kategori_pj', [
    { id: 'bpjs',     label: 'BPJS',      is_default: true, urutan: 1 },
    { id: 'umum',     label: 'Umum',      is_default: true, urutan: 2 },
    { id: 'asuransi', label: 'Asuransi',  is_default: true, urutan: 3 }
  ])
}
if (!fs.existsSync(fp('kat_arsip'))) {
  write('kat_arsip', [
    { id: 'spo',       label: 'SPO',        is_default: true },
    { id: 'kronologi', label: 'Kronologi',  is_default: true },
    { id: 'laporan',   label: 'Laporan',    is_default: true },
    { id: 'sk',        label: 'SK',         is_default: true },
    { id: 'lainnya',   label: 'Lainnya',    is_default: true }
  ])
}
;['anggaran','pembelian','mutasi','penjualan','arsip','tidak_datang'].forEach(n => {
  if (!fs.existsSync(fp(n))) write(n, [])
})
if (!fs.existsSync(fp('settings'))) {
  write('settings', { rs_name: 'RS Medika' })
}

module.exports = { read, write }
