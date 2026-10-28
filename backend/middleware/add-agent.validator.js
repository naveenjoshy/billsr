import { HTTP_STATUS, MESSAGES } from '../constants/httpConstants.js'
import { Agent } from '../models/Agent.js'
import { User } from '../models/User.js'
import {
  fieldFromSchema,
  getUserSpec,
  PHONE,
  validatePassword,
  validateSection,
} from './validate.js'

const HTTP_URL = /^https?:\/\/[^\s]+$/i

const userSpec = getUserSpec(User)

const urlOverrides = (label) => ({
  label, required: false, max: 500, pattern: HTTP_URL, message: `${label} must be an http(s) link`,
})

// bank_id and user_id are never accepted from the client; they are set by the server.
const agentSpec = {
  address: fieldFromSchema(Agent, 'address', { label: 'Address', max: 300 }),
  phone_no: fieldFromSchema(Agent, 'phone_no', {
    label: 'Phone', pattern: PHONE, message: 'Phone must be 7–20 digits (may start with +)',
  }),
  agent_id_type: fieldFromSchema(Agent, 'agent_id_type', { label: 'ID type', required: false, max: 60 }),
  agent_id_number: fieldFromSchema(Agent, 'agent_id_number', { label: 'ID number', required: false, max: 60 }),
  agent_photo_url: fieldFromSchema(Agent, 'agent_photo_url', urlOverrides('Photo link')),
  agent_id_url: fieldFromSchema(Agent, 'agent_id_url', urlOverrides('ID document link')),
  cash_holding_limit: fieldFromSchema(Agent, 'cash_holding_limit', {
    label: 'Cash holding limit', minValue: 0.01, maxValue: 100000000,
  }),
  cash_holding_days: fieldFromSchema(Agent, 'cash_holding_days', {
    label: 'Cash holding days', integer: true, minValue: 1, maxValue: 365,
  }),
}

export function validateAddAgent(req, res, next) {
  const body = req.body ?? {}
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  // The password is validated separately so it is never altered by text sanitizing.
  const { password, ...userRest } = isObject(body.user) ? body.user : { user: body.user }

  const user = validateSection(userRest, userSpec, 'user')
  const agent = validateSection(body.agent, agentSpec, 'agent')
  const errors = { ...user.errors, ...agent.errors }

  for (const key of Object.keys(body)) {
    if (key !== 'user' && key !== 'agent') errors[key] = 'Unexpected field'
  }
  validatePassword(password, errors)

  if (Object.keys(errors).length) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: MESSAGES.GENERAL.VALIDATION_ERROR, errors })
  }

  req.newAgent = { user: { ...user.output, password }, agent: agent.output }
  next()
}
