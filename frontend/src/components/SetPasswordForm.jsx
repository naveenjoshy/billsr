import { useState } from 'react'
import passwordIcon from '../assets/password-icon.svg'
import FormField from './FormField'

const RULES = [
  { label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { label: 'A capital letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'A small letter', test: (value) => /[a-z]/.test(value) },
  { label: 'A number', test: (value) => /[0-9]/.test(value) },
  { label: 'A symbol', test: (value) => /[^A-Za-z0-9\s]/.test(value) },
]

export default function SetPasswordForm({ user, onSubmit, onCancel }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const strong = RULES.every((rule) => rule.test(newPassword)) && !/\s/.test(newPassword)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatusMessage('')
    if (!strong) {
      setStatusMessage('Password does not meet all the requirements.')
      return
    }
    if (newPassword !== confirmPassword) {
      setStatusMessage('Passwords do not match.')
      return
    }
    setIsSubmitting(true)
    try {
      await onSubmit(newPassword, confirmPassword)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to set the password.')
      setIsSubmitting(false)
    }
  }

  return (
    <section className="login-card" aria-labelledby="portal-title">
      <header className="reset-header">
        <h1 id="portal-title">Set a New Password</h1>
        <p>
          Welcome{user?.name ? `, ${user.name}` : ''}. This is your first sign-in, so please
          replace the temporary password with a secure one.
        </p>
      </header>

      <form className="login-form reset-form" onSubmit={handleSubmit}>
        <FormField htmlFor="first-new-password" icon={passwordIcon} label="New password">
          <input
            autoComplete="new-password"
            disabled={isSubmitting}
            id="first-new-password"
            maxLength={72}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
            value={newPassword}
          />
        </FormField>
        <FormField htmlFor="first-confirm-password" icon={passwordIcon} label="Confirm password">
          <input
            autoComplete="new-password"
            disabled={isSubmitting}
            id="first-confirm-password"
            maxLength={72}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </FormField>

        <ul className="password-rules" aria-label="Password requirements">
          {RULES.map((rule) => (
            <li className={rule.test(newPassword) ? 'is-met' : ''} key={rule.label}>
              {rule.test(newPassword) ? '✓' : '•'} {rule.label}
            </li>
          ))}
        </ul>

        {statusMessage && (
          <p aria-live="polite" className="form-status reset-status">{statusMessage}</p>
        )}

        <button className="submit-button" disabled={isSubmitting} type="submit">
          <span>{isSubmitting ? 'Saving...' : 'Set password & continue'}</span>
        </button>
      </form>

      <div className="reset-footer">
        <button className="login-link-button" disabled={isSubmitting} onClick={onCancel} type="button">
          Cancel and sign out
        </button>
      </div>
    </section>
  )
}
