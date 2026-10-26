import { useCallback, useEffect, useMemo, useState } from 'react'
import './SuperAdminHomePage.css'
import OnboardBankModal from '../components/OnboardBankModal'
import { extendBankLicense, getBanks, setBankSuspension } from '../services/adminService'
import onboardIcon from '../assets/super-admin/onboard.svg'
import bankStatIcon from '../assets/super-admin/stat-banks.svg'
import expiringStatIcon from '../assets/super-admin/stat-expiring.svg'
import expiringStatusIcon from '../assets/super-admin/status-expiring.svg'
import graceStatIcon from '../assets/super-admin/stat-grace.svg'
import graceStatusIcon from '../assets/super-admin/status-grace.svg'
import suspendedStatIcon from '../assets/super-admin/stat-suspended.svg'
import suspendedStatusIcon from '../assets/super-admin/status-suspended.svg'
import searchIcon from '../assets/super-admin/search.svg'
import tableLockIcon from '../assets/super-admin/table-action-lock.svg'
import moreIcon from '../assets/super-admin/more.svg'
import tableExtendIcon from '../assets/super-admin/table-action-extend.svg'
import tableManageIcon from '../assets/super-admin/table-action-manage.svg'
import tableNoticeIcon from '../assets/super-admin/table-action-notice.svg'
import paginationIcon from '../assets/super-admin/pagination.svg'
import authorityIcon from '../assets/super-admin/license-authority.svg'
import confirmIcon from '../assets/super-admin/authority-confirm.svg'
import suspendIcon from '../assets/super-admin/authority-suspend.svg'
import calendarIcon from '../assets/super-admin/authority-calendar.svg'
import globalSearchIcon from '../assets/super-admin/notification.svg'
import notificationIcon from '../assets/super-admin/brand.svg'
import banksIcon from '../assets/super-admin/nav-banks.svg'
import complianceIcon from '../assets/super-admin/nav-compliance.svg'
import billingIcon from '../assets/super-admin/nav-billing.svg'
import telemetryIcon from '../assets/super-admin/nav-telemetry.svg'
import securityIcon from '../assets/super-admin/nav-security.svg'

const PAGE_SIZE = 8

const statusActions = {
  grace: 'Extend Grace',
  active: 'Manage',
  expiring: 'Send Notice',
  suspended: 'Reactivate',
}

const pad = (value) => String(value).padStart(2, '0')

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function contactLine(bank) {
  return [bank.ceo && `CEO: ${bank.ceo}`, bank.address].filter(Boolean).join(' • ')
}

const statusLabels = {
  grace: 'In Grace Period',
  active: 'Active License',
  expiring: 'Expiring Soon',
  suspended: 'Locked Out',
}

function StatusBadge({ status }) {
  return (
    <span className={`admin-status-badge admin-status-${status}`}>
      {status === 'grace' && <span className="admin-status-dot" />}
      {status === 'active' && <span className="admin-status-dot" />}
      {status === 'expiring' && <span className="admin-status-dot" />}
      {status === 'suspended' && <img src={tableLockIcon} alt="" />}
      <span>{statusLabels[status]}</span>
    </span>
  )
}

function SummaryCard({ label, value, suffix, detail, tone, image }) {
  return (
    <section className={`admin-summary-card admin-summary-${tone}`}>
      <div className="admin-summary-main">
        <div>
          <p className="admin-summary-label">{label}</p>
          <p className="admin-summary-value">
            <strong>{value}</strong> <span>{suffix}</span>
          </p>
        </div>
        <img className="admin-summary-illustration" src={image} alt="" />
      </div>
      <p className="admin-summary-detail">
        {detail.icon ? (
          <>
            <img src={detail.icon} alt="" />
            <span>{detail.text}</span>
          </>
        ) : (
          <>
            <span className="admin-status-dot" />
            <span>{detail.text}</span>
            <span className="admin-status-dot admin-dot-amber" />
            <span>{detail.secondary}</span>
          </>
        )}
      </p>
    </section>
  )
}

