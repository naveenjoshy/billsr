import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { HTTP_STATUS, MESSAGES } from '../constants/httpConstants.js'
import { Agent } from '../models/Agent.js'
import { AuditLog } from '../models/AuditLog.js'
import { Bank } from '../models/Bank.js'
import { Customer } from '../models/Customer.js'
import { CustomerScheme } from '../models/CustomerScheme.js'
import { Scheme } from '../models/Scheme.js'
import { Transaction } from '../models/Transaction.js'
import { User } from '../models/User.js'

const DAY_MS = 24 * 60 * 60 * 1000
const RISK_THRESHOLD = 0.8
const num = (value) => (value == null ? 0 : Number(value.toString()))
const money = (val) => '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function parseDateBounds(dateStr) {
  let targetDate
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    const [year, month, day] = dateStr.trim().split('-').map(Number)
    targetDate = new Date(year, month - 1, day)
  } else if (dateStr && dateStr !== 'today') {
    targetDate = new Date(dateStr)
  } else {
    targetDate = new Date()
  }

  if (Number.isNaN(targetDate.getTime())) {
    targetDate = new Date()
  }

  const startOfDay = new Date(targetDate)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(targetDate)
  endOfDay.setHours(23, 59, 59, 999)

  return { startOfDay, endOfDay, targetDate }
}

async function findOwnBank(req, res) {
  const bank = await Bank.findOne({ user_id: req.auth.sub }).lean()
  if (!bank) res.status(HTTP_STATUS.NOT_FOUND).json({ message: MESSAGES.BANK.NO_BANK_LINKED })
  return bank
}

function licenseState(bank) {
  const daysLeft = Math.ceil((new Date(bank.license_expiry).getTime() - Date.now()) / DAY_MS)
  const accountStatus = bank.compliance_status?.account_status
  let status = daysLeft <= 15 ? 'expiring' : 'active'
  if (accountStatus === 'Suspended') status = 'suspended'
  else if (accountStatus === 'Grace') status = 'grace'
  return { daysLeft, status }
}

// Signed cash an agent still holds: cash deposits minus withdrawals within the holding window.
async function agentHoldings(bankId) {
  const agents = await Agent.find({ bank_id: bankId }).populate('user_id', 'userID name').lean()
  const holdings = await Promise.all(
    agents.map(async (agent) => {
      const since = new Date(Date.now() - Math.max(agent.cash_holding_days, 1) * DAY_MS)
      const [row] = await Transaction.aggregate([
        {
          $match: {
            agent_id: agent._id,
            transact_mode: 'C',
            transaction_status: { $ne: 'C' },
            collect_date: { $gte: since },
          },
        },
        {
          $group: {
            _id: null,
            held: {
              $sum: {
                $cond: [
                  { $eq: ['$transact_type', 'D'] },
                  { $toDouble: '$transact_amt' },
                  { $multiply: [-1, { $toDouble: '$transact_amt' }] },
                ],
              },
            },
          },
        },
      ])
      const limit = num(agent.cash_holding_limit)
      const held = Math.max(row?.held ?? 0, 0)
      return {
        _id: String(agent._id),
        agentCode: agent.user_id?.userID ?? String(agent._id).slice(-6).toUpperCase(),
        name: agent.user_id?.name ?? 'Unknown agent',
        photoUrl: agent.agent_photo_url ?? null,
        holdingDays: agent.cash_holding_days,
        held,
        limit,
        ratio: limit > 0 ? held / limit : 0,
      }
    }),
  )
  return holdings
}

export async function getDashboard(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const { startOfDay, endOfDay } = parseDateBounds(req.query.date)

    const [today, todayModes, pending, holdings, owner] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            bank_id: bank._id,
            collect_date: { $gte: startOfDay, $lte: endOfDay },
            transaction_status: { $ne: 'C' },
          },
        },
        {
          $group: {
            _id: '$transact_type',
            total: { $sum: { $toDouble: '$transact_amt' } },
            count: { $sum: 1 },
            agents: { $addToSet: '$agent_id' },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $match: {
            bank_id: bank._id,
            collect_date: { $gte: startOfDay, $lte: endOfDay },
            transaction_status: { $ne: 'C' },
          },
        },
        {
          $group: {
            _id: '$transact_mode',
            totalDeposits: {
              $sum: {
                $cond: [{ $eq: ['$transact_type', 'D'] }, { $toDouble: '$transact_amt' }, 0],
              },
            },
            totalWithdrawals: {
              $sum: {
                $cond: [{ $eq: ['$transact_type', 'W'] }, { $toDouble: '$transact_amt' }, 0],
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $match: {
            bank_id: bank._id,
            transaction_status: 'P',
            collect_date: { $gte: startOfDay, $lte: endOfDay },
          },
        },
        { $group: { _id: null, total: { $sum: { $toDouble: '$transact_amt' } }, count: { $sum: 1 } } },
      ]),
      agentHoldings(bank._id),
      User.findById(req.auth.sub).select('name').lean(),
    ])

    const byType = Object.fromEntries(today.map((row) => [row._id, row]))
    const deposits = byType.D?.total ?? 0
    const withdrawals = byType.W?.total ?? 0
    const activeToday = new Set(today.flatMap((row) => row.agents.map(String)))
    const overLimit = holdings.filter((agent) => agent.limit > 0 && agent.held > agent.limit)
    const { daysLeft, status } = licenseState(bank)

    const byMode = Object.fromEntries(todayModes.map((row) => [row._id, row]))
    const cashDeposits = byMode.C?.totalDeposits ?? 0
    const cashWithdrawals = byMode.C?.totalWithdrawals ?? 0
    const transferDeposits = byMode.T?.totalDeposits ?? 0
    const transferWithdrawals = byMode.T?.totalWithdrawals ?? 0

    res.json({
      user: { name: owner?.name ?? '', designation: bank.designation ?? null },
      bank: {
        name: bank.bank_name,
        licenseExpiry: bank.license_expiry,
        graceEnd: bank.compliance_status?.grace_period_end ?? null,
        daysLeft,
        status,
      },
      kpis: {
        netCollections: deposits - withdrawals,
        deposits,
        withdrawals,
        transactionCount: (byType.D?.count ?? 0) + (byType.W?.count ?? 0),
        cashMode: {
          net: cashDeposits - cashWithdrawals,
          deposits: cashDeposits,
          withdrawals: cashWithdrawals,
          count: byMode.C?.count ?? 0,
        },
        transferMode: {
          net: transferDeposits - transferWithdrawals,
          deposits: transferDeposits,
          withdrawals: transferWithdrawals,
          count: byMode.T?.count ?? 0,
        },
        totalAgents: holdings.length,
        agentsOnDuty: activeToday.size,
        cashInField: holdings.reduce((sum, agent) => sum + agent.held, 0),
        overLimitCount: overLimit.length,
        maxLimit: Math.max(0, ...holdings.map((agent) => agent.limit)),
        pendingCount: pending[0]?.count ?? 0,
        pendingAmount: pending[0]?.total ?? 0,
      },
      risk: holdings
        .filter((agent) => agent.ratio >= RISK_THRESHOLD)
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 5),
    })
  } catch (error) {
    console.error('Bank dashboard error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.BANK.DASHBOARD_ERROR })
  }
}

