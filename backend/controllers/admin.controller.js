import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { HTTP_STATUS, MESSAGES } from '../constants/httpConstants.js'
import { Agent } from '../models/Agent.js'
import { AuditLog } from '../models/AuditLog.js'
import { Bank } from '../models/Bank.js'
import { User } from '../models/User.js'
import { Customer } from '../models/Customer.js'
import { Transaction } from '../models/Transaction.js'
import { Scheme } from '../models/Scheme.js'

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

export async function listAdminAgents(req, res) {
  try {
    const { bankId } = req.query
    const filter = {}
    if (bankId && mongoose.isValidObjectId(bankId)) {
      filter.bank_id = bankId
    }
    const agents = await Agent.find(filter)
      .populate('user_id', 'userID name email is_active')
      .populate('bank_id', 'bank_name')
      .sort({ 'user_id.name': 1 })
      .lean()

    const list = agents.map((a) => ({
      _id: String(a._id),
      userID: a.user_id?.userID || 'AGENT',
      name: a.user_id?.name || 'Agent',
      email: a.user_id?.email || '',
      bankId: String(a.bank_id?._id || a.bank_id || ''),
      bankName: a.bank_id?.bank_name || 'Bank',
      phone: a.phone_no,
      status: a.status,
    }))

    res.json({ agents: list })
  } catch (error) {
    console.error('List admin agents error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Unable to load agents' })
  }
}

export async function listAdminCustomers(req, res) {
  try {
    const { agentId, bankId } = req.query
    const filter = {}
    if (agentId && mongoose.isValidObjectId(agentId)) {
      filter.agent_id = agentId
    }
    if (bankId && mongoose.isValidObjectId(bankId)) {
      filter.bank_id = bankId
    }

    const customers = await Customer.find(filter)
      .populate('bank_id', 'bank_name')
      .populate({ path: 'agent_id', populate: { path: 'user_id', select: 'userID name' } })
      .sort({ name: 1 })
      .limit(300)
      .lean()

    const list = customers.map((c) => ({
      _id: String(c._id),
      name: c.name,
      shopName: c.shop_name || '',
      phone: c.phone,
      bankId: String(c.bank_id?._id || c.bank_id || ''),
      bankName: c.bank_id?.bank_name || 'Bank',
      agentId: String(c.agent_id?._id || c.agent_id || ''),
      agentName: c.agent_id?.user_id?.name || '',
      agentUserID: c.agent_id?.user_id?.userID || '',
    }))

    res.json({ customers: list })
  } catch (error) {
    console.error('List admin customers error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Unable to load customers' })
  }
}

