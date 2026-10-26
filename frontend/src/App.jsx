import { useEffect, useState } from 'react'
import { getCurrentUser } from './services/authService'
import LoginPage from './pages/LoginPage'
import SuperAdminHomePage from './pages/SuperAdminHomePage'
import BankHomePage from './pages/BankHomePage'
import AgentManagementPage from './pages/AgentManagementPage'
import AgentHomePage from './pages/AgentHomePage'
import TransactionLedgerPage from './pages/TransactionLedgerPage'
import SchemesReceiptsPage from './pages/SchemesReceiptsPage'
import './App.css'

const HOME_ROLES = ['Superadmin', 'Bank', 'Agent']

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
          setAccessMessage('This account role cannot sign in here.')
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
    if (bankView === 'agents') {
      return (
        <AgentManagementPage
          onNavigate={setBankView}
          onLoggedOut={handleLoggedOut}
          onUserUpdated={setCurrentUser}
          user={currentUser}
        />
      )
    }

    if (bankView === 'ledger' || bankView === 'cancellations') {
      return (
        <TransactionLedgerPage
          activeView={bankView}
          onNavigate={setBankView}
          onLoggedOut={handleLoggedOut}
          onUserUpdated={setCurrentUser}
          user={currentUser}
        />
      )
    }

    if (bankView === 'schemes') {
      return (
        <SchemesReceiptsPage
          onNavigate={setBankView}
          onLoggedOut={handleLoggedOut}
          onUserUpdated={setCurrentUser}
          user={currentUser}
        />
      )
    }

    return (
      <BankHomePage
        onNavigate={setBankView}
        onLoggedOut={handleLoggedOut}
        onUserUpdated={setCurrentUser}
        user={currentUser}
      />
    )
  }

  if (session?.role === 'Agent') {
    return (
      <AgentHomePage
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