export async function listTransactions(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize || req.query.limit, 10) || 10, 1), 100)
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : ''
    const filter = { bank_id: bank._id }

    // Status filter: P, A, C
    if (req.query.status && ['P', 'A', 'C'].includes(req.query.status)) {
      filter.transaction_status = req.query.status
    }

    // Type filter: D, W
    if (req.query.type && ['D', 'W'].includes(req.query.type)) {
      filter.transact_type = req.query.type
    }

    // Mode filter: C (Cash), T (Transfer)
    if (req.query.mode && ['C', 'T'].includes(req.query.mode)) {
      filter.transact_mode = req.query.mode
    }

    // Scheme filter
    if (req.query.scheme && mongoose.isValidObjectId(req.query.scheme)) {
      filter.scheme_id = req.query.scheme
    }

    // Agent filter
    if (req.query.agent && mongoose.isValidObjectId(req.query.agent)) {
      filter.agent_id = req.query.agent
    }

    // Date filter: specific date or range
    if (req.query.startDate || req.query.endDate) {
      const dateFilter = {}
      if (req.query.startDate) {
        const start = new Date(req.query.startDate)
        if (!Number.isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0)
          dateFilter.$gte = start
        }
      }
      if (req.query.endDate) {
        const end = new Date(req.query.endDate)
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999)
          dateFilter.$lte = end
        }
      }
      if (Object.keys(dateFilter).length > 0) {
        filter.collect_date = dateFilter
      }
    } else if (req.query.date) {
      const { startOfDay, endOfDay } = parseDateBounds(req.query.date)
      filter.collect_date = { $gte: startOfDay, $lte: endOfDay }
    } else if (req.query.dateRange === 'today') {
      const { startOfDay, endOfDay } = parseDateBounds('today')
      filter.collect_date = { $gte: startOfDay, $lte: endOfDay }
    } else if (req.query.dateRange === 'week') {
      const pastWeek = new Date(Date.now() - 7 * DAY_MS)
      filter.collect_date = { $gte: pastWeek }
    } else if (req.query.dateRange === 'month') {
      const pastMonth = new Date(Date.now() - 30 * DAY_MS)
      filter.collect_date = { $gte: pastMonth }
    }

    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i')
      const [matchedCustomers, matchedUsers] = await Promise.all([
        Customer.find({
          bank_id: bank._id,
          $or: [{ name: pattern }, { shop_name: pattern }],
        }).select('_id').lean(),
        User.find({
          $or: [{ name: pattern }, { userID: pattern }],
        }).select('_id').lean(),
      ])

      const matchedAgents = await Agent.find({
        bank_id: bank._id,
        user_id: { $in: matchedUsers.map((u) => u._id) },
      }).select('_id').lean()

      filter.$or = [
        { receipt_no: pattern },
        { customer_id: { $in: matchedCustomers.map((c) => c._id) } },
        { agent_id: { $in: matchedAgents.map((a) => a._id) } },
      ]
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1)

    const [total, rows, todayStats, pendingStats, approvedCancellationsMTD, totalAgents, schemes, bankAgents] = await Promise.all([
      Transaction.countDocuments(filter),
      Transaction.find(filter)
        .sort({ transact_time: -1, collect_date: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate('customer_id', 'name shop_name address phone')
        .populate('scheme_id', 'scheme_name')
        .populate({ path: 'agent_id', select: 'user_id cash_holding_limit', populate: { path: 'user_id', select: 'userID name' } })
        .populate({ path: 'cancellation_info.reviewed_by', select: 'name userID' })
        .lean(),
      // 1. Total Volume Today (excluding cancelled)
      Transaction.aggregate([
        { $match: { bank_id: bank._id, collect_date: { $gte: todayStart }, transaction_status: { $ne: 'C' } } },
        {
          $group: {
            _id: '$transact_type',
            total: { $sum: { $toDouble: '$transact_amt' } },
            count: { $sum: 1 },
          },
        },
      ]),
      // 2. Pending Cancellations
      Transaction.aggregate([
        { $match: { bank_id: bank._id, transaction_status: 'P' } },
        {
          $group: {
            _id: null,
            totalLocked: { $sum: { $toDouble: '$transact_amt' } },
            count: { $sum: 1 },
            oldest: { $min: '$collect_date' },
          },
        },
      ]),
      // 3. Approved Cancellations (MTD / Voided)
      Transaction.aggregate([
        { $match: { bank_id: bank._id, transaction_status: 'C', collect_date: { $gte: startOfMonth } } },
        {
          $group: {
            _id: null,
            totalReversed: { $sum: { $toDouble: '$transact_amt' } },
            count: { $sum: 1 },
          },
        },
      ]),
      // 4. Collector Status
      Agent.find({ bank_id: bank._id }).populate('user_id', 'is_active').lean(),
      // Schemes filter list
      Scheme.find({ bank_id: bank._id }).select('_id scheme_name').lean(),
      // Agents filter list
      Agent.find({ bank_id: bank._id })
        .populate('user_id', 'userID name')
        .select('_id user_id')
        .lean(),
    ])

    // Format summary metrics
    const todayDeposits = todayStats.find((s) => s._id === 'D')?.total || 0
    const todayWithdrawals = todayStats.find((s) => s._id === 'W')?.total || 0
    const todayCount = todayStats.reduce((acc, s) => acc + s.count, 0)

    const pendingCount = pendingStats[0]?.count || 0
    const pendingLocked = pendingStats[0]?.totalLocked || 0
    const pendingOldestDate = pendingStats[0]?.oldest || null
    let oldestMinsAgo = 0
    if (pendingOldestDate) {
      oldestMinsAgo = Math.max(1, Math.round((Date.now() - new Date(pendingOldestDate).getTime()) / (60 * 1000)))
    }

    const mtdVoidedCount = approvedCancellationsMTD[0]?.count || 0
    const mtdTotalReversed = approvedCancellationsMTD[0]?.totalReversed || 0

    const totalAgentCount = totalAgents.length
    const activeAgentCount = totalAgents.filter((a) => a.user_id?.is_active !== false).length

    const summary = {
      totalVolumeToday: {
        count: todayCount,
        deposits: todayDeposits,
        withdrawals: todayWithdrawals,
      },
      pendingCancellations: {
        count: pendingCount,
        lockedAmount: pendingLocked,
        oldestMinsAgo,
      },
      approvedCancellationsMTD: {
        count: mtdVoidedCount,
        totalReversed: mtdTotalReversed,
      },
      collectorStatus: {
        active: activeAgentCount,
        total: totalAgentCount,
        clearingTime: '17:00 IST',
      },
    }

    const transactions = rows.map((row) => ({
      _id: String(row._id),
      transactId: 'TX-' + String(row._id).slice(-6).toUpperCase(),
      receiptNo: row.receipt_no,
      scheme: row.scheme_id?.scheme_name ?? '—',
      schemeId: row.scheme_id?._id ? String(row.scheme_id._id) : null,
      customer: row.customer_id?.name ?? '—',
      customerId: row.customer_id?._id ? String(row.customer_id._id).slice(-4) : '—',
      customerShop: row.customer_id?.shop_name ?? '',
      customerAddress: row.customer_id?.address ?? '',
      customerDetail: [row.customer_id?.shop_name, row.customer_id?.address].filter(Boolean).join(' • '),
      customerPhone: row.customer_id?.phone ?? '',
      agentName: row.agent_id?.user_id?.name ?? '—',
      agentCode: row.agent_id?.user_id?.userID ?? '',
      agentId: row.agent_id?._id ? String(row.agent_id._id) : null,
      amount: num(row.transact_amt),
      type: row.transact_type,
      status: row.transaction_status,
      mode: row.transact_mode,
      collectDate: row.collect_date,
      transactTime: row.transact_time || row.collect_date,
      transactionTime: row.transaction_time || row.transact_time || row.collect_date,
      openingBal: num(row.balance_snapshot?.opening_bal),
      newBalance: num(row.balance_snapshot?.new_balance),
      cancellationReason: row.cancellation_info?.cancellation_reason ?? null,
      reviewedBy: row.cancellation_info?.reviewed_by?.name || row.cancellation_info?.reviewed_by?.userID || null,
    }))

    const filterOptions = {
      schemes: schemes.map((s) => ({ _id: String(s._id), name: s.scheme_name })),
      agents: bankAgents.map((a) => ({
        _id: String(a._id),
        name: a.user_id?.name ?? 'Unknown',
        code: a.user_id?.userID ?? '',
      })),
    }

    const { daysLeft, status } = licenseState(bank)

    res.json({
      bank: { name: bank.bank_name, licenseExpiry: bank.license_expiry, daysLeft, status },
      summary,
      transactions,
      filterOptions,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    })
  } catch (error) {
    console.error('List transactions error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.TRANSACTION.LOAD_FAILED })
  }
}

export async function approveTransaction(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.TRANSACTION.INVALID_ID })
    }

    // Atomic status guard so a transaction can only be approved once.
    const updated = await Transaction.findOneAndUpdate(
      { _id: req.params.id, bank_id: bank._id, transaction_status: 'P' },
      { $set: { transaction_status: 'A' } },
      { new: true },
    ).lean()
    if (!updated) {
      return res.status(HTTP_STATUS.CONFLICT).json({ message: MESSAGES.TRANSACTION.NOT_FOUND_OR_NOT_PENDING })
    }

    await AuditLog.create({
      collection_name: 'transactions',
      document_id: updated._id,
      description: 'Transaction approved',
      changed_field: 'transaction_status',
      previous_value: 'P',
      new_value: 'A',
      updated_by: req.auth.sub,
    })
    res.json({ id: String(updated._id), status: 'A' })
  } catch (error) {
    console.error('Approve transaction error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.TRANSACTION.APPROVE_FAILED })
  }
}

