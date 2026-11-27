import { Router } from 'express'
import {
  extendLicense,
  listBanks,
  onboardBank,
  setSuspension,
  getGlobalAuditLogs,
  listAdminAgents,
  listAdminCustomers,
} from '../controllers/admin.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validateOnboardBank } from '../middleware/onboard-bank.validator.js'

const router = Router()

router.use(requireAuth, requireRole('Superadmin'))
router.get('/banks', listBanks)
router.post('/banks', validateOnboardBank, onboardBank)
router.post('/banks/:id/extend', extendLicense)
router.post('/banks/:id/suspension', setSuspension)

// Global Audit & Security Logs endpoints
router.get('/audit-logs', getGlobalAuditLogs)
router.get('/agents', listAdminAgents)
router.get('/customers', listAdminCustomers)

export default router