export async function getGlobalAuditLogs(req, res) {
  try {
    const { bankId, agentId, customerId, startDate, endDate, type, search } = req.query

    // 1. Date range filter
    const dateQuery = {}
    if (startDate) {
      dateQuery.$gte = new Date(startDate)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateQuery.$lte = end
    }

    // 2. Resolve target scope
    const isValidId = (id) => id && mongoose.isValidObjectId(id)

    let targetBankObj = null
    let targetAgentObj = null
    let targetCustomerObj = null

    if (isValidId(bankId)) {
      targetBankObj = await Bank.findById(bankId).lean()
    }
    if (isValidId(agentId)) {
      targetAgentObj = await Agent.findById(agentId).populate('user_id', 'name userID').lean()
    }
    if (isValidId(customerId)) {
      targetCustomerObj = await Customer.findById(customerId).lean()
    }

    // 3. Collect Document IDs for AuditLog $or matching
    let agentIds = []
    let customerIds = []
    let txIds = []
    let schemeIds = []

    if (targetCustomerObj) {
      customerIds = [targetCustomerObj._id]
      const txs = await Transaction.find({ customer_id: targetCustomerObj._id }).select('_id').lean()
      txIds = txs.map((t) => t._id)
    } else if (targetAgentObj) {
      agentIds = [targetAgentObj._id]
      const [custs, txs] = await Promise.all([
        Customer.find({ agent_id: targetAgentObj._id }).select('_id').lean(),
        Transaction.find({ agent_id: targetAgentObj._id }).select('_id').lean(),
      ])
      customerIds = custs.map((c) => c._id)
      txIds = txs.map((t) => t._id)
    } else if (targetBankObj) {
      const [agents, custs, schemes, txs] = await Promise.all([
        Agent.find({ bank_id: targetBankObj._id }).select('_id').lean(),
        Customer.find({ bank_id: targetBankObj._id }).select('_id').lean(),
        Scheme.find({ bank_id: targetBankObj._id }).select('_id').lean(),
        Transaction.find({ bank_id: targetBankObj._id }).select('_id').lean(),
      ])
      agentIds = agents.map((a) => a._id)
      customerIds = custs.map((c) => c._id)
      schemeIds = schemes.map((s) => s._id)
      txIds = txs.map((t) => t._id)
    }

    // 4. Construct AuditLog query
    const auditQuery = {}
    if (Object.keys(dateQuery).length > 0) {
      auditQuery.updated_date = dateQuery
    }

    if (targetCustomerObj) {
      auditQuery.$or = [
        { collection_name: 'customers', document_id: targetCustomerObj._id },
        { collection_name: 'transactions', document_id: { $in: txIds } },
      ]
    } else if (targetAgentObj) {
      auditQuery.$or = [
        { collection_name: 'agents', document_id: targetAgentObj._id },
        { collection_name: 'customers', document_id: { $in: customerIds } },
        { collection_name: 'transactions', document_id: { $in: txIds } },
        ...(targetAgentObj.user_id?._id ? [{ updated_by: targetAgentObj.user_id._id }] : []),
      ]
    } else if (targetBankObj) {
      auditQuery.$or = [
        { collection_name: 'banks', document_id: targetBankObj._id },
        { collection_name: 'agents', document_id: { $in: agentIds } },
        { collection_name: 'customers', document_id: { $in: customerIds } },
        { collection_name: 'schemes', document_id: { $in: schemeIds } },
        { collection_name: 'transactions', document_id: { $in: txIds } },
        ...(targetBankObj.user_id ? [{ updated_by: targetBankObj.user_id }] : []),
      ]
    }

    // 5. Construct Transaction query
    const txQuery = {}
    if (Object.keys(dateQuery).length > 0) {
      txQuery.collect_date = dateQuery
    }
    if (targetCustomerObj) {
      txQuery.customer_id = targetCustomerObj._id
    } else if (targetAgentObj) {
      txQuery.agent_id = targetAgentObj._id
    } else if (targetBankObj) {
      txQuery.bank_id = targetBankObj._id
    }

    // 6. Execute fetches
    const [rawLogs, rawTransactions, allBanks, allAgents, allCustomers] = await Promise.all([
      AuditLog.find(auditQuery)
        .sort({ updated_date: -1 })
        .limit(250)
        .populate('updated_by', 'name userID role')
        .lean(),
      Transaction.find(txQuery)
        .sort({ transact_time: -1, collect_date: -1, _id: -1 })
        .limit(150)
        .populate('bank_id', 'bank_name')
        .populate({ path: 'agent_id', populate: { path: 'user_id', select: 'userID name' } })
        .populate('customer_id', 'name shop_name phone')
        .populate('scheme_id', 'name')
        .populate('cancellation_info.reviewed_by', 'name userID')
        .lean(),
      Bank.find().select('_id bank_name user_id').lean(),
      Agent.find().select('_id bank_id user_id phone_no').populate('user_id', 'name userID').lean(),
      Customer.find().select('_id bank_id agent_id name shop_name phone').lean(),
    ])

    // Fast lookups
    const bankMap = new Map(allBanks.map((b) => [String(b._id), b]))
    const agentMap = new Map(allAgents.map((a) => [String(a._id), a]))
    const customerMap = new Map(allCustomers.map((c) => [String(c._id), c]))
    const userToAgentMap = new Map(
      allAgents.filter((a) => a.user_id).map((a) => [String(a.user_id._id || a.user_id), a])
    )
    const userToBankMap = new Map(
      allBanks.filter((b) => b.user_id).map((b) => [String(b.user_id), b])
    )

    // Format AuditLog records
    const auditEvents = rawLogs.map((log) => {
      let bName = 'Global / Core'
      let aName = '—'
      let cName = '—'
      const scopeTag = (log.collection_name || 'SYSTEM').toUpperCase()

      const docIdStr = String(log.document_id)
      if (log.collection_name === 'banks') {
        const b = bankMap.get(docIdStr)
        if (b) bName = b.bank_name
      } else if (log.collection_name === 'agents') {
        const ag = agentMap.get(docIdStr)
        if (ag) {
          aName = `${ag.user_id?.name || 'Agent'} (${ag.user_id?.userID || 'AGT'})`
          const b = bankMap.get(String(ag.bank_id))
          if (b) bName = b.bank_name
        }
      } else if (log.collection_name === 'customers') {
        const cust = customerMap.get(docIdStr)
        if (cust) {
          cName = cust.name + (cust.shop_name ? ` (${cust.shop_name})` : '')
          const ag = agentMap.get(String(cust.agent_id))
          if (ag) aName = `${ag.user_id?.name || 'Agent'} (${ag.user_id?.userID || 'AGT'})`
          const b = bankMap.get(String(cust.bank_id))
          if (b) bName = b.bank_name
        }
      }

      if (bName === 'Global / Core' && log.updated_by?._id) {
        const userStr = String(log.updated_by._id)
        if (userToBankMap.has(userStr)) {
          bName = userToBankMap.get(userStr).bank_name
        } else if (userToAgentMap.has(userStr)) {
          const ag = userToAgentMap.get(userStr)
          aName = `${ag.user_id?.name || log.updated_by.name} (${ag.user_id?.userID || log.updated_by.userID})`
          const b = bankMap.get(String(ag.bank_id))
          if (b) bName = b.bank_name
        }
      }

      const descLower = (log.description || '').toLowerCase()
      let eventType = 'info'
      if (
        descLower.includes('breach') ||
        descLower.includes('warn') ||
        descLower.includes('exceeded') ||
        descLower.includes('cancellation')
      ) {
        eventType = 'warning'
      } else if (
        descLower.includes('suspend') ||
        descLower.includes('lock') ||
        descLower.includes('drop') ||
        descLower.includes('delete')
      ) {
        eventType = 'danger'
      } else if (
        descLower.includes('settle') ||
        descLower.includes('deposit') ||
        descLower.includes('payout')
      ) {
        eventType = 'settlement'
      }

      return {
        id: `aud-${log._id}`,
        description: log.description || `Field ${log.changed_field || 'record'} modified in ${log.collection_name}`,
        timestamp: log.updated_date ? new Date(log.updated_date).toISOString() : new Date().toISOString(),
        date: log.updated_date ? new Date(log.updated_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        time: log.updated_date ? new Date(log.updated_date).toLocaleTimeString('en-GB') : '',
        source:
          log.collection_name === 'transactions'
            ? 'Transaction Core'
            : log.collection_name === 'customers'
              ? 'Route Manager'
              : log.collection_name === 'banks'
                ? 'License Authority'
                : 'Security Watchdog',
        type: eventType,
        user: log.updated_by?.name
          ? `${log.updated_by.name} (${log.updated_by.userID || log.updated_by.role})`
          : 'System Core',
        bankName: bName,
        agentName: aName,
        customerName: cName,
        scope: scopeTag,
        changedField: log.changed_field,
        previousValue: log.previous_value,
        newValue: log.new_value,
      }
    })

    // Format transaction events
    const txEvents = rawTransactions.map((tx) => {
      const bName = tx.bank_id?.bank_name || 'Bank'
      const aName = tx.agent_id?.user_id?.name
        ? `${tx.agent_id.user_id.name} (${tx.agent_id.user_id.userID})`
        : 'Agent'
      const cName = tx.customer_id?.name
        ? `${tx.customer_id.name}${tx.customer_id.shop_name ? ` (${tx.customer_id.shop_name})` : ''}`
        : 'Customer'

      const isCancelled = tx.transaction_status === 'C'
      const isPendingCancel = tx.transaction_status === 'P'
      const amtStr = `₹${Number(tx.transact_amt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      const typeStr = tx.transact_type === 'D' ? 'Deposit' : 'Payout'

      let desc = `CBS Ledger Entry: ${typeStr} of ${amtStr} recorded for receipt #${tx.receipt_no}`
      let eventType = 'transaction'
      if (isCancelled) {
        desc = `Transaction CANCELLED: Receipt #${tx.receipt_no} (${amtStr}). Reason: ${tx.cancellation_info?.cancellation_reason || 'Approved cancellation'}`
        eventType = 'danger'
      } else if (isPendingCancel) {
        desc = `Cancellation PENDING REVIEW: Receipt #${tx.receipt_no} (${amtStr}). Reason: ${tx.cancellation_info?.cancellation_reason || 'Pending verification'}`
        eventType = 'warning'
      }

      const txTimeVal = tx.transact_time || tx.collect_date
      return {
        id: `tx-${tx._id}`,
        description: desc,
        timestamp: txTimeVal ? new Date(txTimeVal).toISOString() : new Date().toISOString(),
        date: txTimeVal ? new Date(txTimeVal).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        time: txTimeVal ? new Date(txTimeVal).toLocaleTimeString('en-GB') : '',
        source: 'CBS Transaction Ledger',
        type: eventType,
        user: tx.cancellation_info?.reviewed_by?.name || tx.agent_id?.user_id?.name || 'Agent',
        bankName: bName,
        agentName: aName,
        customerName: cName,
        scope: 'TRANSACTION',
        receiptNo: tx.receipt_no,
      }
    })

    let combinedEvents = [...auditEvents, ...txEvents].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    )

    if (type && type !== 'all') {
      combinedEvents = combinedEvents.filter((e) => e.type === type)
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase()
      combinedEvents = combinedEvents.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          e.bankName.toLowerCase().includes(q) ||
          e.agentName.toLowerCase().includes(q) ||
          e.customerName.toLowerCase().includes(q) ||
          (e.user && e.user.toLowerCase().includes(q)) ||
          (e.receiptNo && e.receiptNo.toLowerCase().includes(q))
      )
    }

    res.json({
      events: combinedEvents,
      totalCount: combinedEvents.length,
      filtersApplied: {
        bankId: bankId || null,
        agentId: agentId || null,
        customerId: customerId || null,
        startDate: startDate || null,
        endDate: endDate || null,
      },
    })
  } catch (error) {
    console.error('Get global audit logs error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Unable to load global audit logs' })
  }
}
