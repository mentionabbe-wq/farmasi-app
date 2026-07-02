const router = require('express').Router()
const crypto = require('crypto')
const { read, write } = require('../db')

const hashPw = (password, salt) => crypto.scryptSync(String(password), salt, 64).toString('hex')
const newToken = () => crypto.randomBytes(24).toString('hex')

function issueToken(username) {
  const token = newToken()
  const sessions = read('sessions')
  sessions.push({ token, username, created: Date.now() })
  write('sessions', sessions)
  return token
}

router.post('/register', (req, res) => {
  const { username, nama, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'username & password wajib diisi' })
  const users = read('users')
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) return res.status(400).json({ error: 'Username sudah dipakai' })
  const salt = crypto.randomBytes(16).toString('hex')
  const user = { id: `usr_${Date.now()}`, username, nama: nama || username, salt, hash: hashPw(password, salt), created_at: new Date().toISOString() }
  users.push(user)
  write('users', users)
  const token = issueToken(user.username)
  res.status(201).json({ token, user: { username: user.username, nama: user.nama } })
})

router.post('/login', (req, res) => {
  const { username, password } = req.body
  const u = read('users').find(x => x.username.toLowerCase() === String(username || '').toLowerCase())
  if (!u || hashPw(password || '', u.salt) !== u.hash) return res.status(401).json({ error: 'Username atau password salah' })
  const token = issueToken(u.username)
  res.json({ token, user: { username: u.username, nama: u.nama } })
})

router.post('/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  write('sessions', read('sessions').filter(s => s.token !== token))
  res.json({ ok: true })
})

router.get('/me', (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'belum login' })
  res.json({ user: req.authUser })
})

router.post('/account', (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'belum login' })
  const { nama, password } = req.body
  const users = read('users')
  const i = users.findIndex(u => u.username === req.authUser.username)
  if (i < 0) return res.status(404).json({ error: 'user tidak ditemukan' })
  if (nama) users[i].nama = nama
  if (password) { const salt = crypto.randomBytes(16).toString('hex'); users[i].salt = salt; users[i].hash = hashPw(password, salt) }
  write('users', users)
  res.json({ user: { username: users[i].username, nama: users[i].nama } })
})

module.exports = router