export async function cancelTransaction(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.TRANSACTION.INVALID_ID })
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : 'Approved cancellation by bank admin'

    const updated = await Transaction.findOneAndUpdate(
      { _id: req.params.id, bank_id: bank._id, transaction_status: 'P' },
      {
        $set: {
          transaction_status: 'C',
          'cancellation_info.reviewed_by': req.auth.sub,
          ...(req.body?.reason ? { 'cancellation_info.cancellation_reason': reason } : {}),
        },
      },
      { new: true },
    )
      .populate('customer_id', 'name')
      .populate('scheme_id', 'scheme_name')
      .populate({ path: 'agent_id', select: 'user_id', populate: { path: 'user_id', select: 'name' } })
      .lean()

    if (!updated) {
      return res.status(HTTP_STATUS.CONFLICT).json({ message: MESSAGES.TRANSACTION.NOT_FOUND_OR_CANCELLED })
    }

    await AuditLog.create({
      collection_name: 'transactions',
      document_id: updated._id,
      description: 'Transaction cancellation approved',
      changed_field: 'transaction_status',
      previous_value: 'P',
      new_value: 'C',
      updated_by: req.auth.sub,
    })

    res.json({
      id: String(updated._id),
      status: 'C',
      receiptNo: updated.receipt_no,
      message: `Cancellation approved for receipt ${updated.receipt_no}. Funds reversed.`,
    })
  } catch (error) {
    console.error('Cancel transaction error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.TRANSACTION.CANCEL_FAILED })
  }
}

