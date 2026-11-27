// frontend/src/pages/AgentLoginPage.jsx
import { useState } from 'react'
import billsrLogo from '../assets/agent-login/billsr-logo.png'
import agentIcon from '../assets/agent-login/agent-icon.svg'
import eyeOpen from '../assets/agent-login/eye-open.svg'
import eyeClosed from '../assets/agent-login/eye-closed.svg'
import arrowRight from '../assets/agent-login/arrow-right.svg'
import phoneIcon from '../assets/agent-login/phone.svg'
import { loginUser } from '../services/authService'
import './AgentLoginPage.css'

export default function AgentLoginPage({ onAuthenticated, onSwitchPortal }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const cleanUsername = username.trim()
    if (!cleanUsername || !password) {
      setStatusMessage('Please enter both username and password.')
      return
    }

    setIsSubmitting(true)
    setStatusMessage('Verifying credentials...')

    try {
      const user = await loginUser(cleanUsername, password)

      if (user.role !== 'Agent') {
        setStatusMessage('This portal is strictly for Field Collection Agents. Please use the Bank / Admin portal.')
        setIsSubmitting(false)
        return
      }

      setStatusMessage('')
      if (onAuthenticated) {
        onAuthenticated(user)
      }
    } catch (err) {
      setStatusMessage(
        err instanceof Error
          ? err.message
          : 'Unable to authenticate. Please check your agent credentials.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="agent-login-page" data-node-id="4:787">
      <div className="agent-login-container" data-node-id="4:788">
        {/* 1. Header Branding Module */}
        <div className="agent-brand-header" data-node-id="4:789">
          <img
            src={billsrLogo}
            alt="Billsr Field Banking Platform"
            className="agent-brand-logo"
            data-node-id="4:791"
          />
        </div>

        {/* 2. Main Login Form Card */}
        <section
          className="agent-login-card"
          aria-labelledby="agent-login-heading"
          data-node-id="4:833"
        >
          {/* Card Header */}
          <div className="agent-card-title-row" data-node-id="4:834">
            <div className="agent-icon-badge" data-node-id="4:835">
              <img src={agentIcon} alt="" aria-hidden="true" />
            </div>
            <h2 id="agent-login-heading" className="agent-card-heading" data-node-id="4:838">
              Agent Login
            </h2>
          </div>

          <form className="agent-form-body" onSubmit={handleSubmit}>
            <p className="agent-instruction-label" data-node-id="4:842">
              Enter Username and Password
            </p>

            {/* Username Field */}
            <div className="agent-input-group" data-node-id="4:845">
              <label htmlFor="agent-username" className="visually-hidden" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
                Agent Username or ID
              </label>
              <div className="agent-input-wrap" data-node-id="4:846">
                <input
                  id="agent-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder="SMS-94021"
                  required
                  disabled={isSubmitting}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  data-node-id="4:848"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="agent-input-group" data-node-id="40:3">
              <label htmlFor="agent-password" className="agent-field-label" data-node-id="40:5">
                Password
              </label>
              <div className="agent-input-wrap has-toggle" data-node-id="40:6">
                <input
                  id="agent-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-node-id="40:9"
                />
                <button
                  type="button"
                  className="agent-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                  data-node-id="40:10"
                >
                  <img
                    src={showPassword ? eyeClosed : eyeOpen}
                    alt=""
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            {statusMessage && (
              <p className="agent-status-msg" role="alert" aria-live="polite">
                {statusMessage}
              </p>
            )}

            {/* 3. Primary Action Button */}
            <button
              type="submit"
              className="agent-login-btn"
              disabled={isSubmitting}
              data-node-id="4:928"
            >
              <span>{isSubmitting ? 'Verifying...' : 'Login to Agent Dashboard'}</span>
              <img
                src={arrowRight}
                alt=""
                className="agent-btn-arrow"
                aria-hidden="true"
                data-node-id="4:932"
              />
            </button>
          </form>
        </section>

        {/* 4. Support and Diagnostic Footer */}
        <footer className="agent-support-footer" data-node-id="4:936">
          <a
            href="tel:8330025579"
            className="agent-support-link"
            title="Call Branch Support"
            data-node-id="4:937"
          >
            <img
              src={phoneIcon}
              alt=""
              className="agent-support-phone-icon"
              aria-hidden="true"
              data-node-id="4:938"
            />
            <span data-node-id="4:941">Branch Contact Number (8330025579)</span>
          </a>

          {onSwitchPortal && (
            <button
              type="button"
              className="agent-back-portal-btn"
              onClick={onSwitchPortal}
            >
              Switch to Bank Administrator Portal
            </button>
          )}
        </footer>
      </div>
    </main>
  )
}