export default function SuperAdminHomePage() {
  const [banks, setBanks] = useState([])
  const [summary, setSummary] = useState({ total: 0, active: 0, expiring: 0, grace: 0, suspended: 0 })
  const [loadState, setLoadState] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedBankId, setSelectedBankId] = useState(null)
  const [extensionDays, setExtensionDays] = useState(30)
  const [justification, setJustification] = useState('')
  const [notice, setNotice] = useState('')
  const [customDateOpen, setCustomDateOpen] = useState(false)
  const [customDate, setCustomDate] = useState('')

  const applyBanks = useCallback((data) => {
    setBanks(data.banks)
    setSummary(data.summary)
    setSelectedBankId((current) =>
      data.banks.some((bank) => bank._id === current) ? current : data.banks[0]?._id ?? null,
    )
  }, [])

  const loadBanks = useCallback(async () => {
    setLoadState('loading')
    try {
      applyBanks(await getBanks())
      setLoadState('ready')
    } catch (error) {
      setLoadError(error.message)
      setLoadState('error')
    }
  }, [applyBanks])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBanks()
  }, [loadBanks])

  const selectedBank = banks.find((bank) => bank._id === selectedBankId) ?? null
  const filterTabs = [
    { id: 'all', label: `All (${summary.total})` },
    { id: 'active', label: `Active (${summary.active})` },
    { id: 'grace', label: `On Grace (${summary.grace})` },
    { id: 'suspended', label: `Suspended (${summary.suspended})` },
  ]

  const filteredBanks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return banks.filter((bank) => {
      const matchesFilter =
        activeFilter === 'all' || bank.status === activeFilter
      const matchesSearch =
        !normalizedSearch ||
        `${bank.name} ${bank.code} ${contactLine(bank)}`
          .toLowerCase()
          .includes(normalizedSearch)
      return matchesFilter && matchesSearch
    })
  }, [activeFilter, banks, search])

  const pageCount = Math.max(1, Math.ceil(filteredBanks.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const visibleBanks = filteredBanks.slice(pageStart, pageStart + PAGE_SIZE)

  const handleOnboarded = async (bank) => {
    setOnboardOpen(false)
    setActiveFilter('all')
    setSearch('')
    setPage(1)
    try {
      applyBanks(await getBanks())
      setSelectedBankId(bank._id)
      setNotice(`${bank.name} onboarded.`)
    } catch (error) {
      setNotice(error.message)
    }
  }

  const chooseBank = (bank) => {
    setSelectedBankId(bank._id)
    setCustomDateOpen(false)
    setNotice('')
  }

  const runUpdate = async (action, successMessage) => {
    setBusy(true)
    try {
      const { bank } = await action()
      setBanks((current) => current.map((item) => (item._id === bank._id ? bank : item)))
      // Counts depend on every bank, so refresh them after a change.
      applyBanks(await getBanks())
      setNotice(successMessage(bank))
      return true
    } catch (error) {
      setNotice(error.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const confirmExtension = async () => {
    if (!selectedBank) return
    if (!justification.trim()) {
      setNotice('Add a justification before extending this license.')
      return
    }
    if (selectedBank.status === 'suspended') {
      setNotice('Reactivate the suspended license before extending it.')
      return
    }
    const payload = customDate
      ? { expiryDate: customDate, justification }
      : { days: extensionDays, justification }
    const done = await runUpdate(
      () => extendBankLicense(selectedBank._id, payload),
      (bank) => `License extended through ${formatDate(bank.licenseExpiry)}.`,
    )
    if (done) {
      setCustomDateOpen(false)
      setCustomDate('')
    }
  }

  const toggleSuspension = async (bank = selectedBank) => {
    if (!bank) return
    if (!justification.trim()) {
      chooseBank(bank)
      setNotice('Add a justification before changing license status.')
      return
    }
    const suspend = bank.status !== 'suspended'
    await runUpdate(
      () => setBankSuspension(bank._id, suspend, justification),
      () => (suspend ? `${bank.name} license suspended.` : `${bank.name} license reactivated.`),
    )
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/" aria-label="Billsr Console home">
          <span className="admin-brand-mark">
            B
          </span>
          <span className="admin-brand-name">
            <strong>Billsr</strong>
            <small>CONSOLE</small>
          </span>
        </a>

        <p className="admin-nav-label">GOVERNANCE &amp; OPS</p>
        <nav className="admin-navigation" aria-label="Governance and operations">
          <a className="admin-nav-item admin-nav-active" href="#banks">
            <img src={banksIcon} alt="" />
            <span>Banks &amp; Licenses</span>
          </a>
          <a className="admin-nav-item" href="#registry">
            <img src={complianceIcon} alt="" />
            <span>License Audit &amp; Compliance</span>
          </a>
          <a className="admin-nav-item" href="#billing">
            <img src={billingIcon} alt="" />
            <span>Platform Billing &amp; SaaS Tiers</span>
          </a>
          <a className="admin-nav-item" href="#telemetry">
            <img src={telemetryIcon} alt="" />
            <span>System Telemetry &amp; Health</span>
          </a>
          <a className="admin-nav-item" href="#security">
            <img src={securityIcon} alt="" />
            <span>Global Security Logs</span>
          </a>
        </nav>
        <div className="admin-core-status">
          <div className="admin-core-status-line">
            <span>CORE STATUS</span>
            <span><i /> Active</span>
          </div>
          <code>v4.18.2-gov</code>
        </div>
      </aside>

      <header className="admin-topbar">
        <label className="admin-global-search">
          <img src={globalSearchIcon} alt="" />
          <input
            aria-label="Search banks, license keys, or tenant IDs"
            placeholder="Search banks, license keys, or tenant IDs..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
        </label>
        <div className="admin-account">
          <button className="admin-notifications" type="button" aria-label="Notifications">
            <img src={notificationIcon} alt="" />
            <i />
          </button>
          <div className="admin-user">
            <strong>Master Administrative</strong>
            <span>Root Governance</span>
          </div>
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-page-heading">
          <div>
            <h1>Billsr - Banks &amp; License Management</h1>
            <p>
              SuperAdmin Master Control • Real-time operational authority over tenant institutions,
              software licenses, grace periods, and access locks.
            </p>
          </div>
          <button
            className="admin-primary-button admin-onboard-button"
            onClick={() => setOnboardOpen(true)}
            type="button"
          >
            <img src={onboardIcon} alt="" />
            <span>+ Onboard New Bank Tenant</span>
          </button>
        </section>

        <section className="admin-summary-grid" aria-label="Governance overview">
          <SummaryCard
            label="Registered Banks"
            value={pad(summary.total)}
            suffix="Institutions"
            detail={{ icon: null, text: `${summary.active} Active`, secondary: `${summary.grace} Grace` }}
            tone="banks"
            image={bankStatIcon}
          />
          <SummaryCard
            label="Expiring &lt; 15 Days"
            value={pad(summary.expiring)}
            suffix="Tenants"
            detail={{ icon: expiringStatusIcon, text: 'Urgent renewal needed' }}
            tone="expiring"
            image={expiringStatIcon}
          />
          <SummaryCard
            label="Active Grace Periods"
            value={pad(summary.grace)}
            suffix="Extended"
            detail={{ icon: graceStatusIcon, text: 'Under operational waiver' }}
            tone="grace"
            image={graceStatIcon}
          />
          <SummaryCard
            label="Suspended Tenancies"
            value={pad(summary.suspended)}
            suffix="Locked"
            detail={{ icon: suspendedStatusIcon, text: 'Agent sync dropped' }}
            tone="suspended"
            image={suspendedStatIcon}
          />
        </section>

        <section className="admin-workspace" id="banks">
          <div className="admin-registry-card" id="registry">
            <div className="admin-table-toolbar">
              <div className="admin-filter-tabs" role="tablist" aria-label="Filter banks">
                {filterTabs.map((tab) => (
                  <button
                    aria-selected={activeFilter === tab.id}
                    className={activeFilter === tab.id ? 'is-active' : ''}
                    key={tab.id}
                    onClick={() => {
                      setActiveFilter(tab.id)
                      setPage(1)
                    }}
                    role="tab"
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <label className="admin-table-search">
                <img src={searchIcon} alt="" />
                <input
                  aria-label="Search bank registry"
                  placeholder="Search by name, code, CEO..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPage(1)
                  }}
                />
              </label>
            </div>

            <div className="admin-table-scroll">
              <table className="admin-bank-table">
                <thead>
                  <tr>
                    <th scope="col">Bank Entity &amp; ID</th>
                    <th scope="col">License Validity</th>
                    <th scope="col">Governance Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBanks.map((bank) => (
                    <tr
                      className={`${bank.status === 'suspended' ? 'admin-row-suspended' : ''} ${selectedBankId === bank._id ? 'admin-row-selected' : ''}`}
                      key={bank._id}
                      onClick={() => chooseBank(bank)}
                    >
                      <td>
                        <div className="admin-bank-identity">
                          <span className={`admin-bank-monogram admin-monogram-${bank.status}`}>
                            {bank.initials}
                          </span>
                          <span className="admin-bank-copy">
                            <strong>{bank.name}</strong>
                            <small>{contactLine(bank)}</small>
                          </span>
                        </div>
                      </td>
                      <td className="admin-expiry-cell">{formatDate(bank.licenseExpiry)}</td>
                      <td><StatusBadge status={bank.status} /></td>
                      <td>
                        <div className="admin-row-actions">
                          <button
                            className={`admin-row-action ${bank.status === 'grace' || bank.status === 'expiring' ? 'admin-row-action-primary' : ''}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              chooseBank(bank)
                              setNotice(`${statusActions[bank.status]} selected for ${bank.name}.`)
                            }}
                            type="button"
                          >
                            {bank.status === 'grace' && <img src={tableExtendIcon} alt="" />}
                            {bank.status === 'active' && <img src={tableManageIcon} alt="" />}
                            {bank.status === 'expiring' && <img src={tableNoticeIcon} alt="" />}
                            {statusActions[bank.status]}
                          </button>
                          {bank.status === 'grace' && (
                            <button
                              className="admin-icon-button admin-lock-action"
                              onClick={(event) => {
                                event.stopPropagation()
                                chooseBank(bank)
                                setNotice(`${bank.name} is in a grace period.`)
                              }}
                              type="button"
                              aria-label={`View lock status for ${bank.name}`}
                            >
                              <img src={tableLockIcon} alt="" />
                            </button>
                          )}
                          {bank.status === 'suspended' && (
                            <button
                              className="admin-icon-button"
                              onClick={(event) => {
                                event.stopPropagation()
                                chooseBank(bank)
                                toggleSuspension(bank)
                              }}
                              type="button"
                              aria-label={`Reactivate ${bank.name}`}
                            >
                              <img src={tableNoticeIcon} alt="" />
                            </button>
                          )}
                          <button
                            className="admin-icon-button"
                            onClick={(event) => {
                              event.stopPropagation()
                              chooseBank(bank)
                            }}
                            type="button"
                            aria-label={`More actions for ${bank.name}`}
                          >
                            <img src={moreIcon} alt="" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {loadState !== 'ready' && (
                    <tr>
                      <td className="admin-empty-state" colSpan="4">
                        {loadState === 'loading' ? 'Loading banks…' : (
                          <>
                            {loadError}{' '}
                            <button type="button" onClick={loadBanks}>Retry</button>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                  {loadState === 'ready' && filteredBanks.length === 0 && (
                    <tr>
                      <td className="admin-empty-state" colSpan="4">
                        {banks.length === 0 ? 'No banks have been registered yet.' : 'No banks match this search.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="admin-table-footer">
              <span>
                Displaying {filteredBanks.length ? `${pageStart + 1}–${pageStart + visibleBanks.length}` : '0'} of {filteredBanks.length} Registered Financial Institutions
              </span>
              <div className="admin-pagination" aria-label="Registry pages">
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                  <button
                    aria-current={number === currentPage ? 'page' : undefined}
                    className={number === currentPage ? 'is-current' : ''}
                    key={number}
                    onClick={() => setPage(number)}
                    type="button"
                  >
                    {number}
                  </button>
                ))}
                <button
                  className="admin-next-page"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                  type="button"
                  aria-label="Next page"
                >
                  <img src={paginationIcon} alt="" />
                </button>
              </div>
            </div>
          </div>

          <aside className="admin-authority-card" aria-labelledby="authority-title">
            <div className="admin-authority-heading">
              <img src={authorityIcon} alt="" />
              <div>
                <h2 id="authority-title">License Authority</h2>
                <p>Master Override Panel</p>
              </div>
              {selectedBank && <code>{selectedBank.code}</code>}
            </div>

            {!selectedBank ? (
              <p className="admin-notice">Select a bank to manage its license.</p>
            ) : (
            <>
            <div className="admin-entity-summary">
              <div className="admin-entity-name-row">
                <strong>{selectedBank.name}</strong>
                {selectedBank.status === 'grace' && (
                  <span className="admin-expiry-warning">
                    Exp: {formatDate(selectedBank.licenseExpiry)}
                  </span>
                )}
              </div>
              <p>Agents: <strong>{selectedBank.agentCount} Registered</strong></p>
            </div>

            <div className="admin-extension-controls">
              <label className="admin-control-label">Grant Grace Extension</label>
              <div className="admin-extension-options" role="group" aria-label="Extension duration">
                {[7, 14, 30].map((days) => (
                  <button
                    aria-pressed={extensionDays === days}
                    className={extensionDays === days ? 'is-selected' : ''}
                    key={days}
                    onClick={() => {
                      setExtensionDays(days)
                      setCustomDateOpen(false)
                    }}
                    type="button"
                  >
                    +{days} Days
                  </button>
                ))}
              </div>

              <label className="admin-control-label" htmlFor="justification">
                Mandatory Justification Log
              </label>
              <input
                className="admin-justification-input"
                id="justification"
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
              />
              {customDateOpen && (
                <label className="admin-custom-date">
                  <span>Choose a new expiry date</span>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(event) => setCustomDate(event.target.value)}
                  />
                </label>
              )}
            </div>

            <div className="admin-authority-actions">
              <button className="admin-primary-button admin-confirm-button" disabled={busy} onClick={confirmExtension} type="button">
                <img src={confirmIcon} alt="" />
                <span>Confirm &amp; Extend (+{extensionDays} Days)</span>
              </button>
              <div className="admin-secondary-actions">
                <button className="admin-suspend-button" disabled={busy} onClick={() => toggleSuspension()} type="button">
                  <img src={suspendIcon} alt="" />
                  <span>{selectedBank.status === 'suspended' ? 'Reactivate License' : 'Suspend License'}</span>
                </button>
                <button
                  className={`admin-custom-date-button ${customDateOpen ? 'is-selected' : ''}`}
                  onClick={() => setCustomDateOpen((isOpen) => !isOpen)}
                  type="button"
                >
                  <img src={calendarIcon} alt="" />
                  <span>Custom Date</span>
                </button>
              </div>
              {notice && <p className="admin-notice" role="status">{notice}</p>}
            </div>
            </>
            )}
          </aside>
        </section>
      </main>
      {onboardOpen && (
        <OnboardBankModal
          onClose={() => setOnboardOpen(false)}
          onCreated={handleOnboarded}
        />
      )}
    </div>
  )
}
