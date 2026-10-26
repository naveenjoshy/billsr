import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'
import { Buffer } from 'node:buffer'

const COOKIE = 'token'
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 24 * 60 * 60 * 1000,
}
const RESET_IDENTITY_ERROR = 'Email ID or user ID is incorrect.'

async function findActiveUserByResetIdentity(email, userID) {
  return User.findOne({
    $expr: {
      $and: [
        {
          $eq: [
            {
              $toLower: {
                $trim: { input: { $ifNull: ['$email', ''] } },
              },
            },
            email.trim().toLowerCase(),
          ],
        },
        {
          $eq: [
            {
              $toLower: {
                $trim: { input: { $ifNull: ['$userID', ''] } },
              },
            },
            userID.trim().toLowerCase(),
          ],
        },
        { $ne: ['$is_active', false] },
      ],
    },
  })
}

export async function login(req, res) {
  const { email, password } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string')
    return res.status(400).json({ message: 'Email and password are required' })

  const user = await User.findOne({ email: email.trim().toLowerCase() })
  const ok = user && user.is_active && (await bcrypt.compare(password, user.password_hash))
  if (!ok) return res.status(401).json({ message: 'Invalid Email or Password' })

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  })
  res.cookie(COOKIE, token, cookieOpts)
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } })
}

export async function me(req, res) {
  const user = await User.findById(req.auth.sub).select('name email role is_active')
  if (!user || !user.is_active) return res.status(401).json({ message: 'Unauthorized Access' })
  res.json({ user })
}

export async function verifyPasswordReset(req, res) {
  const { email, userID } = req.body ?? {}
  if (
    typeof email !== 'string' ||
    typeof userID !== 'string' ||
    !email.trim() ||
    !userID.trim()
  ) {
    return res.status(400).json({ message: 'Email ID and user ID are required.' })
  }

  const user = await findActiveUserByResetIdentity(email, userID)
  if (!user) {
    return res.status(400).json({ message: RESET_IDENTITY_ERROR })
  }

  return res.status(200).json({ message: 'Account details verified.' })
}

export async function resetPassword(req, res) {
  const { email, userID, newPassword, confirmPassword } = req.body ?? {}
  if (
    typeof email !== 'string' ||
    typeof userID !== 'string' ||
    !email.trim() ||
    !userID.trim()
  ) {
    return res.status(400).json({ message: 'Email ID and user ID are required.' })
  }

  if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
    return res.status(400).json({ message: 'New password and confirmation are required.' })
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match.' })
  }

  if (newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.',
    })
  }

  const user = await findActiveUserByResetIdentity(email, userID)
  if (!user) {
    return res.status(400).json({ message: RESET_IDENTITY_ERROR })
  }

  user.password_hash = await bcrypt.hash(newPassword, 12)
  user.set('audit_trail.modified_at', new Date())
  await user.save()

  return res.status(200).json({ message: 'Password reset successfully.' })
}

export function logout(req, res) {
  res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined })
  res.status(204).end()
}