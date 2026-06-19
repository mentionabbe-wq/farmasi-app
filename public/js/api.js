const API = (() => {
  const BASE = '/api'

  async function req(method, path, body, isForm = false) {
    const opts = { method, headers: {} }
    if (body && !isForm) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body) }
    if (isForm) opts.body = body
    const res = await fetch(BASE + path, opts)
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`) }
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return res.json()
    return res
  }

  return {
    // Anggaran
    getAnggaran: () => req('GET', '/anggaran'),
    saveAnggaran: d => req('POST', '/anggaran', d),
    delAnggaran: id => req('DELETE', `/anggaran/${id}`),

    // Pembelian
    getPembelian: (p = {}) => req('GET', '/pembelian?' + new URLSearchParams(p)),
    savePembelian: d => req('POST', '/pembelian', d),
    delPembelian: id => req('DELETE', `/pembelian/${id}`),

    // Mutasi
    getMutasi: (p = {}) => req('GET', '/mutasi?' + new URLSearchParams(p)),
    saveMutasi: d => req('POST', '/mutasi', d),
    delMutasi: id => req('DELETE', `/mutasi/${id}`),

    // Penjualan
    getPenjualan: (p = {}) => req('GET', '/penjualan?' + new URLSearchParams(p)),
    savePenjualan: d => req('POST', '/penjualan', d),
    delPenjualan: id => req('DELETE', `/penjualan/${id}`),

    // Arsip
    getArsip: (p = {}) => req('GET', '/arsip?' + new URLSearchParams(p)),
    saveArsip: fd => req('POST', '/arsip', fd, true),
    delArsip: id => req('DELETE', `/arsip/${id}`),

    // Tujuan
    getTujuan: () => req('GET', '/tujuan'),
    saveTujuan: d => req('POST', '/tujuan', d),
    delTujuan: id => req('DELETE', `/tujuan/${id}`),

    // Kategori
    getKategori: () => req('GET', '/kategori'),
    saveKategori: d => req('POST', '/kategori', d),
    delKategori: id => req('DELETE', `/kategori/${id}`),

    // Rekap
    getRekapSummary: (p = {}) => req('GET', '/rekap/summary?' + new URLSearchParams(p)),
    excelUrl: (dari, sampai) => `/api/rekap/excel?dari=${dari || ''}&sampai=${sampai || ''}`,

    // Settings
    getSettings: () => req('GET', '/settings'),
    saveSettings: d => req('POST', '/settings', d),

    // Tidak Datang
    getTidakDatang: () => req('GET', '/tidak-datang'),
    saveTidakDatang: d => req('POST', '/tidak-datang', d),
    delTidakDatang: id => req('DELETE', `/tidak-datang/${id}`),

    // Kategori Arsip
    getKatArsip: () => req('GET', '/kat-arsip'),
    saveKatArsip: d => req('POST', '/kat-arsip', d),
    delKatArsip: id => req('DELETE', `/kat-arsip/${id}`),

    // Supplier
    getSupplier: () => req('GET', '/supplier'),
    saveSupplier: d => req('POST', '/supplier', d),
    delSupplier: id => req('DELETE', `/supplier/${id}`),
  }
})()
