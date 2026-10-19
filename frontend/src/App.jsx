import { useState } from 'react'
import billsrLogo from './assets/billsr-logo.jpg'
import emailIcon from './assets/email-icon.svg'
import eyeIcon from './assets/eye-icon.svg'
import loginIcon from './assets/login-icon.svg'
import passwordIcon from './assets/password-icon.svg'
import './App.css'

function App() {
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    const f = new FormData(event.currentTarget)
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: f.get('email'), password: f.get('password') }),
    })
    const data = await res.json()
    if (!res.ok) return setStatusMessage(data.message)
    setStatusMessage(`Logged in as ${data.user.name} (${data.user.role})`)
    console.log("Logged in as", data.user.name, "with role", data.user.role)
    // navigate to the dashboard here, e.g. with react-router
  } catch {
    setStatusMessage('Server unreachable')
  }
    
  }

  return (
    <main className="login-page">
      <div className="login-content">
        <section className="login-card" aria-labelledby="portal-title">
          <header className="brand-header">
            <img className="brand-logo" src={billsrLogo} alt="Billsr" />
            <h1 id="portal-title">Billsr Operations Portal</h1>
          </header>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="email">Email ID</label>
              <div className="input-wrap">
                <img className="field-icon" src={emailIcon} alt="" />
                <input
                  autoComplete="username"
                  id="email"
                  name="email"
                  placeholder="admin@devikulamcardbank.in"
                  required
                  type="email"
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="password">Password</label>
              <div className="input-wrap">
                <img className="field-icon" src={passwordIcon} alt="" />
                <input
                  autoComplete="current-password"
                  id="password"
                  name="password"
                  placeholder="••••••••••••"
                  required
                  type={passwordVisible ? 'text' : 'password'}
                />
                <button
                  aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                  aria-pressed={passwordVisible}
                  className="visibility-toggle"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  type="button"
                >
                  <img src={eyeIcon} alt="" />
                </button>
              </div>
            </div>

            <button className="submit-button" type="submit">
              <img src={loginIcon} alt="" />
              <span>Login</span>
            </button>
            <p aria-live="polite" className="form-status">
              {statusMessage}
            </p>
          </form>
        </section>

        <footer className="legal-notice">
          <p>
            &copy; 2025 Billsr Financial Technologies &bull; Daily Collection
            &amp; Pigmy Reconciliation Infrastructure. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  )
}

export default App
