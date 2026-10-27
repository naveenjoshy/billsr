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
const money = (val) => '$' + Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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

    const baseDate = req.query.date ? new Date(req.query.date) : new Date()
    const targetDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

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
        { $match: { bank_id: bank._id, transaction_status: 'P' } },
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
    if (req.query.date) {
      const selectedDate = new Date(req.query.date)
      if (!Number.isNaN(selectedDate.getTime())) {
        const startOfDay = new Date(selectedDate)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(selectedDate)
        endOfDay.setHours(23, 59, 59, 999)
        filter.collect_date = { $gte: startOfDay, $lte: endOfDay }
      }
    } else if (req.query.dateRange === 'today') {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      filter.collect_date = { $gte: startOfDay }
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
        .sort({ collect_date: -1 })
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

const APPROACH_THRESHOLD = 0.85

export async function listAgents(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

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
            { $match: { ...base, collect_date: { $gte: startOfDay } } },
            { $group: { _id: '$transact_type', count: { $sum: 1 } } },
          ]),
          Transaction.countDocuments(base),
          Customer.countDocuments({ agent_id: agent._id }),
          Transaction.find({ agent_id: agent._id, bank_id: bank._id })
            .sort({ collect_date: -1 })
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

        const branchName =
          agent.branch_name ||
          (agent.address && agent.address.includes(',') ? agent.address.split(',')[0].trim() : 'Central Market')
        const routeCode = `Route #CM-${(agent.user_id?.userID || String(agent._id)).slice(-2).toUpperCase()}`

        return {
          _id: String(agent._id),
          agentCode: agent.user_id?.userID ?? String(agent._id).slice(-6).toUpperCase(),
          name: agent.user_id?.name ?? 'Unknown agent',
          email: agent.user_id?.email ?? null,
          isActive: agent.user_id?.is_active !== false,
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
          todayDeposits: todayBy.D ?? 0,
          todayWithdrawals: todayBy.W ?? 0,
          totalReceipts: (todayBy.D ?? 0) + (todayBy.W ?? 0) || totalReceipts,
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
        $or: [{ collection_name: 'agents' }, { collection_name: 'transactions' }],
      })
        .sort({ updated_date: -1 })
        .limit(6)
        .lean(),
      Transaction.find({ bank_id: bank._id, transact_type: 'D' })
        .sort({ collect_date: -1 })
        .limit(4)
        .populate('agent_id', 'user_id')
        .populate({ path: 'agent_id', populate: { path: 'user_id', select: 'userID name' } })
        .lean(),
    ])

    const auditEvents = [
      ...recentAuditLogs.map((log) => ({
        id: String(log._id),
        description: log.description || `Event logged in ${log.collection_name}`,
        time: log.updated_date ? new Date(log.updated_date).toLocaleTimeString('en-GB') : '14:22:09',
        source: log.collection_name === 'transactions' ? 'System Core' : 'Audit Watchdog',
        type:
          log.description?.toLowerCase().includes('breach') || log.description?.toLowerCase().includes('warn')
            ? 'warning'
            : 'info',
      })),
      ...recentSettlements.map((tx) => ({
        id: String(tx._id),
        description: `Vault Settlement: ${tx.agent_id?.user_id?.userID || 'ACT-0988'} deposited ${money(tx.transact_amt)} cash to teller #2`,
        time: tx.collect_date ? new Date(tx.collect_date).toLocaleTimeString('en-GB') : '11:15:48',
        source: 'Teller Central',
        type: 'settlement',
      })),
    ].slice(0, 5)

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
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Agent not found' })
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

    res.json({ message: 'Agent limit updated successfully', agent })
  } catch (error) {
    console.error('Update agent limit error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Failed to update agent limit' })
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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Unable to load financial schemes.' })
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Scheme name is required.' })
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
      message: `Scheme "${scheme.scheme_name}" created successfully.`,
      scheme: {
        ...scheme.toObject(),
        _id: String(scheme._id),
        enrolledCustomersCount: 0,
        activeTransactionsCount: 0,
      },
    })
  } catch (error) {
    console.error('Create scheme error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Unable to create financial scheme.' })
  }
}

export async function updateScheme(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Invalid scheme ID.' })
    }

    const scheme = await Scheme.findOne({ _id: id, bank_id: bank._id })
    if (!scheme) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Scheme not found.' })
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
      message: `Scheme "${scheme.scheme_name}" updated successfully.`,
      scheme: scheme.toObject(),
    })
  } catch (error) {
    console.error('Update scheme error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Unable to update scheme.' })
  }
}

export async function deleteScheme(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Invalid scheme ID.' })
    }

    const scheme = await Scheme.findOne({ _id: id, bank_id: bank._id })
    if (!scheme) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Scheme not found.' })
    }

    const [enrolledCount, txCount] = await Promise.all([
      CustomerScheme.countDocuments({ scheme_id: id }),
      Transaction.countDocuments({ scheme_id: id }),
    ])
    if (enrolledCount > 0 || txCount > 0) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        message: `Cannot delete "${scheme.scheme_name}". It is bound to active customer accounts or transactions. Suspend it instead.`,
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

    res.json({ message: `Scheme "${name}" deleted successfully.` })
  } catch (error) {
    console.error('Delete scheme error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Unable to delete scheme.' })
  }
}
