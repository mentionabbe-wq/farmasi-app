const router = require('express').Router()
const { read, write } = require('../db')

function getSettings() {
  const s = read('settings')
  return Array.isArray(s) ? { rs_name: 'RS Medika' } : s
}

router.get('/', (req, res) => res.json(getSettings()))

router.post('/', (req, res) => {
  const current = getSettings()
  const updated = { ...current, ...req.body }
  write('settings', updated)
  res.json(updated)
})

module.exports = router
