const API = (() => {
  const BASE = '/api'

  async function req(method, path, body, isForm = false) {
    const opts = { method, headers: {} }
    const token = localStorage.getItem('token')
    if (token) opts.headers['Authorization'] = 'Bearer ' + token
    if (body && !isForm) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body) }
    if (isForm) opts.body = body
    const res = await fetch(BASE + path, opts)
    if (res.status === 401) {
      localStorage.removeItem('token')
      if (window.onAuthExpired) window.onAuthExpired()
      throw new Error('Sesi berakhir, silakan login')
    }
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`) }
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return res.json()
    return res
  }

  return {
    // Auth
    authLogin: d => req('POST', '/auth/login', d),
    authRegister: d => req('POST', '/auth/register', d),
    authMe: () => req('GET', '/auth/me'),
    authLogout: () => req('POST', '/auth/logout'),
    authAccount: d => req('POST', '/auth/account', d),

    // Anggaran
    getAnggaran: () => req('GET', '/anggaran'),
    saveAnggaran: d => req('POST', '/anggaran', d),
    delAnggaran: id => req('DELETE', `/anggaran/${id}`),

    // Penerimaan (internal: pembelian)
    getPembelian: (p = {}) => req('GET', '/pembelian?' + new URLSearchParams(p)),
    savePembelian: d => req('POST', '/pembelian', d),
    delPembelian: id => req('DELETE', `/pembelian/${id}`),

    // Pembelian (PO ke distributor)
    getPO: (p = {}) => req('GET', '/po?' + new URLSearchParams(p)),
    savePO: d => req('POST', '/po', d),
    updatePO: (id, d) => req('PUT', `/po/${id}`, d),
    delPO: id => req('DELETE', `/po/${id}`),

    // Realisasi Pembelian
    getRealisasi: (p = {}) => req('GET', '/realisasi?' + new URLSearchParams(p)),
    saveRealisasi: d => req('POST', '/realisasi', d),
    updateRealisasi: (id, d) => req('PUT', `/realisasi/${id}`, d),
    delRealisasi: id => req('DELETE', `/realisasi/${id}`),

    // Penerimaan (berdasarkan PO)
    getPenerimaan: (p = {}) => req('GET', '/penerimaan?' + new URLSearchParams(p)),
    savePenerimaan: d => req('POST', '/penerimaan', d),
    updatePenerimaan: (id, d) => req('PUT', `/penerimaan/${id}`, d),
    delPenerimaan: id => req('DELETE', `/penerimaan/${id}`),

    // Barang (directory)
    getBarang: () => req('GET', '/barang'),
    saveBarang: d => req('POST', '/barang', d),
    updateBarang: (id, d) => req('PUT', `/barang/${id}`, d),
    delBarang: id => req('DELETE', `/barang/${id}`),

    // Petugas (directory)
    getPetugas: () => req('GET', '/petugas'),
    savePetugas: d => req('POST', '/petugas', d),
    updatePetugas: (id, d) => req('PUT', `/petugas/${id}`, d),
    delPetugas: id => req('DELETE', `/petugas/${id}`),
    importBarang: fd => req('POST', '/barang/import', fd, true),

    // Obat Dihutangkan
    getHutangObat: () => req('GET', '/hutang-obat'),
    saveHutangObat: d => req('POST', '/hutang-obat', d),
    updateHutangObat: (id, d) => req('PUT', `/hutang-obat/${id}`, d),
    delHutangObat: id => req('DELETE', `/hutang-obat/${id}`),

    // Obat Belum Diambil
    getObatBelum: () => req('GET', '/obat-belum'),
    saveObatBelum: fd => req('POST', '/obat-belum', fd, true),
    delObatBelum: id => req('DELETE', `/obat-belum/${id}`),

    // BPJS PRB
    getBpjsPrb: () => req('GET', '/bpjs-prb'),
    saveBpjsPrb: d => req('POST', '/bpjs-prb', d),
    updateBpjsPrb: (id, d) => req('PUT', `/bpjs-prb/${id}`, d),
    delBpjsPrb: id => req('DELETE', `/bpjs-prb/${id}`),

    // BPJS Alkes
    getBpjsAlkes: () => req('GET', '/bpjs-alkes'),
    saveBpjsAlkes: fd => req('POST', '/bpjs-alkes', fd, true),
    delBpjsAlkes: id => req('DELETE', `/bpjs-alkes/${id}`),

    // BPJS Iterasi
    getBpjsIterasi: () => req('GET', '/bpjs-iterasi'),
    saveBpjsIterasi: d => req('POST', '/bpjs-iterasi', d),
    updateBpjsIterasi: (id, d) => req('PUT', `/bpjs-iterasi/${id}`, d),
    delBpjsIterasi: id => req('DELETE', `/bpjs-iterasi/${id}`),

    // Pinjaman
    getPinjaman: (p = {}) => req('GET', '/pinjaman?' + new URLSearchParams(p)),
    savePinjaman: d => req('POST', '/pinjaman', d),
    updatePinjaman: (id, d) => req('PUT', `/pinjaman/${id}`, d),
    delPinjaman: id => req('DELETE', `/pinjaman/${id}`),

    // Mutasi
    getMutasi: (p = {}) => req('GET', '/mutasi?' + new URLSearchParams(p)),
    saveMutasi: d => req('POST', '/mutasi', d),
    updateMutasi: (id, d) => req('PUT', `/mutasi/${id}`, d),
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
    updateTujuan: (id, d) => req('PUT', `/tujuan/${id}`, d),
    delTujuan: id => req('DELETE', `/tujuan/${id}`),

    // Kategori
    getKategori: () => req('GET', '/kategori'),
    saveKategori: d => req('POST', '/kategori', d),
    updateKategori: (id, d) => req('PUT', `/kategori/${id}`, d),
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
    updateKatArsip: (id, d) => req('PUT', `/kat-arsip/${id}`, d),
    delKatArsip: id => req('DELETE', `/kat-arsip/${id}`),

    // Supplier
    getSupplier: () => req('GET', '/supplier'),
    saveSupplier: d => req('POST', '/supplier', d),
    updateSupplier: (id, d) => req('PUT', `/supplier/${id}`, d),
    delSupplier: id => req('DELETE', `/supplier/${id}`),

    // Stok Opname
    getStokOpname: (p = {}) => req('GET', '/stok-opname?' + new URLSearchParams(p)),
    saveStokOpname: d => req('POST', '/stok-opname', d),
    updateStokOpname: (id, d) => req('PUT', `/stok-opname/${id}`, d),
    delStokOpname: id => req('DELETE', `/stok-opname/${id}`),
  }
})()