export async function rejectCancellation(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.TRANSACTION.INVALID_ID })
    }

    const updated = await Transaction.findOneAndUpdate(
      { _id: req.params.id, bank_id: bank._id, transaction_status: 'P' },
      {
        $set: {
          transaction_status: 'A',
          'cancellation_info.reviewed_by': req.auth.sub,
        },
      },
      { new: true },
    )
      .populate('customer_id', 'name')
      .lean()

    if (!updated) {
      return res.status(HTTP_STATUS.CONFLICT).json({ message: MESSAGES.TRANSACTION.NOT_FOUND_OR_NOT_PENDING })
    }

    await AuditLog.create({
      collection_name: 'transactions',
      document_id: updated._id,
      description: 'Transaction cancellation rejected, transaction accepted',
      changed_field: 'transaction_status',
      previous_value: 'P',
      new_value: 'A',
      updated_by: req.auth.sub,
    })

    res.json({
      id: String(updated._id),
      status: 'A',
      receiptNo: updated.receipt_no,
      message: `Cancellation rejected. Receipt ${updated.receipt_no} retained as Accepted (A).`,
    })
  } catch (error) {
    console.error('Reject cancellation error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.TRANSACTION.REJECT_FAILED })
  }
}

export async function getPendingCancellationsCount(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const count = await Transaction.countDocuments({
      bank_id: bank._id,
      transaction_status: 'P',
    })

    res.json({ count, pendingCount: count })
  } catch (error) {
    console.error('Get pending cancellations count error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: error.message })
  }
}

const APPROACH_THRESHOLD = 0.85

