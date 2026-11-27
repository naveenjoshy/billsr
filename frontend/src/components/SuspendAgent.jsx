import { useState } from 'react'
import { setAgentStatus } from '../services/bankService'
import './SuspendAgent.css'

export default function SuspendAgent({ agent, onClose, onSuccess, onOpenReallocate }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!agent) return null

  const customerCount = agent.customers ?? 0

  const handleConfirm = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await setAgentStatus(agent._id, true, reason.trim())
      onSuccess?.(res.message || `Agent ${agent.name} has been suspended.`)
      onClose?.()
    } catch (err) {
      setError(err.message || 'Failed to suspend agent.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="am-modal-backdrop" role="presentation">
      <div
        className="am-modal-content am-suspend-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suspend-modal-title"
      >
        <div className="am-modal-header">
          <div className="am-suspend-header-wrap">
            <div className="am-suspend-icon-circle">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h3 id="suspend-modal-title" className="am-modal-title">
                Suspend Agent Access
              </h3>
              <p className="am-suspend-subtitle">
                Revoke portal access and collection privileges
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

          <div className="am-suspend-warning-box">
            <div className="warning-box-title">Security &amp; Operational Notice</div>
            <p>
              Suspending this agent will immediately log them out and block them from collecting payments or accessing the Billsr application.
            </p>
          </div>

          {customerCount > 0 && (
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
              Reason for Suspension (Audit note)
            </label>
            <input
              id="suspend-reason"
              type="text"
              placeholder="e.g., Extended leave, device misplaced, route reorganization"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              maxLength={200}
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
              className="am-modal-btn-danger"
              disabled={submitting}
            >
              {submitting ? 'Suspending…' : 'Confirm Suspension'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
