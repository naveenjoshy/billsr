import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  login,
  logout,
  me,
  resetPassword,
  verifyPasswordReset,
} from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many password reset attempts. Please try again later.' },
})

router.post('/login', login)
router.post('/password-reset/verify', passwordResetLimiter, verifyPasswordReset)
router.post('/password-reset', passwordResetLimiter, resetPassword)
router.post('/logout', logout)
router.get('/me', requireAuth, me)
export default router