export async function listAgents(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const baseDate = req.query.date ? new Date(req.query.date) : new Date()
    const targetDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    let activeStart = startOfDay
    let activeEnd = endOfDay

    // If no specific date was queried and there are no transactions today in the bank,
    // look for the most recent transaction date so seeded/historical transactions are accurately reflected
    if (!req.query.date) {
      const todayCount = await Transaction.countDocuments({
        bank_id: bank._id,
        collect_date: { $gte: startOfDay, $lte: endOfDay },
      })
      if (todayCount === 0) {
        const latestTx = await Transaction.findOne({ bank_id: bank._id })
          .sort({ collect_date: -1 })
          .select('collect_date')
          .lean()
        if (latestTx?.collect_date) {
          const lDate = new Date(latestTx.collect_date)
          activeStart = new Date(lDate)
          activeStart.setHours(0, 0, 0, 0)
          activeEnd = new Date(lDate)
          activeEnd.setHours(23, 59, 59, 999)
        }
      }
    }

    const agents = await Agent.find({ bank_id: bank._id })
      .populate('user_id', 'userID name email is_active')
      .sort({ 'audit_trail.created_at': 1 })
      .lean()

    const rows = await Promise.all(
      agents.map(async (agent) => {
        const since = new Date(Date.now() - Math.max(agent.cash_holding_days, 1) * DAY_MS)
        const base = { agent_id: agent._id, bank_id: bank._id, transaction_status: { $ne: 'C' } }
        const [cash, today, totalReceipts, customers, recent] = await Promise.all([
          Transaction.aggregate([
            { $match: { ...base, transact_mode: 'C', collect_date: { $gte: since } } },
            {
              $group: {
                _id: null,
                held: {
                  $sum: {
                    $cond: [
                      { $eq: ['$transact_type', 'D'] },
                      { $toDouble: '$transact_amt' },
                      { $multiply: [-1, { $toDouble: '$transact_amt' }] },
                    ],
                  },
                },
                since: { $min: '$collect_date' },
              },
            },
          ]),
          Transaction.aggregate([
            { $match: { ...base, collect_date: { $gte: activeStart, $lte: activeEnd } } },
            { $group: { _id: '$transact_type', count: { $sum: 1 } } },
          ]),
          Transaction.countDocuments(base),
          Customer.countDocuments({ agent_id: agent._id }),
          Transaction.find({ agent_id: agent._id, bank_id: bank._id })
            .sort({ transact_time: -1, collect_date: -1, _id: -1 })
            .limit(4)
            .populate('customer_id', 'name')
            .lean(),
        ])

        const limit = num(agent.cash_holding_limit)
        const held = Math.max(cash[0]?.held ?? 0, 0)
        const durationDays =
          held > 0 && cash[0]?.since ? Math.floor((Date.now() - new Date(cash[0].since).getTime()) / DAY_MS) : 0
        const ratio = limit > 0 ? held / limit : 0
        const breached = ratio > 1 || (held > 0 && durationDays > agent.cash_holding_days)
        const todayBy = Object.fromEntries(today.map((row) => [row._id, row.count]))
        const todayDeposits = todayBy.D ?? 0
        const todayWithdrawals = todayBy.W ?? 0
        const todayReceipts = todayDeposits + todayWithdrawals

        const branchName =
          agent.branch_name ||
          (agent.address && agent.address.includes(',') ? agent.address.split(',')[0].trim() : 'Central Market')
        const routeCode = `Route #CM-${(agent.user_id?.userID || String(agent._id)).slice(-2).toUpperCase()}`

        return {
          _id: String(agent._id),
          agentCode: agent.user_id?.userID ?? String(agent._id).slice(-6).toUpperCase(),
          name: agent.user_id?.name ?? 'Unknown agent',
          email: agent.user_id?.email ?? null,
          isActive: agent.user_id?.is_active !== false && agent.status !== 'Suspended',
          status: agent.user_id?.is_active === false || agent.status === 'Suspended' ? 'suspended' : 'active',
          phone: agent.phone_no,
          address: agent.address,
          branch: branchName,
          route: routeCode,
          photoUrl: agent.agent_photo_url ?? null,
          limit,
          holdingDays: agent.cash_holding_days,
          held,
          excess: Math.max(held - limit, 0),
          ratio,
          durationDays,
          risk: breached ? 'breach' : ratio >= APPROACH_THRESHOLD ? 'warning' : 'safe',
          todayDeposits,
          todayWithdrawals,
          todayReceipts,
          totalReceipts,
          customers,
          passwordResetPending: agent.password_reset_flag === true,
          lastPasswordChange: agent.last_password_change_date ?? null,
          printerId: `BT-PRN-${(agent.user_id?.userID || String(agent._id)).slice(-4).toUpperCase()}`,
          gpsPing: `12m ago (${branchName.split(' ')[0] || 'Market'})`,
          recent: recent.map((tx) => ({
            _id: String(tx._id),
            receiptNo: tx.receipt_no,
            type: tx.transact_type,
            status: tx.transaction_status,
            amount: num(tx.transact_amt),
            customer: tx.customer_id?.name ?? 'Unknown customer',
            date: tx.collect_date,
          })),
        }
      }),
    )

    const [recentAuditLogs, recentSettlements] = await Promise.all([
      AuditLog.find({
        $or: [
          { collection_name: 'agents' },
          { collection_name: 'customers' },
          { collection_name: 'schemes' },
          { collection_name: 'transactions' },
        ],
      })
        .sort({ updated_date: -1 })
        .limit(30)
        .lean(),
      Transaction.find({ bank_id: bank._id, transact_type: 'D' })
        .sort({ collect_date: -1 })
        .limit(20)
        .populate('agent_id', 'user_id')
        .populate({ path: 'agent_id', populate: { path: 'user_id', select: 'userID name' } })
        .lean(),
    ])

    const auditEvents = [
      ...recentAuditLogs.map((log) => ({
        id: String(log._id),
        description: log.description || `Event logged in ${log.collection_name}`,
        timestamp: log.updated_date ? new Date(log.updated_date).toISOString() : new Date().toISOString(),
        date: log.updated_date ? new Date(log.updated_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        time: log.updated_date ? new Date(log.updated_date).toLocaleTimeString('en-GB') : '14:22:09',
        source: log.collection_name === 'transactions' ? 'System Core' : log.collection_name === 'customers' ? 'Route Manager' : 'Audit Watchdog',
        type:
          log.description?.toLowerCase().includes('breach') || log.description?.toLowerCase().includes('warn')
            ? 'warning'
            : log.action === 'SUSPEND' ? 'danger' : 'info',
      })),
      ...recentSettlements.map((tx) => ({
        id: String(tx._id),
        description: `Vault Settlement: ${tx.agent_id?.user_id?.userID || 'ACT-0988'} deposited ${money(tx.transact_amt)} cash to teller #2`,
        timestamp: tx.collect_date ? new Date(tx.collect_date).toISOString() : new Date().toISOString(),
        date: tx.collect_date ? new Date(tx.collect_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        time: tx.collect_date ? new Date(tx.collect_date).toLocaleTimeString('en-GB') : '11:15:48',
        source: 'Teller Central',
        type: 'settlement',
      })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 30)

    const { daysLeft, status } = licenseState(bank)
    const limits = rows.map((agent) => agent.limit)
    res.json({
      bank: { name: bank.bank_name, licenseExpiry: bank.license_expiry, daysLeft, status },
      summary: {
        totalAgents: rows.length,
        verifiedAgents: rows.filter((agent) => !agent.passwordResetPending).length,
        cashInField: rows.reduce((sum, agent) => sum + agent.held, 0),
        dailyTarget: limits.reduce((sum, value) => sum + value, 0) || 65000,
        breachCount: rows.filter((agent) => agent.risk === 'breach').length,
        approachingCount: rows.filter((agent) => agent.risk === 'warning').length,
        maxLimit: Math.max(0, ...limits),
        minLimit: limits.length ? Math.min(...limits) : 0,
        maxHoldingDays: Math.max(0, ...rows.map((agent) => agent.holdingDays)),
      },
      agents: rows,
      auditEvents,
    })
  } catch (error) {
    console.error('Bank agents error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.BANK.AGENTS_ERROR })
  }
}

export async function updateAgentLimit(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const { id } = req.params
    const { limit, holdingDays } = req.body

    const agent = await Agent.findOne({ _id: id, bank_id: bank._id })
    if (!agent) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: MESSAGES.BANK.AGENT_NOT_FOUND })
    }

    const previousLimit = agent.cash_holding_limit
    const previousDays = agent.cash_holding_days

    if (limit != null && !Number.isNaN(Number(limit))) {
      agent.cash_holding_limit = Number(limit)
    }
    if (holdingDays != null && !Number.isNaN(Number(holdingDays))) {
      agent.cash_holding_days = Math.max(1, Number.parseInt(holdingDays, 10))
    }

    agent.audit_trail = {
      ...agent.audit_trail,
      modified_by: req.auth.sub,
      modified_at: new Date(),
    }

    await agent.save()

    await AuditLog.create({
      collection_name: 'agents',
      document_id: agent._id,
      description: `Cash holding parameters updated (limit: ${previousLimit} -> ${agent.cash_holding_limit}, days: ${previousDays} -> ${agent.cash_holding_days})`,
      changed_field: 'cash_holding_limit',
      previous_value: { limit: previousLimit, holdingDays: previousDays },
      new_value: { limit: agent.cash_holding_limit, holdingDays: agent.cash_holding_days },
      updated_by: req.auth.sub,
    })

    res.json({ message: MESSAGES.BANK.AGENT_LIMIT_UPDATE_SUCCESS, agent })
  } catch (error) {
    console.error('Update agent limit error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.BANK.AGENT_LIMIT_UPDATE_FAILED })
  }
}

