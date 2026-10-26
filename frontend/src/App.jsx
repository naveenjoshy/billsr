import { useEffect, useState } from 'react'
import { getCurrentUser } from './services/authService'
import LoginPage from './pages/LoginPage'
import SuperAdminHomePage from './pages/SuperAdminHomePage'
import BankHomePage from './pages/BankHomePage'
import './App.css'

const HOME_ROLES = ['Superadmin', 'Bank']

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
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

  if (isCheckingSession) {
    return (
      <main className="login-page">
        <p role="status">Checking administrator session...</p>
      </main>
    )
  }

  if (currentUser?.role === 'Superadmin') {
    return <SuperAdminHomePage />
  }

  if (currentUser?.role === 'Bank') {
    return <BankHomePage user={currentUser} />
  }

  return (
    <LoginPage
      accessMessage={accessMessage}
      onAuthenticated={(user) => {
        setAccessMessage('')
        setCurrentUser(user)
      }}
    />
  )
}

export default App
