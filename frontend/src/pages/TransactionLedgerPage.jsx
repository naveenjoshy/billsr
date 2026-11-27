import { useCallback, useEffect, useMemo, useState } from 'react'
import BankShell from '../components/BankShell'
import TransactionForensic from '../components/TransactionForensic'
import { money } from '../components/bankShellUtils'
import { useToast } from '../context/ToastContext'
import {
  cancelBankTransaction,
  getBankDashboard,
  getBankTransactions,
  notifyCancellationsChanged,
  rejectBankCancellation,
} from '../services/bankService'
import './TransactionLedgerPage.css'

const formatDate = (isoString) => {
  if (!isoString) return '—'
  const date = new Date(isoString)
  const isToday = new Date().toDateString() === date.toDateString()
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  if (isToday) return `Today, ${time}`
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`
}

export default function TransactionLedgerPage({
  user,
  onUserUpdated,
  onLoggedOut,
  onNavigate,
  activeView = 'ledger',
  initialFilters = null,
}) {
  const { toast } = useToast()
  // Bank and Shell Info
  const [dashboard, setDashboard] = useState(null)

  // Filters State
  const [search, setSearch] = useState(initialFilters?.search || '')
  const [searchInput, setSearchInput] = useState(initialFilters?.search || '')
  const [dateRange, setDateRange] = useState(initialFilters?.dateRange || 'all')
  const [startDate, setStartDate] = useState(initialFilters?.startDate || '')
  const [endDate, setEndDate] = useState(initialFilters?.endDate || '')
  const [scheme, setScheme] = useState(initialFilters?.scheme || 'all')
  const [agent, setAgent] = useState(initialFilters?.agent || 'all')
  const [initialAgentName] = useState(initialFilters?.agentName || '')
  const [txnType, setTxnType] = useState(initialFilters?.txnType || 'all')
  const [status, setStatus] = useState(
    initialFilters?.status !== undefined
      ? initialFilters.status
      : activeView === 'cancellations'
        ? 'P'
        : 'all',
  )
  const [mode, setMode] = useState(initialFilters?.mode || 'all')

  // Pagination & Layout
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Ledger Data State
  const [txData, setTxData] = useState({
    transactions: [],
    total: 0,
    totalPages: 1,
    summary: {
      totalVolumeToday: { count: 0, deposits: 0, withdrawals: 0 },
      pendingCancellations: { count: 0, lockedAmount: 0, oldestMinsAgo: 0 },
      approvedCancellationsMTD: { count: 0, totalReversed: 0 },
      collectorStatus: { active: 0, total: 0, clearingTime: '17:00 IST' },
    },
    filterOptions: { schemes: [], agents: [] },
  })
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')

  // Interactive UI State
  const [reviewTxn, setReviewTxn] = useState(null)
  const [actionNotice, setActionNotice] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [forensicTxn, setForensicTxn] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  // Reload transactions & summaries helper
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await fetchLedger()
      toast.success('Live transactions reloaded.', 'Refreshed', 2000)
    } catch (err) {
      toast.error(err?.message || 'Failed to refresh transactions.', 'Error')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Load Dashboard metadata for the shell
  useEffect(() => {
    getBankDashboard()
      .then(setDashboard)
      .catch((err) => console.error('Dashboard load error:', err))
  }, [])

  // Close review popup on Escape key
  useEffect(() => {
    if (!reviewTxn) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !actionLoading) {
        setReviewTxn(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [reviewTxn, actionLoading])
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 280)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Load Transactions & Summaries
  const fetchLedger = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getBankTransactions({
        page,
        pageSize,
        search,
        status,
        type: txnType,
        mode,
        scheme,
        agent,
        dateRange,
        startDate: dateRange === 'custom' && startDate ? startDate : undefined,
        endDate: dateRange === 'custom' && endDate ? endDate : undefined,
      })
      setTxData(data)
      setError('')
    } catch (err) {
      setError(err.message || 'Unable to load transaction ledger')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, status, txnType, mode, scheme, agent, dateRange, startDate, endDate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLedger()
  }, [fetchLedger])

  // Reset filters helper
  const handleResetFilters = () => {
    setSearchInput('')
    setSearch('')
    setDateRange('all')
    setStartDate('')
    setEndDate('')
    setScheme('all')
    setAgent('all')
    setTxnType('all')
    setStatus('all')
    setMode('all')
    setPage(1)
  }

  // Active filter count and chips
  const activeFilters = useMemo(() => {
    const list = []
    if (search) list.push({ key: 'search', label: `Search: "${search}"`, onClear: () => setSearchInput('') })
    if (dateRange !== 'all') {
      if (dateRange === 'custom') {
        const label =
          startDate && endDate
            ? `Dates: ${startDate} to ${endDate}`
            : startDate
              ? `From: ${startDate}`
              : endDate
                ? `Until: ${endDate}`
                : 'Custom Date Range'
        list.push({
          key: 'dateRange',
          label,
          onClear: () => {
            setDateRange('all')
            setStartDate('')
            setEndDate('')
          },
        })
      } else {
        const labelMap = { today: 'Today', week: 'This Week', month: 'This Month' }
        list.push({ key: 'dateRange', label: `Date: ${labelMap[dateRange] || dateRange}`, onClear: () => setDateRange('all') })
      }
    }
    if (scheme !== 'all') {
      const s = txData.filterOptions.schemes.find((x) => x._id === scheme)
      list.push({ key: 'scheme', label: `Scheme: ${s?.name || scheme}`, onClear: () => setScheme('all') })
    }
    if (agent !== 'all') {
      const a = txData.filterOptions.agents.find((x) => x._id === agent)
      list.push({ key: 'agent', label: `Agent: ${a?.name || initialAgentName || agent}`, onClear: () => setAgent('all') })
    }
    if (txnType !== 'all') {
      list.push({ key: 'txnType', label: `Type: ${txnType === 'D' ? 'Deposit' : 'Withdrawal'}`, onClear: () => setTxnType('all') })
    }
    if (status !== 'all') {
      const statusMap = { P: 'Pending Review', A: 'Accepted', C: 'Cancelled' }
      list.push({ key: 'status', label: `Status: ${statusMap[status] || status}`, onClear: () => setStatus('all') })
    }
    if (mode !== 'all') {
      list.push({ key: 'mode', label: `Mode: ${mode === 'C' ? 'Cash' : 'Transfer'}`, onClear: () => setMode('all') })
    }
    return list
  }, [search, dateRange, startDate, endDate, scheme, agent, txnType, status, mode, txData.filterOptions, initialAgentName])

  // Approve Cancellation handler
  const handleApproveCancellation = async () => {
    if (!reviewTxn) return
    const targetTxn = reviewTxn
    setActionLoading(true)
    try {
      const res = await cancelBankTransaction(targetTxn._id, targetTxn.cancellationReason || 'Admin approved cancellation')
      const msg = res.message || `Cancellation approved for receipt ${targetTxn.receiptNo}. Funds reversed.`
      setActionNotice({ type: 'success', text: msg })
      toast.success(msg, 'Cancellation Approved')
      setReviewTxn(null)
      notifyCancellationsChanged()
      await fetchLedger()
    } catch (err) {
      const errText = err.message || 'Failed to approve cancellation'
      setActionNotice({ type: 'error', text: errText })
      toast.error(errText, 'Cancellation Error')
    } finally {
      setActionLoading(false)
    }
  }

  // Reject Cancellation handler
  const handleRejectCancellation = async () => {
    if (!reviewTxn) return
    const targetTxn = reviewTxn
    setActionLoading(true)
    try {
      const res = await rejectBankCancellation(targetTxn._id)
      const msg = res.message || `Cancellation rejected. Receipt ${targetTxn.receiptNo} marked accepted.`
      setActionNotice({ type: 'info', text: msg })
      toast.info(msg, 'Cancellation Rejected')
      setReviewTxn(null)
      notifyCancellationsChanged()
      await fetchLedger()
    } catch (err) {
      const errText = err.message || 'Failed to reject cancellation'
      setActionNotice({ type: 'error', text: errText })
      toast.error(errText, 'Cancellation Error')
    } finally {
      setActionLoading(false)
    }
  }

  // Export CSV handler
  const handleExportCSV = () => {
    if (!txData.transactions.length) return
    const headers = [
      'Transaction ID',
      'Receipt No',
      'Date Time',
      'Customer Name',
      'Shop / Account',
      'Agent Name',
      'Agent ID',
      'Scheme',
      'Type',
      'Mode',
      'Amount',
      'Status',
      'Cancellation Reason',
    ]
    const rows = txData.transactions.map((t) => [
      t.transactId,
      t.receiptNo,
      t.collectDate ? new Date(t.collectDate).toISOString() : '',
      `"${t.customer}"`,
      `"${t.customerShop || t.customerId || ''}"`,
      `"${t.agentName}"`,
      t.agentCode,
      `"${t.scheme}"`,
      t.type,
      t.mode,
      t.amount,
      t.status,
      `"${t.cancellationReason || ''}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `ledger_audit_export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Print Report handler
  const handlePrintReport = () => {
    window.print()
  }

  // Copy receipt number to clipboard
  const handleCopyReceipt = (receiptNo) => {
    navigator.clipboard.writeText(receiptNo)
    setCopiedId(receiptNo)
    setTimeout(() => setCopiedId(null), 1800)
  }

  // Summary Metrics shortcut
  const summary = txData.summary || {}
  const pendingCount = summary.pendingCancellations?.count || 0
  const totalVolumeToday = summary.totalVolumeToday || {}

  // Pagination bounds
  const startEntry = txData.total === 0 ? 0 : (page - 1) * pageSize + 1
  const endEntry = Math.min(page * pageSize, txData.total)

  return (
    <BankShell
      active="cancellations"
      bank={dashboard?.bank}
      designation={dashboard?.user?.designation}
      displayName={user?.name || dashboard?.user?.name}
      isRefreshing={isRefreshing || loading}
      onLoggedOut={onLoggedOut}
      onNavigate={onNavigate}
      onRefresh={handleRefresh}
      onUserUpdated={onUserUpdated}
      pendingCancellationsCount={pendingCount}
      user={user}
    >
      <div className="ledger-page">
        {/* Top Breadcrumb & Live Status Bar */}
        <div className="ledger-subbar">
          <div className="ledger-breadcrumb">
            <span className="crumb-category">TREASURY & FIELD OPERATIONS</span>
            <span className="crumb-divider">•</span>
            <span className="crumb-sync">
              <span className="sync-dot" />
              Synchronized
            </span>
          </div>
        </div>

        {/* Action Bar / Title and Controls */}
        <div className="ledger-header">
          <div className="ledger-title-group">
            <h1 className="ledger-title">Transaction & Cancellation Audit Trail</h1>
          </div>

          <div className="ledger-actions-bar">
            {/* Search Input */}
            <div className="ledger-search-box">
              <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="text"
                className="ledger-search-input"
                placeholder="Search receipt #, customer, agent..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {searchInput && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchInput('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              className="action-btn-secondary"
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              title="Reload live transactions & metrics"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`btn-icon ${isRefreshing || loading ? 'is-spinning' : ''}`}
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>{isRefreshing || loading ? 'Refreshing…' : 'Refresh'}</span>
            </button>

            {/* Export CSV Button */}
            <button
              type="button"
              className="action-btn-secondary"
              onClick={handleExportCSV}
              title="Export current audit log to CSV"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Export Audit CSV
            </button>

            {/* Print Report Button */}
            <button
              type="button"
              className="action-btn-secondary"
              onClick={handlePrintReport}
              title="Print transaction report currently displaying on screen"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon">
                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
              </svg>
              Print Report
            </button>

            {/* Escalation Queue Button */}
            <button
              type="button"
              className="action-btn-escalation"
              onClick={() => {
                setStatus('P')
                setPage(1)
              }}
              title="Filter to pending cancellation requests"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Escalation Queue ({pendingCount})
            </button>
          </div>
        </div>

        {/* 4 Metric Top Cards */}
        <div className="ledger-metrics-grid">
          {/* Card 1: Total Volume Today */}
          <div className="metric-card">
            <div className="metric-content">
              <span className="metric-label">TOTAL VOLUME TODAY</span>
              <div className="metric-val-row">
                <span className="metric-primary-val">{money(totalVolumeToday.deposits ?? 0)}</span>
                <span className="metric-type-badge badge-d">D</span>
              </div>
              <span className="metric-subtext">
                {money(totalVolumeToday.withdrawals ?? 0)} W • {(totalVolumeToday.count ?? 0).toLocaleString()} Txns
              </span>
            </div>
            {/* Decorative SVG Sparkline */}
            <div className="metric-sparkline" aria-hidden="true">
              <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="sparkline-svg">
                <defs>
                  <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,28 Q15,10 30,22 T60,12 T85,18 T100,6 L100,36 L0,36 Z"
                  fill="url(#sparklineGrad)"
                />
                <path
                  d="M0,28 Q15,10 30,22 T60,12 T85,18 T100,6"
                  fill="none"
                  stroke="#0d9488"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Card 2: Pending Cancellations */}
          <div
            className={`metric-card metric-amber ${status === 'P' ? 'card-selected' : ''}`}
            onClick={() => {
              setStatus('P')
              setPage(1)
            }}
            role="button"
            tabIndex={0}
          >
            <div className="metric-content">
              <div className="metric-top-bar">
                <span className="metric-label">PENDING CANCELLATIONS</span>
                <svg className="metric-top-icon icon-amber" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="metric-val-row">
                <span className="metric-primary-val text-amber">{pendingCount} Items</span>
              </div>
              <span className="metric-subtext">
                {money(summary.pendingCancellations?.lockedAmount ?? 0)} Locked • Oldest {summary.pendingCancellations?.oldestMinsAgo ?? 0}m ago
              </span>
            </div>
          </div>

          {/* Card 3: Approved Cancellations (MTD) */}
          <div className="metric-card">
            <div className="metric-content">
              <div className="metric-top-bar">
                <span className="metric-label">APPROVED CANCELLATIONS (MTD)</span>
                <svg className="metric-top-icon icon-slate" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="metric-val-row">
                <span className="metric-primary-val">{summary.approvedCancellationsMTD?.count ?? 0} Cancelled Receipts</span>
              </div>
              <span className="metric-subtext">
                {money(summary.approvedCancellationsMTD?.totalReversed ?? 0)} Reversed to accounts
              </span>
            </div>
          </div>

          {/* Card 4: Collector Status */}
          <div className="metric-card">
            <div className="metric-content">
              <div className="metric-top-bar">
                <span className="metric-label">COLLECTOR STATUS</span>
                <svg className="metric-top-icon icon-slate" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
              </div>
              <div className="metric-val-row">
                <span className="metric-primary-val">
                  {summary.collectorStatus?.active ?? 0}/{summary.collectorStatus?.total ?? 0} Active Agents
                </span>
              </div>
              <span className="metric-subtext">
                All clearing runs at {summary.collectorStatus?.clearingTime || '17:00 IST'}
              </span>
            </div>
          </div>
        </div>

        {/* Global Action Notice Banner */}
        {actionNotice && (
          <div className={`action-notice-banner banner-${actionNotice.type}`}>
            <span>{actionNotice.text}</span>
            <button
              type="button"
              className="notice-dismiss-btn"
              onClick={() => setActionNotice(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="ledger-filter-toolbar">
          <div className="filter-dropdowns-row">
            {/* Date Range */}
            <div className="filter-item">
              <label htmlFor="filter-date">Date Range</label>
              <select
                id="filter-date"
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Date Range...</option>
              </select>
            </div>

            {/* Scheme Type */}
            <div className="filter-item">
              <label htmlFor="filter-scheme">Scheme Type</label>
              <select
                id="filter-scheme"
                value={scheme}
                onChange={(e) => {
                  setScheme(e.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All Schemes</option>
                {txData.filterOptions.schemes.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Field Agent */}
            <div className="filter-item">
              <label htmlFor="filter-agent">Field Agent</label>
              <select
                id="filter-agent"
                value={agent}
                onChange={(e) => {
                  setAgent(e.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All Agents</option>
                {agent !== 'all' && !txData.filterOptions.agents.some((a) => a._id === agent) && (
                  <option value={agent}>{initialAgentName || 'Selected Agent'}</option>
                )}
                {txData.filterOptions.agents.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Txn Type */}
            <div className="filter-item">
              <label htmlFor="filter-type">Txn Type</label>
              <select
                id="filter-type"
                value={txnType}
                onChange={(e) => {
                  setTxnType(e.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All Types</option>
                <option value="D">Deposit (D)</option>
                <option value="W">Withdrawal (W)</option>
              </select>
            </div>

            {/* Txn Status */}
            <div className="filter-item">
              <label htmlFor="filter-status">Txn Status</label>
              <select
                id="filter-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All Statuses</option>
                <option value="P">Pending (P)</option>
                <option value="A">Accepted (A)</option>
                <option value="C">Cancelled (C)</option>
              </select>
            </div>

            {/* Collection Mode */}
            <div className="filter-item">
              <label htmlFor="filter-mode">Collection Mode</label>
              <select
                id="filter-mode"
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All Modes</option>
                <option value="C">Cash (C)</option>
                <option value="T">Transfer (T)</option>
              </select>
            </div>
          </div>

          {/* Custom Date Range Picker Row */}
          {dateRange === 'custom' && (
            <div className="custom-date-row">
              <span className="custom-date-hint">Select Dates:</span>
              <div className="custom-date-field">
                <label htmlFor="filter-start-date">From</label>
                <input
                  id="filter-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setPage(1)
                  }}
                  className="filter-date-input"
                />
              </div>
              <span className="custom-date-sep">to</span>
              <div className="custom-date-field">
                <label htmlFor="filter-end-date">To</label>
                <input
                  id="filter-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setPage(1)
                  }}
                  className="filter-date-input"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  type="button"
                  className="custom-date-clear-btn"
                  onClick={() => {
                    setStartDate('')
                    setEndDate('')
                    setPage(1)
                  }}
                >
                  Clear Range
                </button>
              )}
            </div>
          )}

          {/* Active Filter Tags Row */}
          <div className="filter-chips-row">
            <div className="active-chips-list">
              {activeFilters.map((f) => (
                <span key={f.key} className="filter-chip">
                  {f.label}
                  <button type="button" onClick={f.onClear} aria-label={`Remove filter ${f.label}`}>
                    ✕
                  </button>
                </span>
              ))}
              {activeFilters.length > 0 && (
                <button
                  type="button"
                  className="reset-filters-btn"
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </button>
              )}
            </div>
            <div className="entries-count-label">
              Showing {startEntry} - {endEntry} of {txData.total} entries
            </div>
          </div>
        </div>

        {/* Ledger Table Section */}
        <section className="ledger-table-card" aria-label="Direct Agent Ledger Stream">
          {/* Dedicated Print Report Header (visible only during window.print) */}
          <div className="print-report-header" aria-hidden="true">
            <div className="print-header-top">
              <div>
                <h1 className="print-bank-name">{dashboard?.bank?.name || 'BILLSR COOPERATIVE BANK'}</h1>
                <h2 className="print-report-title">Transaction &amp; Cancellation Audit Ledger</h2>
              </div>
              <div className="print-meta-right">
                <div><strong>Printed:</strong> {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                <div><strong>Generated By:</strong> {user?.name || dashboard?.user?.name || 'Administrator'}</div>
              </div>
            </div>

            <div className="print-filter-summary">
              <span className="print-filter-pill">
                <strong>Date Range:</strong>{' '}
                {dateRange === 'custom'
                  ? `${startDate || 'Start'} to ${endDate || 'End'}`
                  : dateRange === 'today'
                  ? 'Today'
                  : dateRange === 'week'
                  ? 'This Week'
                  : dateRange === 'month'
                  ? 'This Month'
                  : 'All Dates'}
              </span>
              {agent !== 'all' && (
                <span className="print-filter-pill">
                  <strong>Agent:</strong>{' '}
                  {txData.filterOptions.agents.find((a) => a._id === agent)?.name || initialAgentName || agent}
                </span>
              )}
              {scheme !== 'all' && (
                <span className="print-filter-pill">
                  <strong>Scheme:</strong>{' '}
                  {txData.filterOptions.schemes.find((s) => s._id === scheme)?.name || scheme}
                </span>
              )}
              {txnType !== 'all' && (
                <span className="print-filter-pill">
                  <strong>Type:</strong> {txnType === 'D' ? 'Deposit (D)' : 'Withdrawal (W)'}
                </span>
              )}
              {status !== 'all' && (
                <span className="print-filter-pill">
                  <strong>Status:</strong>{' '}
                  {status === 'P' ? 'Pending Review' : status === 'A' ? 'Accepted' : status === 'C' ? 'Cancelled' : status}
                </span>
              )}
              {mode !== 'all' && (
                <span className="print-filter-pill">
                  <strong>Mode:</strong> {mode === 'C' ? 'Cash' : 'Transfer'}
                </span>
              )}
              {search && (
                <span className="print-filter-pill">
                  <strong>Keyword:</strong> &quot;{search}&quot;
                </span>
              )}
              <span className="print-filter-pill">
                <strong>Showing:</strong> {startEntry}–{endEntry} of {txData.total}
              </span>
              <span className="print-filter-pill">
                <strong>Total Deposits:</strong> {money(totalVolumeToday.deposits ?? 0)}
              </span>
              <span className="print-filter-pill">
                <strong>Total Withdrawals:</strong> {money(totalVolumeToday.withdrawals ?? 0)}
              </span>
            </div>
          </div>

          <div className="table-card-header">
            <div className="table-title-with-refresh">
              <h2 className="table-title">Transactions</h2>
              <button
                type="button"
                className="table-refresh-btn"
                onClick={handleRefresh}
                disabled={isRefreshing || loading}
                title="Reload live transactions"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`btn-icon ${isRefreshing || loading ? 'is-spinning' : ''}`}
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                <span>{isRefreshing || loading ? 'Refreshing…' : 'Refresh'}</span>
              </button>
            </div>
            <div className="table-header-meta">
              <button
                type="button"
                className="table-print-btn"
                onClick={handlePrintReport}
                title="Print current transactions"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon">
                  <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                </svg>
                Print Report
              </button>
            </div>
          </div>

          <div className="ledger-table-wrapper">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th scope="col">TRANSACT ID & RECEIPT</th>
                  <th scope="col">TIMESTAMP</th>
                  <th scope="col">CUSTOMER DETAILS</th>
                  <th scope="col">FIELD COLLECTOR</th>
                  <th scope="col">SCHEME</th>
                  <th scope="col">MODE</th>
                  <th scope="col">STATUS</th>
                  <th scope="col" className="th-actions">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="table-loading-cell">
                      <div className="table-spinner" />
                      Loading transactions…
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="table-error-cell">
                      {error}
                    </td>
                  </tr>
                ) : txData.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="table-empty-cell">
                      No transactions match the selected filters.
                    </td>
                  </tr>
                ) : (
                  txData.transactions.map((txn) => {
                    const isCancelled = txn.status === 'C'
                    const isPending = txn.status === 'P'
                    const isCopied = copiedId === txn.receiptNo

                    return (
                      <tr
                        key={txn._id}
                        className={`ledger-row ${isCancelled ? 'row-cancelled' : ''} ${isPending ? 'row-pending' : ''
                          }`}
                      >
                        {/* 1. Transact ID & Receipt */}
                        <td className="cell-id">
                          <div className={`id-primary ${isCancelled ? 'strikethrough' : ''}`}>
                            {txn.transactId || '—'}
                          </div>
                          <div className="id-receipt-row">
                            <span className="receipt-text">{txn.receiptNo}</span>
                            <button
                              type="button"
                              className="copy-receipt-btn"
                              title="Copy receipt number"
                              onClick={() => handleCopyReceipt(txn.receiptNo)}
                            >
                              {isCopied ? '✓' : '⧉'}
                            </button>
                          </div>
                        </td>

                        {/* 2. Timestamp */}
                        <td className="cell-timestamp">
                          <span className="time-primary">{formatDate(txn.collectDate)}</span>
                        </td>

                        {/* 3. Customer Details */}
                        <td className="cell-customer">
                          <div className={`customer-name ${isCancelled ? 'strikethrough' : ''}`}>
                            {txn.customer}
                          </div>
                          <div className="customer-sub">
                            {txn.customerShop || txn.customerDetail
                              ? `A/C: ${txn.customerId} • ${txn.customerShop || txn.customerDetail}`
                              : `A/C: ${txn.customerId}`}
                          </div>
                        </td>

                        {/* 4. Field Collector */}
                        <td className="cell-agent">
                          <div className="agent-name">{txn.agentName}</div>
                          <div className="agent-sub">
                            {txn.agentCode ? `${txn.agentCode} • Device P25` : '—'}
                          </div>
                        </td>

                        {/* 5. Scheme */}
                        <td className="cell-scheme">
                          <span className="scheme-tag">{txn.scheme}</span>
                        </td>

                        {/* 6. Mode */}
                        <td className="cell-mode">
                          <span className={`mode-badge mode-${txn.mode === 'C' ? 'cash' : 'transfer'}`}>
                            {txn.mode === 'C' ? 'Cash' : 'Transfer'}
                          </span>
                        </td>

                        {/* 7. Status & Amount */}
                        <td className="cell-status">
                          <div className="status-badge-container">
                            {isPending && <span className="status-pill pill-pending">Pending (P)</span>}
                            {txn.status === 'A' && <span className="status-pill pill-accepted">Accepted (A)</span>}
                            {isCancelled && <span className="status-pill pill-cancelled">Cancelled (C)</span>}
                          </div>
                          <div className={`amount-text ${txn.type === 'W' ? 'amt-w' : 'amt-d'} ${isCancelled ? 'strikethrough' : ''}`}>
                            {txn.type === 'W' ? '-' : '+'}{money(txn.amount)}
                          </div>
                        </td>

                        {/* 8. Actions */}
                        <td className="cell-actions">
                          {isPending && (
                            <button
                              type="button"
                              className="btn-table-review"
                              onClick={() => setReviewTxn(txn)}
                            >
                              Review
                            </button>
                          )}

                          {isCancelled && (
                            <button
                              type="button"
                              className="btn-table-reversal"
                              onClick={() => setForensicTxn(txn)}
                            >
                              View Log
                            </button>
                          )}

                          {txn.status === 'A' && (
                            <button
                              type="button"
                              className="btn-table-forensic"
                              onClick={() => setForensicTxn(txn)}
                              title="View forensic audit trail"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="audit-icon">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                              </svg>
                              View Log
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Dedicated Print Report Footer (visible only during window.print) */}
          <div className="print-report-footer" aria-hidden="true">
            <span>Billsr Treasury Operations • Official Transaction Ledger Report • Page {page} of {Math.max(1, Math.ceil(txData.total / pageSize))}</span>
          </div>

          {/* Pagination Footer */}
          <div className="ledger-pagination-bar">
            <div className="page-size-selector">
              <label htmlFor="select-page-size">Rows per page:</label>
              <select
                id="select-page-size"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="pagination-range-text">
              {startEntry} - {endEntry} of {txData.total} transactions
            </div>

            <div className="pagination-nav-btns">
              <button
                type="button"
                className="nav-btn"
                disabled={page <= 1}
                onClick={() => setPage(1)}
                title="First Page"
              >
                |◀
              </button>
              <button
                type="button"
                className="nav-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                title="Previous Page"
              >
                ◀
              </button>
              <span className="current-page-indicator">Page {page} of {txData.totalPages || 1}</span>
              <button
                type="button"
                className="nav-btn"
                disabled={page >= txData.totalPages}
                onClick={() => setPage((p) => Math.min(txData.totalPages, p + 1))}
                title="Next Page"
              >
                ▶
              </button>
              <button
                type="button"
                className="nav-btn"
                disabled={page >= txData.totalPages}
                onClick={() => setPage(txData.totalPages)}
                title="Last Page"
              >
                ▶|
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Forensic Audit Modal */}
      {forensicTxn && (
        <TransactionForensic
          transaction={forensicTxn}
          onClose={() => setForensicTxn(null)}
        />
      )}

      {/* Pending Cancellation Review Modal Popup */}
      {reviewTxn && reviewTxn.status === 'P' && (
        <div
          className="review-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-card-heading"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) setReviewTxn(null)
          }}
        >
          <div className="review-modal-container">
            <section className="pending-review-panel" aria-labelledby="review-card-heading">
              <div className="review-panel-header">
                <span className="review-header-tag" id="review-card-heading">
                  PENDING CANCELLATION REVIEW • RECEIPT: {reviewTxn.receiptNo}
                </span>
                <button
                  type="button"
                  className="review-dismiss-link"
                  disabled={actionLoading}
                  onClick={() => setReviewTxn(null)}
                >
                  Dismiss Review Pane
                </button>
              </div>

              <div className="review-panel-body">
                {/* Left Column: Customer & Operator Justification */}
                <div className="review-left-col">
                  <div className="review-cust-header">
                    <h3 className="review-cust-name">{reviewTxn.customer}</h3>
                    <p className="review-cust-meta">
                      A/C #{reviewTxn.customerId || '—'} • {reviewTxn.agentName} ({reviewTxn.agentCode || '—'})
                    </p>
                  </div>

                  <div className="review-justification-box">
                    <div className="justification-heading">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="justification-icon">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      OPERATOR JUSTIFICATION
                    </div>
                    <p className="justification-text">
                      "{reviewTxn.cancellationReason || 'No justification provided by operator.'}"
                    </p>
                  </div>
                </div>

                {/* Right Column: Reversal Amount & Decisions */}
                <div className="review-right-col">
                  <div className="reversal-amount-box">
                    <span className="reversal-amount-label">REVERSAL AMOUNT</span>
                    <div className="reversal-amount-val">
                      {money(reviewTxn.amount)}
                      <span className="reversal-type-tag">
                        ({reviewTxn.type === 'D' ? 'Deposit' : 'Withdrawal'})
                      </span>
                    </div>
                  </div>

                  <div className="review-decision-actions">
                    <button
                      type="button"
                      className="review-btn-reject"
                      disabled={actionLoading}
                      onClick={handleRejectCancellation}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="review-btn-approve"
                      disabled={actionLoading}
                      onClick={handleApproveCancellation}
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {actionLoading ? 'Processing…' : 'Approve Cancellation (C)'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </BankShell>
  )
}
