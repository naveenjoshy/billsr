import jwt from 'jsonwebtoken'

function authenticate({ allowPending }) {
  return (req, res, next) => {
    try {
      req.auth = jwt.verify(req.cookies.token, process.env.JWT_SECRET)
    } catch {
      return res.status(401).json({ message: 'Unauthorized Access' })
    }
    // A pending token only proves the password; it may do nothing but set the first password.
    if (req.auth.pwdPending && !allowPending) {
      return res.status(403).json({ message: 'Password change required', code: 'PASSWORD_CHANGE_REQUIRED' })
    }
    next()
  }
}

export const requireAuth = authenticate({ allowPending: false })
export const requireAuthAllowPending = authenticate({ allowPending: true })

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.auth?.role) ? next() : res.status(403).json({ message: 'Access Forbidden' })