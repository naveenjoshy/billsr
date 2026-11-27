import { useCallback, useEffect, useState } from 'react'
import './BankHomePage.css'
import BankShell from '../components/BankShell'
import { initials, money } from '../components/bankShellUtils'
import {
  approveTransaction,
  broadcastCancellationsChanged,
  getBankDashboard,
  getBankTransactions,
} from '../services/bankService'

const statusMeta = {
  P: { label: 'Pending', tone: 'pending' },
  A: { label: 'Confirmed', tone: 'confirmed' },
  C: { label: 'Cancelled', tone: 'cancelled' },
}

function Avatar({ name, photoUrl }) {
  return photoUrl ? (
    <img className="bank-avatar" src={photoUrl} alt="" />
  ) : (
    <span className="bank-avatar bank-avatar-fallback">{initials(name)}</span>
  )
}

function RiskRow({ agent }) {
  const percent = Math.round(agent.ratio * 100)
  const over = agent.ratio > 1
  const fill = Math.min(percent, 100)
  return (
    <div className={`bank-risk-row ${over ? 'is-over' : 'is-near'}`}>
      <div className="bank-risk-agent">
        <Avatar name={agent.name} photoUrl={agent.photoUrl} />
        <div>
          <strong>{agent.name}</strong>
          <small>
            {agent.agentCode} • Holding {agent.holdingDays} {agent.holdingDays === 1 ? 'Day' : 'Days'}
          </small>
        </div>
      </div>
      <div className="bank-risk-meta">
        <span className="bank-risk-held">{money(agent.held)} in hand</span>
        <span>Limit: {money(agent.limit)} ({percent}%)</span>
      </div>
      <div className="bank-risk-bar" role="img" aria-label={`${percent}% of limit`}>
        <span style={{ width: `${fill}%` }} />
      </div>
    </div>
  )
}

