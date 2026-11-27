import { useState, useRef, useEffect } from 'react'
import { logoutUser } from '../services/authService'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import './AgentHome.css'

import cashLimitIcon from '../assets/agent/cash-limit.svg'
import collectedIcon from '../assets/agent/collected.svg'
import payoutsIcon from '../assets/agent/payouts.svg'
import cashInHandIcon from '../assets/agent/cash-in-hand.svg'
import scanQrIcon from '../assets/agent/scan-qr.svg'
import depositIcon from '../assets/agent/deposit.svg'
import payoutIcon from '../assets/agent/payout.svg'
import printSlipIcon from '../assets/agent/print-slip.svg'
import handoverIcon from '../assets/agent/handover.svg'
import mapArrowIcon from '../assets/agent/map-arrow.svg'
import storeCheckIcon from '../assets/agent/store-check.svg'
import storeNextIcon from '../assets/agent/store-next.svg'
import storePendingIcon from '../assets/agent/store-pending.svg'
import navHomeIcon from '../assets/agent/nav-home.svg'
import navTransactIcon from '../assets/agent/nav-transact.svg'
import navOnboardIcon from '../assets/agent/nav-onboard.svg'
import navLedgerIcon from '../assets/agent/nav-ledger.svg'

export default function AgentHome({ user, onLoggedOut }) {
  const [activeTab, setActiveTab] = useState('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const { theme, toggleTheme } = useTheme()
  const { toast } = useToast()

  const agentName = user?.name || 'Ramesh Iyer'
  const initials = agentName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'RI'

  useEffect(() => {
    if (!menuOpen) return undefined
    const handleClose = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !menuRef.current?.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClose)
    document.addEventListener('keydown', handleClose)
    return () => {
      document.removeEventListener('mousedown', handleClose)
      document.removeEventListener('keydown', handleClose)
    }
  }, [menuOpen])

  const handleLogout = async () => {
    try {
      await logoutUser()
      if (onLoggedOut) onLoggedOut()
    } catch {
      if (onLoggedOut) onLoggedOut()
    }
  }

  const handleAction = (actionName) => {
    toast.info(`${actionName} launched`, 'Field Operation', 2200)
  }

  return (
    <div className="agent-shell" data-node-id="4:1673">
      {/* Mobile-constrained Application Container */}
      <div className="agent-container" data-node-id="4:1674">
        {/* Top Header */}
        <header className="agent-header" data-node-id="4:1897">
          <div className="agent-header-row" data-node-id="4:1898">
            <div className="agent-brand" data-node-id="4:1899">
              <div className="agent-brand-mark" data-node-id="4:1900">
                <span className="agent-brand-letter" data-node-id="4:1902">B</span>
              </div>
              <div className="agent-brand-text" data-node-id="4:1903">
                <div className="agent-brand-title-wrap" data-node-id="4:1904">
                  <span className="agent-brand-name" data-node-id="4:1906">Billsr</span>
                  <span className="agent-role-pill" data-node-id="4:1908">AGENT</span>
                </div>
                <span className="agent-brand-sub" data-node-id="4:1910">Dashboard</span>
              </div>
            </div>

            <div className="agent-profile-section" data-node-id="4:1677" ref={menuRef}>
              <button
                type="button"
                className="agent-profile-btn"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-expanded={menuOpen}
                aria-label="Agent options menu"
              >
                <span className="agent-profile-name" data-node-id="4:1687">{agentName}</span>
                <div className="agent-avatar-wrap" data-node-id="4:1679">
                  <div className="agent-avatar" data-node-id="4:1680">
                    <span data-node-id="4:1681">{initials}</span>
                  </div>
                  <span className="agent-online-dot" data-node-id="4:1682" />
                </div>
              </button>

              {menuOpen && (
                <div className="agent-dropdown-menu" role="menu">
                  <div className="agent-dropdown-head">
                    <strong>{agentName}</strong>
                    <span>{user?.email || 'agent@billsr.internal'}</span>
                    <small>{user?.userID ? `Agent ID: ${user.userID}` : 'Branch: Central Market'}</small>
                  </div>
                  <button
                    type="button"
                    className="agent-dropdown-item agent-theme-btn"
                    onClick={() => {
                      toggleTheme()
                      toast.info(`Theme set to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`, 'Theme Updated', 2000)
                    }}
                    role="menuitem"
                  >
                    <span>{theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}</span>
                    <span className="agent-theme-state">{theme === 'dark' ? 'Dark' : 'Light'}</span>
                  </button>
                  <button
                    type="button"
                    className="agent-dropdown-item agent-logout-btn"
                    onClick={handleLogout}
                    role="menuitem"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content Body */}
        <main className="agent-main" data-node-id="4:1675">
          {/* 1. Cash Hold Limit Risk Tracker Card */}
          <section className="agent-card cash-limit-card" data-node-id="4:1706">
            <div className="agent-card-top" data-node-id="4:1707">
              <div className="agent-card-title-group" data-node-id="4:1708">
                <div className="agent-limit-icon" data-node-id="4:1709">
                  <img src={cashLimitIcon} alt="" width="13.33" height="16.67" />
                </div>
                <h2 className="agent-card-title" data-node-id="4:1712">Cash Hold Limit</h2>
              </div>
              <div className="agent-grace-badge" data-node-id="4:1714">
                Day 1 of 2 Days Max
              </div>
            </div>

            <div className="agent-stat-split" data-node-id="4:1715">
              <div className="agent-stat-col" data-node-id="4:1716">
                <span className="agent-stat-caption" data-node-id="4:1718">CASH IN HAND</span>
                <span className="agent-stat-primary" data-node-id="4:1719">₹2,450.00</span>
              </div>
              <div className="agent-stat-col text-right" data-node-id="4:1720">
                <span className="agent-stat-caption" data-node-id="4:1722">HARD LIMIT</span>
                <span className="agent-stat-secondary" data-node-id="4:1723">₹3,000.00</span>
              </div>
            </div>

            <div className="agent-progress-box" data-node-id="4:1724">
              <div className="agent-progress-track" data-node-id="4:1725">
                <div className="agent-progress-fill" style={{ width: '81.6%' }} data-node-id="4:1726" />
              </div>
              <div className="agent-progress-info" data-node-id="4:1727">
                <span data-node-id="4:1729">
                  Current Utilization: <strong className="text-amber">81.6%</strong>
                </span>
                <span data-node-id="4:1731">Remaining: ₹550.00</span>
              </div>
            </div>
          </section>

          {/* 2. Today's Financial Overview Cards */}
          <section className="agent-kpi-row" data-node-id="4:1742">
            <div className="agent-kpi-card" data-node-id="4:1743">
              <div className="agent-kpi-head" data-node-id="4:1744">
                <img src={collectedIcon} alt="" width="10.67" height="10.67" data-node-id="4:1745" />
                <span className="agent-kpi-label text-emerald" data-node-id="4:1748">Collected</span>
              </div>
              <span className="agent-kpi-val" data-node-id="4:1752">₹18,450</span>
            </div>

            <div className="agent-kpi-card" data-node-id="4:1754">
              <div className="agent-kpi-head" data-node-id="4:1755">
                <img src={payoutsIcon} alt="" width="10.67" height="10.67" data-node-id="4:1756" />
                <span className="agent-kpi-label text-red" data-node-id="4:1759">Payouts</span>
              </div>
              <span className="agent-kpi-val" data-node-id="4:1763">₹3,200</span>
            </div>

            <div className="agent-kpi-card" data-node-id="4:1765">
              <div className="agent-kpi-head" data-node-id="4:1766">
                <img src={cashInHandIcon} alt="" width="12.67" height="12" data-node-id="4:1767" />
                <span className="agent-kpi-label text-indigo" data-node-id="4:1770">Cash In Hand</span>
              </div>
              <span className="agent-kpi-val text-emerald" data-node-id="4:1774">+₹15,250</span>
            </div>
          </section>

          {/* 3. Quick Field Operation Actions */}
          <section className="agent-card instant-ops-card" data-node-id="4:1777">
            <div className="agent-card-top" data-node-id="4:1778">
              <h2 className="agent-card-title" data-node-id="4:1780">Instant Operations</h2>
              <span className="agent-hint" data-node-id="4:1782">Tap to Launch</span>
            </div>

            <div className="agent-actions-row" data-node-id="4:1783">
              <button
                type="button"
                className="agent-action-btn"
                onClick={() => handleAction('Scan QR')}
                data-node-id="4:1784"
              >
                <div className="agent-action-icon-bg bg-orange" data-node-id="4:1786">
                  <img src={scanQrIcon} alt="" width="16.67" height="16.67" data-node-id="4:1787" />
                </div>
                <span className="agent-action-label" data-node-id="4:1790">Scan QR</span>
              </button>

              <button
                type="button"
                className="agent-action-btn"
                onClick={() => handleAction('Cash Deposit')}
                data-node-id="4:1791"
              >
                <div className="agent-action-icon-bg bg-emerald" data-node-id="4:1793">
                  <img src={depositIcon} alt="" width="16.67" height="16.67" data-node-id="4:1794" />
                </div>
                <span className="agent-action-label" data-node-id="4:1797">
                  Deposit<br />(D)
                </span>
              </button>

              <button
                type="button"
                className="agent-action-btn"
                onClick={() => handleAction('Payout Voucher')}
                data-node-id="4:1798"
              >
                <div className="agent-action-icon-bg bg-rust" data-node-id="4:1800">
                  <img src={payoutIcon} alt="" width="16.67" height="16.67" data-node-id="4:1801" />
                </div>
                <span className="agent-action-label" data-node-id="4:1804">
                  Payout<br />(W)
                </span>
              </button>

              <button
                type="button"
                className="agent-action-btn"
                onClick={() => handleAction('Thermal Print Slip')}
                data-node-id="4:1805"
              >
                <div className="agent-action-icon-bg bg-slate" data-node-id="4:1807">
                  <img src={printSlipIcon} alt="" width="15" height="16.67" data-node-id="4:1808" />
                </div>
                <span className="agent-action-label" data-node-id="4:1811">
                  Print<br />Slip
                </span>
              </button>

              <button
                type="button"
                className="agent-action-btn"
                onClick={() => handleAction('Vault Handover')}
                data-node-id="4:1812"
              >
                <div className="agent-action-icon-bg bg-navy" data-node-id="4:1814">
                  <img src={handoverIcon} alt="" width="15" height="15" data-node-id="4:1815" />
                </div>
                <span className="agent-action-label" data-node-id="4:1818">Handover</span>
              </button>
            </div>
          </section>

          {/* 4. Assigned Route & Scheduled Vendor Visits */}
          <section className="agent-card route-queue-card" data-node-id="4:1820">
            <div className="agent-card-top" data-node-id="4:1821">
              <div>
                <h2 className="agent-card-title" data-node-id="4:1824">Sector 4 Market Queue</h2>
                <p className="agent-card-subtitle" data-node-id="4:1826">Route #CM-04 • 3 of 14 Vendors</p>
              </div>
              <button
                type="button"
                className="agent-map-btn"
                onClick={() => handleAction('Map View')}
                data-node-id="4:1827"
              >
                <span>Map View</span>
                <img src={mapArrowIcon} alt="" width="4.32" height="7" data-node-id="4:1829" />
              </button>
            </div>

            <div className="agent-vendor-list" data-node-id="4:1831">
              {/* Vendor Item 1: Completed */}
              <div className="agent-vendor-item status-completed" data-node-id="4:1832">
                <div className="agent-vendor-left" data-node-id="4:1833">
                  <div className="agent-vendor-icon-bg bg-emerald-light" data-node-id="4:1834">
                    <img src={storeCheckIcon} alt="" width="15" height="15" data-node-id="4:1835" />
                  </div>
                  <div className="agent-vendor-details" data-node-id="4:1837">
                    <span className="agent-vendor-name" data-node-id="4:1839">Sharma General Store</span>
                    <div className="agent-vendor-tags" data-node-id="4:1840">
                      <span className="agent-scheme-tag tag-purple" data-node-id="4:1842">MBS</span>
                      <span className="agent-vendor-meta" data-node-id="4:1844">₹850.00 • Slip #98412</span>
                    </div>
                  </div>
                </div>
                <div className="agent-vendor-right" data-node-id="4:1845">
                  <span className="agent-status-tag tag-completed" data-node-id="4:1847">Completed</span>
                  <span className="agent-vendor-time" data-node-id="4:1849">10:14 AM</span>
                </div>
              </div>

              {/* Vendor Item 2: Next Visit Target */}
              <div className="agent-vendor-item status-next" data-node-id="4:1850">
                <div className="agent-vendor-left" data-node-id="4:1851">
                  <div className="agent-vendor-icon-bg bg-peach" data-node-id="4:1852">
                    <img src={storeNextIcon} alt="" width="13.5" height="13.5" data-node-id="4:1853" />
                  </div>
                  <div className="agent-vendor-details" data-node-id="4:1855">
                    <div className="agent-vendor-name-row" data-node-id="4:1856">
                      <span className="agent-vendor-name" data-node-id="4:1858">Mehta Electronics</span>
                      <span className="agent-pulse-dot" data-node-id="4:1859" />
                    </div>
                    <div className="agent-vendor-tags" data-node-id="4:1860">
                      <span className="agent-scheme-tag tag-teal" data-node-id="4:1862">SAVINGS</span>
                      <span className="agent-vendor-meta" data-node-id="4:1864">Withdrawal Request</span>
                    </div>
                  </div>
                </div>
                <div className="agent-vendor-right" data-node-id="4:1865">
                  <span className="agent-vendor-amount text-rust" data-node-id="4:1867">-₹200.00</span>
                  <span className="agent-status-tag tag-next" data-node-id="4:1868">Next Visit</span>
                </div>
              </div>

              {/* Vendor Item 3: Pending Recurring Deposit */}
              <div className="agent-vendor-item status-pending" data-node-id="4:1869">
                <div className="agent-vendor-left" data-node-id="4:1870">
                  <div className="agent-vendor-icon-bg bg-white" data-node-id="4:1871">
                    <img src={storePendingIcon} alt="" width="15" height="15" data-node-id="4:1872" />
                  </div>
                  <div className="agent-vendor-details" data-node-id="4:1874">
                    <span className="agent-vendor-name" data-node-id="4:1876">Laxmi Textiles</span>
                    <div className="agent-vendor-tags" data-node-id="4:1877">
                      <span className="agent-scheme-tag tag-cyan" data-node-id="4:1879">RD</span>
                      <span className="agent-vendor-meta" data-node-id="4:1881">Due Collection</span>
                    </div>
                  </div>
                </div>
                <div className="agent-vendor-right" data-node-id="4:1882">
                  <span className="agent-vendor-amount" data-node-id="4:1884">₹500.00</span>
                  <span className="agent-status-tag tag-pending" data-node-id="4:1885">Pending</span>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* Fixed Bottom Navigation */}
        <nav className="agent-bottom-nav" data-node-id="4:1921" aria-label="Agent Navigation">
          <button
            type="button"
            className={`agent-nav-link ${activeTab === 'home' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('home')}
            data-node-id="4:1923"
          >
            <div className="agent-nav-icon-wrap" data-node-id="4:1924">
              <img src={navHomeIcon} alt="" width="16.5" height="16.5" />
            </div>
            <span className="agent-nav-text" data-node-id="4:1927">Home</span>
          </button>

          <button
            type="button"
            className={`agent-nav-link ${activeTab === 'transact' ? 'is-active' : ''}`}
            onClick={() => {
              setActiveTab('transact')
              handleAction('Transact Module')
            }}
            data-node-id="4:1928"
          >
            <div className="agent-nav-icon-wrap" data-node-id="4:1929">
              <img src={navTransactIcon} alt="" width="20.17" height="14.67" />
            </div>
            <span className="agent-nav-text" data-node-id="4:1932">Transact</span>
          </button>

          <button
            type="button"
            className={`agent-nav-link ${activeTab === 'onboard' ? 'is-active' : ''}`}
            onClick={() => {
              setActiveTab('onboard')
              handleAction('Vendor Onboarding Module')
            }}
            data-node-id="4:1933"
          >
            <div className="agent-nav-icon-wrap" data-node-id="4:1934">
              <img src={navOnboardIcon} alt="" width="20.17" height="14.67" />
            </div>
            <span className="agent-nav-text" data-node-id="4:1937">Onboard</span>
          </button>

          <button
            type="button"
            className={`agent-nav-link ${activeTab === 'ledger' ? 'is-active' : ''}`}
            onClick={() => {
              setActiveTab('ledger')
              handleAction('Daily Passbook Ledger')
            }}
            data-node-id="4:1938"
          >
            <div className="agent-nav-icon-wrap" data-node-id="4:1939">
              <img src={navLedgerIcon} alt="" width="16.5" height="18.33" />
            </div>
            <span className="agent-nav-text" data-node-id="4:1942">Ledger</span>
          </button>
        </nav>
      </div>
    </div>
  )
}

