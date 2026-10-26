import jwt from 'jsonwebtoken'
import { HTTP_STATUS, MESSAGES } from '../constants/httpConstants.js'

function authenticate({ allowPending }) {
  return (req, res, next) => {
    const token =
      req.cookies?.accessToken ||
      req.cookies?.token ||
      req.headers.authorization?.replace(/^Bearer\s+/i, '')

    if (!token) {
      return res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json({ message: MESSAGES.AUTH.UNAUTHORIZED_ACCESS })
    }

    try {
      req.auth = jwt.verify(token, process.env.JWT_SECRET)
    } catch {
      return res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json({ message: MESSAGES.AUTH.UNAUTHORIZED_ACCESS })
    }

    // A pending token only proves initial password; it may do nothing but set the first password.
    if (req.auth.pwdPending && !allowPending) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        message: MESSAGES.AUTH.PASSWORD_CHANGE_REQUIRED,
        code: 'PASSWORD_CHANGE_REQUIRED',
      })
    }
    next()
  }
}

export const requireAuth = authenticate({ allowPending: false })
export const requireAuthAllowPending = authenticate({ allowPending: true })

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.auth?.role)
    ? next()
    : res.status(HTTP_STATUS.FORBIDDEN).json({ message: MESSAGES.AUTH.ACCESS_FORBIDDEN })