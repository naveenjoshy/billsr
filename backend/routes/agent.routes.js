import { Router } from 'express'
import { getAgentHome, createAgentTransaction, onboardCustomer } from '../controllers/agent.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth, requireRole('Agent'))
router.get('/home', getAgentHome)
router.post('/transact', createAgentTransaction)
router.post('/customers', onboardCustomer)

export default router
