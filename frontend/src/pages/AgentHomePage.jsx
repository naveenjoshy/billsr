import { useEffect, useState } from 'react'
import UserMenu from '../components/UserMenu'
import { getAgentHome } from '../services/agentService'
import './BankHomePage.css'
import './AgentHomePage.css'

const inr = (value, decimals = 2) =>
  `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`

const timeText = (value) =>
  new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

function Icon({ children, size = 20, ...rest }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width={size}
      {...rest}
    >
      {children}
    </svg>
  )
}

const icons = {
  shield: <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  wallet: <path d="M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 7l12-3v3M17 14h2" />,
  qr: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM20 14v6h-3" />,
  deposit: <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />,
  payout: <path d="M12 20V8M7 13l5-5 5 5M5 4h14" />,
  print: <path d="M7 9V3h10v6M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2M7 14h10v7H7z" />,
  handover: <path d="M3 12h13M12 7l5 5-5 5M21 5v14" />,
  home: <path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />,
  transact: <path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" />,
  onboard: <path d="M15 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M8.5 10a4 4 0 100-8 4 4 0 000 8zM19 8v6M16 11h6" />,
  ledger: <path d="M5 4h12a2 2 0 012 2v14H7a2 2 0 01-2-2zM5 18a2 2 0 012-2h12M9 8h6" />,
  check: <path d="M20 6L9 17l-5-5" />,
  clock: <path d="M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z" />,
  map: <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" />,
}

const glyph = (name, size) => <Icon size={size}>{icons[name]}</Icon>

const OPERATIONS = [
  { key: 'qr', label: 'Scan QR', icon: 'qr', tone: 'orange' },
  { key: 'deposit', label: 'Deposit (D)', icon: 'deposit', tone: 'green' },
  { key: 'payout', label: 'Payout (W)', icon: 'payout', tone: 'red' },
  { key: 'print', label: 'Print Slip', icon: 'print', tone: 'dark' },
  { key: 'handover', label: 'Handover', icon: 'handover', tone: 'dark' },
]

const NAV = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'transact', label: 'Transact', icon: 'transact' },
  { key: 'onboard', label: 'Onboard', icon: 'onboard' },
  { key: 'ledger', label: 'Ledger', icon: 'ledger' },
]

function QueueRow({ item }) {
  const withdrawal = item.type === 'W'
  const cancelled = item.status === 'C'
  const pending = item.status === 'P'
  const state = cancelled ? 'cancelled' : pending ? 'pending' : 'done'
  const label = cancelled ? 'Cancelled' : pending ? 'Pending' : 'Completed'
  return (
    <li className={`ah-row ${withdrawal ? 'ah-row-withdraw' : ''}`}>
      <span className={`ah-row-icon ${withdrawal ? 'is-withdraw' : ''}`}>{glyph(withdrawal ? 'payout' : 'deposit', 20)}</span>
      <div className="ah-row-main">
        <div className="ah-row-title">
          <strong>{item.customer}</strong>
          {item.scheme && <em className="ah-tag">{item.scheme}</em>}
        </div>
        <span className="ah-row-sub">
          {withdrawal ? 'Withdrawal' : 'Deposit'} • Slip #{item.receiptNo}
        </span>
      </div>
      <div className="ah-row-side">
        <strong className={withdrawal ? 'is-neg' : ''}>
          {withdrawal ? '-' : ''}
          {inr(item.amount)}
        </strong>
        <span className={`ah-pill ah-pill-${state}`}>
          {glyph(pending ? 'clock' : 'check', 12)}
          {label}
        </span>
        <small>{timeText(item.at)}</small>
      </div>
    </li>
  )
}

