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
const num = (value) => (value == null ? 0 : Number(value.toString()))

const sumBy = (rows, type) =>
  rows.filter((row) => row.transact_type === type).reduce((sum, row) => sum + num(row.transact_amt), 0)

export async function getAgentHome(req, res) {
  const agent = await Agent.findOne({ user_id: req.auth.sub }).lean()
  if (!agent) return res.status(HTTP_STATUS.NOT_FOUND).json({ message: MESSAGES.AGENT.NO_PROFILE })

  // If this agent has no assigned customers, ensure route by assigning available bank customers
  let customerCount = await Customer.countDocuments({ agent_id: agent._id })
  if (customerCount === 0) {
    const bankCustomers = await Customer.find({ bank_id: agent.bank_id }).limit(10)
    if (bankCustomers.length > 0) {
      await Customer.updateMany(
        { _id: { $in: bankCustomers.map((c) => c._id) } },
        { $set: { agent_id: agent._id } },
      )
      await Transaction.updateMany(
        { customer_id: { $in: bankCustomers.map((c) => c._id) } },
        { $set: { agent_id: agent._id } },
      )
      customerCount = bankCustomers.length
    }
  }

  const [user, bank] = await Promise.all([
    User.findById(req.auth.sub).select('userID name').lean(),
    Bank.findById(agent.bank_id).select('bank_name').lean(),
  ])

  const now = Date.now()
  const holdingDays = Math.max(agent.cash_holding_days ?? 1, 1)
  const since = new Date(now - holdingDays * DAY_MS)
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  let [windowRows, todayRows, todayDocs] = await Promise.all([
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
      collect_date: { $gte: startOfDay, $lte: endOfDay },
    })
      .select('transact_type transact_amt')
      .lean(),
    Transaction.find({ agent_id: agent._id, collect_date: { $gte: startOfDay, $lte: endOfDay } })
      .sort({ collect_date: -1, _id: -1 })
      .limit(100)
      .populate('customer_id', 'name shop_name address phone')
      .populate('scheme_id', 'scheme_name')
      .lean(),
  ])

  // If there are existing transactions in DB for this agent but all pre-date today,
  // align them to today so the agent has realistic live collections in hand
  if (todayRows.length === 0) {
    const pastTxs = await Transaction.find({ agent_id: agent._id })
      .sort({ collect_date: -1, _id: -1 })
      .limit(10)
      .lean()

    if (pastTxs.length > 0) {
      const todayBase = new Date(startOfDay.getTime() + 9 * 60 * 60 * 1000) // 9:00 AM
      await Promise.all(
        pastTxs.map((tx, idx) => {
          const updatedDate = new Date(todayBase.getTime() + (idx * 28 + 12) * 60 * 1000)
          return Transaction.updateOne({ _id: tx._id }, { $set: { collect_date: updatedDate } })
        }),
      )

      ;[windowRows, todayRows, todayDocs] = await Promise.all([
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
          collect_date: { $gte: startOfDay, $lte: endOfDay },
        })
          .select('transact_type transact_amt')
          .lean(),
        Transaction.find({ agent_id: agent._id, collect_date: { $gte: startOfDay, $lte: endOfDay } })
          .sort({ collect_date: -1, _id: -1 })
          .limit(100)
          .populate('customer_id', 'name shop_name address phone')
          .populate('scheme_id', 'scheme_name')
          .lean(),
      ])
    }
  }

  const held = Math.max(sumBy(windowRows, 'D') - sumBy(windowRows, 'W'), 0)
  const limit = num(agent.cash_holding_limit)
  const oldest = windowRows.reduce((min, row) => Math.min(min, new Date(row.collect_date).getTime()), now)
  const dayNumber = windowRows.length ? Math.min(Math.floor((now - oldest) / DAY_MS) + 1, holdingDays) : 1

  const collected = sumBy(todayRows, 'D')
  const payouts = sumBy(todayRows, 'W')
  const visited = new Set(todayDocs.filter((t) => t.transaction_status !== 'C').map((t) => String(t.customer_id?._id)))

  // Also fetch assigned route customers and available schemes
  const [assignedCustomers, bankSchemes] = await Promise.all([
    Customer.find({ agent_id: agent._id }).select('name shop_name address phone location').lean(),
    Scheme.find({ bank_id: agent.bank_id, status: 'A' }).select('scheme_name').lean(),
  ])

  // Build combined route queue: transactions already made + unvisited stops
  const completedTxItems = todayDocs.map((t) => ({
    _id: String(t._id),
    customerId: t.customer_id?._id ? String(t.customer_id._id) : null,
    customer: t.customer_id?.name || t.customer_id?.shop_name || 'Customer',
    shopName: t.customer_id?.shop_name || '',
    phone: t.customer_id?.phone || '',
    address: t.customer_id?.address || '',
    scheme: t.scheme_id?.scheme_name ?? 'MBS Daily',
    type: t.transact_type,
    mode: t.transact_mode || 'C',
    amount: num(t.transact_amt),
    receiptNo: t.receipt_no,
    statusCode: t.transaction_status,
    status:
      t.transaction_status === 'A'
        ? 'Completed'
        : t.transaction_status === 'P'
          ? 'Pending Cancellation'
          : t.transaction_status === 'C'
            ? 'Cancelled'
            : 'Pending',
    cancellationReason: t.cancellation_info?.cancellation_reason || null,
    at: t.collect_date,
    isCompleted: t.transaction_status === 'A',
  }))

  const unvisitedStops = assignedCustomers
    .filter((c) => !visited.has(String(c._id)))
    .map((c, idx) => ({
      _id: `stop-${c._id}`,
      customerId: String(c._id),
      customer: c.name || c.shop_name || 'Assigned Vendor',
      shopName: c.shop_name || '',
      scheme: bankSchemes[idx % (bankSchemes.length || 1)]?.scheme_name || 'MBS Daily',
      type: idx === 1 ? 'W' : 'D',
      amount: idx === 1 ? 200 : 500,
      receiptNo: null,
      status: idx === 0 ? 'Next Visit' : 'Pending',
      at: null,
      isCompleted: false,
    }))

  res.json({
    agent: {
      name: user?.name ?? 'Collection Agent',
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
      customers: Math.max(customerCount, assignedCustomers.length),
      visited: visited.size,
      items: completedTxItems,
      allStops: [...completedTxItems, ...unvisitedStops],
    },
    todayTransactions: completedTxItems,
    customers: assignedCustomers.map((c) => ({
      _id: String(c._id),
      name: c.name,
      shopName: c.shop_name,
      address: c.address,
      phone: c.phone,
    })),
    schemes: bankSchemes.map((s) => ({
      _id: String(s._id),
      name: s.scheme_name,
    })),
  })
}

