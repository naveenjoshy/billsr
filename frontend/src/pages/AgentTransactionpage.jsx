import { useState, useEffect, useMemo, useCallback } from 'react'
import { getAgentHome, createAgentTransaction } from '../services/agentService'
import { useToast } from '../context/ToastContext'
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
import txTallyIcon from '../assets/agent/tx-tally-icon.svg'
import txThermalPrinterIcon from '../assets/agent/tx-thermal-printer.svg'
import txCollectPrintIcon from '../assets/agent/tx-collect-print.svg'
import txShareWhatsappIcon from '../assets/agent/tx-share-whatsapp.svg'
import txShareSmsIcon from '../assets/agent/tx-share-sms.svg'

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

const formatFullDate = (d) => {
  const dt = d ? new Date(d) : new Date()
  return dt
    .toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
    .toUpperCase()
}

const DEFAULT_THERMAL_FIELDS = [
  { field_name: 'Bank Header & Branch', data_type: 'string', is_mandatory: true, print_order: 1 },
  { field_name: 'Transaction Date & Time', data_type: 'date', is_mandatory: true, print_order: 2 },
  { field_name: 'Receipt Reference Number', data_type: 'string', is_mandatory: true, print_order: 3 },
  { field_name: 'Customer ID & Shop Name', data_type: 'string', is_mandatory: true, print_order: 4 },
  { field_name: 'Financial Scheme Code', data_type: 'string', is_mandatory: true, print_order: 5 },
  { field_name: 'Transaction Amount & Mode', data_type: 'currency', is_mandatory: true, print_order: 6 },
  { field_name: 'Ledger Balance Snapshot', data_type: 'currency', is_mandatory: true, print_order: 7 },
  { field_name: 'Field Agent ID & GPS Tag', data_type: 'string', is_mandatory: false, print_order: 8 },
  { field_name: 'Thermal Footer Disclaimer', data_type: 'string', is_mandatory: false, print_order: 9 },
]

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

  // Interactive Denominations state ({ 500: count, 200: count, 100: count, 50: count })
  const [denominations, setDenominations] = useState({
    500: 2,
    200: 0,
    100: 0,
    50: 0,
  })

  // Submission & Confirmation State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmedTx, setConfirmedTx] = useState(null)
  const [previewTxTime, setPreviewTxTime] = useState(() => new Date())

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

  // Timer for preview timestamp
  useEffect(() => {
    const timer = setInterval(() => {
      if (!confirmedTx) {
        setPreviewTxTime(new Date())
      }
    }, 10000)
    return () => clearInterval(timer)
  }, [confirmedTx])

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
    setConfirmedTx(null)
    const cust = agentData?.customers?.find((c) => c._id === customerId)
    if (cust?.schemeId) {
      setSelectedSchemeId(cust.schemeId)
    }
  }

  // Calculate denominations auto-split when amount changes
  const autoSplitDenominations = useCallback((totalAmount) => {
    let rem = Math.max(Math.floor(Number(totalAmount) || 0), 0)
    const counts = { 500: 0, 200: 0, 100: 0, 50: 0 }

    counts[500] = Math.floor(rem / 500)
    rem %= 500

    counts[200] = Math.floor(rem / 200)
    rem %= 200

    counts[100] = Math.floor(rem / 100)
    rem %= 100

    counts[50] = Math.floor(rem / 50)

    setDenominations(counts)
  }, [])

  // Handle Amount Input Change
  const handleAmountChange = (newVal) => {
    setAmount(newVal)
    setConfirmedTx(null)
    const numeric = parseFloat(newVal)
    if (!isNaN(numeric) && numeric > 0) {
      autoSplitDenominations(numeric)
    }
  }

  // Quick Amount Increment Chips
  const handleAddAmount = (addVal) => {
    const current = parseFloat(amount) || 0
    const nextVal = current + addVal
    setAmount(nextVal.toString())
    setConfirmedTx(null)
    autoSplitDenominations(nextVal)
  }

  // Denomination +/- Buttons
  const adjustDenomination = (denom, delta) => {
    setDenominations((prev) => {
      const current = prev[denom] || 0
      const updated = Math.max(current + delta, 0)
      const nextCounts = { ...prev, [denom]: updated }

      // Compute total from new denomination counts and update amount
      const newTotal = Object.entries(nextCounts).reduce(
        (sum, [d, c]) => sum + Number(d) * Number(c),
        0,
      )
      if (newTotal > 0) {
        setAmount(newTotal.toString())
      }
      return nextCounts
    })
    setConfirmedTx(null)
  }

  // Denominations Subtotal
  const denominationTotal = useMemo(() => {
    return Object.entries(denominations).reduce(
      (sum, [d, c]) => sum + Number(d) * Number(c),
      0,
    )
  }, [denominations])

  // Calculation of Live & Projected Balance
  const currentLedgerBalance = currentCustomer?.balance ?? 3210.0
  const parsedAmount = parseFloat(amount) || 0
  const isDeposit = transactType === 'D'

  const projectedBalance = isDeposit
    ? currentLedgerBalance + parsedAmount
    : Math.max(currentLedgerBalance - parsedAmount, 0)

  // Target metrics
  const monthlyTarget = currentCustomer?.monthlyTarget || 15000
  const collectedMonth = currentCustomer?.collectedMonth || Math.round(monthlyTarget * 0.653)
  const targetPct = Math.min(Math.round((collectedMonth / monthlyTarget) * 100), 100)

  // Receipt Fields from Scheme Receipt Config
  const receiptFields = useMemo(() => {
    if (confirmedTx?.receiptConfig?.fields && confirmedTx.receiptConfig.fields.length > 0) {
      return [...confirmedTx.receiptConfig.fields].sort((a, b) => (a.print_order || 0) - (b.print_order || 0))
    }
    if (currentScheme?.receiptConfig?.fields && currentScheme.receiptConfig.fields.length > 0) {
      return [...currentScheme.receiptConfig.fields].sort((a, b) => (a.print_order || 0) - (b.print_order || 0))
    }
    return DEFAULT_THERMAL_FIELDS
  }, [currentScheme, confirmedTx])

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
        type: transactType,
        mode: transactMode,
      })

      const tx = res.transaction
      setConfirmedTx(tx)

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

      // Small delay before opening print preview dialog so DOM reflects confirmed receipt
      setTimeout(() => {
        window.print()
      }, 350)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Transaction submission failed.',
        'Transaction Error',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Share WhatsApp
  const handleShareWhatsapp = () => {
    const bankTitle = agentData?.agent?.bankName || 'Devicolam Taluk Agrl & Rural Development Bank'
    const recNo = confirmedTx?.receiptNo || 'PREVIEW-REC'
    const custName = currentCustomer?.name || 'Customer'
    const bal = confirmedTx ? confirmedTx.newBalance : projectedBalance
    const phone = currentCustomer?.phone ? currentCustomer.phone.replace(/[^0-9]/g, '') : ''

    const message = `*${bankTitle}*\n` +
      `--------------------------------\n` +
      `*FIELD TRANSACTION ACKNOWLEDGEMENT*\n` +
      `*Receipt No:* #${recNo}\n` +
      `*Type:* ${isDeposit ? 'DEPOSIT (CREDIT)' : 'PAYOUT (DEBIT)'}\n` +
      `*Mode:* ${transactMode === 'C' ? 'Cash' : 'Transfer'}\n` +
      `*Amount:* ${money(parsedAmount)}\n` +
      `*Customer:* ${custName} (${currentCustomer?.accountNo || '#1042-xxxx-01'})\n` +
      `*Scheme:* ${currentScheme?.name || 'MBS Daily Pigmy'}\n` +
      `*Updated Balance:* ${money(bal)}\n` +
      `*Date/Time:* ${formatFullDate(confirmedTx?.at || new Date())}\n` +
      `*Agent:* ${agentData?.agent?.name || user?.name || 'Field Agent'}\n` +
      `--------------------------------\n` +
      `_Instant CBS committed thermal record via Billsr_`

    const url = phone
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`

    window.open(url, '_blank')
    toast.info('Opening WhatsApp to share e-slip...', 'WhatsApp e-Slip', 2000)
  }

  // Share SMS e-Slip
  const handleShareSms = () => {
    const bankTitle = 'Devicolam Bank'
    const recNo = confirmedTx?.receiptNo || 'PREVIEW-REC'
    const bal = confirmedTx ? confirmedTx.newBalance : projectedBalance
    const phone = currentCustomer?.phone ? currentCustomer.phone.replace(/[^0-9+]/g, '') : ''

    const message = `${bankTitle}: ${isDeposit ? 'Deposit' : 'Payout'} of ${money(parsedAmount)} processed for A/c ${currentCustomer?.accountNo || 'xx'}. Ref: #${recNo}. Bal: ${money(bal)}. Date: ${formatFullDate(confirmedTx?.at || new Date())}.`

    if (navigator.clipboard) {
      navigator.clipboard.writeText(message)
      toast.success('e-Slip SMS text copied to clipboard.', 'SMS Generated', 2200)
    }

    if (phone) {
      window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`
    }
  }

  const agentName = agentData?.agent?.name || user?.name || 'Collection Agent'
  const bankName = agentData?.agent?.bankName || 'Devicolam Taluk Agrl & Rural Development Bank'
  const agentId = agentData?.agent?.userID || user?.userID || 'AGT-1021'

  const activeReceiptNo = confirmedTx?.receiptNo || 'REC-2026-984021'
  const activeTxId = confirmedTx?._id
    ? `TXN-${confirmedTx._id.slice(-6).toUpperCase()}`
    : `TXN-8849-01`
  const activeTxDate = confirmedTx?.at ? formatFullDate(confirmedTx.at) : formatFullDate(previewTxTime)
  const activeOldBal = confirmedTx?.openingBalance ?? currentLedgerBalance
  const activeNewBal = confirmedTx?.newBalance ?? projectedBalance

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
                  </div>
                  {agentData?.schemes?.length > 1 && (
                    <div className="merchant-scheme-select-wrap">
                      <select
                        className="merchant-scheme-select"
                        value={selectedSchemeId}
                        onChange={(e) => {
                          setSelectedSchemeId(e.target.value)
                          setConfirmedTx(null)
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
                    className={`agent-tx-toggle-btn ${transactType === 'D' ? 'active-deposit' : 'inactive-type'}`}
                    onClick={() => {
                      setTransactType('D')
                      setConfirmedTx(null)
                    }}
                    disabled={isSubmitting}
                    data-node-id="4:4904"
                  >
                    <img src={txDepositArrowIcon} alt="" width="14" height="14" />
                    <span>Deposit [D]</span>
                  </button>
                  <button
                    type="button"
                    className={`agent-tx-toggle-btn ${transactType === 'W' ? 'active-withdraw' : 'inactive-type'}`}
                    onClick={() => {
                      setTransactType('W')
                      setConfirmedTx(null)
                    }}
                    disabled={isSubmitting}
                    data-node-id="4:4910"
                  >
                    <img src={txWithdrawArrowIcon} alt="" width="14" height="14" />
                    <span>Withdraw [W]</span>
                  </button>
                </div>

                {/* Transaction Mode Switcher */}
                <div className="agent-tx-toggle-group" role="group" aria-label="Transaction Mode Switcher">
                  <button
                    type="button"
                    className={`agent-tx-toggle-btn ${transactMode === 'C' ? 'active-cash' : 'inactive-channel'}`}
                    onClick={() => {
                      setTransactMode('C')
                      setConfirmedTx(null)
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
                      setConfirmedTx(null)
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

                {/* Quick Increment Chips */}
                <div className="quick-chips-row" data-node-id="4:4986" role="group" aria-label="Quick amount increments">
                  <button
                    type="button"
                    className="quick-chip-btn"
                    onClick={() => handleAddAmount(200)}
                    disabled={isSubmitting}
                  >
                    +₹200
                  </button>
                  <button
                    type="button"
                    className="quick-chip-btn"
                    onClick={() => handleAddAmount(500)}
                    disabled={isSubmitting}
                  >
                    +₹500
                  </button>
                  <button
                    type="button"
                    className="quick-chip-btn"
                    onClick={() => handleAddAmount(1000)}
                    disabled={isSubmitting}
                  >
                    +₹1,000
                  </button>
                  <button
                    type="button"
                    className="quick-chip-btn"
                    onClick={() => handleAddAmount(2000)}
                    disabled={isSubmitting}
                  >
                    +₹2,000
                  </button>
                </div>

                {/* Interactive Denomination Tally (Figma Node 4:5010) */}
                <div className="denomination-tally-section">
                  <div className="tally-head">
                    <div className="tally-title-wrap">
                      <img src={txTallyIcon} alt="" width="14" height="14" />
                      <h3>Denomination Tally</h3>
                    </div>
                    <span className="tally-status">
                      Tally: <strong>{moneyShort(denominationTotal)}</strong>
                      {Math.abs(denominationTotal - parsedAmount) > 0.01 && (
                        <span className="tally-mismatch-dot" title="Tally differs from entered amount" />
                      )}
                    </span>
                  </div>

                  <div className="denominations-grid">
                    {[500, 200, 100, 50].map((denom) => {
                      const count = denominations[denom] || 0
                      return (
                        <div key={denom} className="denom-chip">
                          <span className="denom-label">₹{denom}</span>
                          <span className="denom-count">× {count}</span>
                          <div className="denom-actions">
                            <button
                              type="button"
                              className="denom-btn minus"
                              onClick={() => adjustDenomination(denom, -1)}
                              disabled={count === 0 || isSubmitting}
                              aria-label={`Decrease ₹${denom} count`}
                            >
                              -
                            </button>
                            <button
                              type="button"
                              className="denom-btn plus"
                              onClick={() => adjustDenomination(denom, 1)}
                              disabled={isSubmitting}
                              aria-label={`Increase ₹${denom} count`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>

              {/* 5. 58mm Thermal ESC/POS Receipt Live Preview (Figma Node 4:5047) */}
              <section className="agent-tx-receipt-section" data-node-id="4:5047">
                <div className="receipt-section-header">
                  <div className="receipt-title-wrap">
                    <img src={txThermalPrinterIcon} alt="" width="16" height="16" />
                    <h2>ESC/POS Thermal Slip (58mm)</h2>
                  </div>
                  <span className={`receipt-state-badge ${confirmedTx ? 'is-confirmed' : 'is-preview'}`}>
                    {confirmedTx ? '✓ CONFIRMED RECORD' : 'LIVE PREVIEW'}
                  </span>
                </div>

                {/* Printable 58mm Thermal Slip Paper */}
                <div className="thermal-paper-slip print-area" id="thermal-receipt-slip">
                  <div className="thermal-tear-edge top-tear" />

                  <div className="thermal-header">
                    <div className="thermal-bank-name">{bankName}</div>
                    <div className="thermal-system-tag">FIELD TRANS LOG SYSTEM - BILLSR</div>
                    <div className="thermal-voucher-mode">
                      {isDeposit
                        ? `COLLECTION RECEIPT (${transactMode === 'C' ? 'CASH RECEIVED' : 'TRANSFER RECEIVED'})`
                        : `WITHDRAWAL VOUCHER (${transactMode === 'C' ? 'CASH DISBURSED' : 'TRANSFER DISBURSED'})`}
                    </div>
                  </div>

                  <div className="thermal-divider-dashed" />

                  {/* Core Technical Identifiers */}
                  <div className="thermal-meta-grid">
                    <div className="thermal-row">
                      <span className="thermal-label">TXN ID:</span>
                      <span className="thermal-val">{activeTxId}</span>
                    </div>
                    <div className="thermal-row">
                      <span className="thermal-label">REC NO:</span>
                      <span className="thermal-val bold">{activeReceiptNo}</span>
                    </div>
                    <div className="thermal-row">
                      <span className="thermal-label">DATE/TIME:</span>
                      <span className="thermal-val">{activeTxDate}</span>
                    </div>
                    <div className="thermal-row">
                      <span className="thermal-label">AGENT:</span>
                      <span className="thermal-val">{agentId} ({agentName.slice(0, 15)})</span>
                    </div>
                    <div className="thermal-row">
                      <span className="thermal-label">AUTH CODE:</span>
                      <span className="thermal-val">AUTH-CBS-{(activeReceiptNo.replace(/[^0-9]/g, '').slice(-4) || '9832')}</span>
                    </div>
                  </div>

                  <div className="thermal-divider-dashed" />

                  {/* Scheme Dynamic Report Fields (matches configured receipt fields from scheme design) */}
                  <div className="thermal-fields-body">
                    {receiptFields.map((field, idx) => {
                      const fn = (field.field_name || '').toLowerCase()

                      if (fn.includes('header') || fn.includes('date') || fn.includes('receipt reference') || fn.includes('disclaimer') || fn.includes('footer')) {
                        // Handled in dedicated header/meta/footer blocks
                        return null
                      }

                      if (fn.includes('customer') || fn.includes('shop') || fn.includes('account')) {
                        return (
                          <div key={idx} className="thermal-block">
                            <div className="thermal-row">
                              <span className="thermal-label">CUSTOMER:</span>
                              <span className="thermal-val bold">{currentCustomer?.name || 'Customer'}</span>
                            </div>
                            {currentCustomer?.shopName && (
                              <div className="thermal-row muted">
                                <span className="thermal-label">SHOP:</span>
                                <span className="thermal-val">{currentCustomer.shopName}</span>
                              </div>
                            )}
                            <div className="thermal-row">
                              <span className="thermal-label">ACC / ID:</span>
                              <span className="thermal-val">{currentCustomer?.accountNo || '#1042-9981-01'}</span>
                            </div>
                          </div>
                        )
                      }

                      if (fn.includes('scheme') || fn.includes('product')) {
                        return (
                          <div key={idx} className="thermal-row">
                            <span className="thermal-label">SCHEME:</span>
                            <span className="thermal-val bold">{currentScheme?.name || 'MBS DAILY PIGMY'}</span>
                          </div>
                        )
                      }

                      if (fn.includes('amount') || fn.includes('mode')) {
                        return (
                          <div key={idx} className="thermal-amount-highlight">
                            <div className="thermal-row bold large">
                              <span className="thermal-label">{isDeposit ? 'AMOUNT COLLECTED:' : 'AMOUNT DISBURSED:'}</span>
                              <span className="thermal-val">
                                {money(parsedAmount)} [{transactMode === 'C' ? 'CASH' : 'TRANSFER'}]
                              </span>
                            </div>
                          </div>
                        )
                      }

                      if (fn.includes('balance') || fn.includes('ledger')) {
                        return (
                          <div key={idx} className="thermal-balance-block">
                            <div className="thermal-row">
                              <span className="thermal-label">OLD BALANCE:</span>
                              <span className="thermal-val">{money(activeOldBal)}</span>
                            </div>
                            <div className="thermal-row bold">
                              <span className="thermal-label">NEW BALANCE:</span>
                              <span className="thermal-val">{money(activeNewBal)}</span>
                            </div>
                          </div>
                        )
                      }

                      if (fn.includes('agent') || fn.includes('gps')) {
                        return (
                          <div key={idx} className="thermal-row muted">
                            <span className="thermal-label">GPS PING:</span>
                            <span className="thermal-val">10.0889°N, 77.0595°E (LOCK: ±3m)</span>
                          </div>
                        )
                      }

                      // Generic dynamic configured field
                      return (
                        <div key={idx} className="thermal-row">
                          <span className="thermal-label">{field.field_name.toUpperCase()}:</span>
                          <span className="thermal-val">
                            {field.data_type === 'currency'
                              ? '₹0.00'
                              : field.data_type === 'number'
                                ? '1'
                                : 'CONFIRMED'}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="thermal-divider-dashed" />

                  {/* Thermal Footer */}
                  <div className="thermal-footer">
                    <div className="thermal-footer-line bold">INSTANT CBS COMMITTED • THERMAL RECORD</div>
                    <div className="thermal-footer-line">BATTERY: 87% • BT-PRINTER ONLINE • 203 DPI</div>
                    <div className="thermal-footer-line">*** Thank you for banking with us! ***</div>
                  </div>

                  <div className="thermal-tear-edge bottom-tear" />
                </div>
              </section>

              {/* 6. Action Controls: Collect & Print, Share WhatsApp, Share SMS (Figma Node 4:5137) */}
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
                        ? 'Collect & Print Receipt'
                        : 'Payout & Print Voucher'}
                  </span>
                </button>

                <div className="agent-tx-share-row" data-node-id="4:5147">
                  <button
                    type="button"
                    className="agent-tx-share-btn btn-whatsapp"
                    onClick={handleShareWhatsapp}
                    data-node-id="4:5148"
                  >
                    <img src={txShareWhatsappIcon} alt="" width="18" height="18" />
                    <span>Share WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    className="agent-tx-share-btn btn-sms"
                    onClick={handleShareSms}
                    data-node-id="4:5153"
                  >
                    <img src={txShareSmsIcon} alt="" width="18" height="18" />
                    <span>SMS e-Slip</span>
                  </button>
                </div>
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
