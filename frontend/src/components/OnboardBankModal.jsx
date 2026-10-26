import { useState } from 'react'
import { onboardBank } from '../services/adminService'

const emptyForm = {
  user: { userID: '', name: '', email: '', password: '' },
  bank: {
    bank_name: '',
    address: '',
    phone: '',
    name_ceo: '',
    designation: '',
    license_expiry: '',
    account_status: 'Active',
    grace_period_end: '',
  },
}

const PHONE = /^\+?[0-9][0-9 ()-]{6,19}$/

function validate({ user, bank }) {
  const errors = {}
  const need = (name, section, key, label) => {
    if (!section[key].trim()) errors[`${name}.${key}`] = `${label} is required`
  }
  need('user', user, 'userID', 'User ID')
  need('user', user, 'name', 'Name')
  need('user', user, 'email', 'Email')
  need('bank', bank, 'bank_name', 'Bank name')
  need('bank', bank, 'address', 'Address')
  need('bank', bank, 'phone', 'Phone')
  need('bank', bank, 'license_expiry', 'License expiry')
  if (user.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(user.email.trim())) {
    errors['user.email'] = 'Email is invalid'
  }
  if (user.password.length < 8) errors['user.password'] = 'Password must be at least 8 characters'
  if (bank.phone.trim() && !PHONE.test(bank.phone.trim())) {
    errors['bank.phone'] = 'Phone must be 7–20 digits (may start with +)'
  }
  if (bank.account_status === 'Grace' && !bank.grace_period_end) {
    errors['bank.grace_period_end'] = 'Grace period end is required'
  }
  return errors
}

export default function OnboardBankModal({ onClose, onCreated }) {
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
      <label className="admin-form-field">
        <span>{label}</span>
        <input
          aria-invalid={Boolean(errors[errorKey])}
          value={form[section][key]}
          onChange={setField(section, key)}
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

    const { grace_period_end: graceEnd, ...bank } = form.bank
    setSubmitting(true)
    try {
      const { bank: created } = await onboardBank({
        user: form.user,
        bank: bank.account_status === 'Grace' ? { ...bank, grace_period_end: graceEnd } : bank,
      })
      onCreated(created)
    } catch (error) {
      setErrors(error.fieldErrors ?? {})
      setFormError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-modal-backdrop" role="presentation">
      <form
        aria-labelledby="onboard-title"
        aria-modal="true"
        className="admin-modal"
        noValidate
        onSubmit={submit}
        role="dialog"
      >
        <h2 id="onboard-title">Onboard New Bank Tenant</h2>

        <fieldset>
          <legend>Login details</legend>
          {field('user', 'userID', 'User ID', { autoComplete: 'off', maxLength: 40 })}
          {field('user', 'name', 'Name', { maxLength: 120 })}
          {field('user', 'email', 'Email', { type: 'email', autoComplete: 'off', maxLength: 254 })}
          {field('user', 'password', 'Temporary password', { type: 'password', autoComplete: 'new-password' })}
        </fieldset>

        <fieldset>
          <legend>Bank details</legend>
          {field('bank', 'bank_name', 'Bank name', { maxLength: 160 })}
          {field('bank', 'address', 'Address', { maxLength: 300 })}
          {field('bank', 'phone', 'Phone', { type: 'tel', maxLength: 20 })}
          {field('bank', 'name_ceo', 'CEO name', { maxLength: 120 })}
          {field('bank', 'designation', 'Designation', { maxLength: 120 })}
          {field('bank', 'license_expiry', 'License expiry', { type: 'date' })}
          <label className="admin-form-field">
            <span>Account status</span>
            <select value={form.bank.account_status} onChange={setField('bank', 'account_status')}>
              <option value="Active">Active</option>
              <option value="Grace">Grace</option>
              <option value="Suspended">Suspended</option>
            </select>
          </label>
          {form.bank.account_status === 'Grace' &&
            field('bank', 'grace_period_end', 'Grace period end', { type: 'date' })}
        </fieldset>

        {formError && <p className="admin-form-error" role="alert">{formError}</p>}

        <div className="admin-modal-actions">
          <button className="admin-modal-cancel" disabled={submitting} onClick={onClose} type="button">
            Cancel
          </button>
          <button className="admin-modal-submit" disabled={submitting} type="submit">
            {submitting ? 'Creating…' : 'Create bank'}
          </button>
        </div>
      </form>
    </div>
  )
}