export default function BankHomePage({ user, onUserUpdated, onLoggedOut, onNavigate }) {
  const [dashboard, setDashboard] = useState(null)
  const [dashboardError, setDashboardError] = useState('')
  const [txState, setTxState] = useState({ transactions: [], total: 0, pageSize: 5 })
  const [txError, setTxError] = useState('')
  const [txLoading, setTxLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [approvingId, setApprovingId] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))

  const loadDashboard = useCallback(async () => {
    try {
      setDashboard(await getBankDashboard({ date: selectedDate }))
      setDashboardError('')
    } catch (error) {
      setDashboardError(error.message)
    }
  }, [selectedDate])

  const loadTransactions = useCallback(async () => {
    setTxLoading(true)
    try {
      setTxState(await getBankTransactions({ page, search, date: selectedDate }))
      setTxError('')
    } catch (error) {
      setTxError(error.message)
    } finally {
      setTxLoading(false)
    }
  }, [page, search, selectedDate])

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate)
    setPage(1)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([loadTransactions(), loadDashboard()])
      broadcastCancellationsChanged()
      setNotice('Live transactions and metrics reloaded.')
    } catch (error) {
      setNotice(error?.message || 'Failed to refresh transactions.')
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTransactions()
  }, [loadTransactions])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const approve = async (transaction) => {
    setApprovingId(transaction._id)
    try {
      await approveTransaction(transaction._id)
      setNotice(`${transaction.receiptNo} approved.`)
      await Promise.all([loadTransactions(), loadDashboard()])
    } catch (error) {
      setNotice(error.message)
    } finally {
      setApprovingId(null)
    }
  }

  const kpis = dashboard?.kpis
  const bank = dashboard?.bank
  const displayName = dashboard?.user.name || user?.name || ''
  const pageCount = Math.max(1, Math.ceil(txState.total / txState.pageSize))
  const from = txState.total ? (page - 1) * txState.pageSize + 1 : 0
  const to = (page - 1) * txState.pageSize + txState.transactions.length
  const pendingTx = txState.transactions.filter((tx) => tx.status === 'P').length

  const todayStr = new Date().toISOString().slice(0, 10)
  const isToday = selectedDate === todayStr
  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const dateLabel = isToday ? 'Today' : formattedDate

  return (
    <BankShell
      active="dashboard"
      bank={bank}
      designation={dashboard?.user.designation}
      displayName={displayName}
      isRefreshing={isRefreshing || txLoading}
      onDateChange={handleDateChange}
      onLoggedOut={onLoggedOut}
      onNavigate={onNavigate}
      onRefresh={handleRefresh}
      onUserUpdated={onUserUpdated}
      pendingCancellationsCount={kpis?.pendingCount ?? 0}
      selectedDate={selectedDate}
      user={user}
    >
        <main className="bank-main">
          {dashboardError && (
            <p className="bank-error" role="alert">
              {dashboardError} <button type="button" onClick={loadDashboard}>Retry</button>
            </p>
          )}

          <section className="bank-kpis" aria-label="Key metrics">
            <article className="bank-kpi">
              <p className="bank-kpi-label">NET COLLECTIONS (TOTAL)</p>
              <p className="bank-kpi-value">{kpis ? money(kpis.netCollections) : '—'}</p>
              {kpis && (
                <ul>
                  <li><span>Deposits</span><b>{money(kpis.deposits)}</b></li>
                  <li><span>Withdrawals</span><b className="is-negative">-{money(kpis.withdrawals)}</b></li>
                  <li className="bank-kpi-foot">{kpis.transactionCount} txns processed</li>
                </ul>
              )}
            </article>
            <article className="bank-kpi">
              <p className="bank-kpi-label">CASH COLLECTIONS</p>
              <p className="bank-kpi-value">{kpis ? money(kpis.cashMode?.net ?? 0) : '—'}</p>
              {kpis && (
                <ul>
                  <li><span>Deposits</span><b>{money(kpis.cashMode?.deposits ?? 0)}</b></li>
                  <li><span>Withdrawals</span><b className="is-negative">-{money(kpis.cashMode?.withdrawals ?? 0)}</b></li>
                  <li className="bank-kpi-foot">{kpis.cashMode?.count ?? 0} cash txns</li>
                </ul>
              )}
            </article>
            <article className="bank-kpi">
              <p className="bank-kpi-label">TRANSFER COLLECTIONS</p>
              <p className="bank-kpi-value">{kpis ? money(kpis.transferMode?.net ?? 0) : '—'}</p>
              {kpis && (
                <ul>
                  <li><span>Deposits</span><b>{money(kpis.transferMode?.deposits ?? 0)}</b></li>
                  <li><span>Withdrawals</span><b className="is-negative">-{money(kpis.transferMode?.withdrawals ?? 0)}</b></li>
                  <li className="bank-kpi-foot">{kpis.transferMode?.count ?? 0} transfer txns</li>
                </ul>
              )}
            </article>
            <article className="bank-kpi">
              <p className="bank-kpi-label">ACTIVE AGENTS</p>
              <p className="bank-kpi-value">
                {kpis ? kpis.agentsOnDuty : '—'}
                {kpis && <small> / {kpis.totalAgents} on duty</small>}
              </p>
            </article>
            <article className="bank-kpi">
              <p className="bank-kpi-label">CASH IN FIELD</p>
              <p className="bank-kpi-value">{kpis ? money(kpis.cashInField) : '—'}</p>
              {kpis?.overLimitCount > 0 && (
                <p className="bank-kpi-alert">
                  {kpis.overLimitCount} Agent{kpis.overLimitCount === 1 ? '' : 's'} Over Limit ({money(kpis.maxLimit)} max)
                </p>
              )}
            </article>
            <article className="bank-kpi">
              <p className="bank-kpi-label">PENDING APPROVALS <b className="bank-count">{kpis?.pendingCount ?? 0}</b></p>
              <p className="bank-kpi-value is-amber">{kpis ? money(kpis.pendingAmount) : '—'}</p>
              <p className="bank-kpi-foot-row">
                <span>Awaiting Approval</span>
                <a
                  href="#cancellations"
                  onClick={(e) => {
                    e.preventDefault()
                    onNavigate?.('cancellations')
                  }}
                >
                  Transaction &amp; Cancellation Queue →
                </a>
              </p>
            </article>
          </section>

          {dashboard && Array.isArray(dashboard.risk) && dashboard.risk.length > 0 && (
            <section className="bank-card" aria-labelledby="risk-title">
              <h2 id="risk-title">Risk Surveillance</h2>
              <p className="bank-card-sub">
                Monitoring agent cash holding limits to prevent unbanked cash float risk.
              </p>
              {dashboard.risk.map((agent) => <RiskRow agent={agent} key={agent._id} />)}
            </section>
          )}

          <section className="bank-card" id="approvals" aria-labelledby="receipts-title">
            <div className="bank-card-head">
              <div className="bank-card-title-wrap">
                <h2 id="receipts-title">
                  Live Receipts &amp; Approvals
                  <span className="bank-date-indicator">
                    • {dateLabel}
                  </span>
                  {pendingTx > 0 && <span className="bank-action-pill">{pendingTx} Action Items</span>}
                </h2>
                <button
                  type="button"
                  className="bank-btn-refresh"
                  onClick={handleRefresh}
                  disabled={isRefreshing || txLoading}
                  title="Reload live transactions & metrics"
                >
                  <svg
                    className={`bank-refresh-icon ${isRefreshing || txLoading ? 'is-spinning' : ''}`}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  <span>{isRefreshing || txLoading ? 'Refreshing…' : 'Refresh'}</span>
                </button>
              </div>
              <input
                aria-label="Search transactions"
                className="bank-search"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search customer, receipt, or ID..."
                value={searchInput}
              />
            </div>

            {notice && <p className="bank-notice" role="status">{notice}</p>}
            {txError && (
              <p className="bank-error" role="alert">
                {txError} <button type="button" onClick={loadTransactions}>Retry</button>
              </p>
            )}

            <div className="bank-table-scroll">
              <table className="bank-table">
                <thead>
                  <tr>
                    <th>TXN REF / RECEIPT</th>
                    <th>SCHEME</th>
                    <th>CUSTOMER &amp; COMMERCIAL UNIT</th>
                    <th>AGENT</th>
                    <th className="is-right">AMOUNT</th>
                    <th>TYPE</th>
                    <th>AUDIT STATUS</th>
                    <th className="is-right">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {txState.transactions.map((tx) => {
                    const status = statusMeta[tx.status]
                    const withdrawal = tx.type === 'W'
                    return (
                      <tr key={tx._id}>
                        <td><strong className="bank-mono">{tx.receiptNo}</strong></td>
                        <td><span className="bank-scheme">{tx.scheme}</span></td>
                        <td>
                          <strong>{tx.customer}</strong>
                          <small>{tx.customerDetail}</small>
                        </td>
                        <td>
                          {tx.agentName}
                          <small>{tx.agentCode}</small>
                        </td>
                        <td className={`is-right bank-amount ${withdrawal ? 'is-negative' : ''}`}>
                          {withdrawal ? '-' : ''}{money(tx.amount)}
                        </td>
                        <td>
                          <span className={`bank-type bank-type-${withdrawal ? 'w' : 'd'}`}>
                            {withdrawal ? 'WDL' : 'DEP'}
                          </span>
                        </td>
                        <td>
                          <span className={`bank-status bank-status-${status.tone}`} title={tx.cancellationReason ?? undefined}>
                            {status.label}
                          </span>
                        </td>
                        <td className="is-right">
                          {tx.status === 'P' && (
                            <button
                              className="bank-approve"
                              disabled={approvingId === tx._id}
                              onClick={() => approve(tx)}
                              type="button"
                            >
                              {approvingId === tx._id ? 'Approving…' : 'Approve'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {!txLoading && !txError && txState.transactions.length === 0 && (
                    <tr>
                      <td className="bank-empty" colSpan="8">
                        {search
                          ? 'No transactions match this search.'
                          : `No transactions recorded for ${isToday ? 'today' : formattedDate}.`}
                      </td>
                    </tr>
                  )}
                  {txLoading && txState.transactions.length === 0 && (
                    <tr><td className="bank-empty" colSpan="8">Loading transactions…</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bank-table-footer">
              <span>
                Showing {from === 0 ? 0 : `${from}–${to}`} of {txState.total} transactions ({dateLabel})
                <span className="bank-dot">•</span> Page {page} of {pageCount}
              </span>
              <div className="bank-pager">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} type="button">Previous</button>
                <button className="is-current" type="button" aria-current="page">{page}</button>
                <button disabled={page >= pageCount} onClick={() => setPage(page + 1)} type="button">Next</button>
              </div>
            </div>
          </section>
        </main>
    </BankShell>
  )
}
