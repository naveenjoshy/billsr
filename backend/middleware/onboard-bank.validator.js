import { HTTP_STATUS, MESSAGES } from '../constants/httpConstants.js'
import { Bank } from '../models/Bank.js'
import { User } from '../models/User.js'
import {
  fieldFromSchema,
  getUserSpec,
  PHONE,
  validatePassword,
  validateSection,
} from './validate.js'

const userSpec = getUserSpec(User)

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
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.GENERAL.VALIDATION_ERROR, errors })
  }

  req.onboarding = { user: { ...user.output, password }, bank: bank.output }
  next()
}
