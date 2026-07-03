/* ── UTILS ── */
const fmt = n => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID')

function filterModalItems(srchId, listId) {
  const q = qs(srchId).value.toLowerCase()
  qs(listId).querySelectorAll('.item-row').forEach(row => {
    const label = row.querySelector('.item-row-label span')?.textContent.toLowerCase() || ''
    row.style.display = label.includes(q) ? '' : 'none'
  })
}
const fmtN = n => Math.round(n || 0).toLocaleString('id-ID')
const today = () => new Date().toISOString().slice(0, 10)
const qs = id => document.getElementById(id)
const BADGE = ['blue','green','amber','purple','coral','teal','gray']
const KAT_HEX = ['#185FA5','#0F6E56','#854F0B','#3C3489','#993C1D','#085041','#444441']
const KAT_COLORS_ARSIP = { SPO:'blue', Kronologi:'amber', Laporan:'green', SK:'purple', Lainnya:'gray', 'Alkes BPJS':'blue' }

let STATE = { tujuan: [], kategori: [], activeMutTab: null, activePjTab: '__all__' }

// State antar-modul (dideklarasikan di atas agar tidak kena TDZ apa pun urutan akses)
let _supplierNames = []
let _poData = []
let _realData = []
let _realisasiAll = []
let _penerimaanAll = []
let _terimaItems = []
let _terimaHarga = 0
let _editTerima = null
let _editPO = null, _editReal = null, _editPin = null, _editHut = null, _editPrb = null, _editIter = null
let _editMut = null, _editSo = null, _editAng = null
let _currentUser = null

function showLoading(v) { document.getElementById('loading-overlay').classList.toggle('show', v) }

function toast(msg, type = 'success') {
  const el = qs('toast')
  el.textContent = msg
  el.className = 'show ' + type
  clearTimeout(el._t)
  el._t = setTimeout(() => el.classList.remove('show'), 2800)
}

function confirm2(msg) { return window.confirm(msg) }

/* ── EXPORT (download file ber-auth) ── */
async function downloadFile(path, filename) {
  showLoading(true)
  try {
    const res = await fetch('/api' + path, { headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') } })
    if (res.status === 401) { localStorage.removeItem('token'); if (window.onAuthExpired) window.onAuthExpired(); throw new Error('Sesi berakhir, silakan login lagi') }
    if (!res.ok) throw new Error('Gagal export (HTTP ' + res.status + ')')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast('File diunduh')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-export]'); if (!b) return
  const grp = b.closest('.export-group')
  const dari = grp?.querySelector('[data-dari]')?.value || ''
  const sampai = grp?.querySelector('[data-sampai]')?.value || ''
  let path = b.dataset.export
  if (dari || sampai) path += (path.includes('?') ? '&' : '?') + `dari=${dari}&sampai=${sampai}`
  downloadFile(path, b.dataset.fn || 'export.xlsx')
})

/* ── PAGINATION (otomatis, per tbody) ── */
function setupPager(tbodyId, perPage = 10) {
  const tbody = document.getElementById(tbodyId); if (!tbody) return
  const wrap = tbody.closest('.table-wrap'); if (!wrap) return
  let pager = wrap.nextElementSibling
  if (!pager || !pager.classList.contains('pager')) { pager = document.createElement('div'); pager.className = 'pager'; wrap.after(pager) }
  let page = 1
  const dataRows = () => [...tbody.children].filter(tr => tr.tagName === 'TR' && !(tr.children.length === 1 && tr.children[0].hasAttribute('colspan')))
  function apply() {
    const rows = dataRows(), total = rows.length, pages = Math.max(1, Math.ceil(total / perPage))
    if (page > pages) page = pages
    if (page < 1) page = 1
    rows.forEach((tr, i) => { tr.style.display = (i >= (page - 1) * perPage && i < page * perPage) ? '' : 'none' })
    pager.innerHTML = total > perPage
      ? `<button class="btn sm" data-pg="prev" ${page <= 1 ? 'disabled' : ''}><i class="ti ti-chevron-left"></i></button>
         <span style="font-size:12px;color:var(--tx2)">Hal ${page}/${pages} · ${total} data</span>
         <button class="btn sm" data-pg="next" ${page >= pages ? 'disabled' : ''}><i class="ti ti-chevron-right"></i></button>`
      : ''
  }
  pager.addEventListener('click', e => { const x = e.target.closest('[data-pg]'); if (!x) return; page += x.dataset.pg === 'next' ? 1 : -1; apply() })
  new MutationObserver(() => { page = 1; apply() }).observe(tbody, { childList: true })
  apply()
}

/* ── NAVIGATION ── */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showPage(btn.dataset.page))
})

async function showPage(p) {
  document.querySelectorAll('.page').forEach(e => e.classList.remove('active'))
  document.querySelectorAll('.nav-btn').forEach(e => e.classList.remove('active'))
  qs('page-' + p).classList.add('active')
  document.querySelector(`.nav-btn[data-page="${p}"]`).classList.add('active')
  const loaders = { dashboard: loadDashboard, anggaran: loadAnggaran, po: loadPO, pinjaman: loadPinjaman, mutasi: loadMutasi, penjualan: loadPenjualan, bpjs: loadBPJS, arsip: loadArsip, stokopname: loadStokOpname, rekap: loadRekap }
  if (loaders[p]) { showLoading(true); try { await loaders[p]() } catch (e) { toast(e.message, 'error') } finally { showLoading(false) } }
}

