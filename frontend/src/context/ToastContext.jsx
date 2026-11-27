import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import Toast from '../components/Toast'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    ({ message, type = 'info', title = '', duration = 4000 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      const newToast = { id, message, type, title, duration }
      setToasts((prev) => [...prev, newToast])
      return id
    },
    [],
  )

  const toastHelpers = useMemo(
    () => ({
      success: (message, title = 'Success', duration = 4000) =>
        showToast({ message, title, type: 'success', duration }),
      error: (message, title = 'Error', duration = 5000) =>
        showToast({ message, title, type: 'error', duration }),
      warning: (message, title = 'Warning', duration = 4500) =>
        showToast({ message, title, type: 'warning', duration }),
      info: (message, title = 'Notice', duration = 4000) =>
        showToast({ message, title, type: 'info', duration }),
    }),
    [showToast],
  )

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, toast: toastHelpers }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((item) => (
          <Toast key={item.id} toast={item} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
