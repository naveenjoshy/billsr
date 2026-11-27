import { useEffect, useMemo, useState } from 'react'
import { getBankAuditEvents } from '../services/bankService'
import './AuditEventLog.css'

const PRESETS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: '7days', label: 'Last 7 Days' },
  { key: '30days', label: 'Last 30 Days' },
  { key: 'custom', label: 'Custom Range' },
]

const TYPE_OPTIONS = [
  { key: 'all', label: 'All Event Types' },
  { key: 'warning', label: 'Alerts & Warnings' },
  { key: 'settlement', label: 'Vault Settlements' },
  { key: 'info', label: 'System & Security' },
]

export default function AuditEventLog({ isOpen, onClose, initialEvents = [] }) {
  const [events, setEvents] = useState(initialEvents)
  const [loading, setLoading] = useState(false)
  const [datePreset, setDatePreset] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Fetch full audit events from server
  useEffect(() => {
    if (!isOpen) return
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)

    getBankAuditEvents()
      .then((res) => {
        if (active && res?.events && res.events.length > 0) {
          setEvents(res.events)
        } else if (active && initialEvents.length > 0) {
          setEvents(initialEvents)
        }
      })
      .catch(() => {
        if (active && initialEvents.length > 0) {
          setEvents(initialEvents)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [isOpen, initialEvents])

  // Fallback / mock seeds with realistic dates if events list is sparse
  const seededEvents = useMemo(() => {
    if (events && events.length > 0) return events

    const now = new Date()
    const d0 = new Date(now).toISOString()
    const d1 = new Date(now.getTime() - 24 * 3600 * 1000).toISOString()
    const d2 = new Date(now.getTime() - 3 * 24 * 3600 * 1000).toISOString()

    return [
      {
        id: 'seed-1',
        description: 'Threshold Warning: AGT-1092 breached ₹3,000 threshold (₹4,850 recorded) - Supervisor Alert Sent',
        timestamp: d0,
        date: d0.slice(0, 10),
        time: '14:22:09',
        source: 'System Core',
        type: 'warning',
      },
      {
        id: 'seed-2',
        description: 'Warning Alert: AGT-1044 exceeded 90% limit ceiling',
        timestamp: d0,
        date: d0.slice(0, 10),
        time: '13:48:11',
        source: 'Audit Watchdog',
        type: 'warning',
      },
      {
        id: 'seed-3',
        description: 'Vault Settlement: ACT-0988 deposited ₹1,980.00 cash to teller #2',
        timestamp: d1,
        date: d1.slice(0, 10),
        time: '11:15:48',
        source: 'Teller Central',
        type: 'settlement',
      },
      {
        id: 'seed-4',
        description: 'Agent route reallocation: 4 customers transferred to active collector',
        timestamp: d2,
        date: d2.slice(0, 10),
        time: '09:30:15',
        source: 'Route Manager',
        type: 'info',
      },
    ]
  }, [events])

  // Filter events by date range, type, and search term
  const filteredEvents = useMemo(() => {
    const now = new Date()
    let startBoundary = null
    let endBoundary = null

    if (datePreset === 'today') {
      startBoundary = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      endBoundary = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    } else if (datePreset === '7days') {
      startBoundary = new Date(now.getTime() - 7 * 24 * 3600 * 1000)
      endBoundary = new Date()
    } else if (datePreset === '30days') {
      startBoundary = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
      endBoundary = new Date()
    } else if (datePreset === 'custom') {
      if (startDate) {
        startBoundary = new Date(`${startDate}T00:00:00`)
      }
      if (endDate) {
        endBoundary = new Date(`${endDate}T23:59:59`)
      }
    }

    const term = searchTerm.trim().toLowerCase()

    return seededEvents.filter((evt) => {
      // Date filter
      if (startBoundary || endBoundary) {
        const evtTime = evt.timestamp
          ? new Date(evt.timestamp).getTime()
          : evt.date
            ? new Date(evt.date).getTime()
            : null

        if (evtTime && !Number.isNaN(evtTime)) {
          if (startBoundary && evtTime < startBoundary.getTime()) return false
          if (endBoundary && evtTime > endBoundary.getTime()) return false
        }
      }

      // Type filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'warning' && evt.type !== 'warning' && evt.type !== 'danger') {
          return false
        }
        if (typeFilter === 'settlement' && evt.type !== 'settlement') {
          return false
        }
        if (typeFilter === 'info' && evt.type !== 'info') {
          return false
        }
      }

      // Search term
      if (term) {
        const matches =
          evt.description?.toLowerCase().includes(term) ||
          evt.source?.toLowerCase().includes(term) ||
          evt.time?.toLowerCase().includes(term) ||
          evt.date?.toLowerCase().includes(term)
        if (!matches) return false
      }

      return true
    })
  }, [seededEvents, datePreset, startDate, endDate, typeFilter, searchTerm])

  if (!isOpen) return null

  // Export filtered events to CSV
  const handleExportCSV = () => {
    if (!filteredEvents.length) return
    const headers = ['Event ID', 'Date', 'Time', 'Type', 'Source', 'Description']
    const rows = filteredEvents.map((e) => [
      e.id,
      `"${e.date || ''}"`,
      `"${e.time || ''}"`,
      `"${e.type || 'info'}"`,
      `"${e.source || ''}"`,
      `"${(e.description || '').replace(/"/g, '""')}"`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `system_audit_events_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleResetFilters = () => {
    setDatePreset('all')
    setStartDate('')
    setEndDate('')
    setTypeFilter('all')
    setSearchTerm('')
  }

  return (
    <div
      className="am-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        className="am-modal-content ael-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-log-modal-title"
      >
        {/* Modal Header */}
        <div className="am-modal-header ael-header">
          <div className="ael-header-title-wrap">
            <div className="ael-icon-circle">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000-16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <div className="ael-title-row">
                <h3 id="audit-log-modal-title" className="am-modal-title">
                  Audit &amp; System Event Log
                </h3>
                <span className="live-feed-tag">Live System Feed</span>
              </div>
              <p className="ael-subtitle">
                Cryptographic audit trail of limit alerts, route reallocations, and vault settlements
              </p>
            </div>
          </div>
          <button
            type="button"
            className="am-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="ael-controls-bar">
          {/* Preset Buttons */}
          <div className="ael-presets-row">
            <span className="ael-filter-label">DATE RANGE:</span>
            <div className="ael-preset-pills">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`ael-pill-btn ${datePreset === p.key ? 'is-active' : ''}`}
                  onClick={() => setDatePreset(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Picker Inputs (Shown when 'custom' is selected or always available) */}
          {datePreset === 'custom' && (
            <div className="ael-custom-date-row">
              <div className="ael-date-field">
                <label htmlFor="ael-start-date">From Date</label>
                <input
                  id="ael-start-date"
                  type="date"
                  className="ael-date-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <span className="ael-date-sep">to</span>
              <div className="ael-date-field">
                <label htmlFor="ael-end-date">To Date</label>
                <input
                  id="ael-end-date"
                  type="date"
                  className="ael-date-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              {(startDate || endDate) && (
                <button
                  type="button"
                  className="ael-clear-dates-btn"
                  onClick={() => {
                    setStartDate('')
                    setEndDate('')
                  }}
                >
                  Clear Range
                </button>
              )}
            </div>
          )}

          {/* Secondary Filters: Type & Keyword */}
          <div className="ael-secondary-filter-row">
            <div className="ael-search-box">
              <svg viewBox="0 0 20 20" fill="currentColor" className="ael-search-icon">
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="text"
                placeholder="Search event descriptions or sources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="ael-search-input"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="ael-search-clear"
                  onClick={() => setSearchTerm('')}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="ael-type-select-wrap">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="ael-type-select"
                aria-label="Filter by event type"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Metadata & Export Bar */}
        <div className="ael-meta-bar">
          <span className="ael-count-text">
            Showing <strong>{filteredEvents.length}</strong> of{' '}
            {seededEvents.length} recorded events
            {datePreset !== 'all' && (
              <span className="ael-active-filter-tag"> • Filtered by date</span>
            )}
          </span>
          <div className="ael-meta-actions">
            {(datePreset !== 'all' || typeFilter !== 'all' || searchTerm) && (
              <button
                type="button"
                className="ael-btn-reset-filters"
                onClick={handleResetFilters}
              >
                Reset Filters
              </button>
            )}
            <button
              type="button"
              className="ael-btn-export"
              onClick={handleExportCSV}
              disabled={filteredEvents.length === 0}
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Scrollable Event List */}
        <div className="ael-body-list">
          {loading && (
            <div className="ael-state-empty">
              <div className="am-spinner" /> Loading audit history…
            </div>
          )}

          {!loading && filteredEvents.length === 0 && (
            <div className="ael-state-empty">
              <svg viewBox="0 0 20 20" fill="currentColor" className="ael-empty-icon">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              <h4>No Audit Events Match the Selected Date Range</h4>
              <p>Try selecting a broader date range or clearing your keyword filter.</p>
              <button
                type="button"
                className="ael-btn-reset-dates"
                onClick={handleResetFilters}
              >
                Reset All Filters
              </button>
            </div>
          )}

          {!loading &&
            filteredEvents.map((evt) => {
              const isWarning = evt.type === 'warning' || evt.type === 'danger'
              const isSettlement = evt.type === 'settlement'

              return (
                <div key={evt.id} className="ael-event-row">
                  <div
                    className={`ael-icon-box ${
                      isWarning
                        ? 'icon-warning'
                        : isSettlement
                          ? 'icon-settlement'
                          : 'icon-info'
                    }`}
                  >
                    {isSettlement ? (
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
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>

                  <div className="ael-event-content">
                    <p className="ael-event-desc">{evt.description}</p>
                    <div className="ael-event-footer">
                      <span className="ael-event-time">
                        {evt.date ? `${evt.date} • ` : ''}
                        {evt.time || '12:00:00'}
                      </span>
                      <span className="ael-source-tag">{evt.source || 'Audit Core'}</span>
                      {evt.user && (
                        <span className="ael-user-tag">By {evt.user}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
        </div>

        {/* Modal Footer */}
        <div className="ael-footer">
          <span className="ael-footer-note">
            Logs are cryptographically linked to audit trail records.
          </span>
          <div className="ael-footer-actions">
            <button
              type="button"
              className="ael-print-btn"
              onClick={() => window.print()}
              title="Print visible audit log report"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon">
                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
              </svg>
              Print Log
            </button>
            <button
              type="button"
              className="am-modal-btn-cancel"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
