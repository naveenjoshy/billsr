import { useEffect, useState } from 'react'
import { addAgent } from '../services/bankService'
import { checkUserIdAvailability } from '../services/authService'
import { HTTP_URL, PHONE, validateEmail, validateName, validateUserID } from '../utils/validators'
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

function validate({ user, agent }) {
  const errors = {}
  const need = (section, data, key, label) => {
    if (!String(data[key]).trim()) errors[`${section}.${key}`] = `${label} is required`
  }

  const userIdErr = validateUserID(user.userID)
  if (userIdErr) errors['user.userID'] = userIdErr

  const nameErr = validateName(user.name, 'Name')
  if (nameErr) errors['user.name'] = nameErr

  const emailErr = validateEmail(user.email)
  if (emailErr) errors['user.email'] = emailErr

  need('agent', agent, 'address', 'Address')
  need('agent', agent, 'phone_no', 'Phone')
  need('agent', agent, 'cash_holding_limit', 'Cash holding limit')
  need('agent', agent, 'cash_holding_days', 'Cash holding days')

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
  const [checkingUserID, setCheckingUserID] = useState(false)
  const [userIdAvailable, setUserIdAvailable] = useState(null)

  useEffect(() => {
    const trimmed = form.user.userID.trim()

    const localErr = validateUserID(trimmed)
    if (localErr) {
      return
    }

    let active = true
    const timer = setTimeout(async () => {
      setCheckingUserID(true)
      try {
        const res = await checkUserIdAvailability(trimmed)
        if (!active) return
        if (!res.available) {
          setUserIdAvailable(false)
          setErrors((prev) => ({
            ...prev,
            'user.userID': res.message || 'Username is not available',
          }))
        } else {
          setUserIdAvailable(true)
          setErrors((prev) => {
            if (
              prev['user.userID'] === 'Username is not available' ||
              prev['user.userID'] === 'This user ID is not available'
            ) {
              const next = { ...prev }
              delete next['user.userID']
              return next
            }
            return prev
          })
        }
      } catch {
        if (!active) return
      } finally {
        if (active) setCheckingUserID(false)
      }
    }, 500)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [form.user.userID])

  const setField = (section, key) => (event) => {
    const { value } = event.target
    if (section === 'user' && key === 'userID') {
      setUserIdAvailable(null)
    }
    const updated = {
      ...form,
      [section]: { ...form[section], [key]: value },
    }
    setForm(updated)

    const errorKey = `${section}.${key}`
    if (Object.keys(errors).length > 0) {
      const fieldErrors = validate(updated)
      setErrors((current) => {
        const next = { ...current }
        if (fieldErrors[errorKey]) {
          next[errorKey] = fieldErrors[errorKey]
        } else {
          delete next[errorKey]
        }
        return next
      })
      if (formError) setFormError('')
    }
  }

  const handleBlur = (section, key) => () => {
    const errorKey = `${section}.${key}`
    const val = String(form[section]?.[key] ?? '').trim()
    if (val !== '') {
      const fieldErrors = validate(form)
      if (fieldErrors[errorKey]) {
        setErrors((current) => ({ ...current, [errorKey]: fieldErrors[errorKey] }))
      }
    }
  }

  const field = (section, key, label, props = {}) => {
    const errorKey = `${section}.${key}`
    const isUserID = section === 'user' && key === 'userID'
    return (
      <label className="aa-field">
        <span>{label}</span>
        <input
          aria-invalid={Boolean(errors[errorKey])}
          onChange={setField(section, key)}
          onBlur={handleBlur(section, key)}
          value={form[section][key]}
          {...props}
        />
        {errors[errorKey] ? (
          <small role="alert">{errors[errorKey]}</small>
        ) : isUserID && checkingUserID ? (
          <small style={{ color: '#64748b' }}>Checking availability…</small>
        ) : isUserID && userIdAvailable ? (
          <small style={{ color: '#16a34a' }}>Username is available</small>
        ) : null}
      </label>
    )
  }

  const submit = async (event) => {
    event.preventDefault()
    const found = validate(form)
    if (
      errors['user.userID'] === 'Username is not available' ||
      errors['user.userID'] === 'This user ID is not available'
    ) {
      found['user.userID'] = errors['user.userID']
    }
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length) return

    setSubmitting(true)
    try {
      const checkRes = await checkUserIdAvailability(form.user.userID.trim()).catch(() => null)
      if (checkRes && !checkRes.available) {
        setErrors((prev) => ({ ...prev, 'user.userID': checkRes.message || 'Username is not available' }))
        setSubmitting(false)
        return
      }

      // Optional blanks are omitted; numeric fields are sent as numbers.
      const agent = {}
      for (const [key, value] of Object.entries(form.agent)) {
        if (String(value).trim() !== '') agent[key] = value
      }
      agent.cash_holding_limit = Number(form.agent.cash_holding_limit)
      agent.cash_holding_days = Number(form.agent.cash_holding_days)

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
