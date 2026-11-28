import { useEffect, useState } from 'react'
import '../pages/BankHomePage.css'
import UserMenu from './UserMenu'
import { dateText, licenseLabels } from './bankShellUtils'
import { getPendingCancellationsCount } from '../services/bankService'

export default function BankShell({
  active,
  bank,
  designation,
  displayName,
  user,
  pendingCancellationsCount,
  onNavigate,
  onUserUpdated,
  onLoggedOut,
  onRefresh,
  isRefreshing,
  children,
}) {
  const [polledCount, setPolledCount] = useState(null)

  useEffect(() => {
    let active = true

    const fetchCount = async () => {
      try {
        const res = await getPendingCancellationsCount()
        if (active && res && typeof res.count === 'number') {
          setPolledCount(res.count)
        }
      } catch {
        // Silently ignore errors
      }
    }

    fetchCount()

    // Refresh ONLY when explicitly triggered (agent requested/cancelled cancellation, or bank accepted/rejected)
    const handleCancellationsChanged = () => fetchCount()
    const handleStorage = (e) => {
      if (e.key === 'billsr:cancellations-updated') {
        fetchCount()
      }
    }

    window.addEventListener('bank:cancellations-updated', handleCancellationsChanged)
    window.addEventListener('storage', handleStorage)

    return () => {
      active = false
      window.removeEventListener('bank:cancellations-updated', handleCancellationsChanged)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const displayCount =
    polledCount !== null
      ? polledCount
      : typeof pendingCancellationsCount === 'number'
      ? pendingCancellationsCount
      : 0

  const navItems = [
    {
      group: 'DAILY OPERATIONS',
      items: [
        { label: 'Dashboard', view: 'dashboard' },
        { label: 'Agent Management & Risk', view: 'agents' },
        {
          label: 'Transaction and Cancellation',
          view: 'cancellations',
          badge: displayCount > 0 ? displayCount : undefined,
        },
        { label: 'Schemes & Receipts', view: 'schemes' },
      ],
    },
    {
      group: 'GOVERNANCE',
      items: [{ label: 'Compliance & Params' }, { label: 'Settings & License' }],
    },
  ]

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
              <a
                aria-current={item.view === active ? 'page' : undefined}
                className={item.view === active ? 'is-active' : ''}
                href="#top"
                key={item.label}
                onClick={(event) => {
                  event.preventDefault()
                  if (item.view && item.view !== active) onNavigate?.(item.view)
                }}
              >
                <span>{item.label}</span>
                {item.badge != null && <span className="nav-item-badge">{item.badge}</span>}
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
          {onRefresh && (
            <button
              type="button"
              className="bank-topbar-refresh"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Reload live transactions & metrics"
            >
              <svg
                className={`bank-refresh-icon ${isRefreshing ? 'is-spinning' : ''}`}
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
              <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          )}
          <UserMenu
            onLoggedOut={onLoggedOut}
            onUserUpdated={onUserUpdated}
            subtitle={designation || bank?.name || ''}
            title={displayName}
            user={user ?? {}}
          />
        </header>
        {children}
      </div>
    </div>
  )
}
