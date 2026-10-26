import { Router } from 'express'
import { validateAddAgent } from '../middleware/add-agent.validator.js'
import {
  approveTransaction,
  cancelTransaction,
  createAgent,
  getDashboard,
  listAgents,
  listTransactions,
  rejectCancellation,
} from '../controllers/bank.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth, requireRole('Bank'))
router.get('/dashboard', getDashboard)
router.get('/agents', listAgents)
router.post('/agents', validateAddAgent, createAgent)
router.get('/transactions', listTransactions)
router.post('/transactions/:id/approve', approveTransaction)
router.post('/transactions/:id/cancel', cancelTransaction)
router.post('/transactions/:id/reject-cancellation', rejectCancellation)

export default router
