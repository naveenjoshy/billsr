import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Agent } from '../models/Agent.js'
import { User } from '../models/User.js'
import { Buffer } from 'node:buffer'
import { EMAIL, fieldFromSchema, validateSection } from '../middleware/validate.js'

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

const PENDING_MAX_AGE = 15 * 60 * 1000

function issueToken(res, user, { pending = false } = {}) {
  const token = jwt.sign(
    { sub: user.id, role: user.role, ...(pending ? { pwdPending: true } : {}) },
    process.env.JWT_SECRET,
    { expiresIn: pending ? '15m' : process.env.JWT_EXPIRES_IN || '1h' },
  )
  res.cookie(COOKIE, token, pending ? { ...cookieOpts, maxAge: PENDING_MAX_AGE } : cookieOpts)
}

const publicUser = (user, extra = {}) => ({
  id: user.id,
  userID: user.userID,
  name: user.name,
  email: user.email,
  role: user.role,
  ...extra,
})

export function passwordStrengthError(password) {
  if (typeof password !== 'string') return 'Password is required.'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (Buffer.byteLength(password, 'utf8') > 72) return 'Password must be at most 72 bytes.'
  if (!/[A-Z]/.test(password)) return 'Password must include a capital letter.'
  if (!/[a-z]/.test(password)) return 'Password must include a small letter.'
  if (!/[0-9]/.test(password)) return 'Password must include a number.'
  if (!/[^A-Za-z0-9\s]/.test(password)) return 'Password must include a symbol.'
  if (/\s/.test(password)) return 'Password must not contain spaces.'
  return null
}

export async function login(req, res) {
  const { email, password } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string')
    return res.status(400).json({ message: 'Email and password are required' })

  const user = await User.findOne({ email: email.trim().toLowerCase() })
  const ok = user && user.is_active && (await bcrypt.compare(password, user.password_hash))
  if (!ok) return res.status(401).json({ message: 'Invalid Email or Password' })

  if (!user.first_login_at) {
    issueToken(res, user, { pending: true })
    return res.json({ user: publicUser(user, { mustChangePassword: true }) })
  }

  user.last_login_at = new Date()
  await user.save()
  issueToken(res, user)
  res.json({ user: publicUser(user) })
}

export async function setFirstPassword(req, res) {
  try {
    const { newPassword, confirmPassword } = req.body ?? {}
    if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
      return res.status(400).json({ message: 'New password and confirmation are required.' })
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' })
    }
    const weakness = passwordStrengthError(newPassword)
    if (weakness) return res.status(400).json({ message: weakness })

    const user = await User.findById(req.auth.sub)
    if (!user || !user.is_active) return res.status(401).json({ message: 'Unauthorized Access' })
    if (user.first_login_at) {
      return res.status(409).json({ message: 'Your password has already been set. Please sign in.' })
    }
    if (await bcrypt.compare(newPassword, user.password_hash)) {
      return res.status(400).json({ message: 'New password must be different from the temporary password.' })
    }

    const now = new Date()
    user.password_hash = await bcrypt.hash(newPassword, 12)
    user.first_login_at = now
    user.last_login_at = now
    user.set('audit_trail.modified_at', now)
    await user.save()

    if (user.role === 'Agent') {
      await Agent.updateOne(
        { user_id: user._id },
        { password_reset_flag: false, last_password_change_date: now },
      )
    }

    issueToken(res, user)
    res.json({ user: publicUser(user) })
  } catch (error) {
    console.error('Set first password error:', error)
    res.status(500).json({ message: 'Unable to set the password' })
  }
}

export async function me(req, res) {
  const user = await User.findById(req.auth.sub).select('userID name email role is_active')
  if (!user || !user.is_active) return res.status(401).json({ message: 'Unauthorized Access' })
  res.json({
    user: publicUser(user, req.auth.pwdPending ? { mustChangePassword: true } : {}),
  })
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

const profileSpec = {
  name: fieldFromSchema(User, 'name', { label: 'Name', max: 120 }),
  email: fieldFromSchema(User, 'email', {
    label: 'Email', max: 254, pattern: EMAIL, message: 'Email is invalid',
  }),
}

export async function updateProfile(req, res) {
  try {
    const { currentPassword, ...rest } = req.body ?? {}
    const { errors, output } = validateSection(rest, profileSpec, 'profile')
    if (Object.keys(errors).length) {
      return res.status(400).json({ message: 'Please correct the highlighted fields', errors })
    }

    const user = await User.findById(req.auth.sub)
    if (!user || !user.is_active) return res.status(401).json({ message: 'Unauthorized Access' })

    const emailChanged = output.email !== user.email
    if (emailChanged) {
      const valid =
        typeof currentPassword === 'string' &&
        (await bcrypt.compare(currentPassword, user.password_hash))
      if (!valid) {
        return res.status(400).json({
          message: 'Current password is required to change your email',
          errors: { 'profile.currentPassword': 'Current password is incorrect' },
        })
      }
      const clash = await User.findOne({ email: output.email, _id: { $ne: user._id } }).lean()
      if (clash) {
        return res.status(409).json({
          message: 'Email is already in use',
          errors: { 'profile.email': 'Email is already in use' },
        })
      }
    }

    user.name = output.name
    user.email = output.email
    user.set('audit_trail.modified_at', new Date())
    await user.save()
    res.json({ user: { id: user.id, userID: user.userID, name: user.name, email: user.email, role: user.role } })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ message: 'Unable to update profile' })
  }
}

export function logout(req, res) {
  res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined })
  res.status(204).end()
}