import { useState } from 'react'
import emailIcon from '../assets/email-icon.svg'
import passwordIcon from '../assets/password-icon.svg'
import FormField from './FormField'

export default function PasswordResetForm({ onBack, onVerify, onReset }) {
  const [step, setStep] = useState('verify')
  const [email, setEmail] = useState('')
  const [userID, setUserID] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleVerify = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setStatusMessage('')
    try {
      await onVerify(email, userID)
      setStep('password')
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Unable to verify account details.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = async (event) => {
    event.preventDefault()
    setStatusMessage('')

    if (newPassword !== confirmPassword) {
      setStatusMessage('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      await onReset(email, userID, newPassword, confirmPassword)
      setStatusMessage('Password reset successfully. You can now sign in.')
      setNewPassword('')
      setConfirmPassword('')
      setStep('complete')
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Unable to reset the password.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="login-card" aria-labelledby="portal-title">
      <header className="reset-header">
        <h1 id="portal-title">Reset Password</h1>
        <p>
          {step === 'verify'
            ? 'Verify your account with your email and user ID.'
            : step === 'password'
              ? 'Choose a new password for your account.'
              : 'Your password has been updated.'}
        </p>
      </header>

      {step === 'verify' && (
        <form className="login-form reset-form" onSubmit={handleVerify}>
          <FormField htmlFor="reset-email" icon={emailIcon} label="Email ID">
            <input
              autoComplete="email"
              disabled={isSubmitting}
              id="reset-email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              required
              type="email"
              value={email}
            />
          </FormField>

          <FormField htmlFor="reset-user-id" label="User ID">
            <input
              autoComplete="username"
              disabled={isSubmitting}
              id="reset-user-id"
              name="userID"
              onChange={(event) => setUserID(event.target.value)}
              placeholder="Enter your user ID"
              required
              type="text"
              value={userID}
            />
          </FormField>

          {statusMessage && (
            <p aria-live="polite" className="form-status reset-status">
              {statusMessage}
            </p>
          )}

          <button className="submit-button" disabled={isSubmitting} type="submit">
            <span>{isSubmitting ? 'Verifying...' : 'Verify account'}</span>
          </button>
        </form>
      )}

      {step === 'password' && (
        <form className="login-form reset-form" onSubmit={handleReset}>
          <p className="reset-verified-account">
            Verified account: <strong>{email}</strong> <span>({userID})</span>
          </p>
          <FormField htmlFor="new-password" icon={passwordIcon} label="New password">
            <input
              autoComplete="new-password"
              disabled={isSubmitting}
              id="new-password"
              minLength={8}
              name="newPassword"
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </FormField>
          <FormField
            htmlFor="confirm-password"
            icon={passwordIcon}
            label="Confirm password"
          >
            <input
              autoComplete="new-password"
              disabled={isSubmitting}
              id="confirm-password"
              minLength={8}
              name="confirmPassword"
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </FormField>
          <p className="reset-password-hint">Use at least 8 characters.</p>

          {statusMessage && (
            <p aria-live="polite" className="form-status reset-status">
              {statusMessage}
            </p>
          )}

          {step === 'password' && (
            <button className="submit-button" disabled={isSubmitting} type="submit">
              <span>{isSubmitting ? 'Updating...' : 'Reset password'}</span>
            </button>
          )}
        </form>
      )}

      {step === 'complete' && (
        <div className="login-form reset-form">
          <p aria-live="polite" className="form-status reset-status">
            {statusMessage}
          </p>
          <button
            className="submit-button"
            onClick={onBack}
            type="button"
          >
            <span>Back to login</span>
          </button>
        </div>
      )}

      {step !== 'complete' && (
        <div className="reset-footer">
          {step === 'password' && (
            <button
              className="login-link-button"
              disabled={isSubmitting}
              onClick={() => {
                setStep('verify')
                setStatusMessage('')
                setNewPassword('')
                setConfirmPassword('')
              }}
              type="button"
            >
              Change account details
            </button>
          )}
          <button
            className="login-link-button"
            disabled={isSubmitting}
            onClick={onBack}
            type="button"
          >
            Back to login
          </button>
        </div>
      )}
    </section>
  )
}
