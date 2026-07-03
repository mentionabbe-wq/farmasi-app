const XLSX = require('xlsx')

// sheets: [{ name, header:[...], rows:[[...]], cols:[{wch}] }]
function sendSheet(res, filename, sheets) {
  const wb = XLSX.utils.book_new()
  sheets.forEach(s => {
    const ws = XLSX.utils.aoa_to_sheet([s.header, ...s.rows])
    if (s.cols) ws['!cols'] = s.cols
    XLSX.utils.book_append_sheet(wb, ws, (s.name || 'Sheet').substring(0, 31).replace(/[:\\/?*[\]]/g, ''))
  })
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
}

module.exports = { sendSheet }
