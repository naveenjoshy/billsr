import { useEffect, useRef, useState } from 'react'
import './Toast.css'

export default function Toast({ toast, onDismiss }) {
  const { id, type = 'info', title, message, duration = 4000 } = toast
  const [isPaused, setIsPaused] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const timerRef = useRef(null)
  const remainingTimeRef = useRef(duration)
  const startTimeRef = useRef(0)

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      onDismiss(id)
    }, 200)
  }

  useEffect(() => {
    if (duration <= 0) return undefined

    const startTimer = () => {
      startTimeRef.current = Date.now()
      timerRef.current = setTimeout(() => {
        handleClose()
      }, remainingTimeRef.current)
    }

    if (!isPaused) {
      startTimer()
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused, duration])

  const handleMouseEnter = () => {
    if (duration <= 0) return
    setIsPaused(true)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    const elapsed = Date.now() - startTimeRef.current
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed)
  }

  const handleMouseLeave = () => {
    if (duration <= 0) return
    setIsPaused(false)
  }

  return (
    <div
      className={`toast-item toast-${type} ${isClosing ? 'toast-closing' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="alert"
      aria-live="polite"
    >
      <div className="toast-icon-wrap" aria-hidden="true">
        {type === 'success' && (
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {type === 'error' && (
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {type === 'warning' && (
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {type === 'info' && (
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

      <div className="toast-body">
        {title && <h5 className="toast-title">{title}</h5>}
        <p className="toast-message">{message}</p>
      </div>

      <button
        type="button"
        className="toast-close-btn"
        onClick={handleClose}
        aria-label="Dismiss notification"
      >
        ✕
      </button>

      {duration > 0 && (
        <div className="toast-progress-track">
          <div
            className={`toast-progress-bar ${isPaused ? 'is-paused' : ''}`}
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      )}
    </div>
  )
}
