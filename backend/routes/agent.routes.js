import { Router } from 'express'
import {
  getAgentHome,
  createAgentTransaction,
  onboardCustomer,
  requestTransactionCancellation,
  withdrawCancellationRequest,
  getAgentTransactionDetail,
} from '../controllers/agent.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth, requireRole('Agent'))
router.get('/home', getAgentHome)
router.get('/transactions/:id', getAgentTransactionDetail)
router.post('/transact', createAgentTransaction)
router.post('/customers', onboardCustomer)
router.post('/transactions/:id/cancel-request', requestTransactionCancellation)
router.post('/transactions/:id/withdraw-cancel', withdrawCancellationRequest)

export default router
