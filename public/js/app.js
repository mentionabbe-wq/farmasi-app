/* ── UTILS ── */
const fmt = n => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID')
const fmtN = n => Math.round(n || 0).toLocaleString('id-ID')
const today = () => new Date().toISOString().slice(0, 10)
const qs = id => document.getElementById(id)
const BADGE = ['blue','green','amber','purple','coral','teal','gray']
const KAT_HEX = ['#185FA5','#0F6E56','#854F0B','#3C3489','#993C1D','#085041','#444441']
const KAT_COLORS_ARSIP = { SPO:'blue', Kronologi:'amber', Laporan:'green', SK:'purple', Lainnya:'gray' }

let STATE = { tujuan: [], kategori: [], activeMutTab: null, activePjTab: '__all__' }

function showLoading(v) { document.getElementById('loading-overlay').classList.toggle('show', v) }

function toast(msg, type = 'success') {
  const el = qs('toast')
  el.textContent = msg
  el.className = 'show ' + type
  clearTimeout(el._t)
  el._t = setTimeout(() => el.classList.remove('show'), 2800)
}

function confirm2(msg) { return window.confirm(msg) }

/* ── NAVIGATION ── */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showPage(btn.dataset.page))
})

async function showPage(p) {
  document.querySelectorAll('.page').forEach(e => e.classList.remove('active'))
  document.querySelectorAll('.nav-btn').forEach(e => e.classList.remove('active'))
  qs('page-' + p).classList.add('active')
  document.querySelector(`.nav-btn[data-page="${p}"]`).classList.add('active')
  const loaders = { dashboard: loadDashboard, anggaran: loadAnggaran, pembelian: loadPembelian, mutasi: loadMutasi, penjualan: loadPenjualan, arsip: loadArsip, rekap: loadRekap }
  if (loaders[p]) { showLoading(true); try { await loaders[p]() } catch (e) { toast(e.message, 'error') } finally { showLoading(false) } }
}

