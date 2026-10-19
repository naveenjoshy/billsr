import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  try {
    req.auth = jwt.verify(req.cookies.token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ message: 'Unauthorized Access' })
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.auth?.role) ? next() : res.status(403).json({ message: 'Access Forbidden' })