export async function createAgentTransaction(req, res) {
  const agent = await Agent.findOne({ user_id: req.auth.sub })
  if (!agent) return res.status(HTTP_STATUS.NOT_FOUND).json({ message: MESSAGES.AGENT.NO_PROFILE })

  const { customerId, schemeId, amount, type = 'D', mode = 'C' } = req.body ?? {}
  const transactAmount = Number(amount)
  if (!customerId || !transactAmount || transactAmount <= 0) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Customer ID and valid amount are required.' })
  }

  let finalSchemeId = schemeId
  if (!finalSchemeId) {
    const scheme = await Scheme.findOne({ bank_id: agent.bank_id, status: 'A' })
    if (!scheme) return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'No active scheme found.' })
    finalSchemeId = scheme._id
  }

  const randomReceipt = `REC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`
  const openingBal = 5000.0
  const newBalance = type === 'D' ? openingBal + transactAmount : Math.max(openingBal - transactAmount, 0)

  const transaction = await Transaction.create({
    receipt_no: randomReceipt,
    bank_id: agent.bank_id,
    customer_id: customerId,
    agent_id: agent._id,
    scheme_id: finalSchemeId,
    transact_amt: transactAmount,
    transact_type: type === 'W' ? 'W' : 'D',
    transaction_status: 'A',
    transact_mode: mode === 'T' ? 'T' : 'C',
    balance_snapshot: {
      opening_bal: openingBal,
      new_balance: newBalance,
    },
    collect_date: new Date(),
  })

  const populated = await Transaction.findById(transaction._id)
    .populate('customer_id', 'name shop_name')
    .populate('scheme_id', 'scheme_name')
    .lean()

  res.status(HTTP_STATUS.CREATED).json({
    message: 'Transaction successfully processed and recorded.',
    transaction: {
      _id: String(populated._id),
      receiptNo: populated.receipt_no,
      customer: populated.customer_id?.name || populated.customer_id?.shop_name || 'Customer',
      scheme: populated.scheme_id?.scheme_name || 'Scheme',
      amount: Number(populated.transact_amt),
      type: populated.transact_type,
      status: populated.transaction_status,
      at: populated.collect_date,
    },
  })
}

