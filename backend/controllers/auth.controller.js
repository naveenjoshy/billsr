import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Buffer } from 'node:buffer'
import { HTTP_STATUS, MESSAGES } from '../constants/httpConstants.js'
import { Agent } from '../models/Agent.js'
import { User } from '../models/User.js'
import { EMAIL, fieldFromSchema, validateSection } from '../middleware/validate.js'

const ACCESS_COOKIE = 'accessToken'
const REFRESH_COOKIE = 'refreshToken'
const LEGACY_COOKIE = 'token'

const ACCESS_EXPIRY_MS = 15 * 60 * 1000 // 15 mins
const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

const cookieBaseOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

const getRefreshSecret = () =>
  process.env.JWT_REFRESH_SECRET || `${process.env.JWT_SECRET}_refresh`

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

function issueTokens(res, user, { pending = false } = {}) {
  const userId = user._id ? String(user._id) : user.id
  const accessPayload = {
    sub: userId,
    role: user.role,
    ...(pending ? { pwdPending: true } : {}),
  }

  const accessToken = jwt.sign(accessPayload, process.env.JWT_SECRET, {
    expiresIn: pending ? '15m' : '15m',
  })

  // Issue refresh token only if user does not require initial password change
  let refreshToken = null
  if (!pending) {
    const refreshPayload = { sub: userId, role: user.role }
    refreshToken = jwt.sign(refreshPayload, getRefreshSecret(), { expiresIn: '7d' })
  }

  // Set cookies
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...cookieBaseOpts,
    maxAge: ACCESS_EXPIRY_MS,
  })

  // Also maintain legacy cookie for smooth transition
  res.cookie(LEGACY_COOKIE, accessToken, {
    ...cookieBaseOpts,
    maxAge: ACCESS_EXPIRY_MS,
  })

  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...cookieBaseOpts,
      maxAge: REFRESH_EXPIRY_MS,
    })
  } else {
    res.clearCookie(REFRESH_COOKIE, cookieBaseOpts)
  }

  return { accessToken, refreshToken }
}

const publicUser = (user, extra = {}) => ({
  id: user._id ? String(user._id) : user.id,
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
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.AUTH.REQUIRED_CREDENTIALS })
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() })
  const ok = user && user.is_active && (await bcrypt.compare(password, user.password_hash))
  if (!ok) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: MESSAGES.AUTH.INVALID_CREDENTIALS })
  }

  if (!user.first_login_at) {
    issueTokens(res, user, { pending: true })
    return res.json({ user: publicUser(user, { mustChangePassword: true }) })
  }

  user.last_login_at = new Date()
  await user.save()
  issueTokens(res, user)
  res.json({ user: publicUser(user) })
}

export async function refreshToken(req, res) {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken
    if (!rawRefreshToken) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: MESSAGES.AUTH.REFRESH_TOKEN_REQUIRED })
    }

    let payload
    try {
      payload = jwt.verify(rawRefreshToken, getRefreshSecret())
    } catch {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: MESSAGES.AUTH.REFRESH_TOKEN_INVALID })
    }

    const user = await User.findById(payload.sub).select('userID name email role is_active')
    if (!user || !user.is_active) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: MESSAGES.AUTH.UNAUTHORIZED_ACCESS })
    }

    issueTokens(res, user)
    res.json({ ok: true, user: publicUser(user) })
  } catch (error) {
    console.error('Refresh token error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.GENERAL.SERVER_ERROR })
  }
}

export async function setFirstPassword(req, res) {
  try {
    const { newPassword, confirmPassword } = req.body ?? {}
    if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.AUTH.NEW_PASSWORD_REQUIRED })
    }
    if (newPassword !== confirmPassword) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.AUTH.PASSWORDS_DO_NOT_MATCH })
    }
    const weakness = passwordStrengthError(newPassword)
    if (weakness) return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: weakness })

    const user = await User.findById(req.auth.sub)
    if (!user || !user.is_active) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: MESSAGES.AUTH.UNAUTHORIZED_ACCESS })
    }
    if (user.first_login_at) {
      return res.status(HTTP_STATUS.CONFLICT).json({ message: MESSAGES.AUTH.PASSWORD_ALREADY_SET })
    }
    if (await bcrypt.compare(newPassword, user.password_hash)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.AUTH.PASSWORD_DIFF_TEMP })
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

    issueTokens(res, user)
    res.json({ user: publicUser(user) })
  } catch (error) {
    console.error('Set first password error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.GENERAL.SERVER_ERROR })
  }
}

export async function me(req, res) {
  const user = await User.findById(req.auth.sub).select('userID name email role is_active')
  if (!user || !user.is_active) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: MESSAGES.AUTH.UNAUTHORIZED_ACCESS })
  }
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
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.AUTH.EMAIL_USER_ID_REQUIRED })
  }

  const user = await findActiveUserByResetIdentity(email, userID)
  if (!user) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.AUTH.RESET_IDENTITY_ERROR })
  }

  return res.status(HTTP_STATUS.OK).json({ message: MESSAGES.AUTH.PASSWORD_RESET_VERIFIED })
}

export async function resetPassword(req, res) {
  const { email, userID, newPassword, confirmPassword } = req.body ?? {}
  if (
    typeof email !== 'string' ||
    typeof userID !== 'string' ||
    !email.trim() ||
    !userID.trim()
  ) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.AUTH.EMAIL_USER_ID_REQUIRED })
  }

  if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.AUTH.NEW_PASSWORD_REQUIRED })
  }

  if (newPassword !== confirmPassword) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.AUTH.PASSWORDS_DO_NOT_MATCH })
  }

  if (newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: MESSAGES.AUTH.PASSWORD_LENGTH_ERROR,
    })
  }

  const user = await findActiveUserByResetIdentity(email, userID)
  if (!user) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.AUTH.RESET_IDENTITY_ERROR })
  }

  user.password_hash = await bcrypt.hash(newPassword, 12)
  user.set('audit_trail.modified_at', new Date())
  await user.save()

  return res.status(HTTP_STATUS.OK).json({ message: MESSAGES.AUTH.PASSWORD_RESET_SUCCESS })
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.GENERAL.VALIDATION_ERROR, errors })
    }

    const user = await User.findById(req.auth.sub)
    if (!user || !user.is_active) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: MESSAGES.AUTH.UNAUTHORIZED_ACCESS })
    }

    const emailChanged = output.email !== user.email
    if (emailChanged) {
      const valid =
        typeof currentPassword === 'string' &&
        (await bcrypt.compare(currentPassword, user.password_hash))
      if (!valid) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          message: 'Current password is required to change your email',
          errors: { 'profile.currentPassword': 'Current password is incorrect' },
        })
      }
      const clash = await User.findOne({ email: output.email, _id: { $ne: user._id } }).lean()
      if (clash) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          message: MESSAGES.BANK.EMAIL_IN_USE,
          errors: { 'profile.email': MESSAGES.BANK.EMAIL_IN_USE },
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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.GENERAL.SERVER_ERROR })
  }
}

export function logout(req, res) {
  res.clearCookie(ACCESS_COOKIE, cookieBaseOpts)
  res.clearCookie(REFRESH_COOKIE, cookieBaseOpts)
  res.clearCookie(LEGACY_COOKIE, cookieBaseOpts)
  res.status(HTTP_STATUS.NO_CONTENT).end()
}