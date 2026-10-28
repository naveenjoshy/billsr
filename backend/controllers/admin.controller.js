import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { HTTP_STATUS, MESSAGES } from '../constants/httpConstants.js'
import { Agent } from '../models/Agent.js'
import { AuditLog } from '../models/AuditLog.js'
import { Bank } from '../models/Bank.js'
import { User } from '../models/User.js'

const DAY_MS = 24 * 60 * 60 * 1000
const EXPIRING_WINDOW_DAYS = 15
const MAX_EXTENSION_DAYS = 365

function deriveStatus(bank, now = Date.now()) {
  const accountStatus = bank.compliance_status?.account_status
  if (accountStatus === 'Suspended') return 'suspended'
  if (accountStatus === 'Grace') return 'grace'
  const expiry = new Date(bank.license_expiry).getTime()
  return expiry - now <= EXPIRING_WINDOW_DAYS * DAY_MS ? 'expiring' : 'active'
}

function initialsOf(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}

function serializeBank(bank, agentCounts) {
  const owner = bank.user_id && typeof bank.user_id === 'object' ? bank.user_id : null
  return {
    _id: String(bank._id),
    code: owner?.userID ?? String(bank._id).slice(-6).toUpperCase(),
    initials: initialsOf(bank.bank_name),
    name: bank.bank_name,
    ceo: bank.name_ceo ?? null,
    address: bank.address,
    licenseExpiry: bank.license_expiry,
    graceEnd: bank.compliance_status?.grace_period_end ?? null,
    status: deriveStatus(bank),
    agentCount: agentCounts.get(String(bank._id)) ?? 0,
  }
}

async function loadAgentCounts() {
  const rows = await Agent.aggregate([{ $group: { _id: '$bank_id', count: { $sum: 1 } } }])
  return new Map(rows.map((row) => [String(row._id), row.count]))
}

function buildSummary(banks) {
  const count = (status) => banks.filter((bank) => bank.status === status).length
  return {
    total: banks.length,
    active: count('active'),
    expiring: count('expiring'),
    grace: count('grace'),
    suspended: count('suspended'),
  }
}

export async function listBanks(req, res) {
  try {
    const [banks, agentCounts] = await Promise.all([
      Bank.find().populate('user_id', 'userID').sort({ bank_name: 1 }).lean(),
      loadAgentCounts(),
    ])
    const items = banks.map((bank) => serializeBank(bank, agentCounts))
    res.json({ banks: items, summary: buildSummary(items) })
  } catch (error) {
    console.error('List banks error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.BANK.LOAD_FAILED })
  }
}

async function loadBankForUpdate(req, res) {
  const { id } = req.params
  if (!mongoose.isValidObjectId(id)) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.BANK.INVALID_ID })
    return null
  }
  const justification = typeof req.body?.justification === 'string' ? req.body.justification.trim() : ''
  if (!justification) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.BANK.JUSTIFICATION_REQUIRED })
    return null
  }
  const bank = await Bank.findById(id)
  if (!bank) {
    res.status(HTTP_STATUS.NOT_FOUND).json({ message: MESSAGES.BANK.NOT_FOUND })
    return null
  }
  return { bank, justification }
}

async function saveWithAudit(req, bank, justification, changes) {
  const actor = req.auth.sub
  const logs = Object.entries(changes).map(([field, [previous, next]]) => ({
    collection_name: 'banks',
    document_id: bank._id,
    description: justification,
    changed_field: field,
    previous_value: previous,
    new_value: next,
    updated_by: actor,
  }))
  bank.set('audit_trail.modified_at', new Date())
  bank.set('audit_trail.modified_by', actor)
  await bank.save()
  await AuditLog.insertMany(logs)
}

