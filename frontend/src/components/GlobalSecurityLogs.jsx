import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getBanks,
  getBankAgents,
  getAgentCustomers,
  getGlobalAuditLogs,
} from '../services/adminService'
import './GlobalSecurityLogs.css'

import securityIcon from '../assets/super-admin/nav-security.svg'
import searchIcon from '../assets/super-admin/search.svg'
import calendarIcon from '../assets/super-admin/authority-calendar.svg'

const DATE_PRESETS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: '7days', label: 'Last 7 Days' },
  { key: '30days', label: 'Last 30 Days' },
  { key: 'custom', label: 'Custom Range' },
]

const TYPE_FILTERS = [
  { key: 'all', label: 'All Event Types' },
  { key: 'warning', label: 'Alerts & Warnings' },
  { key: 'danger', label: 'Suspensions & Locks' },
  { key: 'transaction', label: 'CBS Transactions' },
  { key: 'info', label: 'System & Governance' },
]

export default function GlobalSecurityLogs({ initialBanks = [] }) {
  // Master lists for cascading selectors
  const [banks, setBanks] = useState(initialBanks)
  const [agents, setAgents] = useState([])
  const [customers, setCustomers] = useState([])

  // Filter Selection State
  const [selectedBankId, setSelectedBankId] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')

  // Date Range State
  const [datePreset, setDatePreset] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Secondary Filters
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Log Events Data & Loading
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAgentsLoading, setIsAgentsLoading] = useState(false)
  const [isCustomersLoading, setIsCustomersLoading] = useState(false)
  const [selectedLogDetail, setSelectedLogDetail] = useState(null)

  // 1. Load Banks list if not provided
  useEffect(() => {
    if (initialBanks && initialBanks.length > 0) return
    let active = true
    getBanks()
      .then((res) => {
        if (active && res?.banks) setBanks(res.banks)
      })
      .catch((err) => console.error('Failed to load banks:', err))

    return () => {
      active = false
    }
  }, [initialBanks])

  // Handle Bank Selection Change
  const handleBankChange = (bankId) => {
    setSelectedBankId(bankId)
    setSelectedAgentId('')
    setSelectedCustomerId('')
    setAgents([])
    setCustomers([])
  }

  // Handle Agent Selection Change
  const handleAgentChange = (agentId) => {
    setSelectedAgentId(agentId)
    setSelectedCustomerId('')
    setCustomers([])
  }

  // 2. Fetch Agents when selectedBankId changes
  useEffect(() => {
    if (!selectedBankId) return

    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAgentsLoading(true)
    getBankAgents(selectedBankId)
      .then((res) => {
        if (!active) return
        setAgents(res?.agents || [])
      })
      .catch((err) => {
        console.error('Failed to load bank agents:', err)
        if (active) setAgents([])
      })
      .finally(() => {
        if (active) setIsAgentsLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedBankId])

  // 3. Fetch Customers when selectedAgentId changes
  useEffect(() => {
    if (!selectedAgentId) return

    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCustomersLoading(true)
    getAgentCustomers(selectedAgentId, selectedBankId)
      .then((res) => {
        if (!active) return
        setCustomers(res?.customers || [])
      })
      .catch((err) => {
        console.error('Failed to load agent customers:', err)
        if (active) setCustomers([])
      })
      .finally(() => {
        if (active) setIsCustomersLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedAgentId, selectedBankId])

  // 4. Fetch Logs from Server with current filters
  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await getGlobalAuditLogs({
        bankId: selectedBankId || undefined,
        agentId: selectedAgentId || undefined,
        customerId: selectedCustomerId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        search: searchTerm.trim() || undefined,
      })
      setLogs(res?.events || [])
    } catch (err) {
      console.error('Error fetching global audit logs:', err)
      setLogs([])
    } finally {
      setIsLoading(false)
    }
  }, [selectedBankId, selectedAgentId, selectedCustomerId, startDate, endDate, typeFilter, searchTerm])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs()
  }, [fetchLogs])

  // Date Preset Handler
  const handlePresetSelect = (presetKey) => {
    setDatePreset(presetKey)
    const now = new Date()

    if (presetKey === 'all') {
      setStartDate('')
      setEndDate('')
    } else if (presetKey === 'today') {
      const todayStr = now.toISOString().slice(0, 10)
      setStartDate(todayStr)
      setEndDate(todayStr)
    } else if (presetKey === '7days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      setStartDate(past.toISOString().slice(0, 10))
      setEndDate(now.toISOString().slice(0, 10))
    } else if (presetKey === '30days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      setStartDate(past.toISOString().slice(0, 10))
      setEndDate(now.toISOString().slice(0, 10))
    }
  }

  // Clear All Filters
  const handleResetFilters = () => {
    setSelectedBankId('')
    setSelectedAgentId('')
    setSelectedCustomerId('')
    setDatePreset('all')
    setStartDate('')
    setEndDate('')
    setTypeFilter('all')
    setSearchTerm('')
  }

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (selectedBankId) count += 1
    if (selectedAgentId) count += 1
    if (selectedCustomerId) count += 1
    if (datePreset !== 'all' || startDate || endDate) count += 1
    if (typeFilter !== 'all') count += 1
    if (searchTerm.trim()) count += 1
    return count
  }, [selectedBankId, selectedAgentId, selectedCustomerId, datePreset, startDate, endDate, typeFilter, searchTerm])

  // Statistics Summary
  const stats = useMemo(() => {
    const total = logs.length
    const warnings = logs.filter((l) => l.type === 'warning').length
    const critical = logs.filter((l) => l.type === 'danger').length
    const transactions = logs.filter((l) => l.type === 'transaction').length
    return { total, warnings, critical, transactions }
  }, [logs])

  // Export CSV
  const handleExportCSV = () => {
    if (!logs || logs.length === 0) return

    const headers = [
      'Timestamp',
      'Bank',
      'Agent',
      'Customer',
      'Scope',
      'Event Description',
      'Type',
      'Actor / User',
      'Trace ID',
    ]

    const rows = logs.map((log) => [
      `"${log.timestamp || `${log.date} ${log.time}`}"`,
      `"${(log.bankName || '').replace(/"/g, '""')}"`,
      `"${(log.agentName || '').replace(/"/g, '""')}"`,
      `"${(log.customerName || '').replace(/"/g, '""')}"`,
      `"${(log.scope || '').replace(/"/g, '""')}"`,
      `"${(log.description || '').replace(/"/g, '""')}"`,
      `"${log.type || 'info'}"`,
      `"${(log.user || '').replace(/"/g, '""')}"`,
      `"${log.id || ''}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `global_security_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Print Report
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="gsl-container">
      {/* 1. Header & Title Bar */}
      <section className="gsl-heading">
        <div className="gsl-title-wrap">
          <div className="gsl-title-badge">
            <img src={securityIcon} alt="" width="22" height="22" />
            <h1>Global Security Logs</h1>
          </div>
          <p className="gsl-subtitle">
            Centralized cryptographic audit trail across all tenant banks, field agents, customer accounts, and real-time core banking events.
          </p>
        </div>

        <div className="gsl-head-actions">
          <button
            type="button"
            className="gsl-btn gsl-btn-secondary"
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            title="Download CSV report"
          >
            <span>↓ Export CSV</span>
          </button>
          <button
            type="button"
            className="gsl-btn gsl-btn-secondary"
            onClick={handlePrint}
            title="Print audit log view"
          >
            <span>Print Report</span>
          </button>
          <button
            type="button"
            className="gsl-btn gsl-btn-primary"
            onClick={fetchLogs}
            disabled={isLoading}
            title="Refresh logs from server"
          >
            <span>{isLoading ? 'Syncing...' : '↻ Refresh Logs'}</span>
          </button>
        </div>
      </section>

      {/* 2. Real-time Summary KPI Cards */}
      <section className="gsl-kpi-grid">
        <div className="gsl-kpi-card kpi-total">
          <span className="gsl-kpi-label">TOTAL AUDIT EVENTS</span>
          <div className="gsl-kpi-val-row">
            <strong>{stats.total}</strong>
            <span className="gsl-kpi-tag">Recorded</span>
          </div>
          <span className="gsl-kpi-desc">Global event streams captured</span>
        </div>

        <div className="gsl-kpi-card kpi-warning">
          <span className="gsl-kpi-label">SECURITY ALERTS</span>
          <div className="gsl-kpi-val-row">
            <strong>{stats.warnings}</strong>
            <span className="gsl-kpi-tag amber">Alert</span>
          </div>
          <span className="gsl-kpi-desc">Limits, warnings &amp; cancellations</span>
        </div>

        <div className="gsl-kpi-card kpi-critical">
          <span className="gsl-kpi-label">SUSPENSIONS &amp; LOCKS</span>
          <div className="gsl-kpi-val-row">
            <strong>{stats.critical}</strong>
            <span className="gsl-kpi-tag red">Critical</span>
          </div>
          <span className="gsl-kpi-desc">Tenant, license &amp; agent lockdowns</span>
        </div>

        <div className="gsl-kpi-card kpi-tx">
          <span className="gsl-kpi-label">CBS TRANSACTIONS</span>
          <div className="gsl-kpi-val-row">
            <strong>{stats.transactions}</strong>
            <span className="gsl-kpi-tag blue">Ledger</span>
          </div>
          <span className="gsl-kpi-desc">Collections &amp; payout audit entries</span>
        </div>
      </section>

      {/* 3. Cascading Hierarchical Filters Toolbar */}
      <section className="gsl-filter-card">
        <div className="gsl-filter-card-header">
          <div className="gsl-filter-card-title">
            <span>FILTER AUDIT REPORT</span>
            {activeFiltersCount > 0 && (
              <span className="gsl-filter-count-badge">
                {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active
              </span>
            )}
          </div>
          {activeFiltersCount > 0 && (
            <button
              type="button"
              className="gsl-reset-btn"
              onClick={handleResetFilters}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Cascading Selector Grid: Bank -> Agent -> Customer */}
        <div className="gsl-selectors-grid">
          {/* A. Bank Filter */}
          <div className="gsl-field-wrap">
            <label htmlFor="gsl-bank-select" className="gsl-field-label">
              TENANT BANK
            </label>
            <select
              id="gsl-bank-select"
              className="gsl-select"
              value={selectedBankId}
              onChange={(e) => handleBankChange(e.target.value)}
            >
              <option value="">All Banks (Global View)</option>
              {banks.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name || b.bank_name} ({b.code || b._id.slice(-4)})
                </option>
              ))}
            </select>
          </div>

          {/* B. Agent Filter (Cascaded by Bank) */}
          <div className="gsl-field-wrap">
            <label htmlFor="gsl-agent-select" className="gsl-field-label">
              FIELD AGENT {isAgentsLoading && <span className="gsl-loading-text">(loading...)</span>}
            </label>
            <select
              id="gsl-agent-select"
              className="gsl-select"
              value={selectedAgentId}
              onChange={(e) => handleAgentChange(e.target.value)}
              disabled={!selectedBankId || isAgentsLoading}
            >
              <option value="">
                {!selectedBankId
                  ? 'All Agents (Select a bank to filter)'
                  : agents.length === 0
                    ? 'No agents enrolled in this bank'
                    : 'All Agents under this Bank'}
              </option>
              {agents.map((ag) => (
                <option key={ag._id} value={ag._id}>
                  {ag.name} ({ag.userID || ag._id.slice(-4)})
                </option>
              ))}
            </select>
          </div>

          {/* C. Customer Filter (Cascaded by Agent) */}
          <div className="gsl-field-wrap">
            <label htmlFor="gsl-customer-select" className="gsl-field-label">
              CUSTOMER / VENDOR {isCustomersLoading && <span className="gsl-loading-text">(loading...)</span>}
            </label>
            <select
              id="gsl-customer-select"
              className="gsl-select"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              disabled={!selectedAgentId || isCustomersLoading}
            >
              <option value="">
                {!selectedAgentId
                  ? 'All Customers (Select an agent to filter)'
                  : customers.length === 0
                    ? 'No customers allocated to this agent'
                    : 'All Customers under this Agent'}
              </option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} {c.shopName ? `(${c.shopName})` : ''} - {c.phone}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range & Presets Section */}
        <div className="gsl-date-row">
          <div className="gsl-presets-list">
            <span className="gsl-date-label">
              <img src={calendarIcon} alt="" width="14" height="14" />
              <span>DATE RANGE:</span>
            </span>
            {DATE_PRESETS.map((p) => (
              <button
                type="button"
                key={p.key}
                className={`gsl-preset-btn ${datePreset === p.key ? 'is-active' : ''}`}
                onClick={() => handlePresetSelect(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="gsl-custom-dates">
            <div className="gsl-date-input-group">
              <span className="gsl-date-sublabel">From:</span>
              <input
                type="date"
                className="gsl-date-input"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setDatePreset('custom')
                }}
              />
            </div>
            <div className="gsl-date-input-group">
              <span className="gsl-date-sublabel">To:</span>
              <input
                type="date"
                className="gsl-date-input"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setDatePreset('custom')
                }}
              />
            </div>
          </div>
        </div>

        {/* Search & Type Filter Bar */}
        <div className="gsl-search-type-row">
          <div className="gsl-type-tabs">
            {TYPE_FILTERS.map((t) => (
              <button
                type="button"
                key={t.key}
                className={`gsl-type-pill ${typeFilter === t.key ? 'is-active' : ''}`}
                onClick={() => setTypeFilter(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="gsl-search-box">
            <img src={searchIcon} alt="" width="15" height="15" />
            <input
              type="text"
              placeholder="Search description, receipt #, actor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="gsl-clear-search-btn"
                onClick={() => setSearchTerm('')}
              >
                ✕
              </button>
            )}
          </label>
        </div>
      </section>

      {/* 4. Audit Log Records Table */}
      <section className="gsl-table-card">
        <div className="gsl-table-header-bar">
          <div className="gsl-table-count">
            Showing <strong>{logs.length}</strong> security audit records
          </div>
        </div>

        {isLoading ? (
          <div className="gsl-loading-state">
            <div className="gsl-spinner" />
            <p>Querying cryptographic audit logs across tenant banks...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="gsl-empty-state">
            <div className="gsl-empty-icon">🛡️</div>
            <h3>No Audit Events Found</h3>
            <p>No security or ledger audit records match your selected bank, agent, customer, or date filters.</p>
            <button
              type="button"
              className="gsl-btn gsl-btn-primary"
              onClick={handleResetFilters}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="gsl-table-wrap">
            <table className="gsl-table">
              <thead>
                <tr>
                  <th scope="col">Date / Time</th>
                  <th scope="col">Bank Institution</th>
                  <th scope="col">Scope</th>
                  <th scope="col">Event Details &amp; Justification</th>
                  <th scope="col">Actor / Origin</th>
                  <th scope="col">Status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isWarning = log.type === 'warning'
                  const isDanger = log.type === 'danger'
                  const isTx = log.type === 'transaction'

                  return (
                    <tr
                      key={log.id}
                      className={`gsl-row ${isWarning ? 'row-warning' : ''} ${isDanger ? 'row-danger' : ''} ${selectedLogDetail?.id === log.id ? 'row-selected' : ''}`}
                    >
                      {/* Timestamp */}
                      <td className="gsl-cell-time">
                        <div className="gsl-date-text">{log.date}</div>
                        <div className="gsl-time-text">{log.time || '—'}</div>
                      </td>

                      {/* Bank Institution */}
                      <td className="gsl-cell-bank">
                        <div className="gsl-bank-name" title={log.bankName}>
                          {log.bankName}
                        </div>
                        {log.agentName !== '—' && (
                          <div className="gsl-agent-subtext" title={log.agentName}>
                            Agent: {log.agentName}
                          </div>
                        )}
                        {log.customerName !== '—' && (
                          <div className="gsl-customer-subtext" title={log.customerName}>
                            Cust: {log.customerName}
                          </div>
                        )}
                      </td>

                      {/* Scope Badge */}
                      <td className="gsl-cell-scope">
                        <span className={`gsl-scope-badge scope-${(log.scope || 'SYSTEM').toLowerCase()}`}>
                          {log.scope || 'SYSTEM'}
                        </span>
                      </td>

                      {/* Event Description */}
                      <td className="gsl-cell-desc">
                        <div className="gsl-desc-text">{log.description}</div>
                        {log.changedField && (
                          <div className="gsl-diff-inline">
                            <code>{log.changedField}</code>
                            {log.previousValue !== undefined && log.newValue !== undefined && (
                              <span>
                                : {String(log.previousValue)} → <strong>{String(log.newValue)}</strong>
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actor / User */}
                      <td className="gsl-cell-actor">
                        <div className="gsl-actor-name">{log.user}</div>
                        <div className="gsl-source-tag">{log.source}</div>
                      </td>

                      {/* Status / Severity Badge */}
                      <td className="gsl-cell-status">
                        <span
                          className={`gsl-type-badge type-${log.type || 'info'}`}
                        >
                          {isWarning && '⚠️ Alert'}
                          {isDanger && '⛔ Critical'}
                          {isTx && '💳 CBS Entry'}
                          {!isWarning && !isDanger && !isTx && '✓ Confirmed'}
                        </span>
                      </td>

                      {/* Action / Inspect */}
                      <td className="gsl-cell-action">
                        <button
                          type="button"
                          className="gsl-inspect-btn"
                          onClick={() =>
                            setSelectedLogDetail(selectedLogDetail?.id === log.id ? null : log)
                          }
                          title="View audit event details"
                        >
                          {selectedLogDetail?.id === log.id ? 'Close' : 'Inspect'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 5. Detailed Audit Trace Modal / Drawer */}
      {selectedLogDetail && (
        <div className="gsl-modal-overlay" onClick={() => setSelectedLogDetail(null)}>
          <div className="gsl-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="gsl-modal-header">
              <div className="gsl-modal-title-row">
                <span className={`gsl-type-badge type-${selectedLogDetail.type || 'info'}`}>
                  {selectedLogDetail.type?.toUpperCase()}
                </span>
                <h3>Security Event Trace Details</h3>
              </div>
              <button
                type="button"
                className="gsl-modal-close"
                onClick={() => setSelectedLogDetail(null)}
              >
                ✕
              </button>
            </div>

            <div className="gsl-modal-body">
              <div className="gsl-detail-grid">
                <div className="gsl-detail-item">
                  <span className="gsl-detail-label">EVENT IDENTIFIER</span>
                  <code className="gsl-detail-code">{selectedLogDetail.id}</code>
                </div>
                <div className="gsl-detail-item">
                  <span className="gsl-detail-label">TIMESTAMP</span>
                  <span>{selectedLogDetail.timestamp}</span>
                </div>
                <div className="gsl-detail-item">
                  <span className="gsl-detail-label">INSTITUTION</span>
                  <strong>{selectedLogDetail.bankName}</strong>
                </div>
                <div className="gsl-detail-item">
                  <span className="gsl-detail-label">SCOPE / DOMAIN</span>
                  <span className="gsl-scope-badge">{selectedLogDetail.scope}</span>
                </div>
                <div className="gsl-detail-item">
                  <span className="gsl-detail-label">AGENT ENTITY</span>
                  <span>{selectedLogDetail.agentName || '—'}</span>
                </div>
                <div className="gsl-detail-item">
                  <span className="gsl-detail-label">CUSTOMER ENTITY</span>
                  <span>{selectedLogDetail.customerName || '—'}</span>
                </div>
                <div className="gsl-detail-item">
                  <span className="gsl-detail-label">ACTOR IDENTITY</span>
                  <span>{selectedLogDetail.user}</span>
                </div>
                <div className="gsl-detail-item">
                  <span className="gsl-detail-label">AUDIT SUBSYSTEM</span>
                  <span>{selectedLogDetail.source}</span>
                </div>
              </div>

              <div className="gsl-detail-box">
                <span className="gsl-detail-label">FULL EVENT DESCRIPTION</span>
                <p className="gsl-detail-desc">{selectedLogDetail.description}</p>
              </div>

              {selectedLogDetail.changedField && (
                <div className="gsl-detail-diff-box">
                  <span className="gsl-detail-label">CRYPTOGRAPHIC DELTA / FIELD CHANGE</span>
                  <div className="gsl-diff-row">
                    <div>
                      <small>Field:</small> <code>{selectedLogDetail.changedField}</code>
                    </div>
                    {selectedLogDetail.previousValue !== undefined && (
                      <div>
                        <small>Previous:</small>{' '}
                        <span className="diff-prev">{JSON.stringify(selectedLogDetail.previousValue)}</span>
                      </div>
                    )}
                    {selectedLogDetail.newValue !== undefined && (
                      <div>
                        <small>New Value:</small>{' '}
                        <span className="diff-next">{JSON.stringify(selectedLogDetail.newValue)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="gsl-modal-footer">
              <span className="gsl-footer-security-note">
                🔒 Cryptographically signed by Billsr SuperAdmin Audit Watchdog
              </span>
              <button
                type="button"
                className="gsl-btn gsl-btn-primary"
                onClick={() => setSelectedLogDetail(null)}
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