/* ── DASHBOARD ── */
async function loadDashboard() {
  const [ang, beli, mut, pj, tujuan, kats, tidakDatang, so] = await Promise.all([
    API.getAnggaran(), API.getPenerimaan(), API.getMutasi(),
    API.getPenjualan(), API.getTujuan(), API.getKategori(), API.getTidakDatang(), API.getStokOpname()
  ])
  STATE.tujuan = tujuan; STATE.kategori = kats
  const todayStr = today()
  const pjToday = pj.filter(d => d.tgl === todayStr)
  const totalPjN = pj.reduce((s, d) => s + d.total_nominal, 0)
  const totalBeli = beli.reduce((s, d) => s + d.total, 0)
  const totalMut = mut.reduce((s, d) => s + (d.jml || 0), 0)
  const totalAng = ang.reduce((s, d) => s + d.total, 0)

  qs('dash-cards').innerHTML = `
    <div class="metric-card"><div class="metric-label">Total Anggaran</div><div class="metric-val blue">${fmt(totalAng)}</div></div>
    <div class="metric-card"><div class="metric-label">Total Penerimaan</div><div class="metric-val amber">${fmt(totalBeli)}</div></div>
    <div class="metric-card"><div class="metric-label">Total Mutasi</div><div class="metric-val green">${fmt(totalMut)}</div></div>
    <div class="metric-card"><div class="metric-label">Total Penjualan</div><div class="metric-val purple">${fmt(totalPjN)}</div></div>`

  const lastAng = ang[0]
  if (lastAng) {
    const pct = lastAng.total ? Math.min(100, Math.round(lastAng.terpakai / lastAng.total * 100)) : 0
    qs('dash-anggaran').innerHTML = `
      <div style="font-weight:600;margin-bottom:6px">${lastAng.bulan}</div>
      <div class="rekap-row"><span>Total</span><span>${fmt(lastAng.total)}</span></div>
      <div class="rekap-row"><span>Terpakai</span><span>${fmt(lastAng.terpakai)}</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${pct>90?'#E24B4A':pct>70?'#EF9F27':'#1D9E75'}"></div></div>
      <div style="text-align:right;font-size:11px;color:var(--text-sec);margin-top:2px">${pct}% terpakai</div>`
  } else { qs('dash-anggaran').innerHTML = '<div class="empty"><i class="ti ti-wallet"></i>Belum ada anggaran</div>' }

  const tujuanMap = Object.fromEntries(tujuan.map(t => [t.id, t.label]))
  if (pjToday.length) {
    const totalR = pjToday.reduce((s, d) => s + d.total_resep, 0)
    const totalN = pjToday.reduce((s, d) => s + d.total_nominal, 0)
    qs('dash-penjualan').innerHTML = `
      <div class="rekap-row"><span>Total Resep</span><span style="font-weight:600">${fmtN(totalR)} resep</span></div>
      <div class="rekap-row"><span>Total Nominal</span><span style="font-weight:600;color:var(--green)">${fmt(totalN)}</span></div>
      ${kats.map((k, i) => { const r = pjToday.reduce((s, d) => s + (d.detail[k.id]?.resep || 0), 0); const n = pjToday.reduce((s, d) => s + (d.detail[k.id]?.nominal || 0), 0); return r||n?`<div class="rekap-row"><span style="color:${KAT_HEX[i%KAT_HEX.length]}">${k.label}</span><span style="font-size:12px">${fmtN(r)} resep · ${fmt(n)}</span></div>`:'' }).join('')}`
  } else { qs('dash-penjualan').innerHTML = '<div class="empty"><i class="ti ti-cash"></i>Belum ada data hari ini</div>' }

  qs('dash-mutasi').innerHTML = mut.slice(0, 4).map(d => `<div class="rekap-row"><span>${tujuanMap[d.tujuan] || d.tujuan}</span><span style="font-size:12px;color:var(--tx2)">${d.tgl} · ${fmt(d.jml)}</span></div>`).join('') || '<div class="empty"><i class="ti ti-transfer"></i>Belum ada data</div>'
  qs('dash-pembelian').innerHTML = beli.slice(0, 4).map(d => `<div class="rekap-row"><span>${d.supplier||'-'}</span><span style="font-weight:600">${fmt(d.total)}</span></div>`).join('') || '<div class="empty"><i class="ti ti-shopping-cart"></i>Belum ada data</div>'

  const supMap = {}
  beli.forEach(d => { if (d.supplier) supMap[d.supplier] = (supMap[d.supplier] || 0) + (d.total || 0) })
  const top5Sup = Object.entries(supMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
  qs('dash-supplier').innerHTML = top5Sup.map(([nama, total]) =>
    `<div class="rekap-row"><span>${nama}</span><span style="font-weight:600">${fmt(total)}</span></div>`
  ).join('') || '<div class="empty"><i class="ti ti-truck"></i>Belum ada data pembelian</div>'

  const countMap = {}
  tidakDatang.forEach(d => { countMap[d.nama] = (countMap[d.nama] || 0) + 1 })
  const top5 = Object.entries(countMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
  qs('dash-tidak-datang').innerHTML = top5.map(([nama, count]) =>
    `<div class="rekap-row"><span>${nama}</span><span class="badge amber">${count}x tidak datang</span></div>`
  ).join('') || '<div class="empty"><i class="ti ti-circle-check"></i>Tidak ada laporan obat tidak datang</div>'

  const soByRuangan = {}
  so.forEach(d => {
    const r = d.ruangan || 'Umum'
    if (!soByRuangan[r]) soByRuangan[r] = { sebelum: 0, sesudah: 0, selisih: 0 }
    soByRuangan[r].sebelum += d.nilai_sebelum
    soByRuangan[r].sesudah += d.nilai_sesudah
    soByRuangan[r].selisih += d.selisih
  })
  const soEntries = Object.entries(soByRuangan)
  qs('dash-so').innerHTML = soEntries.length
    ? soEntries.map(([ruangan, v]) => `<div class="rekap-row">
        <div><div style="font-size:13px;font-weight:600">${ruangan}</div>
        <div style="font-size:11px;color:var(--tx2)">Sebelum: ${fmt(v.sebelum)} → Sesudah: ${fmt(v.sesudah)}</div></div>
        <div style="font-weight:600;${v.selisih<0?'color:#E24B4A':v.selisih>0?'color:var(--green)':''}">${(v.selisih>0?'+':'')+fmt(v.selisih)}</div>
      </div>`).join('')
    : '<div class="empty"><i class="ti ti-clipboard-list"></i>Belum ada data stok opname</div>'
}

/* ── ANGGARAN ── */
let _angData = []
async function loadAnggaran() {
  const data = await API.getAnggaran()
  renderAnggaranTable(data)
}

function renderAnggaranTable(data) {
  _angData = data
  const tbody = qs('ang-tbody')
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="8"><div class="empty">Belum ada data anggaran</div></td></tr>'; return }
  tbody.innerHTML = data.map(d => {
    const pct = d.total ? Math.min(100, Math.round(d.terpakai / d.total * 100)) : 0
    return `<tr>
      <td>${d.bulan}</td><td>${fmt(d.total)}</td><td>${fmt(d.ranap)}</td><td>${fmt(d.ralan)}</td>
      <td>${fmt(d.terpakai)}<div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${pct>90?'#E24B4A':pct>70?'#EF9F27':'#1D9E75'}"></div></div></td>
      <td style="color:${d.sisa<0?'#A32D2D':'#0F6E56'}">${fmt(d.sisa)}</td>
      <td style="font-size:12px;color:var(--text-sec)">${d.ket || '-'}</td>
      <td><button class="btn sm" data-id="${d.id}" data-action="edit-ang"><i class="ti ti-pencil"></i></button> <button class="btn sm danger" data-id="${d.id}" data-action="del-ang"><i class="ti ti-trash"></i></button></td></tr>`
  }).join('')
}

qs('ang-save-btn').addEventListener('click', async () => {
  const bulan = qs('ang-bulan').value, total = qs('ang-total').value
  if (!bulan || !total) { toast('Periode dan total wajib diisi', 'error'); return }
  showLoading(true)
  try {
    await API.saveAnggaran({ bulan, total: +total, ranap: +(qs('ang-ranap').value || 0), ralan: +(qs('ang-ralan').value || 0), ket: qs('ang-ket').value })
    ;['ang-bulan','ang-total','ang-ranap','ang-ralan','ang-ket'].forEach(id => qs(id).value = '')
    _editAng = null; qs('ang-save-btn').innerHTML = '<i class="ti ti-device-floppy"></i>Simpan Anggaran'
    const data = await API.getAnggaran(); renderAnggaranTable(data)
    await populateAnggaranSelect()
    toast('Tersimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="edit-ang"]'); if (!b) return
  const d = _angData.find(x => String(x.id) === b.dataset.id); if (!d) return
  qs('ang-bulan').value = d.bulan || ''
  qs('ang-total').value = d.total || ''
  qs('ang-ranap').value = d.ranap || ''
  qs('ang-ralan').value = d.ralan || ''
  qs('ang-ket').value = d.ket || ''
  _editAng = d.id
  qs('ang-save-btn').innerHTML = '<i class="ti ti-pencil"></i>Update Anggaran'
  qs('ang-bulan').scrollIntoView({ behavior: 'smooth', block: 'center' })
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-ang"]')) {
    if (!confirm2('Hapus data anggaran ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try { await API.delAnggaran(id); const data = await API.getAnggaran(); renderAnggaranTable(data); toast('Dihapus') }
    catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

async function populateAnggaranSelect() {
  const el = qs('beli-anggaran')
  if (!el) return
  const data = await API.getAnggaran()
  el.innerHTML = '<option value="">-- Pilih Periode --</option>' + data.map(d => `<option value="${d.bulan}">${d.bulan}</option>`).join('')
}

/* ── SUPPLIER ── */
async function loadSupplierSelects() {
  const list = await API.getSupplier()
  const datalistOpts = list.map(s => `<option value="${s.nama}">`).join('')
  ;['beli-supplier-list', 'beli-filter-list', 'po-supplier-list', 'po-filter-list', 'real-supplier-list', 'terima-supplier-list']
    .forEach(id => { const el = qs(id); if (el) el.innerHTML = datalistOpts })
  _supplierNames = list.map(s => s.nama)
}

async function renderSupplierModal() {
  const list = await API.getSupplier()
  qs('supplier-list-modal').innerHTML = list.length
    ? list.map(s => `<div class="item-row"><div class="item-row-label"><span>${s.nama}</span></div><button class="btn sm" data-id="${s.id}" data-action="edit-supplier"><i class="ti ti-pencil"></i></button> <button class="btn sm danger" data-id="${s.id}" data-action="del-supplier"><i class="ti ti-trash"></i></button></div>`).join('')
    : '<div class="empty" style="padding:8px">Belum ada supplier</div>'
}

qs('supplier-close-btn').addEventListener('click', async () => {
  qs('modal-supplier').classList.remove('open'); await loadSupplierSelects()
})
qs('modal-supplier').addEventListener('click', async e => {
  if (e.target === qs('modal-supplier')) { qs('modal-supplier').classList.remove('open'); await loadSupplierSelects() }
})
qs('supplier-add-btn').addEventListener('click', async () => {
  const nama = qs('supplier-new-input').value.trim()
  if (!nama) { toast('Nama supplier tidak boleh kosong', 'error'); return }
  try { await API.saveSupplier({ nama }); qs('supplier-new-input').value = ''; await renderSupplierModal(); toast('Supplier ditambahkan') }
  catch (e) { toast(e.message, 'error') }
})
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action="edit-supplier"]'); if (!b) return
  const cur = b.closest('.item-row').querySelector('.item-row-label span').textContent
  const v = prompt('Nama supplier baru:', cur); if (v == null) return
  const t = v.trim(); if (!t || t === cur) return
  try { await API.updateSupplier(b.dataset.id, { nama: t }); await renderSupplierModal(); await loadSupplierSelects(); toast('Diperbarui') }
  catch (err) { toast(err.message, 'error') }
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-supplier"]')) {
    if (!confirm2('Hapus supplier ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    try { await API.delSupplier(id); await renderSupplierModal(); toast('Dihapus') }
    catch (e) { toast(e.message, 'error') }
  }
})

/* ── PENERIMAAN (berdasarkan No PO) ── */
async function loadPembelian() {
  _editTerima = null
  qs('terima-save-btn').innerHTML = '<i class="ti ti-device-floppy"></i>Simpan Penerimaan'
  await loadSupplierSelects()
  const [real, td] = await Promise.all([API.getRealisasi(), API.getTidakDatang()])
  _realisasiAll = real
  const poNos = [...new Set(real.map(d => d.no_po).filter(Boolean))]
  qs('terima-nopo-list').innerHTML = poNos.map(n => `<option value="${n}">`).join('')
  renderTerimaItems()
  renderTidakDatangTable(td)
  await renderPenerimaanHistory()
}

function renderTerimaItems(prefill) {
  const box = qs('terima-items')
  const noPo = qs('terima-nopo').value.trim()
  if (!noPo) { box.innerHTML = '<div class="empty" style="padding:8px">Pilih No PO untuk menampilkan barang</div>'; _terimaItems = []; recalcTerima(); return }
  const poLines = _realisasiAll.filter(d => d.no_po === noPo)
  if (!poLines.length) { box.innerHTML = `<div class="empty" style="padding:8px">Tidak ada barang untuk PO "${noPo}". Tambahkan dulu di tab Realisasi Pembelian.</div>`; _terimaItems = []; recalcTerima(); return }
  // Hitung jumlah yang sudah diterima sebelumnya per baris PO
  // (saat edit, penerimaan yang sedang diedit tidak dihitung agar jatahnya kembali tersedia)
  const received = {}
  _penerimaanAll.filter(p => p.no_po === noPo && String(p.id) !== String(_editTerima)).forEach(p => (p.items || []).forEach(it => {
    if (it.real_id != null) received['id:' + it.real_id] = (received['id:' + it.real_id] || 0) + (+it.jumlah_terima || 0)
    else received['nm:' + it.barang] = (received['nm:' + it.barang] || 0) + (+it.jumlah_terima || 0)
  }))
  const items = poLines.map(line => {
    const recv = (received['id:' + line.id] || 0) + (received['nm:' + line.barang] || 0)
    return { ...line, sisa: Math.max(0, (+line.jumlah || 0) - recv) }
  }).filter(l => l.sisa > 0)
  if (!items.length) { box.innerHTML = `<div class="empty" style="padding:8px"><i class="ti ti-checks"></i> Semua barang PO "${noPo}" sudah diterima.</div>`; _terimaItems = []; recalcTerima(); return }
  _terimaItems = items
  box.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Nama Barang</th><th style="text-align:right">Harga PO</th><th style="text-align:right">Harga Penerimaan</th><th style="text-align:right">Diskon (%)</th><th style="text-align:right">Jml Diterima</th><th>Status</th></tr></thead>
    <tbody>${items.map((it, i) => {
      const pf = prefill ? (prefill['id:' + it.id] || prefill['nm:' + it.barang]) : null
      const status = pf ? pf.status : 'datang'
      const harga = pf ? (+pf.harga_terima || 0) : (+it.harga_satuan || 0)
      const disk = pf ? (+pf.diskon || 0) : 0
      const qty = status === 'tidak' ? 0 : status === 'sebagian' ? (+pf.jumlah_terima || 0) : it.sisa
      return `<tr>
      <td>${it.barang}<div style="font-size:11px;color:var(--tx2)">sisa ${it.sisa} dari ${it.jumlah}</div></td>
      <td style="text-align:right">${fmt(it.harga_satuan)}</td>
      <td style="text-align:right"><input type="number" class="input-sm terima-hargaterima" data-i="${i}" value="${harga}" min="0" style="width:96px;text-align:right" oninput="recalcTerima()"></td>
      <td style="text-align:right"><input type="number" class="input-sm terima-disk" data-i="${i}" value="${disk}" min="0" max="100" style="width:62px;text-align:right" oninput="recalcTerima()"></td>
      <td style="text-align:right"><input type="number" class="input-sm terima-qty" data-i="${i}" value="${qty}" min="0" max="${it.sisa}" ${status === 'sebagian' ? '' : 'disabled'} style="width:74px;text-align:right" oninput="recalcTerima()"></td>
      <td><select class="input-sm terima-status" data-i="${i}" onchange="onTerimaStatus(this)">
        <option value="datang"${status === 'datang' ? ' selected' : ''}>Datang</option>
        <option value="sebagian"${status === 'sebagian' ? ' selected' : ''}>Datang Sebagian</option>
        <option value="tidak"${status === 'tidak' ? ' selected' : ''}>Tidak Datang</option>
      </select></td>
    </tr>`
    }).join('')}</tbody></table></div>`
  recalcTerima()
}

function onTerimaStatus(sel) {
  const i = sel.dataset.i
  const qty = document.querySelector(`.terima-qty[data-i="${i}"]`)
  const max = +(_terimaItems[i]?.sisa || 0)
  if (sel.value === 'sebagian') { qty.disabled = false; if (!+qty.value || +qty.value >= max) qty.value = max }
  else if (sel.value === 'tidak') { qty.disabled = true; qty.value = 0 }
  else { qty.disabled = true; qty.value = max }
  recalcTerima()
}

function recalcTerima() {
  let harga = 0, hargaPO = 0
  _terimaItems.forEach((it, i) => {
    const sel = document.querySelector(`.terima-status[data-i="${i}"]`)
    const qtyEl = document.querySelector(`.terima-qty[data-i="${i}"]`)
    const priceEl = document.querySelector(`.terima-hargaterima[data-i="${i}"]`)
    const diskEl = document.querySelector(`.terima-disk[data-i="${i}"]`)
    const status = sel ? sel.value : 'datang'
    const sisa = +(it.sisa || 0)
    let terima = status === 'datang' ? sisa : status === 'tidak' ? 0 : +(qtyEl?.value || 0)
    if (terima > sisa) terima = sisa
    if (terima < 0) terima = 0
    const hpUnit = priceEl ? +(priceEl.value || 0) : (+it.harga_satuan || 0)
    const disk = diskEl ? +(diskEl.value || 0) : 0
    harga += terima * hpUnit * (1 - disk / 100)
    hargaPO += sisa * (+it.harga_satuan || 0)
  })
  _terimaHarga = Math.round(harga)
  const pajak = Math.round(_terimaHarga * 0.11)
  const selisih = hargaPO - _terimaHarga
  qs('terima-hargapo').value = fmt(hargaPO)
  qs('terima-harga').value = fmt(_terimaHarga)
  const selEl = qs('terima-selisih')
  selEl.value = fmt(selisih)
  selEl.style.color = selisih > 0 ? '#E24B4A' : 'inherit'
  qs('terima-pajak').value = fmt(pajak)
  qs('terima-total').value = fmt(_terimaHarga + pajak)
}

async function renderPenerimaanHistory() {
  _penerimaanAll = await API.getPenerimaan()
  const data = _penerimaanAll
  const tbody = qs('terima-tbody')
  const f = qs('terima-filter-nopo').value.trim().toLowerCase()
  const rows = f ? data.filter(d => (d.no_po || '').toLowerCase().includes(f)) : data
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="12"><div class="empty"><i class="ti ti-package"></i>Belum ada penerimaan</div></td></tr>'; return }
  const todayStr = new Date().toISOString().slice(0, 10)
  tbody.innerHTML = rows.map(d => {
    const items = d.items || []
    const dC = items.filter(x => x.status === 'datang').length
    const sC = items.filter(x => x.status === 'sebagian').length
    const tC = items.filter(x => x.status === 'tidak').length
    const summ = [dC ? `${dC} datang` : '', sC ? `${sC} sebagian` : '', tC ? `${tC} tdk` : ''].filter(Boolean).join(', ')
    const total = d.total != null ? d.total : (d.harga || 0) + (d.pajak || 0)
    const jt = d.tgl_jatuh_tempo
    const jtStyle = jt && jt < todayStr ? 'color:#E24B4A;font-weight:600' : jt && jt === todayStr ? 'color:var(--amb-dk);font-weight:600' : ''
    return `<tr>
      <td>${d.tgl}${d.dibuat_oleh ? `<div style="font-size:11px;color:var(--tx3)">oleh ${d.dibuat_oleh}</div>` : ''}</td>
      <td><span class="badge gray">${d.no_po}</span></td>
      <td style="font-size:12px">${d.no_faktur || '-'}</td>
      <td style="font-size:12px">${d.tgl_faktur || '-'}</td>
      <td style="font-size:12px;${jtStyle}">${jt || '-'}${jt && jt < todayStr ? ' ⚠' : ''}</td>
      <td>${d.supplier || '-'}</td>
      <td>${items.length} item${summ ? `<div style="font-size:11px;color:var(--tx2)">${summ}</div>` : ''}</td>
      <td style="text-align:right">${fmt(d.harga)}</td>
      <td style="text-align:right">${fmt(d.pajak)}</td>
      <td style="text-align:right;font-weight:600">${fmt(total)}</td>
      <td>${d.anggaran ? `<span class="badge gray">${d.anggaran}</span>` : '-'}</td>
      <td style="white-space:nowrap"><button class="btn sm" data-id="${d.id}" data-action="edit-terima"><i class="ti ti-pencil"></i></button> <button class="btn sm danger" data-id="${d.id}" data-action="del-terima"><i class="ti ti-trash"></i></button></td>
    </tr>`
  }).join('')
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="edit-terima"]'); if (!b) return
  const d = _penerimaanAll.find(x => String(x.id) === b.dataset.id); if (!d) return
  _editTerima = d.id
  qs('terima-tgl').value = d.tgl || ''
  qs('terima-nopo').value = d.no_po || ''
  qs('terima-faktur').value = d.no_faktur || ''
  qs('terima-tgl-faktur').value = d.tgl_faktur || ''
  qs('terima-jatuh-tempo').value = d.tgl_jatuh_tempo || ''
  qs('terima-supplier').value = d.supplier || ''
  const prefill = {}
  ;(d.items || []).forEach(it => {
    const v = { status: it.status, jumlah_terima: it.jumlah_terima, harga_terima: it.harga_terima, diskon: it.diskon || 0 }
    if (it.real_id != null) prefill['id:' + it.real_id] = v
    prefill['nm:' + it.barang] = v
  })
  renderTerimaItems(prefill)
  qs('terima-save-btn').innerHTML = '<i class="ti ti-pencil"></i>Update Penerimaan'
  qs('terima-nopo').scrollIntoView({ behavior: 'smooth', block: 'center' })
})

qs('terima-nopo').addEventListener('input', () => {
  renderTerimaItems()
  const no = qs('terima-nopo').value.trim()
  const match = _realisasiAll.find(d => d.no_po === no)
  if (!match) return
  if (match.supplier && !qs('terima-supplier').value.trim()) qs('terima-supplier').value = match.supplier
})
qs('terima-filter-nopo').addEventListener('input', renderPenerimaanHistory)

qs('terima-save-btn').addEventListener('click', async () => {
  const noPo = qs('terima-nopo').value.trim()
  if (!noPo) { toast('Pilih No PO dulu', 'error'); return }
  if (!_terimaItems.length) { toast('Tidak ada barang pada PO ini', 'error'); return }
  const items = _terimaItems.map((it, i) => {
    const sel = document.querySelector(`.terima-status[data-i="${i}"]`)
    const qtyEl = document.querySelector(`.terima-qty[data-i="${i}"]`)
    const priceEl = document.querySelector(`.terima-hargaterima[data-i="${i}"]`)
    const diskEl = document.querySelector(`.terima-disk[data-i="${i}"]`)
    const status = sel ? sel.value : 'datang'
    const sisa = +(it.sisa || 0)
    const jumlah_terima = status === 'datang' ? sisa : status === 'tidak' ? 0 : +(qtyEl?.value || 0)
    const harga_terima = priceEl ? +(priceEl.value || 0) : (+it.harga_satuan || 0)
    const diskon = diskEl ? +(diskEl.value || 0) : 0
    return { real_id: it.id, barang: it.barang, jumlah: sisa, jumlah_terima, harga_terima, diskon, status }
  })
  const match = _realisasiAll.find(d => d.no_po === noPo)
  const anggaran = match ? (match.anggaran || '') : ''
  showLoading(true)
  try {
    const payload = {
      tgl: qs('terima-tgl').value || today(), no_po: noPo,
      no_faktur: qs('terima-faktur').value.trim(),
      tgl_faktur: qs('terima-tgl-faktur').value, tgl_jatuh_tempo: qs('terima-jatuh-tempo').value,
      supplier: qs('terima-supplier').value.trim(),
      anggaran, harga: _terimaHarga, pajak: Math.round(_terimaHarga * 0.11),
      items
    }
    if (_editTerima) { await API.updatePenerimaan(_editTerima, payload); _editTerima = null; qs('terima-save-btn').innerHTML = '<i class="ti ti-device-floppy"></i>Simpan Penerimaan' }
    else { await API.savePenerimaan(payload) }
    ;['terima-nopo', 'terima-faktur', 'terima-tgl-faktur', 'terima-jatuh-tempo', 'terima-supplier'].forEach(id => qs(id).value = '')
    await renderPenerimaanHistory()
    renderTerimaItems()
    renderTidakDatangTable(await API.getTidakDatang())
    toast('Penerimaan disimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-terima"]')) {
    if (!confirm2('Hapus penerimaan ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try { await API.delPenerimaan(id); if (String(_editTerima) === String(id)) { _editTerima = null; qs('terima-save-btn').innerHTML = '<i class="ti ti-device-floppy"></i>Simpan Penerimaan' } await renderPenerimaanHistory(); toast('Dihapus') }
    catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

/* ── REALISASI PEMBELIAN + DIRECTORY BARANG ── */
async function loadBarangSelects() {
  const list = await API.getBarang()
  const opts = list.map(b => `<option value="${b.nama}">`).join('')
  ;['real-barang-list', 'hut-item-list', 'blm-obat-list'].forEach(id => { const el = qs(id); if (el) el.innerHTML = opts })
}

function calcRealTotal() {
  const j = +(qs('real-jumlah').value || 0), h = +(qs('real-harga').value || 0)
  qs('real-total').value = fmt(j * h)
}

async function loadRealisasi() {
  await Promise.all([loadBarangSelects(), loadSupplierSelects()])
  const ang = await API.getAnggaran()
  qs('real-anggaran').innerHTML = '<option value="">-- Pilih --</option>' + ang.map(a => `<option value="${a.bulan}">${a.bulan}</option>`).join('')
  _realData = await API.getRealisasi()
  renderRealisasiTable(_realData)
}

function renderRealisasiTable(data) {
  const tbody = qs('real-tbody'), tfoot = qs('real-tfoot')
  const f = qs('real-filter-nopo').value.trim().toLowerCase()
  const rows = f ? data.filter(d => [d.no_po, d.supplier, d.barang, d.anggaran, d.tgl_po].some(v => (v || '').toString().toLowerCase().includes(f))) : data
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="9"><div class="empty"><i class="ti ti-checklist"></i>Belum ada realisasi</div></td></tr>'; tfoot.innerHTML = ''; return }
  let total = 0
  tbody.innerHTML = rows.map(d => {
    total += d.harga_total || 0
    return `<tr>
      <td>${d.tgl_po}${d.dibuat_oleh ? `<div style="font-size:11px;color:var(--tx3)">oleh ${d.dibuat_oleh}</div>` : ''}</td>
      <td><span class="badge gray">${d.no_po}</span></td>
      <td>${d.supplier||'-'}</td>
      <td>${d.anggaran?`<span class="badge gray">${d.anggaran}</span>`:'-'}</td>
      <td>${d.barang}</td>
      <td style="text-align:right">${d.jumlah}</td>
      <td style="text-align:right">${fmt(d.harga_satuan)}</td>
      <td style="text-align:right;font-weight:600">${fmt(d.harga_total)}</td>
      <td><button class="btn sm" data-id="${d.id}" data-action="edit-real"><i class="ti ti-pencil"></i></button> <button class="btn sm danger" data-id="${d.id}" data-action="del-real"><i class="ti ti-trash"></i></button></td>
    </tr>`
  }).join('')
  tfoot.innerHTML = `<tr style="font-weight:700;border-top:2px solid var(--bd)"><td colspan="7">Total (${rows.length} item)</td><td style="text-align:right">${fmt(total)}</td><td></td></tr>`
}

// Saat No PO diketik & sudah ada di data, isi otomatis distributor & anggarannya
qs('real-nopo').addEventListener('input', () => {
  const no = qs('real-nopo').value.trim()
  if (!no) return
  const match = _realData.find(d => d.no_po === no)
  if (!match) return
  if (match.supplier && !qs('real-supplier').value.trim()) qs('real-supplier').value = match.supplier
  if (match.anggaran && !qs('real-anggaran').value) qs('real-anggaran').value = match.anggaran
})

qs('real-filter-nopo').addEventListener('input', () => renderRealisasiTable(_realData))

qs('real-save-btn').addEventListener('click', async () => {
  const no_po = qs('real-nopo').value.trim(), barang = qs('real-barang').value.trim()
  if (!no_po) { toast('No PO wajib diisi', 'error'); return }
  if (!barang) { toast('Nama barang wajib diisi', 'error'); return }
  showLoading(true)
  try {
    const payload = { no_po, tgl_po: qs('real-tgl').value || today(), supplier: qs('real-supplier').value.trim(), anggaran: qs('real-anggaran').value, barang, jumlah: qs('real-jumlah').value, harga_satuan: qs('real-harga').value }
    if (_editReal) { await API.updateRealisasi(_editReal, payload); _editReal = null; qs('real-save-btn').innerHTML = '<i class="ti ti-device-floppy"></i>Simpan Realisasi' }
    else { await API.saveRealisasi(payload) }
    ;['real-barang', 'real-jumlah', 'real-harga', 'real-total'].forEach(id => qs(id).value = '')
    _realData = await API.getRealisasi(); renderRealisasiTable(_realData)
    toast('Tersimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="edit-real"]'); if (!b) return
  const d = _realData.find(x => String(x.id) === b.dataset.id); if (!d) return
  qs('real-nopo').value = d.no_po || ''
  qs('real-tgl').value = d.tgl_po || ''
  qs('real-supplier').value = d.supplier || ''
  qs('real-anggaran').value = d.anggaran || ''
  qs('real-barang').value = d.barang || ''
  qs('real-jumlah').value = d.jumlah || ''
  qs('real-harga').value = d.harga_satuan || ''
  calcRealTotal()
  _editReal = d.id
  qs('real-save-btn').innerHTML = '<i class="ti ti-pencil"></i>Update Realisasi'
  qs('real-nopo').scrollIntoView({ behavior: 'smooth', block: 'center' })
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-real"]')) {
    if (!confirm2('Hapus realisasi ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try { await API.delRealisasi(id); _realData = await API.getRealisasi(); renderRealisasiTable(_realData); toast('Dihapus') }
    catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

// Tab Penjualan: Penjualan / Obat Dihutangkan / Obat Belum Diambil
document.querySelectorAll('[data-pjtab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.pjtab
    document.querySelectorAll('[data-pjtab]').forEach(b => b.classList.toggle('primary', b.dataset.pjtab === tab))
    qs('pjtab-jual').style.display = tab === 'jual' ? '' : 'none'
    qs('pjtab-hutang').style.display = tab === 'hutang' ? '' : 'none'
    qs('pjtab-belum').style.display = tab === 'belum' ? '' : 'none'
  })
})

// Tab Pembelian: Rencana / Realisasi
document.querySelectorAll('[data-potab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.potab
    document.querySelectorAll('[data-potab]').forEach(b => b.classList.toggle('primary', b.dataset.potab === tab))
    qs('potab-rencana').style.display = tab === 'rencana' ? '' : 'none'
    qs('potab-realisasi').style.display = tab === 'realisasi' ? '' : 'none'
    qs('potab-penerimaan').style.display = tab === 'penerimaan' ? '' : 'none'
    if (tab === 'realisasi') loadRealisasi()
    if (tab === 'penerimaan') loadPembelian()
  })
})

/* Modal Kelola Barang */
async function renderBarangModal() {
  const list = await API.getBarang()
  qs('barang-list-modal').innerHTML = list.length
    ? list.map(b => `<div class="item-row"><div class="item-row-label"><span>${b.nama}</span></div><button class="btn sm" data-id="${b.id}" data-action="edit-barang"><i class="ti ti-pencil"></i></button> <button class="btn sm danger" data-id="${b.id}" data-action="del-barang"><i class="ti ti-trash"></i></button></div>`).join('')
    : '<div class="empty" style="padding:8px">Belum ada barang</div>'
}
qs('btn-kelola-barang').addEventListener('click', async () => {
  qs('barang-modal-srch').value = ''
  await renderBarangModal(); qs('modal-barang').classList.add('open')
})
qs('btn-kelola-supplier-real').addEventListener('click', async () => {
  qs('supplier-modal-srch').value = ''
  await renderSupplierModal(); qs('modal-supplier').classList.add('open')
})
qs('barang-close-btn').addEventListener('click', async () => {
  qs('modal-barang').classList.remove('open'); await loadBarangSelects()
})
qs('modal-barang').addEventListener('click', async e => {
  if (e.target === qs('modal-barang')) { qs('modal-barang').classList.remove('open'); await loadBarangSelects() }
})
qs('barang-add-btn').addEventListener('click', async () => {
  const nama = qs('barang-new-input').value.trim()
  if (!nama) { toast('Nama barang tidak boleh kosong', 'error'); return }
  try { await API.saveBarang({ nama }); qs('barang-new-input').value = ''; await renderBarangModal(); toast('Barang ditambahkan') }
  catch (e) { toast(e.message, 'error') }
})
qs('barang-import-btn').addEventListener('click', async () => {
  const f = qs('barang-import-file').files[0]
  if (!f) { toast('Pilih file Excel/CSV dulu', 'error'); return }
  const fd = new FormData(); fd.append('file', f)
  showLoading(true)
  try {
    const r = await API.importBarang(fd)
    qs('barang-import-file').value = ''
    await renderBarangModal(); await loadBarangSelects()
    toast(`${r.added} barang ditambahkan${r.skipped ? `, ${r.skipped} dilewati (duplikat)` : ''}`)
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action="edit-barang"]'); if (!b) return
  const cur = b.closest('.item-row').querySelector('.item-row-label span').textContent
  const v = prompt('Nama barang baru:', cur); if (v == null) return
  const t = v.trim(); if (!t || t === cur) return
  try { await API.updateBarang(b.dataset.id, { nama: t }); await renderBarangModal(); await loadBarangSelects(); toast('Diperbarui') }
  catch (err) { toast(err.message, 'error') }
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-barang"]')) {
    if (!confirm2('Hapus barang ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    try { await API.delBarang(id); await renderBarangModal(); toast('Dihapus') }
    catch (e) { toast(e.message, 'error') }
  }
})

/* ── PEMBELIAN (PO KE DISTRIBUTOR) ── */
async function loadPO() {
  // default ke tab Rencana Pembelian
  qs('potab-rencana').style.display = ''
  qs('potab-realisasi').style.display = 'none'
  qs('potab-penerimaan').style.display = 'none'
  document.querySelectorAll('[data-potab]').forEach(b => b.classList.toggle('primary', b.dataset.potab === 'rencana'))
  await loadSupplierSelects()
  _poData = await API.getPO()
  renderPOTable(_poData)
}

function renderPOTable(data) {
  const tbody = qs('po-tbody'), tfoot = qs('po-tfoot')
  const filterSup = qs('po-filter-supplier').value.trim().toLowerCase()
  let rows = filterSup ? data.filter(d => (d.supplier || '').toLowerCase().includes(filterSup)) : data.slice()
  const sort = qs('po-sort').value
  const yr = d => (d.tgl || '').slice(0, 4)
  rows.sort((a, b) => {
    if (sort === 'tgl-asc')  return a.tgl.localeCompare(b.tgl)
    if (sort === 'thn-desc') return yr(b).localeCompare(yr(a)) || b.tgl.localeCompare(a.tgl)
    if (sort === 'thn-asc')  return yr(a).localeCompare(yr(b)) || a.tgl.localeCompare(b.tgl)
    return b.tgl.localeCompare(a.tgl)
  })
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><i class="ti ti-file-invoice"></i>${filterSup ? 'Tidak ada pembelian dari distributor ini' : 'Belum ada data pembelian'}</div></td></tr>`
    tfoot.innerHTML = ''
    return
  }
  let total = 0
  tbody.innerHTML = rows.map(d => {
    total += d.nominal || 0
    return `<tr>
      <td>${d.tgl}${d.dibuat_oleh ? `<div style="font-size:11px;color:var(--tx3)">oleh ${d.dibuat_oleh}</div>` : ''}</td>
      <td>${d.supplier||'-'}</td>
      <td style="text-align:right;font-weight:600">${fmt(d.nominal)}</td>
      <td style="font-size:12px;color:var(--tx2)">${d.principle||'-'}</td>
      <td><button class="btn sm" data-id="${d.id}" data-action="edit-po"><i class="ti ti-pencil"></i></button> <button class="btn sm danger" data-id="${d.id}" data-action="del-po"><i class="ti ti-trash"></i></button></td></tr>`
  }).join('')
  tfoot.innerHTML = `<tr style="font-weight:700;border-top:2px solid var(--bd)">
    <td colspan="2">Total (${rows.length} PO)</td>
    <td style="text-align:right">${fmt(total)}</td>
    <td colspan="2"></td></tr>`
}

qs('po-filter-supplier').addEventListener('input', () => renderPOTable(_poData))
qs('po-sort').addEventListener('change', () => renderPOTable(_poData))

qs('po-save-btn').addEventListener('click', async () => {
  const supplier = qs('po-supplier').value.trim(), nominal = qs('po-nominal').value
  if (!supplier) { toast('Distributor wajib dipilih', 'error'); return }
  if (_supplierNames.length && !_supplierNames.some(n => n.toLowerCase() === supplier.toLowerCase())) {
    toast('Distributor tidak ada di daftar. Pilih dari daftar atau tambah lewat tombol Kelola.', 'error'); return
  }
  if (!nominal) { toast('Nominal PO wajib diisi', 'error'); return }
  showLoading(true)
  try {
    const payload = { tgl: qs('po-tgl').value || today(), supplier, nominal: +nominal, principle: qs('po-principle').value }
    if (_editPO) { await API.updatePO(_editPO, payload); _editPO = null; qs('po-save-btn').innerHTML = '<i class="ti ti-device-floppy"></i>Simpan Rencana' }
    else { await API.savePO(payload) }
    ;['po-nominal','po-principle'].forEach(id => qs(id).value = '')
    qs('po-supplier').value = ''
    _poData = await API.getPO(); renderPOTable(_poData)
    toast('Tersimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})

qs('btn-kelola-supplier-po').addEventListener('click', async () => {
  qs('supplier-modal-srch').value = ''
  await renderSupplierModal(); qs('modal-supplier').classList.add('open')
})

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="edit-po"]'); if (!b) return
  const d = _poData.find(x => String(x.id) === b.dataset.id); if (!d) return
  qs('po-tgl').value = d.tgl || ''
  qs('po-supplier').value = d.supplier || ''
  qs('po-nominal').value = d.nominal || ''
  qs('po-principle').value = d.principle || ''
  _editPO = d.id
  qs('po-save-btn').innerHTML = '<i class="ti ti-pencil"></i>Update Rencana'
  qs('po-supplier').scrollIntoView({ behavior: 'smooth', block: 'center' })
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-po"]')) {
    if (!confirm2('Hapus data pembelian ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try { await API.delPO(id); _poData = await API.getPO(); renderPOTable(_poData); toast('Dihapus') }
    catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

/* ── BPJS ── */
async function loadBPJS() {
  qs('bptab-prb').style.display = ''
  qs('bptab-alkes').style.display = 'none'
  qs('bptab-iterasi').style.display = 'none'
  document.querySelectorAll('[data-bptab]').forEach(b => b.classList.toggle('primary', b.dataset.bptab === 'prb'))
  await renderPRB()
  await renderAlkes()
  await renderIterasi()
}

document.querySelectorAll('[data-bptab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.bptab
    document.querySelectorAll('[data-bptab]').forEach(b => b.classList.toggle('primary', b.dataset.bptab === tab))
    qs('bptab-prb').style.display = tab === 'prb' ? '' : 'none'
    qs('bptab-alkes').style.display = tab === 'alkes' ? '' : 'none'
    qs('bptab-iterasi').style.display = tab === 'iterasi' ? '' : 'none'
  })
})

let _prbData = []
async function renderPRB() { _prbData = await API.getBpjsPrb(); renderPRBTable() }
function renderPRBTable() {
  const tbody = qs('prb-tbody'), tfoot = qs('prb-tfoot')
  const bln = qs('prb-filter-bulan').value
  const rows = bln ? _prbData.filter(d => (d.tgl || '').slice(0, 7) === bln) : _prbData
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><i class="ti ti-file-text"></i>Belum ada data PRB</div></td></tr>'; tfoot.innerHTML = ''; return }
  let tR = 0, tK = 0, tG = 0
  tbody.innerHTML = rows.map(d => {
    tR += d.jumlah_resep || 0; tK += d.total_klaim || 0; tG += d.resep_gagal || 0
    return `<tr>
      <td>${d.tgl}</td>
      <td style="text-align:right">${fmtN(d.jumlah_resep)}</td>
      <td style="text-align:right;font-weight:600">${fmt(d.total_klaim)}</td>
      <td style="text-align:right">${fmtN(d.resep_gagal)}</td>
      <td style="font-size:12px;color:var(--tx2)">${d.ket || '-'}</td>
      <td><button class="btn sm" data-id="${d.id}" data-action="edit-prb"><i class="ti ti-pencil"></i></button> <button class="btn sm danger" data-id="${d.id}" data-action="del-prb"><i class="ti ti-trash"></i></button></td>
    </tr>`
  }).join('')
  tfoot.innerHTML = `<tr style="font-weight:700;border-top:2px solid var(--bd)"><td>Total (${rows.length})</td><td style="text-align:right">${fmtN(tR)}</td><td style="text-align:right">${fmt(tK)}</td><td style="text-align:right">${fmtN(tG)}</td><td colspan="2"></td></tr>`
}
qs('prb-filter-bulan').addEventListener('change', renderPRBTable)
qs('prb-save-btn').addEventListener('click', async () => {
  showLoading(true)
  try {
    const payload = { tgl: qs('prb-tgl').value || today(), jumlah_resep: qs('prb-resep').value, total_klaim: qs('prb-klaim').value, resep_gagal: qs('prb-gagal').value, ket: qs('prb-ket').value }
    if (_editPrb) { await API.updateBpjsPrb(_editPrb, payload); _editPrb = null; qs('prb-save-btn').innerHTML = '<i class="ti ti-device-floppy"></i>Simpan PRB' }
    else { await API.saveBpjsPrb(payload) }
    ;['prb-resep', 'prb-klaim', 'prb-gagal', 'prb-ket'].forEach(id => qs(id).value = '')
    await renderPRB(); toast('Tersimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="edit-prb"]'); if (!b) return
  const d = _prbData.find(x => String(x.id) === b.dataset.id); if (!d) return
  qs('prb-tgl').value = d.tgl || ''
  qs('prb-resep').value = d.jumlah_resep || ''
  qs('prb-klaim').value = d.total_klaim || ''
  qs('prb-gagal').value = d.resep_gagal || ''
  qs('prb-ket').value = d.ket || ''
  _editPrb = d.id
  qs('prb-save-btn').innerHTML = '<i class="ti ti-pencil"></i>Update PRB'
  qs('prb-tgl').scrollIntoView({ behavior: 'smooth', block: 'center' })
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-prb"]')) {
    if (!confirm2('Hapus data PRB ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try { await API.delBpjsPrb(id); await renderPRB(); toast('Dihapus') }
    catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

let _alkesData = []
async function renderAlkes() { _alkesData = await API.getBpjsAlkes(); renderAlkesTable() }
function renderAlkesTable() {
  const tbody = qs('alkes-tbody')
  const bln = qs('alkes-filter-bulan').value
  const rows = bln ? _alkesData.filter(d => (d.tgl || '').slice(0, 7) === bln) : _alkesData
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty"><i class="ti ti-wheelchair"></i>Belum ada data</div></td></tr>'; return }
  tbody.innerHTML = rows.map(d => {
    const dok = (d.files || []).map(f => `<a href="/uploads/${f.filename}" target="_blank" style="color:var(--green);font-size:12px">${f.originalname}</a>`).join('<br>') || '-'
    return `<tr>
      <td>${d.tgl}</td>
      <td style="font-weight:500">${d.pasien}</td>
      <td>${d.no_rm || '-'}</td>
      <td><span class="badge blue">${d.jenis || '-'}</span></td>
      <td style="text-align:right">${fmtN(d.jumlah)}</td>
      <td>${dok}</td>
      <td><button class="btn sm danger" data-id="${d.id}" data-action="del-alkes"><i class="ti ti-trash"></i></button></td>
    </tr>`
  }).join('')
}
qs('alkes-filter-bulan').addEventListener('change', renderAlkesTable)
qs('alkes-save-btn').addEventListener('click', async () => {
  const pasien = qs('alkes-pasien').value.trim()
  if (!pasien) { toast('Nama pasien wajib diisi', 'error'); return }
  const fd = new FormData()
  fd.append('tgl', qs('alkes-tgl').value || today())
  fd.append('pasien', pasien); fd.append('no_rm', qs('alkes-rm').value); fd.append('jenis', qs('alkes-jenis').value)
  fd.append('jumlah', qs('alkes-jumlah').value); fd.append('ket', qs('alkes-ket').value)
  const files = qs('alkes-dok').files
  for (let i = 0; i < files.length; i++) fd.append('dok', files[i])
  showLoading(true)
  try {
    await API.saveBpjsAlkes(fd)
    ;['alkes-pasien', 'alkes-rm', 'alkes-jumlah', 'alkes-ket'].forEach(id => qs(id).value = '')
    qs('alkes-dok').value = ''
    await renderAlkes(); toast('Alkes disimpan' + (files.length ? ' & dokumen masuk Arsip' : ''))
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})
document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-alkes"]')) {
    if (!confirm2('Hapus data alkes ini? (dokumen di Arsip tetap ada)')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try { await API.delBpjsAlkes(id); await renderAlkes(); toast('Dihapus') }
    catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

let _iterData = []
async function renderIterasi() { _iterData = await API.getBpjsIterasi(); renderIterasiTable() }
function renderIterasiTable() {
  const tbody = qs('iter-tbody')
  const bln = qs('iter-filter-bulan').value
  const rows = bln ? _iterData.filter(d => (d.tgl || '').slice(0, 7) === bln) : _iterData
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="4"><div class="empty"><i class="ti ti-repeat"></i>Belum ada data iterasi</div></td></tr>'; return }
  tbody.innerHTML = rows.map(d => `<tr>
    <td>${d.tgl}</td>
    <td style="font-weight:500">${d.pasien}</td>
    <td>${d.no_rm || '-'}</td>
    <td><button class="btn sm" data-id="${d.id}" data-action="edit-iter"><i class="ti ti-pencil"></i></button> <button class="btn sm danger" data-id="${d.id}" data-action="del-iter"><i class="ti ti-trash"></i></button></td>
  </tr>`).join('')
}
qs('iter-filter-bulan').addEventListener('change', renderIterasiTable)
qs('iter-save-btn').addEventListener('click', async () => {
  const pasien = qs('iter-pasien').value.trim()
  if (!pasien) { toast('Nama pasien wajib diisi', 'error'); return }
  showLoading(true)
  try {
    const payload = { tgl: qs('iter-tgl').value || today(), pasien, no_rm: qs('iter-rm').value }
    if (_editIter) { await API.updateBpjsIterasi(_editIter, payload); _editIter = null; qs('iter-save-btn').innerHTML = '<i class="ti ti-device-floppy"></i>Simpan Iterasi' }
    else { await API.saveBpjsIterasi(payload) }
    ;['iter-pasien', 'iter-rm'].forEach(id => qs(id).value = '')
    await renderIterasi(); toast('Tersimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="edit-iter"]'); if (!b) return
  const d = _iterData.find(x => String(x.id) === b.dataset.id); if (!d) return
  qs('iter-tgl').value = d.tgl || ''
  qs('iter-pasien').value = d.pasien || ''
  qs('iter-rm').value = d.no_rm || ''
  _editIter = d.id
  qs('iter-save-btn').innerHTML = '<i class="ti ti-pencil"></i>Update Iterasi'
  qs('iter-tgl').scrollIntoView({ behavior: 'smooth', block: 'center' })
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-iter"]')) {
    if (!confirm2('Hapus data iterasi ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try { await API.delBpjsIterasi(id); await renderIterasi(); toast('Dihapus') }
    catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

/* ── PINJAMAN ── */
let _pinData = []

async function loadPinjaman() {
  _pinData = await API.getPinjaman()
  renderPinjamanTable(_pinData)
}

function renderPinjamanTable(data) {
  const tbody = qs('pin-tbody')
  const fj = qs('pin-filter-jenis').value
  const rows = fj ? data.filter(d => d.jenis === fj) : data
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty"><i class="ti ti-arrows-exchange"></i>Belum ada data pinjaman</div></td></tr>'; return }
  tbody.innerHTML = rows.map(d => {
    const badge = d.jenis === 'meminjamkan'
      ? '<span class="badge amber">Meminjamkan</span>'
      : '<span class="badge blue">Pinjam</span>'
    return `<tr>
      <td>${d.tgl}</td>
      <td>${badge}</td>
      <td>${d.rs||'-'}</td>
      <td>${d.barang||'-'}</td>
      <td style="font-weight:600">${d.jumlah||'-'}</td>
      <td style="font-size:12px;color:var(--tx2)">${d.ket||'-'}</td>
      <td><button class="btn sm" data-id="${d.id}" data-action="edit-pin"><i class="ti ti-pencil"></i></button> <button class="btn sm danger" data-id="${d.id}" data-action="del-pin"><i class="ti ti-trash"></i></button></td>
    </tr>`
  }).join('')
}

qs('pin-filter-jenis').addEventListener('change', () => renderPinjamanTable(_pinData))

qs('pin-save-btn').addEventListener('click', async () => {
  const rs = qs('pin-rs').value.trim(), barang = qs('pin-barang').value.trim()
  if (!rs) { toast('Nama RS wajib diisi', 'error'); return }
  if (!barang) { toast('Nama barang wajib diisi', 'error'); return }
  showLoading(true)
  try {
    const payload = { tgl: qs('pin-tgl').value || today(), jenis: qs('pin-jenis').value, rs, barang, jumlah: qs('pin-jumlah').value, ket: qs('pin-ket').value }
    if (_editPin) { await API.updatePinjaman(_editPin, payload); _editPin = null; qs('pin-save-btn').innerHTML = '<i class="ti ti-device-floppy"></i>Simpan Pinjaman' }
    else { await API.savePinjaman(payload) }
    ;['pin-rs','pin-barang','pin-jumlah','pin-ket'].forEach(id => qs(id).value = '')
    _pinData = await API.getPinjaman(); renderPinjamanTable(_pinData)
    toast('Tersimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="edit-pin"]'); if (!b) return
  const d = _pinData.find(x => String(x.id) === b.dataset.id); if (!d) return
  qs('pin-tgl').value = d.tgl || ''
  qs('pin-jenis').value = d.jenis || 'pinjam'
  qs('pin-rs').value = d.rs || ''
  qs('pin-barang').value = d.barang || ''
  qs('pin-jumlah').value = d.jumlah || ''
  qs('pin-ket').value = d.ket || ''
  _editPin = d.id
  qs('pin-save-btn').innerHTML = '<i class="ti ti-pencil"></i>Update Pinjaman'
  qs('pin-tgl').scrollIntoView({ behavior: 'smooth', block: 'center' })
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-pin"]')) {
    if (!confirm2('Hapus data pinjaman ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try { await API.delPinjaman(id); _pinData = await API.getPinjaman(); renderPinjamanTable(_pinData); toast('Dihapus') }
    catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

/* ── TIDAK DATANG ── */
function renderTidakDatangTable(data) {
  const tbody = qs('td-tbody')
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="5"><div class="empty">Belum ada data obat tidak datang</div></td></tr>'; return }
  tbody.innerHTML = data.map(d => `<tr>
    <td>${d.tgl}</td>
    <td style="font-weight:500">${d.nama}</td>
    <td>${d.supplier||'-'}</td>
    <td style="font-size:12px;color:var(--tx2)">${d.ket||'-'}</td>
    <td><button class="btn sm danger" data-id="${d.id}" data-action="del-td"><i class="ti ti-trash"></i></button></td>
  </tr>`).join('')
}

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-td"]')) {
    if (!confirm2('Hapus data ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try { await API.delTidakDatang(id); renderTidakDatangTable(await API.getTidakDatang()); toast('Dihapus') }
    catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

/* ── MUTASI ── */
let _mutData = []
async function loadMutasi() {
  const [tujuan, mutasi] = await Promise.all([API.getTujuan(), API.getMutasi()])
  STATE.tujuan = tujuan
  if (!STATE.activeMutTab || !tujuan.find(t => t.id === STATE.activeMutTab)) STATE.activeMutTab = tujuan[0]?.id || null
  buildMutasiTabs(tujuan, mutasi)
  renderMutasiSelect(tujuan)
  await loadPetugasSelects()
  if (!_editMut && _currentUser?.nama) qs('mut-petugas').value = _currentUser.nama
}

function renderMutasiSelect(tujuan) {
  qs('mut-tujuan-select').innerHTML = tujuan.map(t => `<option value="${t.id}">${t.label}</option>`).join('')
}

function buildMutasiTabs(tujuan, mutasi) {
  _mutData = mutasi
  qs('mut-tab-bar').innerHTML = tujuan.map((t, i) => `<button class="tab${t.id === STATE.activeMutTab ? ' active' : ''}" data-tab="${t.id}"><span class="badge ${BADGE[i%BADGE.length]}">${t.label.slice(0,2).toUpperCase()}</span>${t.label}</button>`).join('')
  qs('mut-tab-panels').innerHTML = tujuan.map(t => {
    const items = mutasi.filter(d => d.tujuan === t.id)
    const total = items.reduce((s, d) => s + (d.total || 0), 0)
    const rows = items.length ? items.map(d => `<tr>
      <td style="font-size:12px">${d.tgl}${d.dibuat_oleh ? `<div style="color:var(--tx3)">oleh ${d.dibuat_oleh}</div>` : ''}</td><td style="font-size:12px">${d.no||'-'}</td>
      <td style="text-align:right;font-weight:600">${fmt(d.jml)}</td>
      <td style="font-size:12px">${d.petugas||'-'}</td>
      <td style="font-size:11px;color:var(--tx2);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.ket||'-'}</td>
      <td><button class="btn sm" data-id="${d.id}" data-action="edit-mut"><i class="ti ti-pencil"></i></button> <button class="btn sm danger" data-id="${d.id}" data-action="del-mut"><i class="ti ti-trash"></i></button></td></tr>`).join('')
      : `<tr><td colspan="6"><div class="empty">Belum ada mutasi ke ${t.label}</div></td></tr>`
    return `<div class="tab-panel${t.id === STATE.activeMutTab ? ' active' : ''}" id="mut-panel-${t.id}">
      <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>No.</th><th>Nominal</th><th>Petugas</th><th>Ket.</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      ${items.length ? `<div style="text-align:right;font-size:12px;margin-top:8px;color:var(--tx2)">${items.length} item</div>` : ''}</div>`
  }).join('')

  document.querySelectorAll('#mut-tab-bar .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      STATE.activeMutTab = btn.dataset.tab
      document.querySelectorAll('#mut-tab-bar .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === STATE.activeMutTab))
      document.querySelectorAll('#mut-tab-panels .tab-panel').forEach(p => p.classList.toggle('active', p.id === 'mut-panel-' + STATE.activeMutTab))
    })
  })
}

qs('mut-save-btn').addEventListener('click', async () => {
  const jml = qs('mut-jml').value, tujuan = qs('mut-tujuan-select').value
  if (!jml || !tujuan) { toast('Jumlah dan tujuan wajib diisi', 'error'); return }
  showLoading(true)
  try {
    const payload = { tgl: qs('mut-tgl').value||today(), no: qs('mut-no').value, tujuan, jml: +jml, petugas: qs('mut-petugas').value, ket: qs('mut-ket').value }
    if (_editMut) { await API.updateMutasi(_editMut, payload); _editMut = null; qs('mut-save-btn').innerHTML = '<i class="ti ti-device-floppy"></i>Simpan Mutasi' }
    else { await API.saveMutasi(payload) }
    ;['mut-tgl','mut-no','mut-jml','mut-petugas','mut-ket'].forEach(id => qs(id).value = '')
    const [t, m] = await Promise.all([API.getTujuan(), API.getMutasi()])
    buildMutasiTabs(t, m); renderMutasiSelect(t)
    const pNama = (payload.petugas || '').trim()
    if (pNama && !_petugasNames.some(n => n.toLowerCase() === pNama.toLowerCase())) { try { await API.savePetugas({ nama: pNama }) } catch {} await loadPetugasSelects() }
    toast('Tersimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="edit-mut"]'); if (!b) return
  const d = _mutData.find(x => String(x.id) === b.dataset.id); if (!d) return
  qs('mut-tgl').value = d.tgl || ''
  qs('mut-no').value = d.no || ''
  qs('mut-tujuan-select').value = d.tujuan || ''
  qs('mut-jml').value = d.jml || ''
  qs('mut-petugas').value = d.petugas || ''
  qs('mut-ket').value = d.ket || ''
  _editMut = d.id
  qs('mut-save-btn').innerHTML = '<i class="ti ti-pencil"></i>Update Mutasi'
  qs('mut-tgl').scrollIntoView({ behavior: 'smooth', block: 'center' })
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-mut"]')) {
    if (!confirm2('Hapus data mutasi ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try {
      await API.delMutasi(id)
      const [t, m] = await Promise.all([API.getTujuan(), API.getMutasi()])
      buildMutasiTabs(t, m); renderMutasiSelect(t); toast('Dihapus')
    } catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

/* ── PETUGAS (directory) ── */
let _petugasNames = []
async function loadPetugasSelects() {
  const list = await API.getPetugas()
  _petugasNames = list.map(p => p.nama)
  const el = qs('mut-petugas-list'); if (el) el.innerHTML = list.map(p => `<option value="${p.nama}">`).join('')
}
async function renderPetugasModal() {
  const list = await API.getPetugas()
  qs('petugas-list-modal').innerHTML = list.length
    ? list.map(p => `<div class="item-row"><div class="item-row-label"><span>${p.nama}</span></div><button class="btn sm" data-id="${p.id}" data-action="edit-petugas"><i class="ti ti-pencil"></i></button> <button class="btn sm danger" data-id="${p.id}" data-action="del-petugas"><i class="ti ti-trash"></i></button></div>`).join('')
    : '<div class="empty" style="padding:8px">Belum ada petugas</div>'
}
qs('btn-kelola-petugas').addEventListener('click', async () => {
  qs('petugas-modal-srch').value = ''
  await renderPetugasModal(); qs('modal-petugas').classList.add('open')
})
qs('petugas-close-btn').addEventListener('click', async () => {
  qs('modal-petugas').classList.remove('open'); await loadPetugasSelects()
})
qs('modal-petugas').addEventListener('click', async e => {
  if (e.target === qs('modal-petugas')) { qs('modal-petugas').classList.remove('open'); await loadPetugasSelects() }
})
qs('petugas-add-btn').addEventListener('click', async () => {
  const nama = qs('petugas-new-input').value.trim()
  if (!nama) { toast('Nama petugas tidak boleh kosong', 'error'); return }
  try { await API.savePetugas({ nama }); qs('petugas-new-input').value = ''; await renderPetugasModal(); toast('Petugas ditambahkan') }
  catch (e) { toast(e.message, 'error') }
})
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action="edit-petugas"]'); if (!b) return
  const cur = b.closest('.item-row').querySelector('.item-row-label span').textContent
  const v = prompt('Nama petugas baru:', cur); if (v == null) return
  const t = v.trim(); if (!t || t === cur) return
  try { await API.updatePetugas(b.dataset.id, { nama: t }); await renderPetugasModal(); await loadPetugasSelects(); toast('Diperbarui') }
  catch (err) { toast(err.message, 'error') }
})
document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-petugas"]')) {
    if (!confirm2('Hapus petugas ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    try { await API.delPetugas(id); await renderPetugasModal(); toast('Dihapus') }
    catch (e) { toast(e.message, 'error') }
  }
})

/* ── TUJUAN MODAL ── */
qs('btn-kelola-tujuan').addEventListener('click', () => openModal('tujuan'))
qs('btn-kelola-farmasi').addEventListener('click', () => openModal('tujuan'))
qs('tujuan-close-btn').addEventListener('click', () => closeModal('tujuan'))
qs('modal-tujuan').addEventListener('click', e => { if (e.target === qs('modal-tujuan')) closeModal('tujuan') })

async function openModal(type) {
  if (type === 'tujuan') { await renderTujuanModal(); qs('modal-tujuan').classList.add('open') }
  if (type === 'kategori') { await renderKategoriModal(); qs('modal-kategori').classList.add('open') }
}
async function closeModal(type) {
  qs('modal-' + type).classList.remove('open')
  if (type === 'tujuan') { const [t, m] = await Promise.all([API.getTujuan(), API.getMutasi()]); STATE.tujuan = t; buildMutasiTabs(t, m); renderMutasiSelect(t); renderPjTujuanSelect(t); await renderPenjualanTable() }
  if (type === 'kategori') { const k = await API.getKategori(); STATE.kategori = k; renderPjInputs(k); await renderPjSummary() }
}

async function renderTujuanModal() {
  const list = await API.getTujuan()
  qs('tujuan-list-modal').innerHTML = list.map(t => `<div class="item-row">
    <div class="item-row-label"><span>${t.label}</span>${t.is_default ? '<span class="default-badge">bawaan</span>' : ''}</div>
    <button class="btn sm" data-id="${t.id}" data-action="edit-tujuan"><i class="ti ti-pencil"></i></button>
    ${!t.is_default ? `<button class="btn sm danger" data-id="${t.id}" data-action="del-tujuan"><i class="ti ti-trash"></i></button>` : ''}</div>`).join('')
}

qs('tujuan-add-btn').addEventListener('click', async () => {
  const label = qs('tujuan-new-input').value.trim()
  if (!label) { toast('Nama tujuan tidak boleh kosong', 'error'); return }
  try { await API.saveTujuan({ label }); qs('tujuan-new-input').value = ''; await renderTujuanModal(); toast('Tujuan ditambahkan') }
  catch (e) { toast(e.message, 'error') }
})

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action="edit-tujuan"]'); if (!b) return
  const cur = b.closest('.item-row').querySelector('.item-row-label span').textContent
  const v = prompt('Nama tujuan baru:', cur); if (v == null) return
  const t = v.trim(); if (!t || t === cur) return
  try { await API.updateTujuan(b.dataset.id, { label: t }); await renderTujuanModal(); toast('Diperbarui') }
  catch (err) { toast(err.message, 'error') }
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-tujuan"]')) {
    if (!confirm2('Hapus tujuan ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    try { await API.delTujuan(id); await renderTujuanModal(); toast('Dihapus') }
    catch (e) { toast(e.message, 'error') }
  }
})

/* ── PENJUALAN ── */
let pendingPjFiles = []

async function loadPenjualan() {
  const [kats, tujuan] = await Promise.all([API.getKategori(), API.getTujuan()])
  STATE.kategori = kats
  STATE.tujuan = tujuan
  renderPjInputs(kats)
  renderPjTujuanSelect(tujuan)
  await renderPjSummary()
  await renderPenjualanTable()
  await loadBarangSelects()
  await renderHutangObat()
  await renderObatBelum()
  // default ke tab Penjualan
  qs('pjtab-jual').style.display = ''
  qs('pjtab-hutang').style.display = 'none'
  qs('pjtab-belum').style.display = 'none'
  document.querySelectorAll('[data-pjtab]').forEach(b => b.classList.toggle('primary', b.dataset.pjtab === 'jual'))
}

/* ── OBAT DIHUTANGKAN ── */
let _hutData = []
async function renderHutangObat() {
  _hutData = await API.getHutangObat()
  const data = _hutData
  const tbody = qs('hut-tbody')
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><i class="ti ti-receipt"></i>Belum ada data</div></td></tr>'; return }
  tbody.innerHTML = data.map(d => `<tr>
    <td>${d.tgl}</td>
    <td style="font-weight:500">${d.item}</td>
    <td style="text-align:right">${d.jumlah}</td>
    <td style="text-align:right">${d.jumlah_pasien}</td>
    <td style="font-size:12px;color:var(--tx2)">${d.ket||'-'}</td>
    <td><button class="btn sm" data-id="${d.id}" data-action="edit-hut"><i class="ti ti-pencil"></i></button> <button class="btn sm danger" data-id="${d.id}" data-action="del-hut"><i class="ti ti-trash"></i></button></td>
  </tr>`).join('')
}

qs('hut-save-btn').addEventListener('click', async () => {
  const item = qs('hut-item').value.trim()
  if (!item) { toast('Nama item wajib diisi', 'error'); return }
  showLoading(true)
  try {
    const payload = { tgl: qs('hut-tgl').value || today(), item, jumlah: qs('hut-jumlah').value, jumlah_pasien: qs('hut-pasien').value, ket: qs('hut-ket').value }
    if (_editHut) { await API.updateHutangObat(_editHut, payload); _editHut = null; qs('hut-save-btn').innerHTML = '<i class="ti ti-device-floppy"></i>Simpan' }
    else { await API.saveHutangObat(payload) }
    ;['hut-item', 'hut-jumlah', 'hut-pasien', 'hut-ket'].forEach(id => qs(id).value = '')
    await renderHutangObat(); toast('Tersimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="edit-hut"]'); if (!b) return
  const d = _hutData.find(x => String(x.id) === b.dataset.id); if (!d) return
  qs('hut-tgl').value = d.tgl || ''
  qs('hut-item').value = d.item || ''
  qs('hut-jumlah').value = d.jumlah || ''
  qs('hut-pasien').value = d.jumlah_pasien || ''
  qs('hut-ket').value = d.ket || ''
  _editHut = d.id
  qs('hut-save-btn').innerHTML = '<i class="ti ti-pencil"></i>Update'
  qs('hut-tgl').scrollIntoView({ behavior: 'smooth', block: 'center' })
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-hut"]')) {
    if (!confirm2('Hapus data ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try { await API.delHutangObat(id); await renderHutangObat(); toast('Dihapus') }
    catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

/* ── OBAT BELUM DIAMBIL ── */
async function renderObatBelum() {
  const data = await API.getObatBelum()
  const tbody = qs('blm-tbody')
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><i class="ti ti-clock-pause"></i>Belum ada data</div></td></tr>'; return }
  tbody.innerHTML = data.map(d => {
    const resep = (d.files || []).map(f => `<a href="/uploads/${f.filename}" target="_blank" style="color:var(--green);font-size:12px">${f.originalname}</a>`).join('<br>') || '-'
    return `<tr>
      <td>${d.tgl}</td>
      <td style="font-weight:500">${d.pasien}</td>
      <td>${d.obat}</td>
      <td>${resep}</td>
      <td style="font-size:12px;color:var(--tx2)">${d.ket||'-'}</td>
      <td><button class="btn sm danger" data-id="${d.id}" data-action="del-blm"><i class="ti ti-trash"></i></button></td>
    </tr>`
  }).join('')
}

qs('blm-save-btn').addEventListener('click', async () => {
  const pasien = qs('blm-pasien').value.trim(), obat = qs('blm-obat').value.trim()
  if (!pasien) { toast('Nama pasien wajib diisi', 'error'); return }
  if (!obat) { toast('Nama obat wajib diisi', 'error'); return }
  const fd = new FormData()
  fd.append('tgl', qs('blm-tgl').value || today())
  fd.append('pasien', pasien); fd.append('obat', obat); fd.append('ket', qs('blm-ket').value)
  const files = qs('blm-resep').files
  for (let i = 0; i < files.length; i++) fd.append('resep', files[i])
  showLoading(true)
  try {
    await API.saveObatBelum(fd)
    ;['blm-pasien', 'blm-obat', 'blm-ket'].forEach(id => qs(id).value = '')
    qs('blm-resep').value = ''
    await renderObatBelum(); toast('Disimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-blm"]')) {
    if (!confirm2('Hapus data ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try { await API.delObatBelum(id); await renderObatBelum(); toast('Dihapus') }
    catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

function renderPjTujuanSelect(tujuan) {
  qs('pj-tujuan-select').innerHTML = tujuan.map(t => `<option value="${t.id}">${t.label}</option>`).join('')
}

function renderPjInputs(kats) {
  qs('pj-kat-inputs').innerHTML = (kats || STATE.kategori).map((k, i) => `
    <div class="kat-block" style="border-left-color:${KAT_HEX[i%KAT_HEX.length]}">
      <div class="kat-block-title" style="color:${KAT_HEX[i%KAT_HEX.length]}">${k.label}</div>
      <div class="form-row">
        <div class="form-group"><label>Jumlah Resep</label><input type="number" id="pj-resep-${k.id}" placeholder="0" min="0" oninput="calcPjPreview()"></div>
        <div class="form-group"><label>Nominal Penjualan (Rp)</label><input type="number" id="pj-nominal-${k.id}" placeholder="0" min="0" oninput="calcPjPreview()"></div>
      </div>
    </div>`).join('')
}

function calcPjPreview() {
  let tr = 0, tn = 0
  STATE.kategori.forEach(k => { tr += +(qs('pj-resep-' + k.id)?.value || 0); tn += +(qs('pj-nominal-' + k.id)?.value || 0) })
  qs('pj-total-resep-preview').textContent = fmtN(tr) + ' resep'
  qs('pj-total-nominal-preview').textContent = fmt(tn)
}

qs('pj-save-btn').addEventListener('click', async () => {
  const kats = STATE.kategori
  const detail = {}; let totalResep = 0, totalNominal = 0
  kats.forEach(k => {
    const r = +(qs('pj-resep-' + k.id)?.value || 0), n = +(qs('pj-nominal-' + k.id)?.value || 0)
    detail[k.id] = { resep: r, nominal: n, label: k.label }
    totalResep += r; totalNominal += n
  })
  if (!totalResep && !totalNominal) { toast('Isi minimal satu kategori', 'error'); return }
  showLoading(true)
  try {
    await API.savePenjualan({ tgl: qs('pj-tgl').value || today(), tujuan: qs('pj-tujuan-select').value, shift: qs('pj-shift').value, detail, total_resep: totalResep, total_nominal: totalNominal })
    kats.forEach(k => { const ri = qs('pj-resep-' + k.id), ni = qs('pj-nominal-' + k.id); if (ri) ri.value = ''; if (ni) ni.value = '' })
    qs('pj-shift').value = ''; calcPjPreview()
    await renderPjSummary(); await renderPenjualanTable()
    toast('Penjualan disimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})

async function renderPjSummary() {
  const [data, kats] = await Promise.all([API.getPenjualan(), API.getKategori()])
  STATE.kategori = kats
  const totalR = data.reduce((s, d) => s + d.total_resep, 0)
  const totalN = data.reduce((s, d) => s + d.total_nominal, 0)
  qs('pj-summary-cards').innerHTML = `
    <div class="metric-card"><div class="metric-label">Total Resep</div><div class="metric-val">${fmtN(totalR)}</div><div class="metric-sub">semua kategori</div></div>
    <div class="metric-card"><div class="metric-label">Total Penjualan</div><div class="metric-val green">${fmt(totalN)}</div></div>
    ${kats.map((k, i) => {
      const r = data.reduce((s, d) => s + ((d.detail||{})[k.id]?.resep || 0), 0)
      const n = data.reduce((s, d) => s + ((d.detail||{})[k.id]?.nominal || 0), 0)
      return `<div class="metric-card"><div class="metric-label">${k.label}</div><div class="metric-val" style="font-size:16px;color:${KAT_HEX[i%KAT_HEX.length]}">${fmtN(r)} resep</div><div class="metric-sub">${fmt(n)}</div></div>`
    }).join('')}`
}

async function renderPenjualanTable() {
  const bulan = qs('pj-filter-bulan').value
  const data = await API.getPenjualan(bulan ? { bulan } : {})
  buildPenjualanTabs(STATE.tujuan, data, STATE.kategori)
}

function buildPenjualanTabs(tujuan, allData, kats) {
  const tabs = [{ id: '__all__', label: 'Semua' }, ...tujuan]
  qs('pj-tab-bar').innerHTML = tabs.map((t, i) =>
    `<button class="tab${t.id === STATE.activePjTab ? ' active' : ''}" data-pjtab="${t.id}">
      ${t.id === '__all__' ? '<i class="ti ti-layout-list"></i>' : `<span class="badge ${BADGE[(i-1)%BADGE.length]}">${t.label.slice(0,2).toUpperCase()}</span>`}
      ${t.label}</button>`
  ).join('')
  qs('pj-tab-panels').innerHTML = tabs.map(t => {
    const items = t.id === '__all__' ? allData : allData.filter(d => d.tujuan === t.id)
    return `<div class="tab-panel${t.id === STATE.activePjTab ? ' active' : ''}" id="pj-panel-${t.id}">${renderPjTableHTML(items, kats)}</div>`
  }).join('')
  document.querySelectorAll('#pj-tab-bar .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      STATE.activePjTab = btn.dataset.pjtab
      document.querySelectorAll('#pj-tab-bar .tab').forEach(b => b.classList.toggle('active', b.dataset.pjtab === STATE.activePjTab))
      document.querySelectorAll('#pj-tab-panels .tab-panel').forEach(p => p.classList.toggle('active', p.id === 'pj-panel-' + STATE.activePjTab))
    })
  })
}

function renderPjTableHTML(items, kats) {
  if (!items.length) return '<div class="empty"><i class="ti ti-cash"></i>Belum ada data penjualan</div>'
  const katCols = kats.map(k => `<th colspan="2" style="text-align:center;border-left:1px solid var(--bd)">${k.label}</th>`).join('')
  const katSubCols = kats.map(() => `<th style="border-left:1px solid var(--bd)">Resep</th><th>Nominal</th>`).join('')
  const rows = items.map(d => {
    const katCells = kats.map(k => {
      const r = (d.detail||{})[k.id]?.resep || 0, n = (d.detail||{})[k.id]?.nominal || 0
      return `<td style="text-align:right;border-left:1px solid var(--bd)">${fmtN(r)}</td><td style="text-align:right">${n ? fmt(n) : '-'}</td>`
    }).join('')
    const bar = d.total_resep > 0 ? `<div class="pj-mini-bar">${kats.map((k, i) => { const pct = Math.round(((d.detail||{})[k.id]?.resep || 0) / d.total_resep * 100); return `<div style="width:${pct}%;background:${KAT_HEX[i%KAT_HEX.length]};min-width:${pct>0?'2px':'0'}"></div>` }).join('')}</div>` : ''
    return `<tr><td>${d.tgl}</td><td style="font-size:12px;color:var(--tx2)">${d.shift||'-'}</td>
      <td style="text-align:right">${fmtN(d.total_resep)}${bar}</td>
      <td style="text-align:right;font-weight:600;color:var(--green)">${fmt(d.total_nominal)}</td>
      ${katCells}
      <td><button class="btn sm danger" data-id="${d.id}" data-action="del-pj"><i class="ti ti-trash"></i></button></td></tr>`
  }).join('')
  const totKat = kats.map(k => {
    const r = items.reduce((s, d) => s + ((d.detail||{})[k.id]?.resep || 0), 0)
    const n = items.reduce((s, d) => s + ((d.detail||{})[k.id]?.nominal || 0), 0)
    return `<td style="text-align:right;font-weight:600;border-left:1px solid var(--bd)">${fmtN(r)}</td><td style="text-align:right;font-weight:600">${fmt(n)}</td>`
  }).join('')
  return `<div class="table-wrap"><table>
    <thead><tr><th rowspan="2">Tanggal</th><th rowspan="2">Shift</th><th rowspan="2" style="text-align:right">Total Resep</th><th rowspan="2" style="text-align:right">Total Nominal</th>${katCols}<th rowspan="2"></th></tr><tr>${katSubCols}</tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="2" style="font-size:12px">TOTAL</td>
      <td style="text-align:right">${fmtN(items.reduce((s,d)=>s+d.total_resep,0))}</td>
      <td style="text-align:right;color:var(--green)">${fmt(items.reduce((s,d)=>s+d.total_nominal,0))}</td>
      ${totKat}<td></td></tr></tfoot></table></div>`
}

qs('pj-filter-bulan').addEventListener('change', renderPenjualanTable)

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-pj"]')) {
    if (!confirm2('Hapus data penjualan ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try { await API.delPenjualan(id); await renderPjSummary(); await renderPenjualanTable(); toast('Dihapus') }
    catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

/* ── KATEGORI MODAL ── */
qs('btn-kelola-kategori').addEventListener('click', () => openModal('kategori'))
qs('kategori-close-btn').addEventListener('click', () => closeModal('kategori'))
qs('modal-kategori').addEventListener('click', e => { if (e.target === qs('modal-kategori')) closeModal('kategori') })

async function renderKategoriModal() {
  const list = await API.getKategori()
  qs('kategori-list-modal').innerHTML = list.map(k => `<div class="item-row">
    <div class="item-row-label"><span>${k.label}</span>${k.is_default ? '<span class="default-badge">bawaan</span>' : ''}</div>
    <button class="btn sm" data-id="${k.id}" data-action="edit-kat"><i class="ti ti-pencil"></i></button>
    ${!k.is_default ? `<button class="btn sm danger" data-id="${k.id}" data-action="del-kat"><i class="ti ti-trash"></i></button>` : ''}</div>`).join('')
}

qs('kategori-add-btn').addEventListener('click', async () => {
  const label = qs('kategori-new-input').value.trim()
  if (!label) { toast('Nama kategori tidak boleh kosong', 'error'); return }
  try { await API.saveKategori({ label }); qs('kategori-new-input').value = ''; await renderKategoriModal(); toast('Kategori ditambahkan') }
  catch (e) { toast(e.message, 'error') }
})

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action="edit-kat"]'); if (!b) return
  const cur = b.closest('.item-row').querySelector('.item-row-label span').textContent
  const v = prompt('Nama kategori baru:', cur); if (v == null) return
  const t = v.trim(); if (!t || t === cur) return
  try { await API.updateKategori(b.dataset.id, { label: t }); await renderKategoriModal(); toast('Diperbarui') }
  catch (err) { toast(err.message, 'error') }
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-kat"]')) {
    if (!confirm2('Hapus kategori ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    try { await API.delKategori(id); await renderKategoriModal(); toast('Dihapus') }
    catch (e) { toast(e.message, 'error') }
  }
})

/* ── SETTINGS ── */
qs('btn-settings').addEventListener('click', async () => {
  const s = await API.getSettings()
  qs('settings-rs-name').value = s.rs_name || ''
  qs('acc-nama').value = _currentUser?.nama || ''
  qs('acc-pass').value = ''
  qs('modal-settings').classList.add('open')
})

qs('account-save-btn').addEventListener('click', async () => {
  const nama = qs('acc-nama').value.trim(), password = qs('acc-pass').value
  if (!nama && !password) { toast('Tidak ada yang diubah', 'error'); return }
  try {
    const r = await API.authAccount({ nama: nama || undefined, password: password || undefined })
    _currentUser = r.user
    qs('topbar-user').innerHTML = `<i class="ti ti-user"></i>${r.user.nama}`
    qs('acc-pass').value = ''
    toast('Akun diperbarui')
  } catch (e) { toast(e.message, 'error') }
})

qs('settings-save-btn').addEventListener('click', async () => {
  const rs_name = qs('settings-rs-name').value.trim()
  if (!rs_name) { toast('Nama RS tidak boleh kosong', 'error'); return }
  try {
    await API.saveSettings({ rs_name })
    qs('topbar-rs').textContent = rs_name
    qs('modal-settings').classList.remove('open')
    toast('Pengaturan disimpan')
  } catch (e) { toast(e.message, 'error') }
})

qs('settings-close-btn').addEventListener('click', () => qs('modal-settings').classList.remove('open'))
qs('modal-settings').addEventListener('click', e => { if (e.target === qs('modal-settings')) qs('modal-settings').classList.remove('open') })

/* ── ARSIP ── */
let pendingFiles = []

function setupFileUpload() {
  const area = qs('file-upload-area'), input = qs('arsip-file')
  area.addEventListener('click', () => input.click())
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over') })
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'))
  area.addEventListener('drop', e => { e.preventDefault(); area.classList.remove('drag-over'); addFiles(Array.from(e.dataTransfer.files)) })
  input.addEventListener('change', () => addFiles(Array.from(input.files)))
}

function addFiles(files) {
  pendingFiles = [...pendingFiles, ...files]
  renderFilePreview()
}

function renderFilePreview() {
  qs('file-preview').innerHTML = pendingFiles.map((f, i) => `
    <span class="chip"><i class="ti ti-file"></i>${f.name}<button class="chip-del" data-fi="${i}">×</button></span>`).join('')
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-fi]')
  if (btn && btn.classList.contains('chip-del')) { pendingFiles.splice(+btn.dataset.fi, 1); renderFilePreview() }
})

async function loadKatArsip() {
  const list = await API.getKatArsip()
  const opts = list.map(k => `<option value="${k.label}">${k.label}</option>`).join('')
  qs('arsip-kategori-list').innerHTML = list.map(k => `<option value="${k.label}">`).join('')
  qs('arsip-filter-kat').innerHTML = '<option value="">Semua Kategori</option>' + opts
}

let _arsipData = []

async function loadArsip() {
  await loadKatArsip()
  const kat = qs('arsip-filter-kat').value
  _arsipData = await API.getArsip(kat ? { kat } : {})
  renderFilteredArsip()
}

function renderFilteredArsip() {
  const q = qs('arsip-search').value.toLowerCase().trim()
  const filtered = q ? _arsipData.filter(d =>
    d.judul.toLowerCase().includes(q) || (d.deskripsi || '').toLowerCase().includes(q) || (d.no || '').toLowerCase().includes(q)
  ) : _arsipData
  renderArsipList(filtered)
}

function renderArsipList(data) {
  const el = qs('arsip-list')
  if (!data.length) { el.innerHTML = '<div class="empty"><i class="ti ti-archive"></i>Belum ada arsip</div>'; return }
  el.innerHTML = data.map(d => `<div class="arsip-item">
    <div class="arsip-icon"><i class="ti ti-file-text"></i></div>
    <div class="arsip-body">
      <div class="arsip-title">${d.judul}<span class="badge ${KAT_COLORS_ARSIP[d.kat]||'gray'}">${d.kat}</span></div>
      <div class="arsip-meta">${d.no ? 'No: ' + d.no + ' · ' : ''}${d.tgl}</div>
      ${d.deskripsi ? `<div class="arsip-desc">${d.deskripsi}</div>` : ''}
      ${d.files?.length ? `<div class="arsip-files">${d.files.map(f => `<a class="file-link" href="/uploads/${f.filename}" target="_blank" download="${f.originalname}"><i class="ti ti-download"></i>${f.originalname}</a>`).join('')}</div>` : ''}
    </div>
    <button class="btn sm danger" data-id="${d.id}" data-action="del-arsip"><i class="ti ti-trash"></i></button>
  </div>`).join('')
}

qs('arsip-save-btn').addEventListener('click', async () => {
  const judul = qs('arsip-judul').value, kat = qs('arsip-kategori').value, tgl = qs('arsip-tgl').value || today()
  if (!judul) { toast('Judul dokumen wajib diisi', 'error'); return }
  showLoading(true)
  try {
    const fd = new FormData()
    fd.append('judul', judul); fd.append('kat', kat); fd.append('tgl', tgl)
    fd.append('no', qs('arsip-no').value); fd.append('deskripsi', qs('arsip-deskripsi').value)
    pendingFiles.forEach(f => fd.append('files', f))
    await API.saveArsip(fd)
    ;['arsip-judul','arsip-tgl','arsip-no','arsip-deskripsi'].forEach(id => qs(id).value = '')
    qs('arsip-file').value = ''; pendingFiles = []; renderFilePreview()
    await loadArsip(); toast('Arsip disimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})

qs('arsip-filter-kat').addEventListener('change', loadArsip)
qs('arsip-search').addEventListener('input', renderFilteredArsip)

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-arsip"]')) {
    if (!confirm2('Hapus arsip ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try { await API.delArsip(id); await loadArsip(); toast('Dihapus') }
    catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

/* ── KATEGORI ARSIP MODAL ── */
async function renderKatArsipModal() {
  const list = await API.getKatArsip()
  qs('kat-arsip-list-modal').innerHTML = list.map(k => `<div class="item-row">
    <div class="item-row-label"><span>${k.label}</span>${k.is_default ? '<span class="default-badge">bawaan</span>' : ''}</div>
    <button class="btn sm" data-id="${k.id}" data-action="edit-kat-arsip"><i class="ti ti-pencil"></i></button>
    ${!k.is_default ? `<button class="btn sm danger" data-id="${k.id}" data-action="del-kat-arsip"><i class="ti ti-trash"></i></button>` : ''}</div>`).join('')
}

qs('btn-kelola-kat-arsip').addEventListener('click', async () => {
  qs('kat-arsip-modal-srch').value = ''
  await renderKatArsipModal()
  qs('modal-kat-arsip').classList.add('open')
})

qs('kat-arsip-close-btn').addEventListener('click', async () => {
  qs('modal-kat-arsip').classList.remove('open')
  await loadKatArsip()
})

qs('modal-kat-arsip').addEventListener('click', async e => {
  if (e.target === qs('modal-kat-arsip')) { qs('modal-kat-arsip').classList.remove('open'); await loadKatArsip() }
})

qs('kat-arsip-add-btn').addEventListener('click', async () => {
  const label = qs('kat-arsip-new-input').value.trim()
  if (!label) { toast('Nama kategori tidak boleh kosong', 'error'); return }
  try { await API.saveKatArsip({ label }); qs('kat-arsip-new-input').value = ''; await renderKatArsipModal(); toast('Kategori ditambahkan') }
  catch (e) { toast(e.message, 'error') }
})

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action="edit-kat-arsip"]'); if (!b) return
  const cur = b.closest('.item-row').querySelector('.item-row-label span').textContent
  const v = prompt('Nama kategori arsip baru:', cur); if (v == null) return
  const t = v.trim(); if (!t || t === cur) return
  try { await API.updateKatArsip(b.dataset.id, { label: t }); await renderKatArsipModal(); toast('Diperbarui') }
  catch (err) { toast(err.message, 'error') }
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-kat-arsip"]')) {
    if (!confirm2('Hapus kategori ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    try { await API.delKatArsip(id); await renderKatArsipModal(); toast('Dihapus') }
    catch (e) { toast(e.message, 'error') }
  }
})

/* ── STOK OPNAME ── */
function calcSoSelisih() {
  const sb = +(qs('so-sebelum').value || 0), ss = +(qs('so-sesudah').value || 0)
  const sel = ss - sb
  qs('so-selisih-preview').value = sel === 0 ? 'Rp 0' : (sel > 0 ? '+' : '') + fmt(sel)
  qs('so-selisih-preview').style.color = sel > 0 ? 'var(--green)' : sel < 0 ? '#E24B4A' : 'inherit'
}

let _soData = []
const KATEGORI_SO = ['BMHP', 'Alkes', 'Obat', 'Laboratorium', 'Gas Medis']

async function loadStokOpname() {
  const [data, tujuan] = await Promise.all([API.getStokOpname(), API.getTujuan()])
  const opts = tujuan.map(t => `<option value="${t.label}">${t.label}</option>`).join('')
  qs('so-ruangan').innerHTML = opts
  qs('so-filter-ruangan').innerHTML = '<option value="">Semua Ruangan</option>' + opts
  const katOpts = KATEGORI_SO.map(k => `<option value="${k}">${k}</option>`).join('')
  qs('so-kategori').innerHTML = katOpts
  qs('so-filter-kategori').innerHTML = '<option value="">Semua Kategori</option>' + katOpts
  _soData = data
  renderStokOpnameTable(data)
}

function renderStokOpnameTable(data) {
  const tbody = qs('so-tbody'), tfoot = qs('so-tfoot')
  const filterR = qs('so-filter-ruangan').value
  const filterK = qs('so-filter-kategori').value
  const filterB = qs('so-filter-bulan').value
  let rows = data
  if (filterB) rows = rows.filter(d => (d.tgl || '').slice(0, 7) === filterB)
  if (filterK) rows = rows.filter(d => d.kategori === filterK)
  if (filterR) rows = rows.filter(d => d.ruangan === filterR)
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9"><div class="empty"><i class="ti ti-clipboard-list"></i>Belum ada data stok opname</div></td></tr>'
    tfoot.innerHTML = ''
    return
  }
  let totLebih = 0, totKurang = 0, totSebelum = 0, totSesudah = 0
  tbody.innerHTML = rows.map(d => {
    const lebih = d.selisih > 0 ? d.selisih : 0
    const kurang = d.selisih < 0 ? -d.selisih : 0
    totLebih += lebih; totKurang += kurang
    totSebelum += d.nilai_sebelum || 0; totSesudah += d.nilai_sesudah || 0
    return `<tr>
      <td>${d.tgl}</td>
      <td>${d.kategori ? `<span class="badge blue">${d.kategori}</span>` : '-'}</td>
      <td><span class="badge gray">${d.ruangan||'-'}</span></td>
      <td style="text-align:right">${fmt(d.nilai_sebelum)}</td>
      <td style="text-align:right;font-weight:600">${fmt(d.nilai_sesudah)}</td>
      <td style="text-align:right;font-weight:600;color:var(--green)">${lebih ? '+' + fmt(lebih) : '-'}</td>
      <td style="text-align:right;font-weight:600;color:#E24B4A">${kurang ? '-' + fmt(kurang) : '-'}</td>
      <td style="font-size:12px;color:var(--tx2)">${d.ket||'-'}</td>
      <td><button class="btn sm" data-id="${d.id}" data-action="edit-so"><i class="ti ti-pencil"></i></button> <button class="btn sm danger" data-id="${d.id}" data-action="del-so"><i class="ti ti-trash"></i></button></td>
    </tr>`
  }).join('')
  tfoot.innerHTML = `<tr style="font-weight:700;border-top:2px solid var(--bd)">
    <td colspan="3">Total (${rows.length} data)</td>
    <td style="text-align:right">${fmt(totSebelum)}</td>
    <td style="text-align:right">${fmt(totSesudah)}</td>
    <td style="text-align:right;color:var(--green)">${totLebih ? '+' + fmt(totLebih) : '-'}</td>
    <td style="text-align:right;color:#E24B4A">${totKurang ? '-' + fmt(totKurang) : '-'}</td>
    <td colspan="2"></td>
  </tr>`
}

qs('so-save-btn').addEventListener('click', async () => {
  const sebelum = qs('so-sebelum').value, sesudah = qs('so-sesudah').value
  if (!sebelum && !sesudah) { toast('Nilai stok wajib diisi', 'error'); return }
  showLoading(true)
  try {
    const payload = { tgl: qs('so-tgl').value || today(), kategori: qs('so-kategori').value, ruangan: qs('so-ruangan').value, nilai_sebelum: sebelum, nilai_sesudah: sesudah, ket: qs('so-ket').value }
    if (_editSo) { await API.updateStokOpname(_editSo, payload); _editSo = null; qs('so-save-btn').innerHTML = '<i class="ti ti-device-floppy"></i>Simpan' }
    else { await API.saveStokOpname(payload) }
    ;['so-sebelum','so-sesudah','so-ket'].forEach(id => qs(id).value = '')
    qs('so-selisih-preview').value = ''; qs('so-selisih-preview').style.color = 'inherit'
    _soData = await API.getStokOpname(); renderStokOpnameTable(_soData)
    toast('Tersimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})

qs('so-filter-ruangan').addEventListener('change', () => renderStokOpnameTable(_soData))
qs('so-filter-kategori').addEventListener('change', () => renderStokOpnameTable(_soData))
qs('so-filter-bulan').addEventListener('change', () => renderStokOpnameTable(_soData))

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="edit-so"]'); if (!b) return
  const d = _soData.find(x => String(x.id) === b.dataset.id); if (!d) return
  qs('so-tgl').value = d.tgl || ''
  qs('so-kategori').value = d.kategori || ''
  qs('so-ruangan').value = d.ruangan || ''
  qs('so-sebelum').value = d.nilai_sebelum ?? ''
  qs('so-sesudah').value = d.nilai_sesudah ?? ''
  qs('so-ket').value = d.ket || ''
  calcSoSelisih()
  _editSo = d.id
  qs('so-save-btn').innerHTML = '<i class="ti ti-pencil"></i>Update'
  qs('so-tgl').scrollIntoView({ behavior: 'smooth', block: 'center' })
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-so"]')) {
    if (!confirm2('Hapus data ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try { await API.delStokOpname(id); _soData = await API.getStokOpname(); renderStokOpnameTable(_soData); toast('Dihapus') }
    catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

/* ── REKAP ── */
async function loadRekap() {
  const dari = qs('rekap-dari').value, sampai = qs('rekap-sampai').value
  updateExcelLink()
  showLoading(true)
  try {
    const [sum, beli, mut, pj, so] = await Promise.all([
      API.getRekapSummary({ dari, sampai }),
      API.getPenerimaan({ dari, sampai }),
      API.getMutasi({ dari, sampai }),
      API.getPenjualan({ dari, sampai }),
      API.getStokOpname({ dari, sampai })
    ])
    renderRekapSummary(sum)
    renderRekapPenjualan(sum, pj)
    renderRekapPembelian(beli, sum.totalBeli)
    renderRekapMutasi(sum)
    renderRekapSO(so)
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
}

function renderRekapSO(data) {
  const el = qs('rekap-so')
  if (!data.length) { el.innerHTML = '<div class="empty">Tidak ada data stok opname pada periode ini</div>'; return }
  const byRuangan = {}
  data.forEach(d => {
    const r = d.ruangan || 'Umum'
    if (!byRuangan[r]) byRuangan[r] = { sebelum: 0, sesudah: 0, selisih: 0, count: 0 }
    byRuangan[r].sebelum += d.nilai_sebelum
    byRuangan[r].sesudah += d.nilai_sesudah
    byRuangan[r].selisih += d.selisih
    byRuangan[r].count++
  })
  el.innerHTML = `<div class="cards-row">${Object.entries(byRuangan).map(([ruangan, v]) => `
    <div class="metric-card">
      <div class="metric-label">${ruangan}</div>
      <div style="font-size:12px;margin:6px 0 2px"><span style="color:var(--tx2)">Sebelum SO</span><br><strong>${fmt(v.sebelum)}</strong></div>
      <div style="font-size:12px;margin-bottom:2px"><span style="color:var(--tx2)">Sesudah SO</span><br><strong>${fmt(v.sesudah)}</strong></div>
      <div style="font-size:14px;font-weight:600;margin-top:6px;${v.selisih<0?'color:#E24B4A':v.selisih>0?'color:var(--green)':''}">${(v.selisih>0?'+':'')+fmt(v.selisih)}</div>
      <div class="metric-sub">${v.count} kali opname</div>
    </div>`).join('')}</div>`
}

function updateExcelLink() { /* download ditangani lewat klik ber-auth */ }
qs('btn-excel').addEventListener('click', e => {
  e.preventDefault()
  const dari = qs('rekap-dari').value, sampai = qs('rekap-sampai').value
  downloadFile(`/rekap/excel?dari=${dari || ''}&sampai=${sampai || ''}`, 'Rekap_Farmasi.xlsx')
})

qs('rekap-filter-btn').addEventListener('click', loadRekap)
qs('rekap-dari').addEventListener('change', updateExcelLink)
qs('rekap-sampai').addEventListener('change', updateExcelLink)

function renderRekapSummary(sum) {
  qs('rekap-summary').innerHTML = `
    <div class="metric-card"><div class="metric-label">Total Resep</div><div class="metric-val">${fmtN(sum.totalPjR)}</div></div>
    <div class="metric-card"><div class="metric-label">Total Penjualan</div><div class="metric-val purple">${fmt(sum.totalPjN)}</div></div>
    <div class="metric-card"><div class="metric-label">Total Penerimaan</div><div class="metric-val amber">${fmt(sum.totalBeli)}</div></div>
    <div class="metric-card"><div class="metric-label">Total Mutasi</div><div class="metric-val green">${fmtN(sum.totalMut)} item</div></div>
    <div class="metric-card"><div class="metric-label">Total Arsip</div><div class="metric-val">${fmtN(sum.arsipCount)} dok.</div></div>`
}

function renderRekapPenjualan(sum, pj) {
  const el = qs('rekap-penjualan')
  if (!sum.pjByKat.length) { el.innerHTML = '<div class="empty">Tidak ada data</div>'; return }
  el.innerHTML = sum.pjByKat.map((k, i) => {
    const pct = sum.totalPjR ? Math.round(k.resep / sum.totalPjR * 100) : 0
    return `<div class="rekap-row">
      <div><div style="font-size:13px;font-weight:600;color:${KAT_HEX[i%KAT_HEX.length]}">${k.label}</div>
      <div style="font-size:11px;color:var(--text-sec)">${fmtN(k.resep)} resep · ${pct}%</div></div>
      <div style="font-weight:600">${fmt(k.nominal)}</div></div>`
  }).join('') + `<div style="text-align:right;font-size:12px;margin-top:8px;color:var(--text-sec)">Total: ${fmt(sum.totalPjN)} · ${fmtN(sum.totalPjR)} resep</div>`
}

function renderRekapPembelian(beli, total) {
  const el = qs('rekap-pembelian')
  if (!beli.length) { el.innerHTML = '<div class="empty">Tidak ada data</div>'; return }
  el.innerHTML = beli.slice(0, 8).map(d => `<div class="rekap-row">
    <div><div style="font-size:13px">${d.supplier||'-'}</div><div style="font-size:11px;color:var(--text-sec)">${d.tgl} · ${d.anggaran||'-'}</div></div>
    <div style="font-weight:600">${fmt(d.total)}</div></div>`).join('') + `<div style="text-align:right;font-size:12px;margin-top:8px;color:var(--text-sec)">Total: ${fmt(total)}</div>`
}

function renderRekapMutasi(sum) {
  const el = qs('rekap-mutasi')
  if (!sum.mutByTujuan.length) { el.innerHTML = '<div class="empty">Tidak ada data</div>'; return }
  el.innerHTML = `<div class="cards-row">${sum.mutByTujuan.map(t => `<div class="metric-card"><div class="metric-label">${t.label}</div><div style="font-size:16px;font-weight:600">${fmt(t.total)}</div><div class="metric-sub">${fmtN(t.count)} transaksi</div></div>`).join('')}</div>`
}

/* ── INIT ── */
async function init() {
  qs('topbar-date').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  try { const s = await API.getSettings(); qs('topbar-rs').textContent = s.rs_name || 'RS Medika' } catch {}
  const defDate = today()
  ;['po-tgl','real-tgl','terima-tgl','pin-tgl','mut-tgl','arsip-tgl','pj-tgl','hut-tgl','blm-tgl','prb-tgl','alkes-tgl','iter-tgl','so-tgl'].forEach(id => { const el = qs(id); if (el) el.value = defDate })
  qs('rekap-sampai').value = defDate
  qs('rekap-dari').value = defDate.slice(0, 7) + '-01'
  qs('pj-filter-bulan').value = defDate.slice(0, 7)
  updateExcelLink()
  setupFileUpload()

  // Pagination otomatis untuk tabel-tabel daftar
  ;['po-tbody', 'real-tbody', 'terima-tbody', 'pin-tbody', 'hut-tbody', 'blm-tbody', 'prb-tbody', 'alkes-tbody', 'iter-tbody', 'so-tbody', 'td-tbody'].forEach(id => setupPager(id))

  // Modal search
  qs('supplier-modal-srch').addEventListener('input', () => filterModalItems('supplier-modal-srch', 'supplier-list-modal'))
  qs('barang-modal-srch').addEventListener('input', () => filterModalItems('barang-modal-srch', 'barang-list-modal'))
  qs('petugas-modal-srch').addEventListener('input', () => filterModalItems('petugas-modal-srch', 'petugas-list-modal'))
  qs('kat-arsip-modal-srch').addEventListener('input', () => filterModalItems('kat-arsip-modal-srch', 'kat-arsip-list-modal'))
  qs('tujuan-modal-srch').addEventListener('input', () => filterModalItems('tujuan-modal-srch', 'tujuan-list-modal'))
  qs('kategori-modal-srch').addEventListener('input', () => filterModalItems('kategori-modal-srch', 'kategori-list-modal'))

  await showPage('dashboard')
}

/* ── AUTH FLOW ── */
function showAuth() {
  qs('auth-overlay').style.display = 'flex'
}
function startApp() {
  qs('auth-overlay').style.display = 'none'
  qs('topbar-user').innerHTML = `<i class="ti ti-user"></i>${_currentUser?.nama || ''}`
  init().catch(console.error)
}
window.onAuthExpired = () => { _currentUser = null; showAuth() }

async function boot() {
  if (localStorage.getItem('token')) {
    try { const r = await API.authMe(); _currentUser = r.user; startApp(); return } catch {}
  }
  localStorage.removeItem('token')
  showAuth()
}

qs('show-register').addEventListener('click', e => { e.preventDefault(); qs('auth-login').style.display = 'none'; qs('auth-register').style.display = ''; qs('auth-title').textContent = 'Daftar akun baru' })
qs('show-login').addEventListener('click', e => { e.preventDefault(); qs('auth-register').style.display = 'none'; qs('auth-login').style.display = ''; qs('auth-title').textContent = 'Masuk ke akun Anda' })

qs('login-btn').addEventListener('click', async () => {
  const username = qs('login-user').value.trim(), password = qs('login-pass').value
  if (!username || !password) { toast('Isi username & password', 'error'); return }
  showLoading(true)
  try {
    const r = await API.authLogin({ username, password })
    localStorage.setItem('token', r.token); _currentUser = r.user
    qs('login-pass').value = ''
    startApp(); toast('Selamat datang, ' + r.user.nama)
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})
qs('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') qs('login-btn').click() })

qs('reg-btn').addEventListener('click', async () => {
  const nama = qs('reg-nama').value.trim(), username = qs('reg-user').value.trim(), password = qs('reg-pass').value
  if (!username || !password) { toast('Username & password wajib diisi', 'error'); return }
  showLoading(true)
  try {
    const r = await API.authRegister({ username, nama, password })
    localStorage.setItem('token', r.token); _currentUser = r.user
    ;['reg-nama', 'reg-user', 'reg-pass'].forEach(id => qs(id).value = '')
    startApp(); toast('Akun dibuat. Selamat datang, ' + r.user.nama)
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})

qs('btn-logout').addEventListener('click', async () => {
  if (!confirm2('Keluar dari akun?')) return
  try { await API.authLogout() } catch {}
  localStorage.removeItem('token'); _currentUser = null
  location.reload()
})

boot()