export default function AgentHomePage({ user, onLoggedOut, onUserUpdated }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getAgentHome()
      .then((result) => active && setData(result))
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [])

  const name = data?.agent.name ?? user.name
  const hold = data?.cashHold
  const utilization = hold ? hold.utilization : 0
  const level = utilization >= 100 ? 'breach' : utilization >= 85 ? 'warning' : 'ok'

  return (
    <div className="bank-shell ah-page">
      <aside className="bank-sidebar ah-side" aria-label="Agent navigation">
        <div className="bank-brand">
          <span className="bank-brand-mark">B</span>
          <span className="bank-brand-name">
            <strong>Billsr</strong>
            <small>FIELD AGENT</small>
          </span>
        </div>
        <nav className="bank-nav" aria-label="FIELD OPERATIONS">
          <p>Collection Agent Portal</p>
          {NAV.map((item) => (
            <a
              className={item.key === 'home' ? 'is-active' : ''}
              href="#top"
              key={item.key}
              onClick={(event) => event.preventDefault()}
            >
              {item.key === 'home' ? 'Dashboard' : item.label}
            </a>
          ))}
        </nav>
        <div className="bank-sync">
          <span>
            COLLECTION SYNC <i /> Live
          </span>
          <code>{data?.agent.userID || 'Agent'}</code>
        </div>
      </aside>

      <div className="bank-content ah-content" id="top">
      <header className="bank-topbar">
        <div className="bank-topbar-left">
          <span className="bank-chip">{data?.agent.bankName || 'Loading…'}</span>
          {hold && (
            <span className={`bank-license ah-limit-${level}`}>
              Day {hold.dayNumber} of {hold.holdingDays} Cash Holding
            </span>
          )}
        </div>
        <UserMenu
          onLoggedOut={onLoggedOut}
          onUserUpdated={onUserUpdated}
          subtitle={data?.agent.bankName || 'Field Agent'}
          title={name}
          user={user}
        />
      </header>

      <main className="bank-main ah-main">
        {error && <p className="ah-state" role="alert">{error}</p>}
        {!data && !error && <p className="ah-state" role="status">Loading your dashboard...</p>}

        {data && (
          <>
            <section className="ah-card ah-hold">
              <div className="ah-hold-head">
                <h2>
                  <span className="ah-shield">{glyph('shield', 20)}</span>
                  Cash Hold Limit
                </h2>
                <span className="ah-day">
                  Day {hold.dayNumber} of {hold.holdingDays} {hold.holdingDays === 1 ? 'Day' : 'Days'} Max
                </span>
              </div>
              <div className="ah-hold-figures">
                <div>
                  <span>CASH IN HAND</span>
                  <strong>{inr(hold.held)}</strong>
                </div>
                <div className="ah-right">
                  <span>HARD LIMIT</span>
                  <b>{inr(hold.limit)}</b>
                </div>
              </div>
              <div className={`ah-bar is-${level}`}>
                <div style={{ width: `${Math.min(utilization, 100)}%` }} />
              </div>
              <div className="ah-hold-foot">
                <span className={`ah-util is-${level}`}>Current Utilization: {utilization.toFixed(1)}%</span>
                <span>Remaining: {inr(hold.remaining)}</span>
              </div>
            </section>

            <section className="ah-kpis">
              <div className="ah-card ah-kpi">
                <span className="ah-kpi-icon is-green">{glyph('down', 16)}</span>
                <span>Collected</span>
                <strong>{inr(data.today.collected, 0)}</strong>
              </div>
              <div className="ah-card ah-kpi">
                <span className="ah-kpi-icon is-red">{glyph('up', 16)}</span>
                <span>Payouts</span>
                <strong>{inr(data.today.payouts, 0)}</strong>
              </div>
              <div className="ah-card ah-kpi">
                <span className="ah-kpi-icon is-indigo">{glyph('wallet', 16)}</span>
                <span>Cash In Hand</span>
                <strong className={data.today.net >= 0 ? 'is-pos' : 'is-neg'}>
                  {data.today.net >= 0 ? '+' : '-'}
                  {inr(Math.abs(data.today.net), 0)}
                </strong>
              </div>
            </section>

            <section className="ah-ops">
              <div className="ah-sec-head">
                <h2>Instant Operations</h2>
                <span>Tap to Launch</span>
              </div>
              <div className="ah-tiles">
                {OPERATIONS.map((op) => (
                  <button className="ah-tile" key={op.key} type="button">
                    <span className={`ah-tile-icon is-${op.tone}`}>{glyph(op.icon, 24)}</span>
                    <span>{op.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="ah-queue">
              <div className="ah-sec-head">
                <div>
                  <h2>Today&apos;s Collection Queue</h2>
                  <p>
                    {data.queue.visited} of {data.queue.customers} Vendors visited
                  </p>
                </div>
                <button className="ah-map" type="button">
                  {glyph('map', 16)} Map View ›
                </button>
              </div>
              {data.queue.items.length ? (
                <ul className="ah-list">
                  {data.queue.items.map((item) => (
                    <QueueRow item={item} key={item._id} />
                  ))}
                </ul>
              ) : (
                <p className="ah-empty">No transactions recorded today.</p>
              )}
            </section>
          </>
        )}
      </main>
      </div>
    </div>
  )
}