export async function setAgentSuspension(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.BANK.INVALID_ID })
    }

    const { suspend, reason } = req.body ?? {}
    if (typeof suspend !== 'boolean') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'suspend must be a boolean (true or false)' })
    }

    const trimmedReason = typeof reason === 'string' ? reason.trim() : ''
    if (!trimmedReason) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: `Reason is required to ${suspend ? 'suspend' : 'reactivate'} an agent.`,
      })
    }

    const agent = await Agent.findOne({ _id: id, bank_id: bank._id }).populate('user_id', 'userID name email is_active')
    if (!agent) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: MESSAGES.BANK.AGENT_NOT_FOUND })
    }

    const nextStatus = suspend ? 'Suspended' : 'Active'
    const previousActive = agent.user_id?.is_active !== false
    const previousStatus = agent.status || (previousActive ? 'Active' : 'Suspended')

    // Update User is_active
    if (agent.user_id?._id) {
      await User.updateOne(
        { _id: agent.user_id._id },
        { $set: { is_active: !suspend, 'audit_trail.modified_at': new Date() } },
      )
    }

    // Update Agent status & audit
    agent.status = nextStatus
    agent.audit_trail = {
      ...agent.audit_trail,
      modified_by: req.auth.sub,
      modified_at: new Date(),
    }
    await agent.save()

    await AuditLog.create({
      collection_name: 'agents',
      document_id: agent._id,
      action: suspend ? 'SUSPEND' : 'ACTIVATE',
      description: `${agent.user_id?.name || 'Agent'} (${agent.user_id?.userID || ''}) was ${suspend ? 'suspended' : 'reactivated'}: ${trimmedReason}`,
      changed_field: 'status',
      previous_value: previousStatus,
      new_value: nextStatus,
      updated_by: req.auth.sub,
    })

    const customerCount = await Customer.countDocuments({ agent_id: agent._id, bank_id: bank._id })

    res.json({
      message: `Agent ${agent.user_id?.name || ''} has been ${suspend ? 'suspended' : 'reactivated'} successfully.`,
      agent: {
        _id: String(agent._id),
        name: agent.user_id?.name,
        agentCode: agent.user_id?.userID,
        isActive: !suspend,
        status: nextStatus.toLowerCase(),
        customers: customerCount,
      },
    })
  } catch (error) {
    console.error('Set agent suspension error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Unable to update agent status' })
  }
}

export async function listAgentCustomers(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.BANK.INVALID_ID })
    }

    const agent = await Agent.findOne({ _id: id, bank_id: bank._id }).populate('user_id', 'userID name').lean()
    if (!agent) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: MESSAGES.BANK.AGENT_NOT_FOUND })
    }

    const customers = await Customer.find({ agent_id: id, bank_id: bank._id })
      .select('_id name shop_name phone address location type')
      .sort({ name: 1 })
      .lean()

    res.json({
      agent: {
        _id: String(agent._id),
        name: agent.user_id?.name || 'Unknown agent',
        agentCode: agent.user_id?.userID || '',
      },
      customers: customers.map((c) => ({
        _id: String(c._id),
        name: c.name,
        shopName: c.shop_name || '',
        phone: c.phone || '',
        address: c.address || '',
        type: c.type || 'Retail',
      })),
      total: customers.length,
    })
  } catch (error) {
    console.error('List agent customers error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Unable to load agent customers' })
  }
}

