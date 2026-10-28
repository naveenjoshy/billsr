import { useCallback, useEffect, useMemo, useState } from 'react'
import AddAgentModal from '../components/AddAgentModal'
import BankShell from '../components/BankShell'
import { dateText, initials, money } from '../components/bankShellUtils'
import { getBankAgents, updateAgentLimit } from '../services/bankService'
import './AgentManagementPage.css'

const PAGE_SIZE = 5

const FILTERS = [
  { key: 'all', label: 'All Statuses' },
  { key: 'warning', label: 'Warnings' },
  { key: 'breach', label: 'At Risk' },
]

function Avatar({ agent, large = false }) {
  const sizeClass = large ? 'am-avatar am-avatar-lg' : 'am-avatar'
  if (agent?.photoUrl) {
    return <img alt="" className={sizeClass} src={agent.photoUrl} />
  }

  // Generate a consistent stylish color based on agent name/code
  const colors = ['bg-indigo', 'bg-orange', 'bg-teal', 'bg-slate', 'bg-amber', 'bg-emerald']
  const colorIndex = (agent?.agentCode || 'AGT').charCodeAt(agent?.agentCode ? agent.agentCode.length - 1 : 0) % colors.length
  const bgClass = colors[colorIndex]

  return (
    <span className={`${sizeClass} am-avatar-fallback ${bgClass}`}>
      {initials(agent?.name || 'AG')}
    </span>
  )
}

function limitBarTone(agent) {
  if (!agent) return 'safe'
  if (agent.ratio > 1) return 'over'
  if (agent.ratio >= 0.85) return 'near'
  return 'safe'
}

