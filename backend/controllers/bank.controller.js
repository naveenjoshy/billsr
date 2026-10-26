import mongoose from 'mongoose'
import { Agent } from '../models/Agent.js'
import { AuditLog } from '../models/AuditLog.js'
import { Bank } from '../models/Bank.js'
import { Customer } from '../models/Customer.js'
import '../models/Scheme.js'
import { Transaction } from '../models/Transaction.js'
import { User } from '../models/User.js'

const DAY_MS = 24 * 60 * 60 * 1000
const PAGE_SIZE = 5
const RISK_THRESHOLD = 0.8
const num = (value) => (value == null ? 0 : Number(value.toString()))
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function findOwnBank(req, res) {
  const bank = await Bank.findOne({ user_id: req.auth.sub }).lean()
  if (!bank) res.status(404).json({ message: 'No bank is linked to this account' })
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

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const [today, pending, holdings, owner] = await Promise.all([
      Transaction.aggregate([
        { $match: { bank_id: bank._id, collect_date: { $gte: startOfDay }, transaction_status: { $ne: 'C' } } },
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
    res.status(500).json({ message: 'Unable to load dashboard' })
  }
}

export async function listTransactions(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1)
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : ''
    const filter = { bank_id: bank._id }

    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i')
      const customers = await Customer.find({
        bank_id: bank._id,
        $or: [{ name: pattern }, { shop_name: pattern }],
      }).select('_id').lean()
      filter.$or = [{ receipt_no: pattern }, { customer_id: { $in: customers.map((c) => c._id) } }]
    }

    const [total, rows] = await Promise.all([
      Transaction.countDocuments(filter),
      Transaction.find(filter)
        .sort({ collect_date: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate('customer_id', 'name shop_name address')
        .populate('scheme_id', 'scheme_name')
        .populate({ path: 'agent_id', select: 'user_id', populate: { path: 'user_id', select: 'userID name' } })
        .lean(),
    ])

    const transactions = rows.map((row) => ({
      _id: String(row._id),
      receiptNo: row.receipt_no,
      scheme: row.scheme_id?.scheme_name ?? '—',
      customer: row.customer_id?.name ?? '—',
      customerDetail: [row.customer_id?.shop_name, row.customer_id?.address].filter(Boolean).join(' • '),
      agentName: row.agent_id?.user_id?.name ?? '—',
      agentCode: row.agent_id?.user_id?.userID ?? '',
      amount: num(row.transact_amt),
      type: row.transact_type,
      status: row.transaction_status,
      mode: row.transact_mode,
      collectDate: row.collect_date,
      cancellationReason: row.cancellation_info?.cancellation_reason ?? null,
    }))

    res.json({ transactions, total, page, pageSize: PAGE_SIZE })
  } catch (error) {
    console.error('List transactions error:', error)
    res.status(500).json({ message: 'Unable to load transactions' })
  }
}

export async function approveTransaction(req, res) {
  try {
    const bank = await findOwnBank(req, res)
    if (!bank) return
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid transaction id' })
    }

    // Atomic status guard so a transaction can only be approved once.
    const updated = await Transaction.findOneAndUpdate(
      { _id: req.params.id, bank_id: bank._id, transaction_status: 'P' },
      { $set: { transaction_status: 'A' } },
      { new: true },
    ).lean()
    if (!updated) {
      return res.status(409).json({ message: 'Transaction not found or no longer pending' })
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
    res.status(500).json({ message: 'Unable to approve transaction' })
  }
}
