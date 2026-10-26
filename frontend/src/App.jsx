import { useEffect, useState } from 'react'
import { getCurrentUser } from './services/authService'
import LoginPage from './pages/LoginPage'
import SuperAdminHomePage from './pages/SuperAdminHomePage'
import BankHomePage from './pages/BankHomePage'
import AgentManagementPage from './pages/AgentManagementPage'
import './App.css'

const HOME_ROLES = ['Superadmin', 'Bank']

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [bankView, setBankView] = useState('dashboard')
  const [accessMessage, setAccessMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    getCurrentUser()
      .then((user) => {
        if (!isMounted) return
        setCurrentUser(user)
        if (user && !HOME_ROLES.includes(user.role)) {
          setAccessMessage('This console is only available to Superadmin and Bank accounts.')
        }
      })
      .catch((error) => {
        if (isMounted) {
          setAccessMessage(
            error instanceof Error
              ? error.message
              : 'Unable to verify the current session. Please sign in.',
          )
        }
      })
      .finally(() => {
        if (isMounted) setIsCheckingSession(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleLoggedOut = () => {
    setAccessMessage('')
    setBankView('dashboard')
    setCurrentUser(null)
  }

  if (isCheckingSession) {
    return (
      <main className="login-page">
        <p role="status">Checking administrator session...</p>
      </main>
    )
  }

  const session = currentUser?.mustChangePassword ? null : currentUser

  if (session?.role === 'Superadmin') {
    return (
      <SuperAdminHomePage
        onLoggedOut={handleLoggedOut}
        onUserUpdated={setCurrentUser}
        user={currentUser}
      />
    )
  }

  if (session?.role === 'Bank') {
    const BankPage = bankView === 'agents' ? AgentManagementPage : BankHomePage
    return (
      <BankPage
        onNavigate={setBankView}
        onLoggedOut={handleLoggedOut}
        onUserUpdated={setCurrentUser}
        user={currentUser}
      />
    )
  }

  return (
    <LoginPage
      accessMessage={accessMessage}
      pendingUser={currentUser?.mustChangePassword ? currentUser : null}
      onAuthenticated={(user) => {
        setAccessMessage('')
        setCurrentUser(user)
      }}
    />
  )
}

export default App
