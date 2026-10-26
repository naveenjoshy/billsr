import { useCallback, useEffect, useState } from 'react'
import './BankHomePage.css'
import {
  approveTransaction,
  getBankDashboard,
  getBankTransactions,
} from '../services/bankService'

const money = (value) => {
  const formatted = Math.abs(value).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
  return value < 0 ? `-${formatted}` : formatted
}

const dateText = (value) =>
  new Date(value).toLocaleDateString('en-CA', { timeZone: 'UTC' })

const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

const statusMeta = {
  P: { label: 'Pending', tone: 'pending' },
  A: { label: 'Confirmed', tone: 'confirmed' },
  C: { label: 'Cancelled', tone: 'cancelled' },
}

const licenseLabels = {
  active: 'License Active',
  expiring: 'License Expiring',
  grace: 'In Grace Period',
  suspended: 'License Suspended',
}

const navItems = [
  { group: 'DAILY OPERATIONS', items: ['Dashboard', 'Agent Management & Risk', 'Transaction Ledger', 'Schemes & Receipts'] },
  { group: 'GOVERNANCE', items: ['Compliance & Params', 'Settings & License'] },
]

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

export default function BankHomePage({ user }) {
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

  const loadDashboard = useCallback(async () => {
    try {
      setDashboard(await getBankDashboard())
      setDashboardError('')
    } catch (error) {
      setDashboardError(error.message)
    }
  }, [])

  const loadTransactions = useCallback(async () => {
    setTxLoading(true)
    try {
      setTxState(await getBankTransactions({ page, search }))
      setTxError('')
    } catch (error) {
      setTxError(error.message)
    } finally {
      setTxLoading(false)
    }
  }, [page, search])

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

  return (
    <div className="bank-shell">
      <aside className="bank-sidebar">
        <div className="bank-brand">
          <span className="bank-brand-mark">B</span>
          <span className="bank-brand-name">
            <strong>Billsr</strong>
            <small>ADMIN CORE</small>
          </span>
          <span className="bank-version">v3.0</span>
        </div>
        {navItems.map((section) => (
          <nav className="bank-nav" key={section.group} aria-label={section.group}>
            <p>{section.group}</p>
            {section.items.map((item) => (
              <a className={item === 'Dashboard' ? 'is-active' : ''} href="#top" key={item}>
                {item}
              </a>
            ))}
          </nav>
        ))}
        <div className="bank-sync">
          <span>AGENT SYNC <i /> Live</span>
          <code>Bank Core Unified</code>
        </div>
      </aside>

      <div className="bank-content" id="top">
        <header className="bank-topbar">
          <div className="bank-topbar-left">
            <span className="bank-chip">{bank?.name ?? 'Loading…'}</span>
            {bank && (
              <span className={`bank-license bank-license-${bank.status}`}>
                {licenseLabels[bank.status]}: Expires {dateText(bank.licenseExpiry)} ({Math.max(bank.daysLeft, 0)} Days)
              </span>
            )}
          </div>
          <div className="bank-user">
            <strong>{bank?.name}</strong>
            <span>{dashboard?.user.designation || displayName}</span>
          </div>
        </header>

        <main className="bank-main">
          {dashboardError && (
            <p className="bank-error" role="alert">
              {dashboardError} <button type="button" onClick={loadDashboard}>Retry</button>
            </p>
          )}

          <section className="bank-kpis" aria-label="Key metrics">
            <article className="bank-kpi">
              <p className="bank-kpi-label">NET COLLECTIONS (TODAY)</p>
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
                <a href="#approvals">Review Queue →</a>
              </p>
            </article>
            <article className="bank-kpi">
              <p className="bank-kpi-label">BANK LICENSE</p>
              <p className="bank-kpi-value">
                {bank ? Math.max(bank.daysLeft, 0) : '—'}<small> Days Left</small>
              </p>
              {bank && (
                <p className="bank-kpi-foot-row">
                  <span>Expires {dateText(bank.licenseExpiry)}</span>
                  <b className={`bank-health bank-health-${bank.status}`}>
                    {bank.status === 'active' ? 'Healthy' : licenseLabels[bank.status]}
                  </b>
                </p>
              )}
            </article>
          </section>

          <section className="bank-card" aria-labelledby="risk-title">
            <h2 id="risk-title">Risk Surveillance</h2>
            <p className="bank-card-sub">
              Monitoring agent cash holding limits to prevent unbanked cash float risk.
            </p>
            {dashboard && dashboard.risk.length === 0 && (
              <p className="bank-empty">No agents are near their cash holding limit.</p>
            )}
            {dashboard?.risk.map((agent) => <RiskRow agent={agent} key={agent._id} />)}
          </section>

          <section className="bank-card" id="approvals" aria-labelledby="receipts-title">
            <div className="bank-card-head">
              <h2 id="receipts-title">
                Live Receipts &amp; Approvals
                {pendingTx > 0 && <span className="bank-action-pill">{pendingTx} Action Items</span>}
              </h2>
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
                        {search ? 'No transactions match this search.' : 'No transactions have been recorded yet.'}
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
                Showing {from === 0 ? 0 : `${from}–${to}`} of {txState.total} transactions
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
      </div>
    </div>
  )
}
