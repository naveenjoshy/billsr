import { useEffect, useState } from 'react'
import { onboardBank } from '../services/adminService'
import { checkUserIdAvailability } from '../services/authService'
import { PHONE, validateEmail, validateName, validateUserID } from '../utils/validators'

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

function validate({ user, bank }) {
  const errors = {}
  const need = (name, section, key, label) => {
    if (!section[key].trim()) errors[`${name}.${key}`] = `${label} is required`
  }

  const userIdErr = validateUserID(user.userID)
  if (userIdErr) errors['user.userID'] = userIdErr

  const nameErr = validateName(user.name, 'Name')
  if (nameErr) errors['user.name'] = nameErr

  const emailErr = validateEmail(user.email)
  if (emailErr) errors['user.email'] = emailErr

  need('bank', bank, 'bank_name', 'Bank name')
  need('bank', bank, 'address', 'Address')
  need('bank', bank, 'phone', 'Phone')
  need('bank', bank, 'license_expiry', 'License expiry')

  if (bank.name_ceo.trim()) {
    const ceoErr = validateName(bank.name_ceo, 'CEO name')
    if (ceoErr) errors['bank.name_ceo'] = ceoErr
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
        if (section === 'bank' && key === 'account_status' && value !== 'Grace') {
          delete next['bank.grace_period_end']
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
      <label className="admin-form-field">
        <span>{label}</span>
        <input
          aria-invalid={Boolean(errors[errorKey])}
          value={form[section][key]}
          onChange={setField(section, key)}
          onBlur={handleBlur(section, key)}
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

    const { grace_period_end: graceEnd, ...bank } = form.bank
    setSubmitting(true)
    try {
      const checkRes = await checkUserIdAvailability(form.user.userID.trim()).catch(() => null)
      if (checkRes && !checkRes.available) {
        setErrors((prev) => ({ ...prev, 'user.userID': checkRes.message || 'Username is not available' }))
        setSubmitting(false)
        return
      }

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
