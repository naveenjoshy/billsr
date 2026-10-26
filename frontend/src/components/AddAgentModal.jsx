import { useState } from 'react'
import { addAgent } from '../services/bankService'
import './AddAgentModal.css'

const emptyForm = {
  user: { userID: '', name: '', email: '', password: '' },
  agent: {
    address: '',
    phone_no: '',
    agent_id_type: '',
    agent_id_number: '',
    agent_photo_url: '',
    agent_id_url: '',
    cash_holding_limit: '',
    cash_holding_days: '',
  },
}

const PHONE = /^\+?[0-9][0-9 ()-]{6,19}$/
const HTTP_URL = /^https?:\/\/\S+$/i

function validate({ user, agent }) {
  const errors = {}
  const need = (section, data, key, label) => {
    if (!String(data[key]).trim()) errors[`${section}.${key}`] = `${label} is required`
  }
  need('user', user, 'userID', 'User ID')
  need('user', user, 'name', 'Name')
  need('user', user, 'email', 'Email')
  need('agent', agent, 'address', 'Address')
  need('agent', agent, 'phone_no', 'Phone')
  need('agent', agent, 'cash_holding_limit', 'Cash holding limit')
  need('agent', agent, 'cash_holding_days', 'Cash holding days')

  if (user.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(user.email.trim())) {
    errors['user.email'] = 'Email is invalid'
  }
  if (user.password.length < 8) errors['user.password'] = 'Password must be at least 8 characters'
  if (agent.phone_no.trim() && !PHONE.test(agent.phone_no.trim())) {
    errors['agent.phone_no'] = 'Phone must be 7–20 digits (may start with +)'
  }
  const limit = Number(agent.cash_holding_limit)
  if (agent.cash_holding_limit !== '' && !(limit > 0)) {
    errors['agent.cash_holding_limit'] = 'Cash holding limit must be greater than 0'
  }
  const days = Number(agent.cash_holding_days)
  if (agent.cash_holding_days !== '' && !(Number.isInteger(days) && days >= 1 && days <= 365)) {
    errors['agent.cash_holding_days'] = 'Enter a whole number of days (1–365)'
  }
  for (const key of ['agent_photo_url', 'agent_id_url']) {
    if (agent[key].trim() && !HTTP_URL.test(agent[key].trim())) {
      errors[`agent.${key}`] = 'Must be an http(s) link'
    }
  }
  return errors
}

export default function AddAgentModal({ onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const setField = (section, key) => (event) => {
    const { value } = event.target
    setForm((current) => ({ ...current, [section]: { ...current[section], [key]: value } }))
  }

  const field = (section, key, label, props = {}) => {
    const errorKey = `${section}.${key}`
    return (
      <label className="aa-field">
        <span>{label}</span>
        <input
          aria-invalid={Boolean(errors[errorKey])}
          onChange={setField(section, key)}
          value={form[section][key]}
          {...props}
        />
        {errors[errorKey] && <small role="alert">{errors[errorKey]}</small>}
      </label>
    )
  }

  const submit = async (event) => {
    event.preventDefault()
    const found = validate(form)
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length) return

    // Optional blanks are omitted; numeric fields are sent as numbers.
    const agent = {}
    for (const [key, value] of Object.entries(form.agent)) {
      if (String(value).trim() !== '') agent[key] = value
    }
    agent.cash_holding_limit = Number(form.agent.cash_holding_limit)
    agent.cash_holding_days = Number(form.agent.cash_holding_days)

    setSubmitting(true)
    try {
      const { agent: created } = await addAgent({ user: form.user, agent })
      onCreated(created)
    } catch (error) {
      setErrors(error.fieldErrors ?? {})
      setFormError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="aa-backdrop" role="presentation">
      <form
        aria-labelledby="add-agent-title"
        aria-modal="true"
        className="aa-modal"
        noValidate
        onSubmit={submit}
        role="dialog"
      >
        <h2 id="add-agent-title">Add New Agent</h2>

        <fieldset>
          <legend>Login details</legend>
          {field('user', 'userID', 'User ID', { autoComplete: 'off', maxLength: 40 })}
          {field('user', 'name', 'Name', { maxLength: 120 })}
          {field('user', 'email', 'Email', { type: 'email', autoComplete: 'off', maxLength: 254 })}
          {field('user', 'password', 'Temporary password', { type: 'password', autoComplete: 'new-password' })}
        </fieldset>

        <fieldset>
          <legend>Agent details</legend>
          {field('agent', 'phone_no', 'Phone', { type: 'tel', maxLength: 20 })}
          {field('agent', 'address', 'Address', { maxLength: 300 })}
          {field('agent', 'agent_id_type', 'ID type (optional)', { maxLength: 60 })}
          {field('agent', 'agent_id_number', 'ID number (optional)', { maxLength: 60 })}
          {field('agent', 'cash_holding_limit', 'Cash holding limit', { type: 'number', min: '0.01', step: '0.01' })}
          {field('agent', 'cash_holding_days', 'Cash holding days', { type: 'number', min: '1', max: '365', step: '1' })}
          {field('agent', 'agent_photo_url', 'Photo link (optional)', { type: 'url', maxLength: 500 })}
          {field('agent', 'agent_id_url', 'ID document link (optional)', { type: 'url', maxLength: 500 })}
        </fieldset>

        {formError && <p className="aa-error" role="alert">{formError}</p>}

        <div className="aa-actions">
          <button className="aa-cancel" disabled={submitting} onClick={onClose} type="button">Cancel</button>
          <button className="aa-submit" disabled={submitting} type="submit">
            {submitting ? 'Creating…' : 'Create agent'}
          </button>
        </div>
      </form>
    </div>
  )
}
