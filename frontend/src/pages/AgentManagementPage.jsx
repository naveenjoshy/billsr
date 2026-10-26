import { useCallback, useEffect, useMemo, useState } from 'react'
import AddAgentModal from '../components/AddAgentModal'
import BankShell from '../components/BankShell'
import { dateText, initials, money } from '../components/bankShellUtils'
import { getBankAgents } from '../services/bankService'
import './AgentManagementPage.css'

const PAGE_SIZE = 5

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

const FILTERS = [
  { key: 'all', label: 'All Statuses' },
  { key: 'warning', label: 'Warnings' },
  { key: 'breach', label: 'At Risk' },
]

function Avatar({ agent, large = false }) {
  const size = large ? 'am-avatar am-avatar-lg' : 'am-avatar'
  return agent.photoUrl ? (
    <img alt="" className={size} src={agent.photoUrl} />
  ) : (
    <span className={`${size} am-avatar-fallback`}>{initials(agent.name)}</span>
  )
}

function limitBarTone(agent) {
  if (agent.ratio > 1) return 'over'
  if (agent.ratio >= 0.85) return 'near'
  return 'safe'
}

function durationLabel(agent) {
  if (agent.held <= 0) return { text: '0 Days (Settled)', tone: 'settled' }
  const text = plural(agent.durationDays, 'Day') + (agent.durationDays > agent.holdingDays ? ' (Breached)' : '')
  return { text, tone: agent.durationDays > agent.holdingDays ? 'breach' : 'open' }
}

