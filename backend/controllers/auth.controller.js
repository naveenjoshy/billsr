import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'

const COOKIE = 'token'
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 24 * 60 * 60 * 1000,
}

export async function login(req, res) {
  const { email, password } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string')
    return res.status(400).json({ message: 'Email and password are required' })

  const user = await User.findOne({ email: email.trim().toLowerCase() })
  const ok = user && user.is_active && (await bcrypt.compare(password, user.password_hash))
  if (!ok) return res.status(401).json({ message: 'Invalid email or password' })

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  })
  res.cookie(COOKIE, token, cookieOpts)
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } })
}

export async function me(req, res) {
  const user = await User.findById(req.auth.sub).select('name email role is_active')
  if (!user || !user.is_active) return res.status(401).json({ message: 'Unauthorized' })
  res.json({ user })
}

export function logout(req, res) {
  res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined })
  res.status(204).end()
}