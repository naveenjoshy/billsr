import { useState, useEffect, useMemo } from 'react'
import { getAgentHome, createAgentTransaction } from '../services/agentService'
import { useToast } from '../context/ToastContext'
import AgentTransactionConfirmationPage from './AgentTransactionConfirmationPage'
import './AgentTransactionpage.css'

// Agent Transaction Figma Assets
import txMerchantStoreIcon from '../assets/agent/tx-merchant-store.svg'
import txDepositArrowIcon from '../assets/agent/tx-deposit-arrow.svg'
import txWithdrawArrowIcon from '../assets/agent/tx-withdraw-arrow.svg'
import txCashIcon from '../assets/agent/tx-cash-icon.svg'
import txTransferIcon from '../assets/agent/tx-transfer-icon.svg'
import txStreakIcon from '../assets/agent/tx-streak-icon.svg'
import txAmountIcon from '../assets/agent/tx-amount-icon.svg'
import txProjectedIcon from '../assets/agent/tx-projected-icon.svg'
import txCollectPrintIcon from '../assets/agent/tx-collect-print.svg'

// Bottom Nav Icons
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

export default function AgentTransactionpage({
  user,
  initialCustomerId,
  initialType = 'D',
  initialMode = 'C',
  onNavigateHome,
  onNavigateOnboard,
  onTransactionSuccess,
}) {
  const { toast } = useToast()

  // Live Agent & Bank Data
  const [agentData, setAgentData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Transaction Selection State
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId || '')
  const [selectedSchemeId, setSelectedSchemeId] = useState('')
  const [transactType, setTransactType] = useState(initialType || 'D') // 'D' = Deposit, 'W' = Withdraw
  const [transactMode, setTransactMode] = useState(initialMode || 'C') // 'C' = Cash, 'T' = Transfer
  const [amount, setAmount] = useState('1000')

  // Submission & Confirmation State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [completedTx, setCompletedTx] = useState(null)

  // Load Live Data
  useEffect(() => {
    let isMounted = true
    getAgentHome()
      .then((res) => {
        if (!isMounted) return
        setAgentData(res)

        // Select initial customer or first available customer
        const custs = res.customers || []
        if (custs.length > 0) {
          const match = initialCustomerId ? custs.find((c) => c._id === initialCustomerId) : null
          const chosen = match || custs[0]
          setSelectedCustomerId(chosen._id)
          if (chosen.schemeId) {
            setSelectedSchemeId(chosen.schemeId)
          } else if (res.schemes?.length > 0) {
            setSelectedSchemeId(res.schemes[0]._id)
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : 'Unable to connect to live agent feed.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [initialCustomerId])

  // Active Customer Object
  const currentCustomer = useMemo(() => {
    if (!agentData?.customers) return null
    return (
      agentData.customers.find((c) => c._id === selectedCustomerId) ||
      agentData.customers[0] ||
      null
    )
  }, [agentData, selectedCustomerId])

  // Active Scheme Object
  const currentScheme = useMemo(() => {
    if (!agentData?.schemes) return null
    if (selectedSchemeId) {
      const found = agentData.schemes.find((s) => s._id === selectedSchemeId)
      if (found) return found
    }
    if (currentCustomer?.schemeId) {
      const found = agentData.schemes.find((s) => s._id === currentCustomer.schemeId)
      if (found) return found
    }
    return agentData.schemes[0] || null
  }, [agentData, selectedSchemeId, currentCustomer])

  // Update selected scheme when customer changes if customer has a specific scheme
  const handleCustomerChange = (customerId) => {
    setSelectedCustomerId(customerId)
    setCompletedTx(null)
    const cust = agentData?.customers?.find((c) => c._id === customerId)
    if (cust?.schemeId) {
      setSelectedSchemeId(cust.schemeId)
    }
  }

  // Handle Amount Input Change
  const handleAmountChange = (newVal) => {
    setAmount(newVal)
    setCompletedTx(null)
  }

  // Calculation of Live & Projected Balance
  const currentLedgerBalance = currentCustomer?.balance ?? 3210.0
  const parsedAmount = parseFloat(amount) || 0

  // Permitted Operation check: scheme permittedOperation === 'A' allows withdrawals, 'S' is Deposit Only
  const isWithdrawalEnabled = useMemo(() => {
    if (currentScheme?.permittedOperation) {
      return currentScheme.permittedOperation === 'A'
    }
    if (currentCustomer?.permittedOperation) {
      return currentCustomer.permittedOperation === 'A'
    }
    return true
  }, [currentScheme, currentCustomer])

  // Derive effective transaction type: if scheme does not permit withdrawal, force 'D'
  const effectiveTransactType = !isWithdrawalEnabled && transactType === 'W' ? 'D' : transactType
  const isDeposit = effectiveTransactType === 'D'

  // Keyboard shortcut listener for D, W, C, T
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return
      const k = e.key?.toLowerCase()
      if (k === 'd') {
        setTransactType('D')
        setCompletedTx(null)
      } else if (k === 'w') {
        if (!isWithdrawalEnabled) {
          toast.info(
            `Withdrawal is not enabled for ${currentScheme?.name || 'this scheme'} (Deposit Only).`,
            'Operation Disabled',
            2200,
          )
          return
        }
        setTransactType('W')
        setCompletedTx(null)
      } else if (k === 'c') {
        setTransactMode('C')
        setCompletedTx(null)
      } else if (k === 't') {
        setTransactMode('T')
        setCompletedTx(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isWithdrawalEnabled, currentScheme, toast])

  const projectedBalance = isDeposit
    ? currentLedgerBalance + parsedAmount
    : Math.max(currentLedgerBalance - parsedAmount, 0)

  // Target metrics
  const monthlyTarget = currentCustomer?.monthlyTarget || 15000
  const collectedMonth = currentCustomer?.collectedMonth || Math.round(monthlyTarget * 0.653)
  const targetPct = Math.min(Math.round((collectedMonth / monthlyTarget) * 100), 100)

  // Submit Transaction
  const handleCollectAndPrint = async (e) => {
    if (e) e.preventDefault()
    if (!selectedCustomerId) {
      toast.error('Please select an enrolled vendor or customer.', 'Missing Vendor')
      return
    }
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Please enter a valid transaction amount.', 'Invalid Amount')
      return
    }

    if (!isDeposit && !isWithdrawalEnabled) {
      toast.error(
        `Withdrawals are not permitted for scheme '${currentScheme?.name || 'this scheme'}' (Deposit Only).`,
        'Operation Not Permitted',
      )
      return
    }

    if (!isDeposit && parsedAmount > currentLedgerBalance) {
      toast.error(
        `Withdrawal amount (${money(parsedAmount)}) exceeds available ledger balance (${money(currentLedgerBalance)}).`,
        'Insufficient Balance',
      )
      return
    }

    setIsSubmitting(true)
    try {
      const res = await createAgentTransaction({
        customerId: selectedCustomerId,
        schemeId: selectedSchemeId || currentCustomer?.schemeId || undefined,
        amount: parsedAmount,
        type: effectiveTransactType,
        mode: transactMode,
        transactTime: new Date().toISOString(),
      })

      const tx = res.transaction
      setCompletedTx(tx)

      // Update current customer's balance locally for immediate feedback
      if (agentData?.customers) {
        setAgentData((prev) => {
          if (!prev?.customers) return prev
          return {
            ...prev,
            customers: prev.customers.map((c) =>
              c._id === selectedCustomerId ? { ...c, balance: tx.newBalance } : c,
            ),
          }
        })
      }

      toast.success(
        `Slip #${tx.receiptNo} confirmed. Balance: ${money(tx.newBalance)}`,
        `${isDeposit ? 'Deposit' : 'Payout'} Recorded`,
        3500,
      )

      if (onTransactionSuccess) {
        onTransactionSuccess(tx)
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Transaction submission failed.',
        'Transaction Error',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const agentName = agentData?.agent?.name || user?.name || 'Collection Agent'
  const agentId = agentData?.agent?.userID || user?.userID || 'AGT-1021'

  if (completedTx) {
    return (
      <AgentTransactionConfirmationPage
        transaction={completedTx}
        customer={currentCustomer}
        scheme={currentScheme}
        agent={agentData?.agent}
        user={user}
        onNavigateHome={onNavigateHome}
        onNavigateOnboard={onNavigateOnboard}
        onNavigateLedger={onNavigateHome}
        onNewTransaction={() => {
          setCompletedTx(null)
          setAmount('1000')
        }}
      />
    )
  }

  return (
    <div className="agent-tx-shell" data-node-id="4:4856">
      <div className="agent-tx-container">
        {/* Top Header */}
        <header className="agent-tx-header" data-node-id="4:4857">
          <div className="agent-tx-header-left">
            <button
              type="button"
              className="agent-tx-back-btn"
              onClick={onNavigateHome}
              aria-label="Back to Home Dashboard"
              title="Return to Home Dashboard"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="agent-tx-brand">
              <div className="agent-tx-brand-mark">
                <span>B</span>
              </div>
              <div className="agent-tx-brand-titles">
                <div className="agent-tx-brand-row">
                  <span className="agent-tx-brand-name">Billsr</span>
                  <span className="agent-tx-role-pill">AGENT</span>
                </div>
                <span className="agent-tx-brand-sub">Transact &amp; Receipt</span>
              </div>
            </div>
          </div>

          <div className="agent-tx-agent-pill">
            <span className="agent-tx-agent-name">{agentName}</span>
            <span className="agent-tx-agent-id">ID: {agentId}</span>
          </div>
        </header>

        {/* Scrollable Content Body */}
        <main className="agent-tx-main">
          {error && (
            <div className="agent-tx-error-banner" role="alert">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="agent-tx-loading" role="status">
              <div className="agent-tx-spinner" />
              <span>Connecting to live ledger &amp; schemes...</span>
            </div>
          ) : (
            <>
              {/* 1. Merchant Header Card (Figma Node 4:4876) */}
              <section className="agent-tx-card merchant-card" data-node-id="4:4876">
                <div className="merchant-card-row">
                  <div className="merchant-left">
                    <div className="merchant-icon-wrap" data-node-id="4:4878">
                      <img src={txMerchantStoreIcon} alt="" width="22" height="22" />
                    </div>
                    <div className="merchant-info" data-node-id="4:4884">
                      <div className="merchant-select-wrap">
                        <select
                          className="merchant-select"
                          value={selectedCustomerId}
                          onChange={(e) => handleCustomerChange(e.target.value)}
                          disabled={isSubmitting}
                          aria-label="Select Customer or Shop"
                        >
                          {agentData?.customers?.length ? (
                            agentData.customers.map((c) => (
                              <option key={c._id} value={c._id}>
                                {c.name} {c.shopName ? `• ${c.shopName}` : ''}
                              </option>
                            ))
                          ) : (
                            <option value="">No enrolled merchants found</option>
                          )}
                        </select>
                      </div>
                      <div className="merchant-acct-row">
                        <span className="merchant-acct-id" data-node-id="4:4888">
                          {currentCustomer?.accountNo || '#1042-9981-01'}
                        </span>
                        {currentCustomer?.phone && (
                          <span className="merchant-phone"> • {currentCustomer.phone}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="merchant-balance-wrap" data-node-id="4:4889">
                    <span className="merchant-bal-label" data-node-id="4:4890">LEDGER BALANCE</span>
                    <span className="merchant-bal-amount" data-node-id="4:4891">
                      {money(currentLedgerBalance)}
                    </span>
                  </div>
                </div>

                <div className="merchant-sub-bar" data-node-id="4:4892">
                  <div className="merchant-scheme-info">
                    <span className="merchant-dot" />
                    <span className="merchant-scheme-name">
                      {currentScheme?.name || currentCustomer?.schemeName || 'MBS Daily Pigmy (#101)'}
                    </span>
                    {!isWithdrawalEnabled && (
                      <span className="scheme-deposit-only-tag" title="Withdrawals are disabled for this scheme">
                        Deposit Only
                      </span>
                    )}
                  </div>
                  {agentData?.schemes?.length > 1 && (
                    <div className="merchant-scheme-select-wrap">
                      <select
                        className="merchant-scheme-select"
                        value={selectedSchemeId}
                        onChange={(e) => {
                          setSelectedSchemeId(e.target.value)
                          setCompletedTx(null)
                        }}
                        disabled={isSubmitting}
                        aria-label="Change Scheme"
                      >
                        {agentData.schemes.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </section>

              {/* 2. Dual Mode Switchers: Deposit vs Withdraw & Cash vs Transfer (Figma Node 4:4903) */}
              <section className="agent-tx-switchers-row" data-node-id="4:4903">
                {/* Transaction Type Switcher */}
                <div className="agent-tx-toggle-group" role="group" aria-label="Transaction Type Switcher">
                  <button
                    type="button"
                    className={`agent-tx-toggle-btn ${effectiveTransactType === 'D' ? 'active-deposit' : 'inactive-type'}`}
                    onClick={() => {
                      setTransactType('D')
                      setCompletedTx(null)
                    }}
                    disabled={isSubmitting}
                    data-node-id="4:4904"
                  >
                    <img src={txDepositArrowIcon} alt="" width="14" height="14" />
                    <span>Deposit [D]</span>
                  </button>
                  <button
                    type="button"
                    className={`agent-tx-toggle-btn ${!isWithdrawalEnabled
                      ? 'disabled-withdraw'
                      : effectiveTransactType === 'W'
                        ? 'active-withdraw'
                        : 'inactive-type'
                      }`}
                    onClick={() => {
                      if (!isWithdrawalEnabled) {
                        toast.info(
                          `Withdrawal is not enabled for ${currentScheme?.name || 'this scheme'} (Deposit Only).`,
                          'Withdrawal Disabled',
                          2500,
                        )
                        return
                      }
                      setTransactType('W')
                      setCompletedTx(null)
                    }}
                    disabled={isSubmitting || !isWithdrawalEnabled}
                    title={
                      !isWithdrawalEnabled
                        ? 'Withdrawals are disabled for this scheme (Deposit Only)'
                        : 'Withdraw [W]'
                    }
                    data-node-id="4:4910"
                  >
                    <img src={txWithdrawArrowIcon} alt="" width="14" height="14" />
                    <span>Withdraw [W]</span>
                    {!isWithdrawalEnabled && (
                      <span className="tx-lock-pill" title="Withdrawals Disabled">
                        Locked
                      </span>
                    )}
                  </button>
                </div>

                {/* Transaction Mode Switcher */}
                <div className="agent-tx-toggle-group" role="group" aria-label="Transaction Mode Switcher">
                  <button
                    type="button"
                    className={`agent-tx-toggle-btn ${transactMode === 'C' ? 'active-cash' : 'inactive-channel'}`}
                    onClick={() => {
                      setTransactMode('C')
                      setCompletedTx(null)
                    }}
                    disabled={isSubmitting}
                    data-node-id="4:4916"
                  >
                    <img src={txCashIcon} alt="" width="15" height="15" />
                    <span>Cash [C]</span>
                  </button>
                  <button
                    type="button"
                    className={`agent-tx-toggle-btn ${transactMode === 'T' ? 'active-transfer' : 'inactive-channel'}`}
                    onClick={() => {
                      setTransactMode('T')
                      setCompletedTx(null)
                    }}
                    disabled={isSubmitting}
                    data-node-id="4:4921"
                  >
                    <img src={txTransferIcon} alt="" width="15" height="15" />
                    <span>Transfer [T]</span>
                  </button>
                </div>
              </section>

              {/* 3. Momentum & Target Tracker (Figma Node 4:4927) */}
              <section className="agent-tx-card momentum-card" data-node-id="4:4927">
                <div className="momentum-top">
                  <div className="momentum-metrics">
                    <span className="momentum-target-label">
                      Monthly Target: <strong>{moneyShort(monthlyTarget)}</strong>
                    </span>
                    <span className="momentum-collected-label">
                      Collected: <strong>{moneyShort(collectedMonth)} ({targetPct}%)</strong>
                    </span>
                  </div>
                  <div className="momentum-streak-badge" data-node-id="4:4941">
                    <img src={txStreakIcon} alt="" width="12" height="12" />
                    <span>Daily streak: 18 days</span>
                  </div>
                </div>

                <div className="momentum-progress-track" data-node-id="4:4948">
                  <div
                    className="momentum-progress-fill"
                    style={{ width: `${targetPct}%` }}
                    data-node-id="4:4949"
                  />
                </div>
              </section>

              {/* 4. Collection Amount & Projected Balance Card (Figma Node 4:4951) */}
              <section className="agent-tx-card amount-card" data-node-id="4:4951">
                <div className="amount-card-header">
                  <div className="amount-header-title">
                    <img src={txAmountIcon} alt="" width="16" height="16" />
                    <h2>{isDeposit ? 'ENTER COLLECTION AMOUNT' : 'ENTER PAYOUT AMOUNT'}</h2>
                  </div>
                  <span className={`amount-mode-tag ${isDeposit ? 'tag-deposit' : 'tag-withdraw'}`}>
                    {isDeposit ? 'Deposit Mode' : 'Withdrawal Mode'}
                  </span>
                </div>

                <div className="amount-input-box" data-node-id="4:4970">
                  <span className="currency-prefix">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    className="amount-number-input"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0"
                    disabled={isSubmitting}
                    aria-label="Transaction Amount"
                    autoFocus
                  />
                </div>

                <div className="projected-bal-row" data-node-id="4:4977">
                  <div className="projected-bal-left">
                    <img src={txProjectedIcon} alt="" width="14" height="14" />
                    <span>Projected Bal:</span>
                    <strong className={isDeposit ? 'text-emerald' : 'text-rust'}>
                      {money(projectedBalance)}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="amount-reset-btn"
                    onClick={() => handleAmountChange('0')}
                    disabled={isSubmitting}
                    title="Clear entered amount"
                  >
                    Clear
                  </button>
                </div>
              </section>

              {/* 5. Action Controls: Submit Transaction (Figma Node 4:5137) */}
              <section className="agent-tx-actions-section" data-node-id="4:5137">
                <button
                  type="button"
                  className={`agent-tx-submit-btn ${isDeposit ? 'is-deposit' : 'is-withdraw'}`}
                  onClick={handleCollectAndPrint}
                  disabled={isSubmitting}
                  data-node-id="4:5138"
                >
                  <img src={txCollectPrintIcon} alt="" width="20" height="20" />
                  <span>
                    {isSubmitting
                      ? 'Committing to CBS...'
                      : isDeposit
                        ? 'Collect & Generate Slip'
                        : 'Disburse & Generate Voucher'}
                  </span>
                </button>
              </section>
            </>
          )}
        </main>

        {/* Fixed Bottom Navigation (Matches Agent Shell) */}
        <nav className="agent-tx-bottom-nav" aria-label="Agent Navigation">
          <button
            type="button"
            className="agent-tx-nav-btn"
            onClick={onNavigateHome}
          >
            <img src={navHomeIcon} alt="" width="16.5" height="16.5" />
            <span>Home</span>
          </button>

          <button
            type="button"
            className="agent-tx-nav-btn is-active"
            aria-current="page"
          >
            <img src={navTransactIcon} alt="" width="20" height="14.5" />
            <span>Transact</span>
          </button>

          <button
            type="button"
            className="agent-tx-nav-btn"
            onClick={onNavigateOnboard || onNavigateHome}
          >
            <img src={navOnboardIcon} alt="" width="20" height="14.5" />
            <span>Onboard</span>
          </button>

          <button
            type="button"
            className="agent-tx-nav-btn"
            onClick={onNavigateHome}
          >
            <img src={navLedgerIcon} alt="" width="16.5" height="18.5" />
            <span>Ledger</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