export async function reallocateAgentCustomers(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const { sourceAgentId, targetAgentId, customerIds, reason } = req.body ?? {}

    if (!mongoose.isValidObjectId(sourceAgentId) || !mongoose.isValidObjectId(targetAgentId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Valid source and destination agent IDs are required' })
    }

    if (String(sourceAgentId) === String(targetAgentId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Destination agent must be different from source agent' })
    }

    const [sourceAgent, targetAgent] = await Promise.all([
      Agent.findOne({ _id: sourceAgentId, bank_id: bank._id }).populate('user_id', 'userID name is_active').lean(),
      Agent.findOne({ _id: targetAgentId, bank_id: bank._id }).populate('user_id', 'userID name is_active status').lean(),
    ])

    if (!sourceAgent) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Source agent not found in your bank' })
    }
    if (!targetAgent) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Destination agent not found in your bank' })
    }

    // Target agent must be active
    const targetIsActive = targetAgent.user_id?.is_active !== false && targetAgent.status !== 'Suspended'
    if (!targetIsActive) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Cannot reallocate customers to a suspended agent' })
    }

    // Determine filter for customers to update
    const filter = { agent_id: sourceAgent._id, bank_id: bank._id }
    if (Array.isArray(customerIds) && customerIds.length > 0) {
      const validIds = customerIds.filter((cid) => mongoose.isValidObjectId(cid))
      if (validIds.length === 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'No valid customer IDs provided' })
      }
      filter._id = { $in: validIds }
    }

    const now = new Date()
    const updateResult = await Customer.updateMany(filter, {
      $set: {
        agent_id: targetAgent._id,
        'audit_trail.modified_at': now,
        'audit_trail.modified_by': req.auth.sub,
      },
    })

    const count = updateResult.modifiedCount

    const justification = typeof reason === 'string' && reason.trim() ? reason.trim() : 'Customer route reallocation'

    await AuditLog.create({
      collection_name: 'customers',
      document_id: targetAgent._id,
      action: 'REALLOCATE',
      description: `Reallocated ${count} customer(s) from ${sourceAgent.user_id?.name || 'Source Agent'} (${sourceAgent.user_id?.userID || ''}) to ${targetAgent.user_id?.name || 'Target Agent'} (${targetAgent.user_id?.userID || ''}). Note: ${justification}`,
      changed_field: 'agent_id',
      previous_value: String(sourceAgent._id),
      new_value: String(targetAgent._id),
      updated_by: req.auth.sub,
    })

    const [remainingSource, newTargetCount] = await Promise.all([
      Customer.countDocuments({ agent_id: sourceAgent._id, bank_id: bank._id }),
      Customer.countDocuments({ agent_id: targetAgent._id, bank_id: bank._id }),
    ])

    res.json({
      message: `Successfully reallocated ${count} customer(s) to ${targetAgent.user_id?.name || 'target agent'}.`,
      reallocatedCount: count,
      sourceAgent: { _id: String(sourceAgent._id), remainingCustomers: remainingSource },
      targetAgent: { _id: String(targetAgent._id), totalCustomers: newTargetCount },
    })
  } catch (error) {
    console.error('Reallocate agent customers error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Unable to reallocate customers' })
  }
}

export async function createAgent(req, res) {
  const { user: userInput, agent: agentInput } = req.newAgent
  const actor = req.auth.sub
  let user
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

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
      role: 'Agent',
    })

    const agent = await Agent.create({
      ...agentInput,
      user_id: user._id,
      bank_id: bank._id,
      password_reset_flag: true,
      audit_trail: { created_by: actor, modified_by: actor },
    })

    await AuditLog.create({
      collection_name: 'agents',
      document_id: agent._id,
      description: 'Agent added',
      changed_field: 'agent',
      new_value: { userID: user.userID, bank_id: String(bank._id) },
      updated_by: actor,
    })

    res.status(HTTP_STATUS.CREATED).json({ agent: { _id: String(agent._id), userID: user.userID, name: user.name } })
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
    console.error('Create agent error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.BANK.CREATE_AGENT_ERROR })
  }
}

export async function listSchemes(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const schemes = await Scheme.find({ bank_id: bank._id }).lean()

    const schemeIds = schemes.map((s) => s._id)
    const [enrolledCounts, txCounts] = await Promise.all([
      CustomerScheme.aggregate([
        { $match: { scheme_id: { $in: schemeIds } } },
        { $group: { _id: '$scheme_id', count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        { $match: { scheme_id: { $in: schemeIds }, bank_id: bank._id } },
        { $group: { _id: '$scheme_id', count: { $sum: 1 } } },
      ]),
    ])

    const enrolledMap = Object.fromEntries(enrolledCounts.map((c) => [String(c._id), c.count]))
    const txMap = Object.fromEntries(txCounts.map((c) => [String(c._id), c.count]))

    const result = schemes.map((s) => ({
      ...s,
      _id: String(s._id),
      enrolledCustomersCount: enrolledMap[String(s._id)] || 0,
      activeTransactionsCount: txMap[String(s._id)] || 0,
    }))

    res.json({ schemes: result })
  } catch (error) {
    console.error('List schemes error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.SCHEME.LOAD_FAILED })
  }
}

export async function createScheme(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const {
      scheme_name,
      scheme_description,
      status = 'A',
      permitted_operation = 'A',
      receipt_config = { fields: [] },
    } = req.body

    if (!scheme_name || !scheme_name.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.SCHEME.NAME_REQUIRED })
    }

    const scheme = await Scheme.create({
      bank_id: bank._id,
      scheme_name: scheme_name.trim(),
      scheme_description: scheme_description?.trim() || '',
      status: ['A', 'S'].includes(status) ? status : 'A',
      permitted_operation: ['A', 'S'].includes(permitted_operation) ? permitted_operation : 'A',
      receipt_config: {
        fields: Array.isArray(receipt_config?.fields) ? receipt_config.fields : [],
      },
    })

    await AuditLog.create({
      collection_name: 'schemes',
      document_id: scheme._id,
      action: 'CREATE',
      description: `New scheme "${scheme.scheme_name}" created by bank administrator`,
      new_value: scheme.toObject(),
      updated_by: req.auth.sub,
    }).catch(() => null)

    res.status(HTTP_STATUS.CREATED).json({
      message: MESSAGES.SCHEME.CREATE_SUCCESS(scheme.scheme_name),
      scheme: {
        ...scheme.toObject(),
        _id: String(scheme._id),
        enrolledCustomersCount: 0,
        activeTransactionsCount: 0,
      },
    })
  } catch (error) {
    console.error('Create scheme error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.SCHEME.CREATE_FAILED })
  }
}

