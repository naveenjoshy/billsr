import { Router } from 'express'
import { validateAddAgent } from '../middleware/add-agent.validator.js'
import {
  approveTransaction,
  cancelTransaction,
  createAgent,
  createScheme,
  deleteScheme,
  getAuditEvents,
  getDashboard,
  listAgentCustomers,
  listAgents,
  listSchemes,
  listTransactions,
  reallocateAgentCustomers,
  rejectCancellation,
  setAgentSuspension,
  updateAgentLimit,
  updateScheme,
} from '../controllers/bank.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth, requireRole('Bank'))
router.get('/dashboard', getDashboard)
router.get('/audit-events', getAuditEvents)
router.get('/agents', listAgents)
router.post('/agents', validateAddAgent, createAgent)
router.put('/agents/:id/limit', updateAgentLimit)
router.put('/agents/:id/status', setAgentSuspension)
router.post('/agents/:id/suspension', setAgentSuspension)
router.get('/agents/:id/customers', listAgentCustomers)
router.post('/agents/reallocate-customers', reallocateAgentCustomers)
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