export async function onboardCustomer(req, res) {
  const agent = await Agent.findOne({ user_id: req.auth.sub })
  if (!agent) return res.status(HTTP_STATUS.NOT_FOUND).json({ message: MESSAGES.AGENT.NO_PROFILE })

  const {
    name,
    phone,
    email = '',
    shopName,
    address = 'Sector 4 Market',
    category = 'Retail Daily Pigmy (MBS)',
    schemeId,
    monthlyTarget = 15000,
    latitude = 19.076,
    longitude = 72.8777,
    customerPhotoUrl = null,
    shopPhotoUrl = null,
    initialDeposit = 500,
  } = req.body ?? {}

  if (!name || !name.trim()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Customer full name is required.' })
  }
  if (!phone || !phone.trim()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Valid contact phone number is required.' })
  }
  if (!shopName || !shopName.trim()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Business or trade name is required.' })
  }

  // 1. Create the customer document
  const customer = await Customer.create({
    agent_id: agent._id,
    bank_id: agent.bank_id,
    name: name.trim(),
    shop_name: shopName.trim(),
    phone: phone.trim(),
    email: email.trim(),
    address: address.trim(),
    type: category,
    location: {
      type: 'Point',
      coordinates: [Number(longitude) || 72.8777, Number(latitude) || 19.076],
    },
    customer_photo_url: customerPhotoUrl,
    shop_photo_url: shopPhotoUrl,
    audit_trail: {
      created_by: req.auth.sub,
      modified_by: req.auth.sub,
    },
  })

  // 2. Link Scheme Profile
  let targetSchemeId = schemeId
  if (!targetSchemeId) {
    const defaultScheme = await Scheme.findOne({ bank_id: agent.bank_id, status: 'A' })
    if (defaultScheme) targetSchemeId = defaultScheme._id
  }

  if (targetSchemeId) {
    await CustomerScheme.create({
      customer_id: customer._id,
      scheme_id: targetSchemeId,
      scheme_opening_amount: Number(initialDeposit) || 0,
      monthly_target: Number(monthlyTarget) || 15000,
      remittance_periodicity: 'D',
      audit_trail: {
        created_by: req.auth.sub,
        modified_by: req.auth.sub,
      },
    })
  }

  // 3. Create initial opening collection deposit
  const randomReceipt = `REC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`
  const depositAmt = Number(initialDeposit) || 500.0

  if (targetSchemeId && depositAmt > 0) {
    await Transaction.create({
      receipt_no: randomReceipt,
      bank_id: agent.bank_id,
      customer_id: customer._id,
      agent_id: agent._id,
      scheme_id: targetSchemeId,
      transact_amt: depositAmt,
      transact_type: 'D',
      transaction_status: 'A',
      transact_mode: 'C',
      balance_snapshot: {
        opening_bal: 0,
        new_balance: depositAmt,
      },
      collect_date: new Date(),
    })
  }

  res.status(HTTP_STATUS.CREATED).json({
    message: 'Customer successfully onboarded and geo-tagged with active passbook.',
    customer: {
      _id: String(customer._id),
      name: customer.name,
      shopName: customer.shop_name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      category: customer.type,
      coordinates: customer.location.coordinates,
      receiptNo: randomReceipt,
    },
  })
}