export async function updateScheme(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.SCHEME.INVALID_ID })
    }

    const scheme = await Scheme.findOne({ _id: id, bank_id: bank._id })
    if (!scheme) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: MESSAGES.SCHEME.NOT_FOUND })
    }

    const { scheme_name, scheme_description, status, permitted_operation, receipt_config } = req.body

    const prev = scheme.toObject()
    if (scheme_name !== undefined) scheme.scheme_name = scheme_name.trim()
    if (scheme_description !== undefined) scheme.scheme_description = scheme_description.trim()
    if (status !== undefined && ['A', 'S'].includes(status)) scheme.status = status
    if (permitted_operation !== undefined && ['A', 'S'].includes(permitted_operation)) {
      scheme.permitted_operation = permitted_operation
    }
    if (receipt_config?.fields && Array.isArray(receipt_config.fields)) {
      scheme.receipt_config = receipt_config
    }

    await scheme.save()

    await AuditLog.create({
      collection_name: 'schemes',
      document_id: scheme._id,
      action: 'UPDATE',
      description: `Scheme "${scheme.scheme_name}" updated by bank administrator`,
      previous_value: prev,
      new_value: scheme.toObject(),
      updated_by: req.auth.sub,
    }).catch(() => null)

    res.json({
      message: MESSAGES.SCHEME.UPDATE_SUCCESS(scheme.scheme_name),
      scheme: scheme.toObject(),
    })
  } catch (error) {
    console.error('Update scheme error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.SCHEME.UPDATE_FAILED })
  }
}

export async function deleteScheme(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.SCHEME.INVALID_ID })
    }

    const scheme = await Scheme.findOne({ _id: id, bank_id: bank._id })
    if (!scheme) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: MESSAGES.SCHEME.NOT_FOUND })
    }

    const [enrolledCount, txCount] = await Promise.all([
      CustomerScheme.countDocuments({ scheme_id: id }),
      Transaction.countDocuments({ scheme_id: id }),
    ])
    if (enrolledCount > 0 || txCount > 0) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        message: MESSAGES.SCHEME.IN_USE_CONFLICT(scheme.scheme_name),
      })
    }

    const name = scheme.scheme_name
    await Scheme.deleteOne({ _id: id, bank_id: bank._id })

    await AuditLog.create({
      collection_name: 'schemes',
      document_id: id,
      action: 'DELETE',
      description: `Scheme "${name}" deleted by bank administrator`,
      previous_value: scheme.toObject(),
      updated_by: req.auth.sub,
    }).catch(() => null)

    res.json({ message: MESSAGES.SCHEME.DELETE_SUCCESS(name) })
  } catch (error) {
    console.error('Delete scheme error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGES.SCHEME.DELETE_FAILED })
  }
}

export async function getAuditEvents(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const { startDate, endDate, type } = req.query ?? {}

    const dateQuery = {}
    if (startDate) {
      dateQuery.$gte = new Date(startDate)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateQuery.$lte = end
    }

    const auditFilter = {
      $or: [
        { collection_name: 'agents' },
        { collection_name: 'customers' },
        { collection_name: 'schemes' },
        { collection_name: 'transactions' },
      ],
    }
    if (Object.keys(dateQuery).length > 0) {
      auditFilter.updated_date = dateQuery
    }

    const txFilter = { bank_id: bank._id, transact_type: 'D' }
    if (Object.keys(dateQuery).length > 0) {
      txFilter.collect_date = dateQuery
    }

    const [auditLogs, settlements] = await Promise.all([
      AuditLog.find(auditFilter)
        .sort({ updated_date: -1 })
        .limit(100)
        .populate('updated_by', 'name userID')
        .lean(),
      Transaction.find(txFilter)
        .sort({ collect_date: -1 })
        .limit(50)
        .populate({ path: 'agent_id', populate: { path: 'user_id', select: 'userID name' } })
        .lean(),
    ])

    let events = [
      ...auditLogs.map((log) => ({
        id: String(log._id),
        description: log.description || `Event logged in ${log.collection_name}`,
        timestamp: log.updated_date ? new Date(log.updated_date).toISOString() : new Date().toISOString(),
        date: log.updated_date ? new Date(log.updated_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        time: log.updated_date ? new Date(log.updated_date).toLocaleTimeString('en-GB') : '14:22:09',
        source: log.collection_name === 'transactions' ? 'System Core' : log.collection_name === 'customers' ? 'Route Manager' : 'Audit Watchdog',
        type:
          log.description?.toLowerCase().includes('breach') || log.description?.toLowerCase().includes('warn')
            ? 'warning'
            : log.action === 'SUSPEND' ? 'danger' : 'info',
        user: log.updated_by?.name || null,
      })),
      ...settlements.map((tx) => ({
        id: String(tx._id),
        description: `Vault Settlement: ${tx.agent_id?.user_id?.userID || 'ACT-0988'} deposited ${money(tx.transact_amt)} cash to teller #2`,
        timestamp: tx.collect_date ? new Date(tx.collect_date).toISOString() : new Date().toISOString(),
        date: tx.collect_date ? new Date(tx.collect_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        time: tx.collect_date ? new Date(tx.collect_date).toLocaleTimeString('en-GB') : '11:15:48',
        source: 'Teller Central',
        type: 'settlement',
        user: tx.agent_id?.user_id?.name || null,
      })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    if (type && type !== 'all') {
      events = events.filter((e) => e.type === type)
    }

    res.json({ events })
  } catch (error) {
    console.error('Get audit events error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Unable to load audit events' })
  }
}
