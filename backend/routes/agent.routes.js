import { Router } from 'express'
import { getAgentHome } from '../controllers/agent.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth, requireRole('Agent'))
router.get('/home', getAgentHome)

export default router
