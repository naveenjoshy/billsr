import mongoose from 'mongoose'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import { Bank } from '../models/Bank.js'
import { User } from '../models/User.js'
import { Agent } from '../models/Agent.js'
import { Scheme } from '../models/Scheme.js'
import { Customer } from '../models/Customer.js'
import { CustomerScheme } from '../models/CustomerScheme.js'
import { Transaction } from '../models/Transaction.js'

dotenv.config({ path: 'backend/.env.local' })

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB })
    console.log('Connected to MongoDB')

    const bank = await Bank.findOne().lean()
    if (!bank) {
      console.error('No bank found in DB')
      process.exit(1)
    }

    console.log(`Seeding for bank: ${bank.bank_name} (${bank._id})`)

    // 1. Schemes
    const schemeDefs = [
      {
        scheme_name: 'MBS Daily',
        scheme_description: 'Daily Pigmy collection scheme for retail shop owners',
        status: 'A',
        permitted_operation: 'A',
      },
      {
        scheme_name: 'Recurring RD',
        scheme_description: 'Standard 365-day recurring deposit scheme',
        status: 'A',
        permitted_operation: 'A',
      },
      {
        scheme_name: 'Savings',
        scheme_description: 'Flexible daily savings deposit account',
        status: 'A',
        permitted_operation: 'A',
      },
      {
        scheme_name: 'Micro-Loan EMI',
        scheme_description: 'Daily micro-credit installment collection',
        status: 'A',
        permitted_operation: 'A',
      },
    ]

    const schemes = []
    for (const def of schemeDefs) {
      let scheme = await Scheme.findOne({ bank_id: bank._id, scheme_name: def.scheme_name })
      if (!scheme) {
        scheme = await Scheme.create({ ...def, bank_id: bank._id })
      }
      schemes.push(scheme)
    }
    console.log(`Ensured ${schemes.length} schemes`)

    // 2. Agents
    const agentDefs = [
      { name: 'Ramesh Iyer', userID: 'AGT-1021', email: 'ramesh.iyer@dvlmbank.com', phone: '9847012345', limit: 250000, days: 3 },
      { name: 'Pooja Hegde', userID: 'AGT-1044', email: 'pooja.hegde@dvlmbank.com', phone: '9847054321', limit: 300000, days: 4 },
      { name: 'Suresh Nair', userID: 'AGT-1008', email: 'suresh.nair@dvlmbank.com', phone: '9847098765', limit: 200000, days: 2 },
      { name: 'Deepak Verma', userID: 'AGT-1090', email: 'deepak.verma@dvlmbank.com', phone: '9847087654', limit: 150000, days: 3 },
    ]

    const agents = []
    for (const def of agentDefs) {
      let user = await User.findOne({ userID: def.userID })
      if (!user) {
        user = await User.create({
          userID: def.userID,
          name: def.name,
          email: def.email,
          password_hash: await bcrypt.hash('Agent@1234', 10),
          role: 'Agent',
          is_active: true,
        })
      }
      let agent = await Agent.findOne({ user_id: user._id, bank_id: bank._id })
      if (!agent) {
        agent = await Agent.create({
          user_id: user._id,
          bank_id: bank._id,
          address: 'Taluk Office Road, Adimali',
          phone_no: def.phone,
          cash_holding_limit: def.limit,
          cash_holding_days: def.days,
          password_reset_flag: false,
        })
      }
      agents.push({ agent, user })
    }
    console.log(`Ensured ${agents.length} agents`)

    // 3. Customers
    const customerDefs = [
      { name: 'Sharma General Store', shop_name: 'Shop #12', address: 'Sector 4 Market', phone: '9447110001', custId: '1042', agentIdx: 0 },
      { name: 'Laxmi Textiles', shop_name: 'Laxmi Plaza', address: 'Main Bazaar', phone: '9447110002', custId: '1088', agentIdx: 1 },
      { name: 'Mehta Electronics', shop_name: 'Mehta Arcade', address: 'Station Road', phone: '9447110003', custId: '1104', agentIdx: 2 },
      { name: 'Gupta Kirana', shop_name: 'Gupta Stores', address: 'Market Junction', phone: '9447110004', custId: '1012', agentIdx: 3 },
      { name: 'Anand Provision Store', shop_name: 'Anand Corner', address: 'Gandhi Road', phone: '9447110005', custId: '1240', agentIdx: 0 },
      { name: 'Patel Hardware & Paints', shop_name: 'Patel Complex', address: 'Highway Ring Road', phone: '9447110006', custId: '1332', agentIdx: 2 },
      { name: 'Kerala Spice Traders', shop_name: 'Spices Depot', address: 'Market Road', phone: '9447110007', custId: '1410', agentIdx: 1 },
      { name: 'City Bakery & Sweets', shop_name: 'City Bakers', address: 'Bus Stand Corner', phone: '9447110008', custId: '1455', agentIdx: 0 },
      { name: 'Metro Medicals', shop_name: 'Metro Pharmacy', address: 'Hospital Road', phone: '9447110009', custId: '1520', agentIdx: 2 },
      { name: 'Highland Tea Stall', shop_name: 'Highland Point', address: 'Hill Top Junction', phone: '9447110010', custId: '1580', agentIdx: 3 },
    ]

    const customers = []
    for (const def of customerDefs) {
      let cust = await Customer.findOne({ bank_id: bank._id, phone: def.phone })
      if (!cust) {
        cust = await Customer.create({
          bank_id: bank._id,
          agent_id: agents[def.agentIdx].agent._id,
          name: def.name,
          shop_name: def.shop_name,
          address: def.address,
          phone: def.phone,
          location: { type: 'Point', coordinates: [76.95, 10.02] },
        })
      }
      customers.push({ cust, custId: def.custId })
    }
    console.log(`Ensured ${customers.length} customers`)

    // 4. Enroll Customers in Schemes
    for (let i = 0; i < customers.length; i++) {
      const scheme = schemes[i % schemes.length]
      const existing = await CustomerScheme.findOne({ customer_id: customers[i].cust._id, scheme_id: scheme._id })
      if (!existing) {
        await CustomerScheme.create({
          customer_id: customers[i].cust._id,
          scheme_id: scheme._id,
          scheme_opening_amount: 500,
          monthly_target: 15000,
          remittance_periodicity: 'D',
        })
      }
    }

    // 5. Seed Transactions (Matching Figma exactly)
    await Transaction.deleteMany({ bank_id: bank._id })
    console.log('Cleared old transactions for this bank')

    const now = new Date()
    const todayAt = (h, m) => {
      const d = new Date(now)
      d.setHours(h, m, 0, 0)
      return d
    }

    const txs = [
      {
        receipt_no: 'REC-2026-90412',
        customer_id: customers[0].cust._id, // Sharma General Store
        agent_id: agents[0].agent._id, // Ramesh Iyer
        scheme_id: schemes[0]._id, // MBS Daily
        transact_amt: 850.0,
        transact_type: 'D',
        transaction_status: 'P',
        transact_mode: 'C',
        balance_snapshot: { opening_bal: 3210.0, new_balance: 4060.0 },
        cancellation_info: {
          cancellation_reason:
            'Customer entered duplicate amount by error, cash retained by shop owner. Thermal slip not handed over.',
        },
        collect_date: todayAt(10, 42),
      },
      {
        receipt_no: 'REC-2026-90411',
        customer_id: customers[1].cust._id, // Laxmi Textiles
        agent_id: agents[1].agent._id, // Pooja Hegde
        scheme_id: schemes[1]._id, // Recurring RD
        transact_amt: 1200.0,
        transact_type: 'D',
        transaction_status: 'A',
        transact_mode: 'T',
        balance_snapshot: { opening_bal: 14200.0, new_balance: 15400.0 },
        collect_date: todayAt(10, 39),
      },
      {
        receipt_no: 'REC-2026-90410',
        customer_id: customers[2].cust._id, // Mehta Electronics
        agent_id: agents[2].agent._id, // Suresh Nair
        scheme_id: schemes[2]._id, // Savings
        transact_amt: 500.0,
        transact_type: 'D',
        transaction_status: 'A',
        transact_mode: 'C',
        balance_snapshot: { opening_bal: 8500.0, new_balance: 9000.0 },
        collect_date: todayAt(10, 35),
      },
      {
        receipt_no: 'REC-2026-90409',
        customer_id: customers[3].cust._id, // Gupta Kirana
        agent_id: agents[3].agent._id, // Deepak Verma
        scheme_id: schemes[0]._id, // MBS Daily
        transact_amt: 650.0,
        transact_type: 'W',
        transaction_status: 'C',
        transact_mode: 'C',
        balance_snapshot: { opening_bal: 5650.0, new_balance: 5000.0 },
        cancellation_info: {
          cancellation_reason: 'Voided by Admin. Incorrect withdrawal slip submitted.',
        },
        collect_date: todayAt(10, 14),
      },
      {
        receipt_no: 'REC-2026-90408',
        customer_id: customers[4].cust._id, // Anand Provision Store
        agent_id: agents[0].agent._id, // Ramesh Iyer
        scheme_id: schemes[3]._id, // Micro-Loan EMI
        transact_amt: 400.0,
        transact_type: 'D',
        transaction_status: 'A',
        transact_mode: 'C',
        balance_snapshot: { opening_bal: 2200.0, new_balance: 2600.0 },
        collect_date: todayAt(10, 2),
      },
      {
        receipt_no: 'REC-2026-90407',
        customer_id: customers[5].cust._id, // Patel Hardware & Paints
        agent_id: agents[2].agent._id, // Suresh Nair
        scheme_id: schemes[1]._id, // Recurring RD
        transact_amt: 2100.0,
        transact_type: 'D',
        transaction_status: 'P',
        transact_mode: 'C',
        balance_snapshot: { opening_bal: 11000.0, new_balance: 13100.0 },
        cancellation_info: {
          cancellation_reason:
            'Accidental double-swipe on Android handheld terminal during morning market collection.',
        },
        collect_date: todayAt(9, 58),
      },
      {
        receipt_no: 'REC-2026-90406',
        customer_id: customers[6].cust._id, // Kerala Spice Traders
        agent_id: agents[1].agent._id, // Pooja Hegde
        scheme_id: schemes[0]._id, // MBS Daily
        transact_amt: 3500.0,
        transact_type: 'D',
        transaction_status: 'A',
        transact_mode: 'C',
        balance_snapshot: { opening_bal: 42000.0, new_balance: 45500.0 },
        collect_date: todayAt(9, 45),
      },
      {
        receipt_no: 'REC-2026-90405',
        customer_id: customers[7].cust._id, // City Bakery & Sweets
        agent_id: agents[0].agent._id, // Ramesh Iyer
        scheme_id: schemes[2]._id, // Savings
        transact_amt: 750.0,
        transact_type: 'D',
        transaction_status: 'A',
        transact_mode: 'C',
        balance_snapshot: { opening_bal: 9400.0, new_balance: 10150.0 },
        collect_date: todayAt(9, 30),
      },
      {
        receipt_no: 'REC-2026-90404',
        customer_id: customers[8].cust._id, // Metro Medicals
        agent_id: agents[2].agent._id, // Suresh Nair
        scheme_id: schemes[1]._id, // Recurring RD
        transact_amt: 1850.0,
        transact_type: 'D',
        transaction_status: 'A',
        transact_mode: 'T',
        balance_snapshot: { opening_bal: 24000.0, new_balance: 25850.0 },
        collect_date: todayAt(9, 15),
      },
      {
        receipt_no: 'REC-2026-90403',
        customer_id: customers[9].cust._id, // Highland Tea Stall
        agent_id: agents[3].agent._id, // Deepak Verma
        scheme_id: schemes[3]._id, // Micro-Loan EMI
        transact_amt: 200.0,
        transact_type: 'D',
        transaction_status: 'P',
        transact_mode: 'C',
        balance_snapshot: { opening_bal: 1600.0, new_balance: 1800.0 },
        cancellation_info: {
          cancellation_reason: 'Customer requested amount correction before end-of-day ledger reconciliation.',
        },
        collect_date: todayAt(9, 2),
      },
      {
        receipt_no: 'REC-2026-90402',
        customer_id: customers[0].cust._id, // Sharma General Store
        agent_id: agents[0].agent._id, // Ramesh Iyer
        scheme_id: schemes[2]._id, // Savings
        transact_amt: 1500.0,
        transact_type: 'W',
        transaction_status: 'A',
        transact_mode: 'C',
        balance_snapshot: { opening_bal: 4710.0, new_balance: 3210.0 },
        collect_date: todayAt(8, 45),
      },
      {
        receipt_no: 'REC-2026-90401',
        customer_id: customers[1].cust._id, // Laxmi Textiles
        agent_id: agents[1].agent._id, // Pooja Hegde
        scheme_id: schemes[0]._id, // MBS Daily
        transact_amt: 1000.0,
        transact_type: 'D',
        transaction_status: 'C',
        transact_mode: 'C',
        balance_snapshot: { opening_bal: 13200.0, new_balance: 14200.0 },
        cancellation_info: {
          cancellation_reason: 'Cancelled by Admin. Wrong customer scheme code tagged.',
        },
        collect_date: todayAt(8, 30),
      },
    ]

    for (const t of txs) {
      await Transaction.create({ ...t, bank_id: bank._id })
    }

    console.log(`Successfully seeded ${txs.length} transactions for ${bank.bank_name}!`)
    await mongoose.disconnect()
    process.exit(0)
  } catch (err) {
    console.error('Seed error:', err)
    process.exit(1)
  }
}

seed()