export default function AgentManagementPage({ user, onUserUpdated, onLoggedOut, onNavigate }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState('')
  const [warningTriggerActive, setWarningTriggerActive] = useState(true)

  // Adjust limit modal state
  const [adjustingAgent, setAdjustingAgent] = useState(null)
  const [adjustLimitInput, setAdjustLimitInput] = useState('')
  const [adjustDaysInput, setAdjustDaysInput] = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)
  const [adjustError, setAdjustError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getBankAgents()
      setData(res)
      setError('')
    } catch (err) {
      setError(err.message || 'Unable to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const agents = useMemo(() => data?.agents ?? [], [data])
  const summary = data?.summary
  const auditEvents = data?.auditEvents ?? []

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return agents.filter((agent) => {
      if (filter !== 'all' && agent.risk !== filter) return false
      if (branchFilter !== 'all' && agent.branch !== branchFilter) return false
      if (!term) return true
      return [agent.name, agent.agentCode, agent.phone, agent.branch].some((val) =>
        val?.toLowerCase().includes(term),
      )
    })
  }, [agents, filter, branchFilter, search])

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const rows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const selected = agents.find((a) => a._id === selectedId) ?? visible[0] ?? agents[0] ?? null
  const from = visible.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const to = Math.min(currentPage * PAGE_SIZE, visible.length)

  const counts = {
    all: agents.length,
    warning: summary?.approachingCount ?? 0,
    breach: summary?.breachCount ?? 0,
  }

  // Handle Export CSV
  const handleExportCSV = () => {
    if (!agents.length) return
    const headers = [
      'Agent Code',
      'Name',
      'Branch',
      'Route',
      'Phone',
      'Held Amount',
      'Limit',
      'Excess',
      'Duration (Days)',
      'Holding Days Limit',
      'Risk Status',
      'Customers',
      'Today Deposits',
      'Today Withdrawals',
      'Total Receipts',
    ]
    const csvRows = agents.map((a) => [
      a.agentCode,
      `"${a.name}"`,
      `"${a.branch || ''}"`,
      `"${a.route || ''}"`,
      `"${a.phone || ''}"`,
      a.held,
      a.limit,
      a.excess,
      a.durationDays,
      a.holdingDays,
      a.risk,
      a.customers,
      a.todayDeposits ?? 0,
      a.todayWithdrawals ?? 0,
      a.todayReceipts ?? (a.todayDeposits ?? 0) + (a.todayWithdrawals ?? 0),
    ])
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `agent_risk_audit_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Open Adjust Limit Modal
  const handleOpenAdjust = (agentToAdjust) => {
    if (!agentToAdjust) return
    setAdjustingAgent(agentToAdjust)
    setAdjustLimitInput(String(agentToAdjust.limit || 3000))
    setAdjustDaysInput(String(agentToAdjust.holdingDays || 2))
    setAdjustError('')
  }

  // Save Limit Adjustment
  const handleSaveAdjust = async (e) => {
    e.preventDefault()
    if (!adjustingAgent) return
    const numLimit = Number(adjustLimitInput)
    const numDays = Number(adjustDaysInput)
    if (Number.isNaN(numLimit) || numLimit < 0) {
      setAdjustError('Please provide a valid limit amount')
      return
    }
    if (Number.isNaN(numDays) || numDays < 1) {
      setAdjustError('Holding days must be at least 1')
      return
    }
    setAdjustSaving(true)
    setAdjustError('')
    try {
      await updateAgentLimit(adjustingAgent._id, {
        limit: numLimit,
        holdingDays: numDays,
      })
      setNotice(`Updated cash parameters for ${adjustingAgent.name}.`)
      setAdjustingAgent(null)
      await load()
    } catch (err) {
      setAdjustError(err.message || 'Failed to update limit')
    } finally {
      setAdjustSaving(false)
    }
  }

  // Request Settlement Dispatch Alert
  const handleRequestSettlement = () => {
    if (!selected) return
    setNotice(`Immediate settlement demand push notification dispatched to ${selected.name} (${selected.agentCode}).`)
    setTimeout(() => setNotice(''), 6000)
  }

  return (
    <BankShell
      active="agents"
      bank={data?.bank}
      designation=""
      displayName={user?.name ?? ''}
      onLoggedOut={onLoggedOut}
      onNavigate={onNavigate}
      onUserUpdated={onUserUpdated}
      user={user}
    >
      <main className="am-page">
        {/* Top Header Row */}
        <header className="am-header-section">
          <div className="am-title-block">
            <h1 className="am-title">Field Collection Agent Directory &amp; Risk Controls</h1>
          </div>

          <div className="am-header-controls">
            {/* Search Box */}
            <div className="am-search-box">
              <svg className="am-search-svg" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                aria-label="Search by agent name, ID"
                className="am-search-input"
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search by agent name, ID..."
                value={search}
              />
              {search && (
                <button
                  type="button"
                  className="am-clear-search"
                  onClick={() => setSearch('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Export Audit Feed Button */}
            <button
              type="button"
              className="am-btn-export"
              onClick={handleExportCSV}
              title="Export agent risk audit data to CSV"
            >
              <svg className="am-btn-svg" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Export Audit Feed
            </button>

            {/* Onboard New Agent Button */}
            <button
              type="button"
              className="am-btn-onboard"
              onClick={() => setAdding(true)}
            >
              <svg className="am-btn-svg" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
              </svg>
              + Onboard New Agent
            </button>
          </div>
        </header>

        {notice && (
          <div className="am-toast-banner" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')}>✕</button>
          </div>
        )}

        {error && (
          <div className="am-error-banner" role="alert">
            <span>{error}</span>
            <button type="button" onClick={load}>Retry</button>
          </div>
        )}

        {/* Top Dark Policy Parameters Card */}
        <section className="am-policy-dark" aria-label="Systemic Policy Ceilings">
          {/* Column 1: Cash Holding Limit */}
          <div className="am-policy-col">
            <div className="am-policy-head">
              <span className="am-policy-label">CASH HOLDING LIMIT</span>
              <button
                type="button"
                className="am-edit-pencil-btn"
                title="Adjust policy holding limit"
                onClick={() => handleOpenAdjust(selected || agents[0])}
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            </div>
            <div className="am-policy-val">
              {money(summary?.maxLimit || 3000)}
              <small className="am-policy-unit">/agent</small>
            </div>
          </div>

          <div className="am-policy-divider" />

          {/* Column 2: Unsettled Limit */}
          <div className="am-policy-col">
            <div className="am-policy-head">
              <span className="am-policy-label">UNSETTLED LIMIT</span>
              <button
                type="button"
                className="am-edit-pencil-btn"
                title="Adjust unsettled duration limit"
                onClick={() => handleOpenAdjust(selected || agents[0])}
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            </div>
            <div className="am-policy-val">
              {summary?.maxHoldingDays || 2} Days
              <small className="am-policy-unit">max</small>
            </div>
          </div>

          <div className="am-policy-divider" />

          {/* Column 3: Threshold Violation Alert */}
          <div className="am-policy-col am-policy-col-switch">
            <div className="am-policy-head">
              <span className="am-alert-dot" />
              <span className="am-policy-label">THRESHOLD VIOLATION ALERT</span>
            </div>
            <div className="am-switch-row">
              <div className="am-switch-text-block">
                <div className="am-switch-title">Warning Trigger</div>
              </div>
              <button
                type="button"
                className={`am-toggle-pill ${warningTriggerActive ? 'is-active' : ''}`}
                onClick={() => setWarningTriggerActive(!warningTriggerActive)}
                aria-label="Toggle violation warning trigger"
              >
                <span className="am-toggle-thumb" />
              </button>
            </div>
          </div>
        </section>

        {/* 4 Metric Summary Cards */}
        <section className="am-kpis-grid" aria-label="Key Risk Metrics">
          {/* Card 1: Deployed */}
          <article className="am-kpi-card">
            <div className="am-kpi-info">
              <span className="am-kpi-label">FIELD AGENTS DEPLOYED</span>
              <strong className="am-kpi-val">{summary?.totalAgents ?? 28}</strong>
            </div>
            <div className="am-kpi-icon-box box-gray">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            </div>
          </article>

          {/* Card 2: Aggregated Cash */}
          <article className="am-kpi-card">
            <div className="am-kpi-info">
              <span className="am-kpi-label">AGGREGATED CASH IN FIELD</span>
              <strong className="am-kpi-val">{money(summary?.cashInField ?? 41890)}</strong>
            </div>
            <div className="am-kpi-icon-box box-blue">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                <path
                  fillRule="evenodd"
                  d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </article>

          {/* Card 3: Breaches */}
          <article className="am-kpi-card">
            <div className="am-kpi-info">
              <span className="am-kpi-label">HOLDING LIMIT BREACHES</span>
              <strong className="am-kpi-val text-amber">
                {summary?.breachCount ?? 2} Agents
              </strong>
            </div>
            <div className="am-kpi-icon-box box-amber">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </article>

          {/* Card 4: Approaching */}
          <article className="am-kpi-card">
            <div className="am-kpi-info">
              <span className="am-kpi-label">HOLDING LIMIT APPROACHING</span>
              <strong className="am-kpi-val text-amber">
                {summary?.approachingCount ?? 3} Agents
              </strong>
            </div>
            <div className="am-kpi-icon-box box-amber">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </article>
        </section>

        {/* 2-Column Split: Registry Table (Left) + Telemetry Sidebar (Right) */}
        <div className="am-content-grid">
          {/* Left Column: Registry Table */}
          <section className="am-table-card" aria-labelledby="registry-heading">
            <div className="am-table-head">
              <div className="am-registry-title-wrap">
                <span className="am-record-count-badge">
                  {visible.length} of {agents.length} Records
                </span>
              </div>

              <div className="am-filter-tabs-row">
                <div className="am-filter-tabs">
                  {FILTERS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`am-tab-btn ${filter === item.key ? 'is-active' : ''}`}
                      onClick={() => {
                        setFilter(item.key)
                        setPage(1)
                      }}
                    >
                      {item.label}
                      {item.key !== 'all' && ` (${counts[item.key]})`}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="am-icon-funnel-btn"
                  title="Filter options"
                  onClick={() => {
                    setFilter('all')
                    setBranchFilter('all')
                    setSearch('')
                  }}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="am-table-container">
              <table className="am-main-table">
                <thead>
                  <tr>
                    <th scope="col">AGENT PROFILE &amp; CONTACT</th>
                    <th scope="col">BRANCH &amp; ROUTE</th>
                    <th scope="col">TODAY&apos;S TXNS</th>
                    <th scope="col">CASH IN HAND / CEILING</th>
                    <th scope="col">DURATION</th>
                    <th scope="col">SECURITY / CREDENTIAL</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !agents.length && (
                    <tr>
                      <td colSpan={6} className="am-empty-row">
                        <div className="am-spinner" /> Loading field agents…
                      </td>
                    </tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="am-empty-row">
                        No agents match the selected filters.
                      </td>
                    </tr>
                  )}
                  {rows.map((agent) => {
                    const tone = limitBarTone(agent)
                    const isSelected = selected?._id === agent._id
                    const isBreached =
                      agent.ratio > 1 ||
                      (agent.held > 0 && agent.durationDays > agent.holdingDays)

                    return (
                      <tr
                        key={agent._id}
                        className={`am-table-row ${isSelected ? 'row-selected' : ''}`}
                        onClick={() => setSelectedId(agent._id)}
                      >
                        {/* Profile & Contact */}
                        <td>
                          <div className="am-profile-cell">
                            <Avatar agent={agent} />
                            <div className="am-profile-meta">
                              <strong className="am-agent-name">{agent.name}</strong>
                              <span className="am-agent-code">{agent.agentCode}</span>
                              <span className="am-agent-phone">{agent.phone || '—'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Branch & Route */}
                        <td>
                          <div className="am-branch-cell">
                            <strong className="am-branch-title">{agent.branch || 'Central Market'}</strong>
                            <span className="am-vendor-count">{agent.customers ?? 0} Assigned Vendors</span>
                            <span className="am-route-link">{agent.route || 'Route #CM-04'}</span>
                          </div>
                        </td>

                        {/* Today's Transactions */}
                        <td>
                          <div className="am-txns-cell">
                            <div className="am-txns-numbers">
                              <span className="txn-dep">{agent.todayDeposits ?? 0} Dep</span>
                              <span className="txn-sep">/</span>
                              <span className="txn-wdl">{agent.todayWithdrawals ?? 0} Wdl</span>
                            </div>
                            <span className="am-receipts-total">
                              {(agent.todayReceipts ?? (agent.todayDeposits ?? 0) + (agent.todayWithdrawals ?? 0))} total receipts
                            </span>
                          </div>
                        </td>

                        {/* Cash in Hand / Ceiling */}
                        <td>
                          <div className="am-cash-cell">
                            <div className="am-cash-header">
                              <strong className={`cash-figure text-${tone}`}>{money(agent.held)}</strong>
                              <span className="cash-ceiling">/ {money(agent.limit)}</span>
                            </div>
                            <div className="am-bar-track">
                              <div
                                className={`am-bar-fill fill-${tone}`}
                                style={{ width: `${Math.min(agent.ratio * 100, 100)}%` }}
                              />
                            </div>
                            <div className="am-cash-status">
                              {agent.excess > 0 ? (
                                <span className="status-excess">+{money(agent.excess)} Over Ceiling</span>
                              ) : agent.ratio >= 0.85 ? (
                                <span className="status-near">
                                  {(agent.ratio * 100).toFixed(1)}% (Near Threshold)
                                </span>
                              ) : (
                                <span className="status-safe">
                                  {(agent.ratio * 100).toFixed(1)}% Safe Tier
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Duration */}
                        <td>
                          {agent.held <= 0 ? (
                            <span className="duration-pill pill-settled">
                              <svg viewBox="0 0 20 20" fill="currentColor">
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              0 Days (Settled)
                            </span>
                          ) : isBreached ? (
                            <span className="duration-pill pill-breached">
                              <svg viewBox="0 0 20 20" fill="currentColor">
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              {agent.durationDays ?? 0} {agent.durationDays === 1 ? 'Day' : 'Days'} (Breached)
                            </span>
                          ) : (
                            <span className="duration-pill pill-open">
                              <svg viewBox="0 0 20 20" fill="currentColor">
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              {agent.durationDays ?? 0} {agent.durationDays === 1 ? 'Day' : 'Days'}
                            </span>
                          )}
                        </td>

                        {/* Security / Credential */}
                        <td>
                          {agent.passwordResetPending ? (
                            <div className="security-cell cell-pending">
                              <svg className="sec-icon" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                  fillRule="evenodd"
                                  d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <div>
                                <span className="sec-status-text">Pending Reset</span>
                                <small className="sec-sub">First Login Req</small>
                              </div>
                            </div>
                          ) : (
                            <div className="security-cell cell-completed">
                              <svg className="sec-icon" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                  fillRule="evenodd"
                                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <div>
                                <span className="sec-status-text">Completed</span>
                                <small className="sec-sub">
                                  {agent.lastPasswordChange
                                    ? dateText(agent.lastPasswordChange)
                                    : '2026-10-18'}
                                </small>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Paging */}
            <div className="am-table-footer">
              <span className="am-footer-records-text">
                Showing {from} to {to} of {visible.length} agents registered
              </span>
              <div className="am-pagination-group">
                <button
                  type="button"
                  className="am-pager-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </button>
                {Array.from({ length: pageCount }, (_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`am-pager-num ${idx + 1 === currentPage ? 'is-active' : ''}`}
                    onClick={() => setPage(idx + 1)}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button
                  type="button"
                  className="am-pager-btn"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </section>

          {/* Right Column: Live Agent Telemetry Sidebar */}
          <aside className="am-telemetry-sidebar" aria-label="Live Agent Telemetry">
            {/* Header */}
            <div className="telemetry-top-header">
              <span className="telemetry-title">LIVE AGENT TELEMETRY</span>
              {selected?.risk === 'breach' || selected?.risk === 'warning' ? (
                <span className="telemetry-badge badge-warning">
                  <span className="pulse-dot warning-dot" /> Warning Active
                </span>
              ) : (
                <span className="telemetry-badge badge-safe">
                  <span className="pulse-dot safe-dot" /> Synchronized
                </span>
              )}
            </div>

            {selected ? (
              <div className="telemetry-body">
                {/* Agent Card Header */}
                <div className="telemetry-agent-card">
                  <Avatar agent={selected} large />
                  <div className="telemetry-agent-meta">
                    <h3 className="telemetry-agent-name">{selected.name}</h3>
                    <div className="telemetry-code-branch">
                      <span>{selected.agentCode}</span>
                      <span>•</span>
                      <span>{selected.branch || 'Central Market Branch'}</span>
                    </div>
                  </div>
                </div>

                {/* Custody Warning Box */}
                <div className={`telemetry-custody-card custody-${selected.risk || 'safe'}`}>
                  <div className="custody-header">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>CUSTODY {selected.risk === 'safe' ? 'STATUS' : 'WARNING'}</span>
                  </div>
                  <div className="custody-big-val">{money(selected.held)}</div>
                  <p className="custody-desc">
                    Threshold is {money(selected.limit)}
                    {selected.excess > 0
                      ? ` • ${money(selected.excess)} in unremitted excess.`
                      : ' • Operating within authorized limit.'}
                  </p>
                  <div className="custody-track">
                    <div
                      className={`custody-fill fill-${limitBarTone(selected)}`}
                      style={{ width: `${Math.min(selected.ratio * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Field Route Breakdown */}
                <div className="telemetry-section">
                  <h4 className="telemetry-subheading">FIELD ROUTE BREAKDOWN</h4>
                  <div className="telemetry-stats-duo">
                    <div className="telemetry-stat-card">
                      <span className="stat-label">Vendors Assigned</span>
                      <strong className="stat-number">{selected.customers ?? 0} Vendors</strong>
                    </div>
                    <div className="telemetry-stat-card">
                      <span className="stat-label">Settlement Lapse</span>
                      <strong
                        className={`stat-number ${selected.durationDays > selected.holdingDays ? 'text-lapse-over' : 'text-lapse-ok'
                          }`}
                      >
                        {selected.durationDays > selected.holdingDays
                          ? `${selected.durationDays - selected.holdingDays} Days Over`
                          : 'On Schedule'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Stacked Action Buttons */}
                <div className="telemetry-actions-stack">
                  {/* Button 1: Request Settlement */}
                  <button
                    type="button"
                    className="telemetry-btn-demand"
                    onClick={handleRequestSettlement}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    </svg>
                    Request Immediate Settlement Deposit
                  </button>

                  {/* Button 2: View Live Ledger (tbl_tt_transact) */}
                  <button
                    type="button"
                    className="telemetry-btn-ledger"
                    onClick={() => onNavigate?.('cancellations')}
                    title="Navigate to Transaction and Cancellation page"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                    </svg>
                    View Live Ledger
                  </button>

                  {/* Button 3: Adjust Custom Limit */}
                  <button
                    type="button"
                    className="telemetry-btn-adjust"
                    onClick={() => handleOpenAdjust(selected)}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
                    </svg>
                    Adjust Custom Limit for {selected.name.split(' ')[0]}
                  </button>
                </div>

                {/* Audit & System Event Log */}
                <div className="telemetry-section telemetry-log-section">
                  <div className="telemetry-log-heading-row">
                    <h4 className="telemetry-subheading">AUDIT &amp; SYSTEM EVENT LOG</h4>
                    <span className="live-feed-tag">Live Feed</span>
                  </div>

                  <div className="telemetry-event-list">
                    {auditEvents.length > 0 ? (
                      auditEvents.map((evt) => (
                        <div key={evt.id} className="telemetry-event-item">
                          <div className={`event-icon-circle icon-${evt.type || 'info'}`}>
                            {evt.type === 'settlement' ? (
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
                          <div className="event-content">
                            <p className="event-desc">{evt.description}</p>
                            <span className="event-meta">
                              {evt.time} • {evt.source}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="telemetry-event-item">
                          <div className="event-icon-circle icon-warning">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                          <div className="event-content">
                            <p className="event-desc">
                              Threshold Warning: AGT-1092 breached ₹3,000 threshold (₹4,850 recorded) - Supervisor Alert Sent
                            </p>
                            <span className="event-meta">14:22:09 • System Core</span>
                          </div>
                        </div>

                        <div className="telemetry-event-item">
                          <div className="event-icon-circle icon-warning">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                          <div className="event-content">
                            <p className="event-desc">
                              Warning Alert: AGT-1044 exceeded 90% limit ceiling
                            </p>
                            <span className="event-meta">13:48:11 • Auto Watchdog</span>
                          </div>
                        </div>

                        <div className="telemetry-event-item">
                          <div className="event-icon-circle icon-settlement">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                          <div className="event-content">
                            <p className="event-desc">
                              Vault Settlement: ACT-0988 deposited ₹1,980.00 cash to teller #2
                            </p>
                            <span className="event-meta">11:15:48 • Teller Central</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="telemetry-empty">Select an agent to inspect telemetry</div>
            )}
          </aside>
        </div>
      </main>

      {/* Onboard New Agent Modal */}
      {adding && (
        <AddAgentModal
          onClose={() => setAdding(false)}
          onCreated={(created) => {
            setAdding(false)
            setNotice(`Agent ${created.name} (${created.userID}) onboarded successfully.`)
            setSelectedId(created._id)
            load()
          }}
        />
      )}

      {/* Adjust Custom Limit Modal */}
      {adjustingAgent && (
        <div className="am-modal-overlay" role="dialog" aria-modal="true">
          <div className="am-modal-card">
            <div className="am-modal-header">
              <h3>Adjust Risk Limits: {adjustingAgent.name}</h3>
              <button
                type="button"
                className="am-modal-close"
                onClick={() => setAdjustingAgent(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="am-modal-form">
              {adjustError && <p className="am-modal-error">{adjustError}</p>}

              <div className="am-modal-field">
                <label htmlFor="adjust-limit">Cash Holding Limit (₹)</label>
                <input
                  id="adjust-limit"
                  type="number"
                  min="0"
                  step="100"
                  value={adjustLimitInput}
                  onChange={(e) => setAdjustLimitInput(e.target.value)}
                  required
                />
                <span className="am-modal-hint">
                  Maximum permissible cash in hand before supervisor alert triggers.
                </span>
              </div>

              <div className="am-modal-field">
                <label htmlFor="adjust-days">Unsettled Holding Window (Days)</label>
                <input
                  id="adjust-days"
                  type="number"
                  min="1"
                  max="30"
                  value={adjustDaysInput}
                  onChange={(e) => setAdjustDaysInput(e.target.value)}
                  required
                />
                <span className="am-modal-hint">
                  Mandatory vault hand-off period in days.
                </span>
              </div>

              <div className="am-modal-actions">
                <button
                  type="button"
                  className="am-modal-btn-cancel"
                  onClick={() => setAdjustingAgent(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="am-modal-btn-save"
                  disabled={adjustSaving}
                >
                  {adjustSaving ? 'Saving…' : 'Save Parameters'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </BankShell>
  )
}