/* ── DASHBOARD ── */
async function loadDashboard() {
  const [ang, beli, mut, pj, tujuan, kats] = await Promise.all([
    API.getAnggaran(), API.getPembelian(), API.getMutasi(),
    API.getPenjualan(), API.getTujuan(), API.getKategori()
  ])
  STATE.tujuan = tujuan; STATE.kategori = kats
  const todayStr = today()
  const pjToday = pj.filter(d => d.tgl === todayStr)
  const totalPjN = pj.reduce((s, d) => s + d.total_nominal, 0)
  const totalBeli = beli.reduce((s, d) => s + d.total, 0)
  const totalMut = mut.reduce((s, d) => s + (d.total || 0), 0)
  const totalAng = ang.reduce((s, d) => s + d.total, 0)

  qs('dash-cards').innerHTML = `
    <div class="metric-card"><div class="metric-label">Total Anggaran</div><div class="metric-val blue">${fmt(totalAng)}</div></div>
    <div class="metric-card"><div class="metric-label">Total Pembelian</div><div class="metric-val amber">${fmt(totalBeli)}</div></div>
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

  qs('dash-mutasi').innerHTML = mut.slice(0, 4).map(d => `<div class="rekap-row"><span>${d.nama}</span><span style="font-size:12px;color:var(--text-sec)">${tujuanMap[d.tujuan] || d.tujuan} · ${fmtN(d.jml)} ${d.satuan}</span></div>`).join('') || '<div class="empty"><i class="ti ti-transfer"></i>Belum ada data</div>'
  qs('dash-pembelian').innerHTML = beli.slice(0, 4).map(d => `<div class="rekap-row"><span>${d.nama}</span><span style="font-weight:600">${fmt(d.total)}</span></div>`).join('') || '<div class="empty"><i class="ti ti-shopping-cart"></i>Belum ada data</div>'
}

/* ── ANGGARAN ── */
async function loadAnggaran() {
  const data = await API.getAnggaran()
  renderAnggaranTable(data)
}

function renderAnggaranTable(data) {
  const tbody = qs('ang-tbody')
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="8"><div class="empty">Belum ada data anggaran</div></td></tr>'; return }
  tbody.innerHTML = data.map(d => {
    const pct = d.total ? Math.min(100, Math.round(d.terpakai / d.total * 100)) : 0
    return `<tr>
      <td>${d.bulan}</td><td>${fmt(d.total)}</td><td>${fmt(d.ranap)}</td><td>${fmt(d.ralan)}</td>
      <td>${fmt(d.terpakai)}<div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${pct>90?'#E24B4A':pct>70?'#EF9F27':'#1D9E75'}"></div></div></td>
      <td style="color:${d.sisa<0?'#A32D2D':'#0F6E56'}">${fmt(d.sisa)}</td>
      <td style="font-size:12px;color:var(--text-sec)">${d.ket || '-'}</td>
      <td><button class="btn sm danger" data-id="${d.id}" data-action="del-ang"><i class="ti ti-trash"></i></button></td></tr>`
  }).join('')
}

qs('ang-save-btn').addEventListener('click', async () => {
  const bulan = qs('ang-bulan').value, total = qs('ang-total').value
  if (!bulan || !total) { toast('Periode dan total wajib diisi', 'error'); return }
  showLoading(true)
  try {
    await API.saveAnggaran({ bulan, total: +total, ranap: +(qs('ang-ranap').value || 0), ralan: +(qs('ang-ralan').value || 0), ket: qs('ang-ket').value })
    ;['ang-bulan','ang-total','ang-ranap','ang-ralan','ang-ket'].forEach(id => qs(id).value = '')
    const data = await API.getAnggaran(); renderAnggaranTable(data)
    await populateAnggaranSelect()
    toast('Anggaran disimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
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
  const data = await API.getAnggaran()
  qs('beli-anggaran').innerHTML = '<option value="">-- Pilih Periode --</option>' + data.map(d => `<option value="${d.bulan}">${d.bulan}</option>`).join('')
}

/* ── PEMBELIAN ── */
async function loadPembelian() {
  await populateAnggaranSelect()
  const data = await API.getPembelian()
  renderPembelianTable(data)
}

function renderPembelianTable(data) {
  const tbody = qs('beli-tbody')
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="9"><div class="empty">Belum ada data pembelian</div></td></tr>'; return }
  tbody.innerHTML = data.map(d => `<tr>
    <td>${d.tgl}</td><td>${d.supplier||'-'}</td><td>${d.nama}</td>
    <td style="text-align:right">${fmtN(d.jml)}</td><td>${d.satuan||''}</td>
    <td style="text-align:right">${fmt(d.harga)}</td><td style="text-align:right;font-weight:600">${fmt(d.total)}</td>
    <td>${d.anggaran?`<span class="badge gray">${d.anggaran}</span>`:'-'}</td>
    <td><button class="btn sm danger" data-id="${d.id}" data-action="del-beli"><i class="ti ti-trash"></i></button></td></tr>`).join('')
}

qs('beli-save-btn').addEventListener('click', async () => {
  const nama = qs('beli-nama').value, jml = qs('beli-jml').value
  if (!nama || !jml) { toast('Nama item dan jumlah wajib diisi', 'error'); return }
  showLoading(true)
  try {
    await API.savePembelian({ tgl: qs('beli-tgl').value||today(), supplier: qs('beli-supplier').value, nama, jml: +jml, satuan: qs('beli-satuan').value, harga: +(qs('beli-harga').value||0), anggaran: qs('beli-anggaran').value, ket: qs('beli-ket').value })
    ;['beli-tgl','beli-supplier','beli-nama','beli-jml','beli-satuan','beli-harga','beli-ket'].forEach(id => qs(id).value = '')
    qs('beli-anggaran').value = ''
    renderPembelianTable(await API.getPembelian())
    toast('Pembelian disimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-beli"]')) {
    if (!confirm2('Hapus data pembelian ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try { await API.delPembelian(id); renderPembelianTable(await API.getPembelian()); toast('Dihapus') }
    catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

/* ── MUTASI ── */
async function loadMutasi() {
  const [tujuan, mutasi] = await Promise.all([API.getTujuan(), API.getMutasi()])
  STATE.tujuan = tujuan
  if (!STATE.activeMutTab || !tujuan.find(t => t.id === STATE.activeMutTab)) STATE.activeMutTab = tujuan[0]?.id || null
  buildMutasiTabs(tujuan, mutasi)
  renderMutasiSelect(tujuan)
}

function renderMutasiSelect(tujuan) {
  qs('mut-tujuan-select').innerHTML = tujuan.map(t => `<option value="${t.id}">${t.label}</option>`).join('')
}

function buildMutasiTabs(tujuan, mutasi) {
  qs('mut-tab-bar').innerHTML = tujuan.map((t, i) => `<button class="tab${t.id === STATE.activeMutTab ? ' active' : ''}" data-tab="${t.id}"><span class="badge ${BADGE[i%BADGE.length]}">${t.label.slice(0,2).toUpperCase()}</span>${t.label}</button>`).join('')
  qs('mut-tab-panels').innerHTML = tujuan.map(t => {
    const items = mutasi.filter(d => d.tujuan === t.id)
    const total = items.reduce((s, d) => s + (d.total || 0), 0)
    const rows = items.length ? items.map(d => `<tr>
      <td style="font-size:12px">${d.tgl}</td><td style="font-size:12px">${d.no||'-'}</td><td>${d.nama}</td>
      <td style="text-align:right">${fmtN(d.jml)}</td><td>${d.satuan||''}</td>
      <td style="text-align:right;font-size:12px">${d.harga?fmt(d.harga):'-'}</td>
      <td style="text-align:right;font-size:12px">${d.total?fmt(d.total):'-'}</td>
      <td style="font-size:12px">${d.petugas||'-'}</td>
      <td style="font-size:11px;color:var(--text-sec);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.ket||'-'}</td>
      <td><button class="btn sm danger" data-id="${d.id}" data-action="del-mut"><i class="ti ti-trash"></i></button></td></tr>`).join('')
      : `<tr><td colspan="10"><div class="empty">Belum ada mutasi ke ${t.label}</div></td></tr>`
    return `<div class="tab-panel${t.id === STATE.activeMutTab ? ' active' : ''}" id="mut-panel-${t.id}">
      <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>No.</th><th>Item</th><th>Jml</th><th>Sat.</th><th>Harga Sat.</th><th>Total</th><th>Petugas</th><th>Ket.</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      ${items.length ? `<div style="text-align:right;font-size:13px;font-weight:600;margin-top:8px;color:var(--text-sec)">Total: <span style="color:var(--text)">${fmt(total)}</span> (${items.length} item)</div>` : ''}</div>`
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
  const nama = qs('mut-nama').value, jml = qs('mut-jml').value, tujuan = qs('mut-tujuan-select').value
  if (!nama || !jml || !tujuan) { toast('Nama, jumlah, dan tujuan wajib diisi', 'error'); return }
  showLoading(true)
  try {
    await API.saveMutasi({ tgl: qs('mut-tgl').value||today(), no: qs('mut-no').value, tujuan, nama, jml: +jml, satuan: qs('mut-satuan').value, harga: +(qs('mut-harga').value||0), petugas: qs('mut-petugas').value, ket: qs('mut-ket').value })
    ;['mut-tgl','mut-no','mut-nama','mut-jml','mut-satuan','mut-harga','mut-petugas','mut-ket'].forEach(id => qs(id).value = '')
    const [t, m] = await Promise.all([API.getTujuan(), API.getMutasi()])
    buildMutasiTabs(t, m); renderMutasiSelect(t)
    toast('Mutasi disimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
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

/* ── TUJUAN MODAL ── */
qs('btn-kelola-tujuan').addEventListener('click', () => openModal('tujuan'))
qs('tujuan-close-btn').addEventListener('click', () => closeModal('tujuan'))
qs('modal-tujuan').addEventListener('click', e => { if (e.target === qs('modal-tujuan')) closeModal('tujuan') })

async function openModal(type) {
  if (type === 'tujuan') { await renderTujuanModal(); qs('modal-tujuan').classList.add('open') }
  if (type === 'kategori') { await renderKategoriModal(); qs('modal-kategori').classList.add('open') }
}
async function closeModal(type) {
  qs('modal-' + type).classList.remove('open')
  if (type === 'tujuan') { const [t, m] = await Promise.all([API.getTujuan(), API.getMutasi()]); STATE.tujuan = t; buildMutasiTabs(t, m); renderMutasiSelect(t); renderPjTujuanSelect(t) }
  if (type === 'kategori') { const k = await API.getKategori(); STATE.kategori = k; renderPjInputs(k); await renderPjSummary() }
}

async function renderTujuanModal() {
  const list = await API.getTujuan()
  qs('tujuan-list-modal').innerHTML = list.map(t => `<div class="item-row">
    <div class="item-row-label"><span>${t.label}</span>${t.is_default ? '<span class="default-badge">bawaan</span>' : ''}</div>
    ${!t.is_default ? `<button class="btn sm danger" data-id="${t.id}" data-action="del-tujuan"><i class="ti ti-trash"></i></button>` : ''}</div>`).join('')
}

qs('tujuan-add-btn').addEventListener('click', async () => {
  const label = qs('tujuan-new-input').value.trim()
  if (!label) { toast('Nama tujuan tidak boleh kosong', 'error'); return }
  try { await API.saveTujuan({ label }); qs('tujuan-new-input').value = ''; await renderTujuanModal(); toast('Tujuan ditambahkan') }
  catch (e) { toast(e.message, 'error') }
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
}

function renderPjTujuanSelect(tujuan) {
  qs('pj-tujuan-select').innerHTML = tujuan.map(t => `<option value="${t.id}">${t.label}</option>`).join('')
}

function renderPjInputs(kats) {
  qs('pj-kat-inputs').innerHTML = (kats || STATE.kategori).map((k, i) => `
    <div class="kat-block" style="border-left-color:${KAT_HEX[i%KAT_HEX.length]}">
      <div class="kat-block-title" style="color:${KAT_HEX[i%KAT_HEX.length]}">${k.label}</div>
      <div class="form-group"><label>Total Belanja (Rp)</label><input type="number" id="pj-nominal-${k.id}" placeholder="0" min="0" oninput="calcPjPreview()"></div>
    </div>`).join('')
}

function calcPjPreview() {
  let tn = 0
  STATE.kategori.forEach(k => { tn += +(qs('pj-nominal-' + k.id)?.value || 0) })
  qs('pj-total-nominal-preview').textContent = fmt(tn)
}

qs('pj-save-btn').addEventListener('click', async () => {
  const kats = STATE.kategori
  const detail = {}; let totalNominal = 0
  kats.forEach(k => {
    const n = +(qs('pj-nominal-' + k.id)?.value || 0)
    detail[k.id] = { resep: 0, nominal: n, label: k.label }
    totalNominal += n
  })
  if (!totalNominal) { toast('Isi minimal satu kategori', 'error'); return }
  showLoading(true)
  try {
    await API.savePenjualan({ tgl: qs('pj-tgl').value || today(), tujuan: qs('pj-tujuan-select').value, shift: qs('pj-shift').value, detail, total_resep: 0, total_nominal: totalNominal })
    kats.forEach(k => { const ni = qs('pj-nominal-' + k.id); if (ni) ni.value = '' })
    qs('pj-shift').value = ''; calcPjPreview()
    await renderPjSummary(); await renderPenjualanTable()
    toast('Penjualan disimpan')
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
})

async function renderPjSummary() {
  const [data, kats] = await Promise.all([API.getPenjualan(), API.getKategori()])
  STATE.kategori = kats
  const totalN = data.reduce((s, d) => s + d.total_nominal, 0)
  qs('pj-summary-cards').innerHTML = `
    <div class="metric-card"><div class="metric-label">Total Belanja</div><div class="metric-val green">${fmt(totalN)}</div><div class="metric-sub">semua kategori</div></div>
    ${kats.map((k, i) => {
      const n = data.reduce((s, d) => s + ((d.detail||{})[k.id]?.nominal || 0), 0)
      return `<div class="metric-card"><div class="metric-label">${k.label}</div><div class="metric-val" style="font-size:16px;color:${KAT_HEX[i%KAT_HEX.length]}">${fmt(n)}</div></div>`
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
  const katCols = kats.map(k => `<th style="text-align:right;border-left:1px solid var(--bd)">${k.label}</th>`).join('')
  const rows = items.map(d => {
    const katCells = kats.map(k => {
      const n = (d.detail||{})[k.id]?.nominal || 0
      return `<td style="text-align:right;border-left:1px solid var(--bd)">${n ? fmt(n) : '-'}</td>`
    }).join('')
    return `<tr><td>${d.tgl}</td><td style="font-size:12px;color:var(--tx2)">${d.shift||'-'}</td>
      <td style="text-align:right;font-weight:600;color:var(--green)">${fmt(d.total_nominal)}</td>
      ${katCells}
      <td><button class="btn sm danger" data-id="${d.id}" data-action="del-pj"><i class="ti ti-trash"></i></button></td></tr>`
  }).join('')
  const totKat = kats.map(k => {
    const n = items.reduce((s, d) => s + ((d.detail||{})[k.id]?.nominal || 0), 0)
    return `<td style="text-align:right;font-weight:600;border-left:1px solid var(--bd)">${fmt(n)}</td>`
  }).join('')
  return `<div class="table-wrap"><table>
    <thead><tr><th>Tanggal</th><th>Shift</th><th style="text-align:right">Total Belanja</th>${katCols}<th></th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="2" style="font-size:12px">TOTAL</td>
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
    ${!k.is_default ? `<button class="btn sm danger" data-id="${k.id}" data-action="del-kat"><i class="ti ti-trash"></i></button>` : ''}</div>`).join('')
}

qs('kategori-add-btn').addEventListener('click', async () => {
  const label = qs('kategori-new-input').value.trim()
  if (!label) { toast('Nama kategori tidak boleh kosong', 'error'); return }
  try { await API.saveKategori({ label }); qs('kategori-new-input').value = ''; await renderKategoriModal(); toast('Kategori ditambahkan') }
  catch (e) { toast(e.message, 'error') }
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
  qs('modal-settings').classList.add('open')
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

async function loadArsip() {
  const kat = qs('arsip-filter-kat').value
  const data = await API.getArsip(kat ? { kat } : {})
  renderArsipList(data)
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

document.addEventListener('click', async e => {
  if (e.target.closest('[data-action="del-arsip"]')) {
    if (!confirm2('Hapus arsip ini?')) return
    const id = e.target.closest('[data-id]').dataset.id
    showLoading(true)
    try { await API.delArsip(id); await loadArsip(); toast('Dihapus') }
    catch (err) { toast(err.message, 'error') } finally { showLoading(false) }
  }
})

/* ── REKAP ── */
async function loadRekap() {
  const dari = qs('rekap-dari').value, sampai = qs('rekap-sampai').value
  updateExcelLink()
  showLoading(true)
  try {
    const [sum, beli, mut, pj] = await Promise.all([
      API.getRekapSummary({ dari, sampai }),
      API.getPembelian({ dari, sampai }),
      API.getMutasi({ dari, sampai }),
      API.getPenjualan({ dari, sampai })
    ])
    renderRekapSummary(sum)
    renderRekapPenjualan(sum, pj)
    renderRekapPembelian(beli, sum.totalBeli)
    renderRekapMutasi(sum)
  } catch (e) { toast(e.message, 'error') } finally { showLoading(false) }
}

function updateExcelLink() {
  const dari = qs('rekap-dari').value, sampai = qs('rekap-sampai').value
  qs('btn-excel').href = API.excelUrl(dari, sampai)
}

qs('rekap-filter-btn').addEventListener('click', loadRekap)
qs('rekap-dari').addEventListener('change', updateExcelLink)
qs('rekap-sampai').addEventListener('change', updateExcelLink)

function renderRekapSummary(sum) {
  qs('rekap-summary').innerHTML = `
    <div class="metric-card"><div class="metric-label">Total Resep</div><div class="metric-val">${fmtN(sum.totalPjR)}</div></div>
    <div class="metric-card"><div class="metric-label">Total Penjualan</div><div class="metric-val purple">${fmt(sum.totalPjN)}</div></div>
    <div class="metric-card"><div class="metric-label">Total Pembelian</div><div class="metric-val amber">${fmt(sum.totalBeli)}</div></div>
    <div class="metric-card"><div class="metric-label">Total Mutasi</div><div class="metric-val green">${fmt(sum.totalMut)}</div></div>
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
    <div><div style="font-size:13px">${d.nama}</div><div style="font-size:11px;color:var(--text-sec)">${d.tgl} · ${d.supplier||'-'}</div></div>
    <div style="font-weight:600">${fmt(d.total)}</div></div>`).join('') + `<div style="text-align:right;font-size:12px;margin-top:8px;color:var(--text-sec)">Total: ${fmt(total)}</div>`
}

function renderRekapMutasi(sum) {
  const el = qs('rekap-mutasi')
  if (!sum.mutByTujuan.length) { el.innerHTML = '<div class="empty">Tidak ada data</div>'; return }
  el.innerHTML = `<div class="cards-row">${sum.mutByTujuan.map(t => `<div class="metric-card"><div class="metric-label">${t.label}</div><div style="font-size:16px;font-weight:600">${fmt(t.total)}</div><div class="metric-sub">${fmtN(t.count)} item</div></div>`).join('')}</div>`
}

/* ── INIT ── */
async function init() {
  qs('topbar-date').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  try { const s = await API.getSettings(); qs('topbar-rs').textContent = s.rs_name || 'RS Medika' } catch {}
  const defDate = today()
  ;['beli-tgl','mut-tgl','arsip-tgl','pj-tgl'].forEach(id => { const el = qs(id); if (el) el.value = defDate })
  qs('rekap-sampai').value = defDate
  qs('rekap-dari').value = defDate.slice(0, 7) + '-01'
  qs('pj-filter-bulan').value = defDate.slice(0, 7)
  updateExcelLink()
  setupFileUpload()
  await showPage('dashboard')
}

init().catch(console.error)
