import { Router } from 'express'
import { getAgentHome, createAgentTransaction } from '../controllers/agent.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth, requireRole('Agent'))
router.get('/home', getAgentHome)
router.post('/transact', createAgentTransaction)

export default router
