import { Router } from 'express'
import { validateAddAgent } from '../middleware/add-agent.validator.js'
import {
  approveTransaction,
  cancelTransaction,
  createAgent,
  createScheme,
  deleteScheme,
  getDashboard,
  listAgents,
  listSchemes,
  listTransactions,
  rejectCancellation,
  updateAgentLimit,
  updateScheme,
} from '../controllers/bank.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth, requireRole('Bank'))
router.get('/dashboard', getDashboard)
router.get('/agents', listAgents)
router.post('/agents', validateAddAgent, createAgent)
router.put('/agents/:id/limit', updateAgentLimit)
router.get('/transactions', listTransactions)
router.post('/transactions/:id/approve', approveTransaction)
router.post('/transactions/:id/cancel', cancelTransaction)
router.post('/transactions/:id/reject-cancellation', rejectCancellation)

// Scheme & Receipt Configuration
router.get('/schemes', listSchemes)
router.post('/schemes', createScheme)
router.put('/schemes/:id', updateScheme)
router.delete('/schemes/:id', deleteScheme)

export default router
