import { useEffect, useState } from 'react'
import { setAgentStatus } from '../services/bankService'
import './SuspendAgent.css'

export default function SuspendAgent({
  agent,
  action = 'suspend',
  onClose,
  onSuccess,
  onOpenReallocate,
}) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isReactivate = action === 'reactivate'

  // Escape key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [submitting, onClose])

  if (!agent) return null

  const customerCount = agent.customers ?? 0

  const handleConfirm = async (e) => {
    e.preventDefault()
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      setError(`Reason for ${isReactivate ? 'reactivation' : 'suspension'} is required.`)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await setAgentStatus(agent._id, !isReactivate, trimmedReason)
      onSuccess?.(
        res.message ||
          `Agent ${agent.name} has been ${isReactivate ? 'reactivated' : 'suspended'}.`,
      )
      onClose?.()
    } catch (err) {
      setError(err.message || `Failed to ${isReactivate ? 'reactivate' : 'suspend'} agent.`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="am-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose?.()
      }}
    >
      <div
        className="am-modal-content am-suspend-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suspend-modal-title"
      >
        <div className="am-modal-header">
          <div className="am-suspend-header-wrap">
            <div className={`am-suspend-icon-circle ${isReactivate ? 'is-reactivate' : ''}`}>
              {isReactivate ? (
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <div>
              <h3 id="suspend-modal-title" className="am-modal-title">
                {isReactivate ? 'Reactivate Agent Access' : 'Suspend Agent Access'}
              </h3>
              <p className="am-suspend-subtitle">
                {isReactivate
                  ? 'Restore portal access and collection privileges'
                  : 'Revoke portal access and collection privileges'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="am-modal-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleConfirm} className="am-modal-form">
          {error && <div className="am-modal-error">{error}</div>}

          {/* Agent info strip */}
          <div className="am-suspend-agent-strip">
            <div className="am-suspend-avatar">
              {agent.photoUrl ? (
                <img src={agent.photoUrl} alt={agent.name} />
              ) : (
                <span>{(agent.name || 'AG').slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="am-suspend-agent-meta">
              <strong>{agent.name}</strong>
              <div className="am-suspend-agent-sub">
                <span>{agent.agentCode}</span>
                <span>•</span>
                <span>{agent.branch || 'Central Market Branch'}</span>
                <span>•</span>
                <span>{agent.phone || 'No phone'}</span>
              </div>
            </div>
          </div>

          {isReactivate ? (
            <div className="am-suspend-info-box">
              <div className="info-box-title">Reactivation Notice</div>
              <p>
                Reactivating this agent will restore their portal access and permit them to resume field collections and login to the Billsr application.
              </p>
            </div>
          ) : (
            <div className="am-suspend-warning-box">
              <div className="warning-box-title">Security &amp; Operational Notice</div>
              <p>
                Suspending this agent will immediately log them out and block them from collecting payments or accessing the Billsr application.
              </p>
            </div>
          )}

          {!isReactivate && customerCount > 0 && (
            <div className="am-suspend-reallocate-callout">
              <div className="reallocate-callout-content">
                <strong>Active Route Notice</strong>
                <p>
                  This agent currently manages <strong>{customerCount} assigned vendor{customerCount === 1 ? '' : 's'}</strong>. To prevent collection delays, you can reallocate these customers to another active agent.
                </p>
              </div>
              <button
                type="button"
                className="am-btn-reallocate-prompt"
                onClick={() => {
                  onClose?.()
                  onOpenReallocate?.(agent)
                }}
              >
                Reallocate Vendors Now →
              </button>
            </div>
          )}

          <div className="am-modal-field">
            <label htmlFor="suspend-reason">
              {isReactivate ? 'Reason for Reactivation' : 'Reason for Suspension'}{' '}
              <span className="field-required-asterisk">*</span>
            </label>
            <input
              id="suspend-reason"
              type="text"
              placeholder={
                isReactivate
                  ? 'e.g., Leave ended, device recovered, compliance clearance completed'
                  : 'e.g., Extended leave, device misplaced, route reorganization'
              }
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (error) setError('')
              }}
              disabled={submitting}
              maxLength={200}
              required
            />
          </div>

          <div className="am-modal-actions">
            <button
              type="button"
              className="am-modal-btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={isReactivate ? 'am-modal-btn-success' : 'am-modal-btn-danger'}
              disabled={submitting}
            >
              {submitting
                ? isReactivate
                  ? 'Reactivating…'
                  : 'Suspending…'
                : isReactivate
                  ? 'Confirm Reactivation'
                  : 'Confirm Suspension'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
