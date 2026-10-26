import { Buffer } from 'node:buffer'
import { Bank } from '../models/Bank.js'
import { User } from '../models/User.js'
import { EMAIL, fieldFromSchema, validateSection } from './validate.js'

const PHONE = /^\+?[0-9][0-9 ()-]{6,19}$/
const USER_ID = /^[A-Za-z0-9._-]+$/

const userSpec = {
  userID: fieldFromSchema(User, 'userID', {
    label: 'User ID', min: 3, max: 40, pattern: USER_ID,
    message: 'User ID may only contain letters, numbers, dot, dash and underscore',
  }),
  name: fieldFromSchema(User, 'name', { label: 'Name', max: 120 }),
  email: fieldFromSchema(User, 'email', {
    label: 'Email', max: 254, pattern: EMAIL, message: 'Email is invalid',
  }),
}

const bankSpec = {
  bank_name: fieldFromSchema(Bank, 'bank_name', { label: 'Bank name', max: 160 }),
  address: fieldFromSchema(Bank, 'address', { label: 'Address', max: 300 }),
  phone: fieldFromSchema(Bank, 'phone', {
    label: 'Phone', pattern: PHONE, message: 'Phone must be 7–20 digits (may start with +)',
  }),
  name_ceo: fieldFromSchema(Bank, 'name_ceo', { label: 'CEO name', max: 120 }),
  designation: fieldFromSchema(Bank, 'designation', { label: 'Designation', max: 120 }),
  license_expiry: fieldFromSchema(Bank, 'license_expiry', { label: 'License expiry' }),
  account_status: fieldFromSchema(Bank, 'compliance_status.account_status', {
    label: 'Account status', required: false,
  }),
  grace_period_end: fieldFromSchema(Bank, 'compliance_status.grace_period_end', {
    label: 'Grace period end',
    required: (input) => input?.account_status === 'Grace',
  }),
}

function validatePassword(password, errors) {
  if (typeof password !== 'string' || password.length < 8) {
    errors['user.password'] = 'Password must be at least 8 characters'
  } else if (Buffer.byteLength(password, 'utf8') > 72) {
    errors['user.password'] = 'Password must be at most 72 bytes'
  }
}

export function validateOnboardBank(req, res, next) {
  const body = req.body ?? {}
  const userIsObject = body.user !== null && typeof body.user === 'object' && !Array.isArray(body.user)
  // The password is validated separately so it is never altered by text sanitizing.
  const { password, ...userRest } = userIsObject ? body.user : { user: body.user }

  const user = validateSection(userRest, userSpec, 'user')
  const bank = validateSection(body.bank, bankSpec, 'bank')
  const errors = { ...user.errors, ...bank.errors }

  for (const key of Object.keys(body)) {
    if (key !== 'user' && key !== 'bank') errors[key] = 'Unexpected field'
  }
  validatePassword(password, errors)

  const { license_expiry: expiry, account_status: status, grace_period_end: graceEnd } = bank.output
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  if (expiry && expiry <= today) errors['bank.license_expiry'] = 'License expiry must be a future date'
  if (status === 'Grace' && graceEnd && graceEnd <= today) {
    errors['bank.grace_period_end'] = 'Grace period end must be a future date'
  }
  if (status !== 'Grace' && graceEnd) {
    errors['bank.grace_period_end'] = 'Grace period end is only allowed when status is Grace'
  }

  if (Object.keys(errors).length) {
    return res.status(400).json({ message: 'Please correct the highlighted fields', errors })
  }

  req.onboarding = { user: { ...user.output, password }, bank: bank.output }
  next()
}