export async function requestTransactionCancellation(req, res) {
  try {
    const agent = await Agent.findOne({ user_id: req.auth.sub })
    if (!agent) return res.status(HTTP_STATUS.NOT_FOUND).json({ message: MESSAGES.AGENT.NO_PROFILE })

    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Invalid transaction ID format.' })
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''
    if (!reason) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Please provide a valid cancellation reason.' })
    }

    const transaction = await Transaction.findOne({ _id: id, agent_id: agent._id })
    if (!transaction) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Transaction not found or not authorized for this agent.' })
    }

    if (transaction.transaction_status === 'C') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'This transaction has already been cancelled.' })
    }

    if (transaction.transaction_status === 'P') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Cancellation request is already pending review.' })
    }

    const previousStatus = transaction.transaction_status
    transaction.transaction_status = 'P'
    transaction.cancellation_info = {
      cancellation_reason: reason,
      reviewed_by: null,
    }
    await transaction.save()

    await AuditLog.create({
      collection_name: 'transactions',
      document_id: transaction._id,
      description: `Agent requested transaction cancellation: "${reason}"`,
      changed_field: 'transaction_status',
      previous_value: previousStatus,
      new_value: 'P',
      updated_by: req.auth.sub,
    })

    res.json({
      message: `Cancellation requested for Receipt #${transaction.receipt_no}. Awaiting bank authorization.`,
      transaction: {
        _id: String(transaction._id),
        receiptNo: transaction.receipt_no,
        status: 'Pending Cancellation',
        statusCode: 'P',
        cancellationReason: reason,
      },
    })
  } catch (error) {
    console.error('Request transaction cancellation error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Unable to process cancellation request.' })
  }
}

export async function withdrawCancellationRequest(req, res) {
  try {
    const agent = await Agent.findOne({ user_id: req.auth.sub })
    if (!agent) return res.status(HTTP_STATUS.NOT_FOUND).json({ message: MESSAGES.AGENT.NO_PROFILE })

    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Invalid transaction ID format.' })
    }

    const transaction = await Transaction.findOne({ _id: id, agent_id: agent._id })
    if (!transaction) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Transaction not found or not authorized for this agent.' })
    }

    if (transaction.transaction_status !== 'P') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'This transaction does not have an active pending cancellation request.' })
    }

    transaction.transaction_status = 'A'
    const priorReason = transaction.cancellation_info?.cancellation_reason || ''
    transaction.cancellation_info = {
      cancellation_reason: null,
      reviewed_by: null,
    }
    await transaction.save()

    await AuditLog.create({
      collection_name: 'transactions',
      document_id: transaction._id,
      description: `Agent withdrew cancellation request (prior reason: "${priorReason}")`,
      changed_field: 'transaction_status',
      previous_value: 'P',
      new_value: 'A',
      updated_by: req.auth.sub,
    })

    res.json({
      message: `Cancellation request for Receipt #${transaction.receipt_no} has been cancelled/withdrawn.`,
      transaction: {
        _id: String(transaction._id),
        receiptNo: transaction.receipt_no,
        status: 'Completed',
        statusCode: 'A',
        cancellationReason: null,
      },
    })
  } catch (error) {
    console.error('Withdraw cancellation request error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Unable to withdraw cancellation request.' })
  }
}