export async function onboardBank(req, res) {
  const { user: userInput, bank: bankInput } = req.onboarding
  const actor = req.auth.sub
  let user
  try {
    // Unique indexes may not be built yet, so enforce uniqueness explicitly.
    const clash = await User.findOne({
      $or: [{ email: userInput.email }, { userID: userInput.userID }],
    })
      .collation({ locale: 'en', strength: 2 })
      .lean()
    if (clash) {
      const field = clash.email?.toLowerCase() === userInput.email ? 'email' : 'userID'
      const label = field === 'email' ? 'Email' : 'User ID'
      return res.status(HTTP_STATUS.CONFLICT).json({
        message: `${label} is already in use`,
        errors: { [`user.${field}`]: `${label} is already in use` },
      })
    }

    user = await User.create({
      userID: userInput.userID,
      name: userInput.name,
      email: userInput.email,
      password_hash: await bcrypt.hash(userInput.password, 12),
      role: 'Bank',
    })

    const bank = await Bank.create({
      user_id: user._id,
      bank_name: bankInput.bank_name,
      address: bankInput.address,
      phone: bankInput.phone,
      name_ceo: bankInput.name_ceo,
      designation: bankInput.designation,
      license_expiry: bankInput.license_expiry,
      compliance_status: {
        account_status: bankInput.account_status ?? 'Active',
        grace_period_end: bankInput.grace_period_end,
      },
      audit_trail: { created_by: actor, modified_by: actor },
    })

    await AuditLog.create({
      collection_name: 'banks',
      document_id: bank._id,
      description: 'Bank onboarded',
      changed_field: 'bank',
      new_value: { bank_name: bank.bank_name, userID: user.userID },
      updated_by: actor,
    })

    const agentCounts = await loadAgentCounts()
    await bank.populate('user_id', 'userID')
    res.status(HTTP_STATUS.CREATED).json({ bank: serializeBank(bank.toObject(), agentCounts) })
  } catch (error) {
    // Without a transaction, remove the login record so no orphan user remains.
    if (user) await User.deleteOne({ _id: user._id }).catch(() => {})
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern ?? {})[0]
      const labels = { userID: 'User ID', email: 'Email' }
      return res.status(HTTP_STATUS.CONFLICT).json({
        message: `${labels[field] ?? 'A value'} is already in use`,
        errors: field in labels ? { [`user.${field}`]: `${labels[field]} is already in use` } : undefined,
      })
    }
    console.error('Onboard bank error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.BANK.ONBOARD_FAILED })
  }
}

export async function extendLicense(req, res) {
  try {
    const loaded = await loadBankForUpdate(req, res)
    if (!loaded) return
    const { bank, justification } = loaded

    if (bank.compliance_status.account_status === 'Suspended') {
      return res.status(HTTP_STATUS.CONFLICT).json({ message: MESSAGES.BANK.SUSPENDED_LICENSE_EXTENSION })
    }

    const { days, expiryDate } = req.body ?? {}
    let newExpiry
    if (expiryDate) {
      newExpiry = new Date(`${expiryDate}T00:00:00.000Z`)
      if (Number.isNaN(newExpiry.getTime()) || newExpiry <= new Date()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.BANK.FUTURE_EXPIRY_REQUIRED })
      }
    } else if (Number.isInteger(days) && days > 0 && days <= MAX_EXTENSION_DAYS) {
      newExpiry = new Date(Math.max(bank.license_expiry.getTime(), Date.now()) + days * DAY_MS)
    } else {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.BANK.EXTENSION_DAYS_OR_DATE_REQUIRED })
    }

    const previousExpiry = bank.license_expiry
    const previousStatus = bank.compliance_status.account_status
    bank.license_expiry = newExpiry
    bank.compliance_status.account_status = 'Active'
    bank.compliance_status.grace_period_end = undefined

    await saveWithAudit(req, bank, justification, {
      license_expiry: [previousExpiry, newExpiry],
      'compliance_status.account_status': [previousStatus, 'Active'],
    })

    const agentCounts = await loadAgentCounts()
    await bank.populate('user_id', 'userID')
    res.json({ bank: serializeBank(bank.toObject(), agentCounts) })
  } catch (error) {
    console.error('Extend license error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.BANK.EXTEND_LICENSE_FAILED })
  }
}

export async function setSuspension(req, res) {
  try {
    const loaded = await loadBankForUpdate(req, res)
    if (!loaded) return
    const { bank, justification } = loaded

    if (typeof req.body?.suspend !== 'boolean') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.BANK.SUSPEND_BOOLEAN_REQUIRED })
    }
    const previousStatus = bank.compliance_status.account_status
    const nextStatus = req.body.suspend ? 'Suspended' : 'Active'
    bank.compliance_status.account_status = nextStatus
    if (!req.body.suspend) bank.compliance_status.grace_period_end = undefined

    await saveWithAudit(req, bank, justification, {
      'compliance_status.account_status': [previousStatus, nextStatus],
    })

    const agentCounts = await loadAgentCounts()
    await bank.populate('user_id', 'userID')
    res.json({ bank: serializeBank(bank.toObject(), agentCounts) })
  } catch (error) {
    console.error('Set suspension error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.BANK.UPDATE_LICENSE_STATUS_FAILED })
  }
}
