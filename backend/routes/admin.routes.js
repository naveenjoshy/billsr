import { Router } from 'express'
import { extendLicense, listBanks, onboardBank, setSuspension } from '../controllers/admin.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validateOnboardBank } from '../middleware/onboard-bank.validator.js'

const router = Router()

router.use(requireAuth, requireRole('Superadmin'))
router.get('/banks', listBanks)
router.post('/banks', validateOnboardBank, onboardBank)
router.post('/banks/:id/extend', extendLicense)
router.post('/banks/:id/suspension', setSuspension)

export default router
