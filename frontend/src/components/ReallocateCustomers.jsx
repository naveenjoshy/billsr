import { useEffect, useMemo, useState } from 'react'
import { getAgentCustomers, reallocateCustomers } from '../services/bankService'
import './ReallocateCustomers.css'

export default function ReallocateCustomers({
  sourceAgent,
  agents = [],
  onClose,
  onSuccess,
}) {
  const [targetAgentId, setTargetAgentId] = useState('')
  const [customers, setCustomers] = useState([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [mode, setMode] = useState('all') // 'all' | 'selected'
  const [search, setSearch] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Load the customers assigned to source agent
  useEffect(() => {
    let active = true
    async function fetchCustomers() {
      if (!sourceAgent?._id) return
      setLoadingCustomers(true)
      try {
        const res = await getAgentCustomers(sourceAgent._id)
        if (active) {
          const list = res.customers || []
          setCustomers(list)
          setSelectedIds(new Set(list.map((c) => c._id)))
        }
      } catch (err) {
        if (active) setError(err.message || 'Unable to fetch assigned customers.')
      } finally {
        if (active) setLoadingCustomers(false)
      }
    }
    fetchCustomers()
    return () => {
      active = false
    }
  }, [sourceAgent?._id])

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

  // Destination agent candidates: exclude source agent and suspended agents
  const availableTargetAgents = useMemo(() => {
    return agents.filter(
      (a) => a._id !== sourceAgent?._id && a.isActive,
    )
  }, [agents, sourceAgent?._id])

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return customers
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.shopName && c.shopName.toLowerCase().includes(term)) ||
        (c.phone && c.phone.includes(term)) ||
        (c.address && c.address.toLowerCase().includes(term)),
    )
  }, [customers, search])

  const toggleSelectCustomer = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredCustomers.map((c) => c._id)))
  }

  const handleClearAll = () => {
    setSelectedIds(new Set())
  }

  const countToTransfer = mode === 'all' ? customers.length : selectedIds.size

  const targetAgent = availableTargetAgents.find((a) => a._id === targetAgentId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!targetAgentId) {
      setError('Please select a destination agent.')
      return
    }

    if (countToTransfer === 0) {
      setError('Please select at least one customer to reallocate.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const payload = {
        sourceAgentId: sourceAgent._id,
        targetAgentId,
        customerIds: mode === 'all' ? undefined : Array.from(selectedIds),
        reason: reason.trim(),
      }
      const res = await reallocateCustomers(payload)
      onSuccess?.(res.message || `Reallocated ${res.reallocatedCount} customer(s).`)
      onClose?.()
    } catch (err) {
      setError(err.message || 'Failed to reallocate customers.')
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
        className="am-modal-content am-reallocate-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reallocate-modal-title"
      >
        <div className="am-modal-header">
          <div className="am-reallocate-header-wrap">
            <div className="am-reallocate-icon-circle">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" />
              </svg>
            </div>
            <div>
              <h3 id="reallocate-modal-title" className="am-modal-title">
                Reallocate Customer Route
              </h3>
              <p className="am-reallocate-subtitle">
                Transfer vendor accounts from {sourceAgent?.name || 'Agent'}
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

        <form onSubmit={handleSubmit} className="am-modal-form">
          {error && <div className="am-modal-error">{error}</div>}

          {/* Source Agent Summary Card */}
          <div className="am-reallocate-source-card">
            <span className="source-label">Source Agent</span>
            <div className="source-agent-details">
              <strong>{sourceAgent?.name}</strong>
              <span className="agent-badge-code">{sourceAgent?.agentCode}</span>
              <span className="agent-vendor-pill">
                {customers.length} Total Assigned Vendors
              </span>
            </div>
          </div>

          {/* Destination Agent Selector */}
          <div className="am-modal-field">
            <label htmlFor="target-agent-select">
              Destination Agent <span className="req-star">*</span>
            </label>
            <select
              id="target-agent-select"
              value={targetAgentId}
              onChange={(e) => {
                setTargetAgentId(e.target.value)
                setError('')
              }}
              disabled={submitting || availableTargetAgents.length === 0}
              className="am-select-control"
            >
              <option value="">
                {availableTargetAgents.length === 0
                  ? 'No other active agents available'
                  : 'Select an active agent to take over route…'}
              </option>
              {availableTargetAgents.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name} ({a.agentCode}) — {a.branch || 'Branch'} ({a.customers ?? 0} current vendors)
                </option>
              ))}
            </select>
          </div>

          {/* Scope Selection: All vs Specific */}
          <div className="am-modal-field">
            <label>Allocation Scope</label>
            <div className="am-scope-tabs">
              <button
                type="button"
                className={`scope-tab-btn ${mode === 'all' ? 'is-active' : ''}`}
                onClick={() => setMode('all')}
              >
                All Vendors ({customers.length})
              </button>
              <button
                type="button"
                className={`scope-tab-btn ${mode === 'selected' ? 'is-active' : ''}`}
                onClick={() => setMode('selected')}
              >
                Select Specific Vendors ({selectedIds.size})
              </button>
            </div>
          </div>

          {/* If specific selection mode */}
          {mode === 'selected' && (
            <div className="am-vendor-selection-panel">
              <div className="vendor-panel-toolbar">
                <input
                  type="text"
                  placeholder="Filter vendors by name, shop, or phone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="vendor-search-input"
                />
                <div className="vendor-bulk-actions">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="btn-select-mini"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="btn-select-mini"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="vendor-checkbox-list">
                {loadingCustomers ? (
                  <div className="vendor-list-loading">Loading vendors…</div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="vendor-list-empty">
                    {search ? 'No vendors match your search' : 'No vendors found'}
                  </div>
                ) : (
                  filteredCustomers.map((cust) => {
                    const checked = selectedIds.has(cust._id)
                    return (
                      <label
                        key={cust._id}
                        className={`vendor-item-row ${checked ? 'is-checked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectCustomer(cust._id)}
                        />
                        <div className="vendor-item-info">
                          <div className="vendor-name-row">
                            <strong className="vendor-name">{cust.name}</strong>
                            {cust.shopName && (
                              <span className="vendor-shop">({cust.shopName})</span>
                            )}
                          </div>
                          <div className="vendor-sub-row">
                            <span>{cust.phone}</span>
                            {cust.address && <span>• {cust.address}</span>}
                          </div>
                        </div>
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Reason / Note Field */}
          <div className="am-modal-field">
            <label htmlFor="reallocate-reason">Reason or Audit Note (Optional)</label>
            <input
              id="reallocate-reason"
              type="text"
              placeholder="e.g., Route workload balancing, coverage during leave"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              maxLength={200}
            />
          </div>

          {/* Transfer Summary Strip */}
          <div className="am-transfer-summary-box">
            <span>
              Transferring <strong>{countToTransfer} vendor{countToTransfer === 1 ? '' : 's'}</strong> to{' '}
              <strong>{targetAgent?.name || 'selected agent'}</strong>.
            </span>
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
              className="am-modal-btn-save"
              disabled={submitting || !targetAgentId || countToTransfer === 0}
            >
              {submitting ? 'Reallocating…' : `Confirm Reallocation (${countToTransfer})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
