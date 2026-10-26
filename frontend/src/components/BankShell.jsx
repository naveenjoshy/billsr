import '../pages/BankHomePage.css'
import UserMenu from './UserMenu'
import { dateText, licenseLabels } from './bankShellUtils'

const navItems = [
  {
    group: 'DAILY OPERATIONS',
    items: [
      { label: 'Dashboard', view: 'dashboard' },
      { label: 'Agent Management & Risk', view: 'agents' },
      { label: 'Transaction Ledger', view: 'ledger' },
      { label: 'Cancellation Queue', view: 'cancellations', badge: 4 },
      { label: 'Schemes & Receipts' },
    ],
  },
  {
    group: 'GOVERNANCE',
    items: [{ label: 'Compliance & Params' }, { label: 'Settings & License' }],
  },
]

export default function BankShell({
  active,
  bank,
  designation,
  displayName,
  user,
  onNavigate,
  onUserUpdated,
  onLoggedOut,
  children,
}) {
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