export default function AgentManagementPage({ user, onUserUpdated, onLoggedOut, onNavigate }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await getBankAgents())
      setError('')
    } catch (err) {
      setError(err.message)
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

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return agents.filter((agent) => {
      if (filter !== 'all' && agent.risk !== filter) return false
      if (!term) return true
      return [agent.name, agent.agentCode, agent.phone].some((value) => value?.toLowerCase().includes(term))
    })
  }, [agents, filter, search])

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const rows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const selected = agents.find((agent) => agent._id === selectedId) ?? visible[0] ?? agents[0] ?? null
  const from = visible.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0

  const counts = {
    all: agents.length,
    warning: summary?.approachingCount ?? 0,
    breach: summary?.breachCount ?? 0,
  }

  const limitText = summary
    ? summary.minLimit === summary.maxLimit
      ? { value: money(summary.maxLimit), unit: '/agent' }
      : { value: `${money(summary.minLimit)} – ${money(summary.maxLimit)}`, unit: '/agent' }
    : { value: '—', unit: '' }

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
      <main className="am-main">
        <div className="am-head">
          <div>
            <span className="am-tag">RISK GOVERNANCE CORE</span>
            <h1>Field Collection Agent Directory &amp; Risk Controls</h1>
          </div>
          <div className="am-tools">
            <input
              aria-label="Search agents"
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search agent name, ID..."
              value={search}
            />
            <button className="am-add" onClick={() => setAdding(true)} type="button">
              + Add Agent
            </button>
          </div>
        </div>

        {notice && <p className="am-notice" role="status">{notice}</p>}
        {error && (
          <p className="am-error" role="alert">
            {error} <button onClick={load} type="button">Retry</button>
          </p>
        )}

        <section className="am-policy" aria-label="Policy parameters">
          <article>
            <p>CASH HOLDING LIMIT</p>
            <strong>{limitText.value}<small> {limitText.unit}</small></strong>
            <span>Ceiling across all active schemes</span>
          </article>
          <article>
            <p>UNSETTLED LIMIT</p>
            <strong>{summary ? summary.maxHoldingDays : '—'}<small> Days max</small></strong>
            <span>Mandatory vault hand-off period</span>
          </article>
          <article>
            <p>WARNING THRESHOLD</p>
            <strong>85%<small> of limit</small></strong>
            <span>Agents above this are flagged as approaching</span>
          </article>
        </section>

        <section className="am-kpis" aria-label="Agent metrics">
          <article>
            <p>FIELD AGENTS DEPLOYED</p>
            <strong>{summary ? summary.totalAgents : '—'}</strong>
            {summary && <span className="am-good">{summary.verifiedAgents} credential-verified</span>}
          </article>
          <article>
            <p>AGGREGATED CASH IN FIELD</p>
            <strong>{summary ? money(summary.cashInField) : '—'}</strong>
            {summary && <span>Combined limit {money(summary.dailyTarget)}</span>}
          </article>
          <article className="am-kpi-breach">
            <p>HOLDING LIMIT BREACHES</p>
            <strong>{summary ? plural(summary.breachCount, 'Agent') : '—'}</strong>
          </article>
          <article className="am-kpi-warn">
            <p>HOLDING LIMIT APPROACHING</p>
            <strong>{summary ? plural(summary.approachingCount, 'Agent') : '—'}</strong>
            <span>&gt; 85% cash limit threshold</span>
          </article>
        </section>

        <div className="am-layout">
          <section className="am-card" aria-labelledby="am-registry">
            <div className="am-card-head">
              <h2 id="am-registry">
                Agent Registry <span className="am-pill">{visible.length} of {agents.length} Records</span>
              </h2>
              <div className="am-tabs" role="tablist">
                {FILTERS.map((item) => (
                  <button
                    aria-selected={filter === item.key}
                    className={filter === item.key ? 'is-on' : ''}
                    key={item.key}
                    onClick={() => {
                      setFilter(item.key)
                      setPage(1)
                    }}
                    role="tab"
                    type="button"
                  >
                    {item.label}{item.key === 'all' ? '' : ` (${counts[item.key]})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="am-scroll">
              <table className="am-table">
                <thead>
                  <tr>
                    <th>AGENT PROFILE &amp; CONTACT</th>
                    <th>CUSTOMERS</th>
                    <th>TODAY&apos;S TXNS</th>
                    <th>CASH IN HAND / CEILING</th>
                    <th>DURATION</th>
                    <th>SECURITY / CREDENTIAL</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((agent) => {
                    const tone = limitBarTone(agent)
                    const duration = durationLabel(agent)
                    return (
                      <tr
                        aria-selected={selected?._id === agent._id}
                        className={`am-row am-risk-${agent.risk} ${selected?._id === agent._id ? 'is-selected' : ''}`}
                        key={agent._id}
                        onClick={() => setSelectedId(agent._id)}
                      >
                        <td>
                          <div className="am-profile">
                            <Avatar agent={agent} />
                            <div>
                              <strong>{agent.name}</strong>
                              <small>{agent.agentCode}</small>
                              <small>{agent.phone}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong>{agent.customers}</strong>
                          <small>Assigned</small>
                          <small>{agent.totalReceipts} total receipts</small>
                        </td>
                        <td>
                          <span className="am-dep">{agent.todayDeposits} Dep</span> /{' '}
                          <span className="am-wdl">{agent.todayWithdrawals} Wdl</span>
                        </td>
                        <td>
                          <div className="am-cash">
                            <strong className={`am-cash-${tone}`}>{money(agent.held)}</strong>
                            <small>/ {money(agent.limit)}</small>
                          </div>
                          <div
                            aria-label={`${Math.round(agent.ratio * 100)}% of limit`}
                            className="am-bar"
                            role="img"
                          >
                            <span className={`am-fill-${tone}`} style={{ width: `${Math.min(agent.ratio * 100, 100)}%` }} />
                          </div>
                          <small className={`am-cash-${tone}`}>
                            {agent.excess > 0
                              ? `+${money(agent.excess)} Over Ceiling`
                              : `${Math.round(agent.ratio * 100)}% of limit`}
                          </small>
                        </td>
                        <td><span className={`am-duration am-duration-${duration.tone}`}>{duration.text}</span></td>
                        <td>
                          {agent.passwordResetPending ? (
                            <span className="am-cred am-cred-pending">Pending Reset<small>First Login Req</small></span>
                          ) : (
                            <span className="am-cred am-cred-ok">
                              Completed
                              <small>{agent.lastPasswordChange ? dateText(agent.lastPasswordChange) : '—'}</small>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {loading && !agents.length && (
                    <tr><td className="am-empty" colSpan="6">Loading agents…</td></tr>
                  )}
                  {!loading && !error && rows.length === 0 && (
                    <tr>
                      <td className="am-empty" colSpan="6">
                        {agents.length ? 'No agents match the current filter.' : 'No agents are registered under this bank yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="am-footer">
              <span>Showing {from ? `${from} to ${from + rows.length - 1}` : 0} of {visible.length} agents registered</span>
              <div className="am-pager">
                <button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} type="button">Previous</button>
                {Array.from({ length: pageCount }, (_, index) => (
                  <button
                    aria-current={index + 1 === currentPage ? 'page' : undefined}
                    className={index + 1 === currentPage ? 'is-current' : ''}
                    key={index}
                    onClick={() => setPage(index + 1)}
                    type="button"
                  >
                    {index + 1}
                  </button>
                ))}
                <button disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} type="button">Next</button>
              </div>
            </div>
          </section>

          <aside className="am-side" aria-label="Selected agent">
            <section className="am-card">
              <p className="am-side-title">SELECTED AGENT</p>
              {!selected && <p className="am-empty">Select an agent to see details.</p>}
              {selected && (
                <>
                  <div className="am-profile am-profile-lg">
                    <Avatar agent={selected} large />
                    <div>
                      <strong>{selected.name}</strong>
                      <small>{selected.agentCode}</small>
                      <small>{selected.email}</small>
                    </div>
                  </div>
                  <div className={`am-custody am-risk-${selected.risk}`}>
                    <p>CUSTODY {selected.risk === 'safe' ? 'STATUS' : 'WARNING'}</p>
                    <strong>{money(selected.held)}</strong>
                    <span>
                      Threshold is {money(selected.limit)}
                      {selected.excess > 0 ? ` • ${money(selected.excess)} in unremitted excess.` : '.'}
                    </span>
                    <div className="am-bar">
                      <span className={`am-fill-${limitBarTone(selected)}`} style={{ width: `${Math.min(selected.ratio * 100, 100)}%` }} />
                    </div>
                  </div>
                  <p className="am-side-title">FIELD ROUTE BREAKDOWN</p>
                  <div className="am-stats">
                    <div><small>Customers Assigned</small><strong>{selected.customers}</strong></div>
                    <div>
                      <small>Settlement Window</small>
                      <strong>{plural(selected.holdingDays, 'Day')}</strong>
                    </div>
                  </div>
                  <p className="am-address">{selected.address}</p>
                </>
              )}
            </section>

            <section className="am-card">
              <p className="am-side-title">RECENT ACTIVITY</p>
              {selected && selected.recent.length === 0 && <p className="am-empty">No transactions yet.</p>}
              <ul className="am-activity">
                {selected?.recent.map((tx) => (
                  <li key={tx._id}>
                    <strong>
                      {tx.receiptNo} • {tx.type === 'D' ? 'Deposit' : 'Withdrawal'} {money(tx.amount)}
                    </strong>
                    <small>
                      {tx.customer} • {dateText(tx.date)}
                      {tx.status === 'C' ? ' • Cancelled' : tx.status === 'P' ? ' • Pending' : ''}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </main>
      {adding && (
        <AddAgentModal
          onClose={() => setAdding(false)}
          onCreated={(created) => {
            setAdding(false)
            setNotice(`${created.name} (${created.userID}) was added.`)
            setSelectedId(created._id)
            load()
          }}
        />
      )}
    </BankShell>
  )
}
