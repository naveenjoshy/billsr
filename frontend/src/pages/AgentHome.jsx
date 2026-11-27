import { useState, useRef, useEffect, useCallback } from 'react'
import { logoutUser } from '../services/authService'
import { getAgentHome, createAgentTransaction } from '../services/agentService'
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

const money = (val) =>
  `₹${Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const moneyShort = (val) =>
  `₹${Number(val || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`

const formatTime = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function AgentHome({ user, onLoggedOut }) {
  const [homeData, setHomeData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('home')
  const [menuOpen, setMenuOpen] = useState(false)

  // Quick Operation Modal State
  const [transactModalOpen, setTransactModalOpen] = useState(false)
  const [transactType, setTransactType] = useState('D')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedSchemeId, setSelectedSchemeId] = useState('')
  const [amount, setAmount] = useState('')
  const [isSubmittingTx, setIsSubmittingTx] = useState(false)

  const menuRef = useRef(null)
  const { theme, toggleTheme } = useTheme()
  const { toast } = useToast()

  const reloadHomeData = useCallback(async () => {
    try {
      const res = await getAgentHome()
      setHomeData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to live agent dashboard.')
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    getAgentHome()
      .then((res) => {
        if (!isMounted) return
        setHomeData(res)
        if (res.customers?.length > 0) {
          setSelectedCustomerId((prev) => prev || res.customers[0]._id)
        }
        if (res.schemes?.length > 0) {
          setSelectedSchemeId((prev) => prev || res.schemes[0]._id)
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : 'Unable to connect to live agent dashboard.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

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

  const agentName = homeData?.agent?.name || user?.name || 'Collection Agent'
  const bankName = homeData?.agent?.bankName || 'Devicolam Taluk Agrl & Rural Development Bank'
  const agentId = homeData?.agent?.userID || user?.userID || 'agent'
  const userEmail = user?.email || 'agent@dvlmbank.com'

  const initials = agentName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'CA'

  const handleLogout = async () => {
    try {
      await logoutUser()
      if (onLoggedOut) onLoggedOut()
    } catch {
      if (onLoggedOut) onLoggedOut()
    }
  }

  const handleTransactSubmit = async (e) => {
    e.preventDefault()
    if (!selectedCustomerId) {
      toast.error('Please select an enrolled vendor / customer.', 'Transaction Error')
      return
    }
    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Please enter a valid numeric transaction amount.', 'Transaction Error')
      return
    }

    setIsSubmittingTx(true)
    try {
      const res = await createAgentTransaction({
        customerId: selectedCustomerId,
        schemeId: selectedSchemeId || undefined,
        amount: parsedAmount,
        type: transactType,
        mode: 'C',
      })
      toast.success(
        `Receipt #${res.transaction?.receiptNo || 'REC'} for ₹${parsedAmount.toLocaleString('en-IN')} confirmed.`,
        `${transactType === 'D' ? 'Deposit' : 'Payout'} Recorded`,
        3000,
      )
      setTransactModalOpen(false)
      setAmount('')
      await reloadHomeData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transaction submission failed.', 'Failed')
    } finally {
      setIsSubmittingTx(false)
    }
  }

  const handleAction = (actionKey) => {
    if (actionKey === 'deposit') {
      setTransactType('D')
      setTransactModalOpen(true)
    } else if (actionKey === 'payout') {
      setTransactType('W')
      setTransactModalOpen(true)
    } else if (actionKey === 'qr') {
      setTransactType('D')
      setTransactModalOpen(true)
      toast.info('QR Code terminal active: select customer to complete collection', 'Scanner Ready', 2200)
    } else if (actionKey === 'print') {
      const latestTx = homeData?.queue?.items?.[0]
      if (latestTx) {
        toast.info(
          `Thermal Slip #${latestTx.receiptNo} generated for ${latestTx.customer} (${money(latestTx.amount)})`,
          'Receipt Printer',
          2600,
        )
      } else {
        toast.info('No transactions available to reprint.', 'Thermal Printer', 2000)
      }
    } else if (actionKey === 'handover') {
      const heldAmt = homeData?.cashHold?.held ?? 0
      toast.success(
        `Vault Handover generated for ${money(heldAmt)} to branch teller #2.`,
        'Vault Handover Request',
        2800,
      )
    } else {
      toast.info(`${actionKey} launched`, 'Field Operation', 2200)
    }
  }

  const hold = homeData?.cashHold
  const today = homeData?.today
  const queue = homeData?.queue
  const stops = queue?.allStops || queue?.items || []
  const utilization = hold ? Number(hold.utilization || 0) : 0
  const barWidth = Math.min(Math.max(utilization, 0), 100)

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
                    <span>{userEmail}</span>
                    <small>Agent ID: {agentId} • {bankName}</small>
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
          {error && (
            <div className="agent-empty-queue" style={{ color: '#ef4444' }} role="alert">
              {error}
            </div>
          )}

          {isLoading && !homeData ? (
            <div className="agent-loading-state" role="status">
              <div className="agent-spinner" />
              <span>Connecting to database feed...</span>
            </div>
          ) : (
            <>
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
                    Day {hold?.dayNumber ?? 1} of {hold?.holdingDays ?? 2} {hold?.holdingDays === 1 ? 'Day' : 'Days'} Max
                  </div>
                </div>

                <div className="agent-stat-split" data-node-id="4:1715">
                  <div className="agent-stat-col" data-node-id="4:1716">
                    <span className="agent-stat-caption" data-node-id="4:1718">CASH IN HAND</span>
                    <span className="agent-stat-primary" data-node-id="4:1719">{money(hold?.held)}</span>
                  </div>
                  <div className="agent-stat-col text-right" data-node-id="4:1720">
                    <span className="agent-stat-caption" data-node-id="4:1722">HARD LIMIT</span>
                    <span className="agent-stat-secondary" data-node-id="4:1723">{money(hold?.limit)}</span>
                  </div>
                </div>

                <div className="agent-progress-box" data-node-id="4:1724">
                  <div className="agent-progress-track" data-node-id="4:1725">
                    <div
                      className="agent-progress-fill"
                      style={{ width: `${barWidth}%` }}
                      data-node-id="4:1726"
                    />
                  </div>
                  <div className="agent-progress-info" data-node-id="4:1727">
                    <span data-node-id="4:1729">
                      Current Utilization:{' '}
                      <strong className={utilization >= 85 ? 'text-red' : 'text-amber'}>
                        {utilization.toFixed(1)}%
                      </strong>
                    </span>
                    <span data-node-id="4:1731">Remaining: {money(hold?.remaining)}</span>
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
                  <span className="agent-kpi-val" data-node-id="4:1752">{moneyShort(today?.collected)}</span>
                </div>

                <div className="agent-kpi-card" data-node-id="4:1754">
                  <div className="agent-kpi-head" data-node-id="4:1755">
                    <img src={payoutsIcon} alt="" width="10.67" height="10.67" data-node-id="4:1756" />
                    <span className="agent-kpi-label text-red" data-node-id="4:1759">Payouts</span>
                  </div>
                  <span className="agent-kpi-val" data-node-id="4:1763">{moneyShort(today?.payouts)}</span>
                </div>

                <div className="agent-kpi-card" data-node-id="4:1765">
                  <div className="agent-kpi-head" data-node-id="4:1766">
                    <img src={cashInHandIcon} alt="" width="12.67" height="12" data-node-id="4:1767" />
                    <span className="agent-kpi-label text-indigo" data-node-id="4:1770">Cash In Hand</span>
                  </div>
                  <span className={`agent-kpi-val ${(today?.net ?? 0) >= 0 ? 'text-emerald' : 'text-red'}`} data-node-id="4:1774">
                    {(today?.net ?? 0) >= 0 ? '+' : '-'}₹{Math.abs(today?.net ?? 0).toLocaleString('en-IN')}
                  </span>
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
                    onClick={() => handleAction('qr')}
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
                    onClick={() => handleAction('deposit')}
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
                    onClick={() => handleAction('payout')}
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
                    onClick={() => handleAction('print')}
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
                    onClick={() => handleAction('handover')}
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
                    <p className="agent-card-subtitle" data-node-id="4:1826">
                      Route #CM-04 • {queue?.visited ?? 0} of {queue?.customers ?? 0} Vendors
                    </p>
                  </div>
                  <button
                    type="button"
                    className="agent-map-btn"
                    onClick={() => toast.info('Geographic GPS route map displayed.', 'Route View')}
                    data-node-id="4:1827"
                  >
                    <span>Map View</span>
                    <img src={mapArrowIcon} alt="" width="4.32" height="7" data-node-id="4:1829" />
                  </button>
                </div>

                <div className="agent-vendor-list" data-node-id="4:1831">
                  {stops.length === 0 ? (
                    <div className="agent-empty-queue">No collection route stops assigned for today.</div>
                  ) : (
                    stops.map((item, index) => {
                      const isCompleted = item.status === 'Completed'
                      const isNext = item.status === 'Next Visit'
                      const isCancelled = item.status === 'Cancelled'

                      const iconBg = isCompleted
                        ? 'bg-emerald-light'
                        : isNext
                          ? 'bg-peach'
                          : 'bg-white'
                      const iconSrc = isCompleted
                        ? storeCheckIcon
                        : isNext
                          ? storeNextIcon
                          : storePendingIcon

                      const schemeTagClass =
                        item.scheme?.includes('RD')
                          ? 'tag-cyan'
                          : item.scheme?.includes('Savings')
                            ? 'tag-teal'
                            : 'tag-purple'

                      return (
                        <div
                          key={item._id || index}
                          className={`agent-vendor-item is-clickable ${
                            isCompleted ? 'status-completed' : isNext ? 'status-next' : 'status-pending'
                          }`}
                          onClick={() => {
                            if (item.customerId) {
                              setSelectedCustomerId(item.customerId)
                              setTransactType(item.type === 'W' ? 'W' : 'D')
                              setTransactModalOpen(true)
                            }
                          }}
                          data-node-id={`stop-${index}`}
                          title="Click to transact with vendor"
                        >
                          <div className="agent-vendor-left">
                            <div className={`agent-vendor-icon-bg ${iconBg}`}>
                              <img src={iconSrc} alt="" width="15" height="15" />
                            </div>
                            <div className="agent-vendor-details">
                              <div className="agent-vendor-name-row">
                                <span className="agent-vendor-name">{item.customer}</span>
                                {isNext && <span className="agent-pulse-dot" />}
                              </div>
                              <div className="agent-vendor-tags">
                                <span className={`agent-scheme-tag ${schemeTagClass}`}>
                                  {item.scheme}
                                </span>
                                <span className="agent-vendor-meta">
                                  {item.receiptNo ? `Slip #${item.receiptNo}` : 'Due Collection'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="agent-vendor-right">
                            <span
                              className={`agent-vendor-amount ${
                                item.type === 'W' ? 'text-rust' : ''
                              }`}
                            >
                              {item.type === 'W' ? '-' : '+'}
                              {money(item.amount)}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                className={`agent-status-tag ${
                                  isCompleted
                                    ? 'tag-completed'
                                    : isNext
                                      ? 'tag-next'
                                      : isCancelled
                                        ? 'tag-cancelled'
                                        : 'tag-pending'
                                }`}
                              >
                                {item.status}
                              </span>
                              {item.at && (
                                <span className="agent-vendor-time">{formatTime(item.at)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>
            </>
          )}
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
              setTransactModalOpen(true)
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
              toast.info('Vendor KYC onboarding module active.', 'Field Onboard')
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
              toast.info('Daily agent passbook ledger opened.', 'Ledger Passbook')
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

      {/* Instant Transact Modal Dialog */}
      {transactModalOpen && (
        <div
          className="agent-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingTx) {
              setTransactModalOpen(false)
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="agent-modal-card">
            <div className="agent-modal-head">
              <h3>{transactType === 'D' ? 'New Cash Deposit' : 'New Payout Voucher'}</h3>
              <button
                type="button"
                className="agent-modal-close"
                onClick={() => setTransactModalOpen(false)}
                disabled={isSubmittingTx}
              >
                ×
              </button>
            </div>

            <form className="agent-modal-form" onSubmit={handleTransactSubmit}>
              <div className="agent-form-field">
                <label htmlFor="tx-customer">Select Vendor / Customer</label>
                <select
                  id="tx-customer"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                  disabled={isSubmittingTx}
                >
                  {homeData?.customers?.length ? (
                    homeData.customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} {c.shopName ? `(${c.shopName})` : ''}
                      </option>
                    ))
                  ) : (
                    <option value="">No vendors found</option>
                  )}
                </select>
              </div>

              <div className="agent-form-field">
                <label htmlFor="tx-scheme">Scheme Profile</label>
                <select
                  id="tx-scheme"
                  value={selectedSchemeId}
                  onChange={(e) => setSelectedSchemeId(e.target.value)}
                  disabled={isSubmittingTx}
                >
                  {homeData?.schemes?.length ? (
                    homeData.schemes.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))
                  ) : (
                    <option value="">Default Scheme</option>
                  )}
                </select>
              </div>

              <div className="agent-form-field">
                <label htmlFor="tx-amount">Amount (₹)</label>
                <input
                  id="tx-amount"
                  type="number"
                  min="1"
                  step="any"
                  placeholder="e.g. 500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  disabled={isSubmittingTx}
                  autoFocus
                />
              </div>

              <div className="agent-modal-actions">
                <button
                  type="button"
                  className="agent-btn-cancel"
                  onClick={() => setTransactModalOpen(false)}
                  disabled={isSubmittingTx}
                >
                  Cancel
                </button>
                <button type="submit" className="agent-btn-submit" disabled={isSubmittingTx}>
                  {isSubmittingTx
                    ? 'Recording...'
                    : transactType === 'D'
                      ? 'Submit Deposit (D)'
                      : 'Submit Payout (W)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
