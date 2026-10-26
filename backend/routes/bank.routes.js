import { Router } from 'express'
import { approveTransaction, getDashboard, listTransactions } from '../controllers/bank.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth, requireRole('Bank'))
router.get('/dashboard', getDashboard)
router.get('/transactions', listTransactions)
router.post('/transactions/:id/approve', approveTransaction)

export default router
