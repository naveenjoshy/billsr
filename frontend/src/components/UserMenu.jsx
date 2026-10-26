import { useEffect, useRef, useState } from 'react'
import { logoutUser, updateProfile } from '../services/authService'
import './UserMenu.css'

function EditProfileModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ name: user.name ?? '', email: user.email ?? '', currentPassword: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const emailChanged = form.email.trim().toLowerCase() !== (user.email ?? '').toLowerCase()

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    const found = {}
    if (!form.name.trim()) found['profile.name'] = 'Name is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) found['profile.email'] = 'Email is invalid'
    if (emailChanged && !form.currentPassword) found['profile.currentPassword'] = 'Current password is required'
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length) return

    setSaving(true)
    try {
      const payload = { name: form.name, email: form.email }
      if (emailChanged) payload.currentPassword = form.currentPassword
      onSaved(await updateProfile(payload))
    } catch (error) {
      setErrors(error.fieldErrors ?? {})
      setFormError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const field = (key, label, props = {}) => (
    <label className="um-field">
      <span>{label}</span>
      <input
        aria-invalid={Boolean(errors[`profile.${key}`])}
        onChange={set(key)}
        value={form[key]}
        {...props}
      />
      {errors[`profile.${key}`] && <small role="alert">{errors[`profile.${key}`]}</small>}
    </label>
  )

  return (
    <div className="um-backdrop" role="presentation">
      <form aria-labelledby="um-edit-title" aria-modal="true" className="um-modal" noValidate onSubmit={submit} role="dialog">
        <h2 id="um-edit-title">Edit user details</h2>
        <label className="um-field">
          <span>User ID</span>
          <input disabled value={user.userID ?? ''} />
        </label>
        {field('name', 'Name', { maxLength: 120 })}
        {field('email', 'Email', { type: 'email', maxLength: 254, autoComplete: 'off' })}
        {emailChanged &&
          field('currentPassword', 'Current password (required to change email)', {
            type: 'password',
            autoComplete: 'current-password',
          })}
        {formError && <p className="um-error" role="alert">{formError}</p>}
        <div className="um-actions">
          <button className="um-cancel" disabled={saving} onClick={onClose} type="button">Cancel</button>
          <button className="um-save" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  )
}

export default function UserMenu({ user, title, subtitle, onUserUpdated, onLoggedOut, className = '' }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const logout = async () => {
    try {
      await logoutUser()
      onLoggedOut()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className={`um-root ${className}`} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="um-trigger"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="um-trigger-text">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </span>
        <span aria-hidden="true" className="um-caret">▾</span>
      </button>

      {open && (
        <div className="um-menu" role="menu">
          <div className="um-menu-head">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button
            onClick={() => {
              setOpen(false)
              setEditing(true)
            }}
            role="menuitem"
            type="button"
          >
            Edit user details
          </button>
          <button className="um-logout" onClick={logout} role="menuitem" type="button">Log out</button>
          {error && <p className="um-error" role="alert">{error}</p>}
        </div>
      )}

      {editing && (
        <EditProfileModal
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setEditing(false)
            onUserUpdated(updated)
          }}
          user={user}
        />
      )}
    </div>
  )
}
