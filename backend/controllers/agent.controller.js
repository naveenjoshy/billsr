import { HTTP_STATUS, MESSAGES } from '../constants/httpConstants.js'
import { Agent } from '../models/Agent.js'
import { Bank } from '../models/Bank.js'
import { Customer } from '../models/Customer.js'
import '../models/Scheme.js'
import { Transaction } from '../models/Transaction.js'
import { User } from '../models/User.js'

const DAY_MS = 24 * 60 * 60 * 1000
const num = (value) => (value == null ? 0 : Number(value.toString()))

const sumBy = (rows, type) => rows.filter((row) => row.transact_type === type).reduce((sum, row) => sum + num(row.transact_amt), 0)

export async function getAgentHome(req, res) {
  const agent = await Agent.findOne({ user_id: req.auth.sub }).lean()
  if (!agent) return res.status(HTTP_STATUS.NOT_FOUND).json({ message: MESSAGES.AGENT.NO_PROFILE })

  const [user, bank] = await Promise.all([
    User.findById(req.auth.sub).select('userID name').lean(),
    Bank.findById(agent.bank_id).select('bank_name').lean(),
  ])

  const now = Date.now()
  const holdingDays = Math.max(agent.cash_holding_days ?? 1, 1)
  const since = new Date(now - holdingDays * DAY_MS)
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [windowRows, todayRows, customerCount, todayDocs] = await Promise.all([
    Transaction.find({
      agent_id: agent._id,
      transact_mode: 'C',
      transaction_status: { $ne: 'C' },
      collect_date: { $gte: since },
    })
      .select('transact_type transact_amt collect_date')
      .lean(),
    Transaction.find({
      agent_id: agent._id,
      transaction_status: { $ne: 'C' },
      collect_date: { $gte: startOfDay },
    })
      .select('transact_type transact_amt')
      .lean(),
    Customer.countDocuments({ agent_id: agent._id }),
    Transaction.find({ agent_id: agent._id, collect_date: { $gte: startOfDay } })
      .sort({ collect_date: -1 })
      .limit(20)
      .populate('customer_id', 'name shop_name')
      .populate('scheme_id', 'scheme_name')
      .lean(),
  ])

  const held = Math.max(sumBy(windowRows, 'D') - sumBy(windowRows, 'W'), 0)
  const limit = num(agent.cash_holding_limit)
  const oldest = windowRows.reduce((min, row) => Math.min(min, new Date(row.collect_date).getTime()), now)
  const dayNumber = windowRows.length ? Math.min(Math.floor((now - oldest) / DAY_MS) + 1, holdingDays) : 1

  const collected = sumBy(todayRows, 'D')
  const payouts = sumBy(todayRows, 'W')
  const visited = new Set(todayDocs.filter((t) => t.transaction_status !== 'C').map((t) => String(t.customer_id?._id)))

  res.json({
    agent: {
      name: user?.name ?? 'Agent',
      userID: user?.userID ?? '',
      photoUrl: agent.agent_photo_url ?? null,
      bankName: bank?.bank_name ?? '',
    },
    cashHold: {
      held,
      limit,
      utilization: limit > 0 ? Math.min((held / limit) * 100, 999) : 0,
      remaining: Math.max(limit - held, 0),
      dayNumber,
      holdingDays,
    },
    today: { collected, payouts, net: collected - payouts },
    queue: {
      customers: customerCount,
      visited: visited.size,
      items: todayDocs.map((t) => ({
        _id: String(t._id),
        customer: t.customer_id?.shop_name || t.customer_id?.name || 'Customer',
        scheme: t.scheme_id?.scheme_name ?? '',
        type: t.transact_type,
        amount: num(t.transact_amt),
        receiptNo: t.receipt_no,
        status: t.transaction_status,
        at: t.collect_date,
      })),
    },
  })
}
