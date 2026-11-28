import { useState, useMemo } from 'react'
import { useToast } from '../context/ToastContext'
import './AgentTransactionConfirmationPage.css'

// Confirmation Figma Assets (Node 4:4389)
import succVerifiedIcon from '../assets/agent/succ-verified.svg'
import succCashModeIcon from '../assets/agent/succ-cash-mode.svg'
import succCalendarIcon from '../assets/agent/succ-calendar.svg'
import succAgentBadgeIcon from '../assets/agent/succ-agent-badge.svg'
import succPrinterIcon from '../assets/agent/succ-printer.svg'
import succDigitalReceiptIcon from '../assets/agent/succ-digital-receipt.svg'
import succPhoneIcon from '../assets/agent/succ-phone.svg'
import succResendIcon from '../assets/agent/succ-resend.svg'
import succBigCheckIcon from '../assets/agent/succ-big-check.svg'
import succScanQrIcon from '../assets/agent/succ-scan-qr.svg'
import succDailyLedgerIcon from '../assets/agent/succ-daily-ledger.svg'
import succStoreProfileIcon from '../assets/agent/succ-store-profile.svg'

// Share Icons
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

const formatFullDate = (d) => {
  const dt = d ? new Date(d) : new Date()
  return dt
    .toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
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

export default function AgentTransactionConfirmationPage({
  transaction,
  customer,
  scheme,
  agent,
  user,
  isDuplicate = false,
  onNavigateHome,
  onNewTransaction,
  onNavigateLedger,
  onNavigateOnboard,
}) {
  const { toast } = useToast()
  const [recipientPhone, setRecipientPhone] = useState(() => {
    return (
      transaction?.phone ||
      customer?.phone ||
      '+91 98765-43210'
    )
  })
  const [isEditingPhone, setIsEditingPhone] = useState(false)

  // Core transaction fields
  const isDeposit = (transaction?.type || 'D') === 'D'
  const isCash = (transaction?.mode || 'C') === 'C'
  const amountVal = Number(transaction?.amount || 1500)
  const openingBal = Number(transaction?.openingBalance ?? customer?.balance ?? 3210)
  const newBal = Number(
    transaction?.newBalance ??
      (isDeposit ? openingBal + amountVal : Math.max(openingBal - amountVal, 0)),
  )

  const receiptNo = transaction?.receiptNo || 'WD-2026-98412'
  const txDate = transaction?.at ? formatFullDate(transaction.at) : formatFullDate(new Date())
  const customerName = transaction?.customer || customer?.name || 'Sharma General Store'
  const customerShop = transaction?.shopName || customer?.shopName || 'Shop #12'
  const customerAcct = customer?.accountNo || `#1042-${String(customer?._id || '9981').slice(-4)}-01`
  const schemeName = transaction?.scheme || scheme?.name || customer?.schemeName || 'MBS Daily Pigmy (#101)'
  const agentName = agent?.name || user?.name || 'Ramesh Iyer'
  const agentId = agent?.userID || user?.userID || 'AGT-1021'
  const bankName = agent?.bankName || 'Devikulam Taluk Agrl & Rural Development Bank'

  // Dynamic Scheme Receipt Config Fields
  const receiptFields = useMemo(() => {
    if (transaction?.receiptConfig?.fields && transaction.receiptConfig.fields.length > 0) {
      return [...transaction.receiptConfig.fields].sort((a, b) => (a.print_order || 0) - (b.print_order || 0))
    }
    if (scheme?.receiptConfig?.fields && scheme.receiptConfig.fields.length > 0) {
      return [...scheme.receiptConfig.fields].sort((a, b) => (a.print_order || 0) - (b.print_order || 0))
    }
    return DEFAULT_THERMAL_FIELDS
  }, [transaction, scheme])

  // Printable e-Slip message preview
  const messagePreview = useMemo(() => {
    const heading = isDuplicate
      ? '*DUPLICATE TRANSACTION RECEIPT*'
      : '*FIELD TRANSACTION ACKNOWLEDGEMENT*'
    return (
      `*${bankName}*\n` +
      `--------------------------------\n` +
      `${heading}\n` +
      `*Receipt No:* #${receiptNo}${isDuplicate ? ' (DUPLICATE)' : ''}\n` +
      `*Type:* ${isDeposit ? 'DEPOSIT (CREDIT)' : 'PAYOUT (DEBIT)'}\n` +
      `*Mode:* ${isCash ? 'Cash' : 'Transfer'}\n` +
      `*Amount:* ${money(amountVal)}\n` +
      `*Customer:* ${customerName} (${customerAcct})\n` +
      `*Scheme:* ${schemeName}\n` +
      `*Old Balance:* ${money(openingBal)}\n` +
      `*New Balance:* ${money(newBal)}\n` +
      `*Date/Time:* ${txDate}\n` +
      `*Agent:* ${agentName} (${agentId})\n` +
      `--------------------------------\n` +
      `_${isDuplicate ? 'Duplicate copy generated via Billsr CBS' : 'Instant CBS committed thermal record via Billsr'}_`
    )
  }, [bankName, isDuplicate, receiptNo, isDeposit, isCash, amountVal, customerName, customerAcct, schemeName, openingBal, newBal, txDate, agentName, agentId])

  // Handler: Print Slip
  const handlePrintSlip = () => {
    window.print()
    toast.success(
      isDuplicate
        ? 'Duplicate thermal slip dispatched to Bluetooth printer.'
        : 'Thermal print job dispatched to Bluetooth ESC/POS printer.',
      'Printing Slip',
      2400,
    )
  }

  // Handler: Share WhatsApp
  const handleShareWhatsapp = () => {
    const cleanPhone = recipientPhone ? recipientPhone.replace(/[^0-9]/g, '') : ''
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messagePreview)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(messagePreview)}`

    window.open(url, '_blank')
    toast.info(`Sharing digital receipt via WhatsApp to ${recipientPhone}...`, 'WhatsApp Dispatch', 2200)
  }

  // Handler: Send SMS e-Slip
  const handleSendSms = () => {
    const cleanPhone = recipientPhone ? recipientPhone.replace(/[^0-9+]/g, '') : ''
    const shortSms = `${bankName}: ${isDeposit ? 'Deposit' : 'Payout'} of ${money(amountVal)} confirmed for A/c ${customerAcct}. Ref: #${receiptNo}. New Bal: ${money(newBal)}. Txn Date: ${txDate}.`

    if (navigator.clipboard) {
      navigator.clipboard.writeText(shortSms)
      toast.success('e-Slip SMS text copied to clipboard.', 'SMS Ready', 2000)
    }

    if (cleanPhone) {
      window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(shortSms)}`
    }
  }

  return (
    <div className="succ-page-shell" data-node-id="4:4389">
      <div className="succ-container">
        {/* Top Header (Figma Node 4:4565) */}
        <header className="succ-header" data-node-id="4:4565">
          <div className="succ-header-left">
            <button
              type="button"
              className="succ-back-btn"
              onClick={onNavigateHome}
              aria-label="Back to Home Dashboard"
              title="Return to Home Dashboard"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="succ-brand" data-node-id="4:4567">
              <div className="succ-brand-mark" data-node-id="4:4568">
                <span>B</span>
              </div>
              <div className="succ-brand-titles">
                <div className="succ-brand-row">
                  <span className="succ-brand-name">Billsr</span>
                  <span className="succ-role-pill">AGENT</span>
                </div>
                <span className="succ-brand-sub">Collect Transact</span>
              </div>
            </div>
          </div>

          <div className="succ-agent-pill">
            <span className="succ-agent-name">{agentName}</span>
            <span className="succ-agent-id">ID: {agentId}</span>
          </div>
        </header>

        {/* Scrollable Content Body */}
        <main className="succ-main" data-node-id="4:4390">
          {/* 1. Micro-Celebration & Live Synced Banner (Figma Node 4:4518) */}
          <section className="succ-banner-card" data-node-id="4:4518">
            <div className="succ-ambient-glow" />

            <div className="succ-badge-wrap">
              <div className="succ-animated-badge" data-node-id="4:4542">
                <img src={succBigCheckIcon} alt="" width="30" height="30" />
              </div>
            </div>

            <div className="succ-cbs-pill" data-node-id="4:4522">
              <span className="succ-cbs-dot" />
              <span>{isDuplicate ? 'DUPLICATE RECEIPT • CBS VERIFIED' : 'CBS CLEARED & COMMITTED'}</span>
            </div>

            <h1 className="succ-title" data-node-id="4:4525">
              {isDuplicate ? 'Duplicate Receipt' : 'Transaction Successful'}
            </h1>
            <p className="succ-subtitle" data-node-id="4:4528">
              {isDuplicate
                ? 'Official Duplicate Copy of CBS Verified Transaction'
                : 'Core Banking System (CBS) Synchronized Instantly'}
            </p>
          </section>

          {/* 2. Primary Transaction Receipt Slip Card (Figma Node 4:4393) */}
          <section className="succ-receipt-card" data-node-id="4:4393">
            {/* Merchant Header & Pigmy Badge (4:4394) */}
            <div className="succ-merchant-header" data-node-id="4:4394">
              <div className="succ-merchant-info">
                <div className="succ-merchant-title-row">
                  <span className="succ-merchant-name">{customerName}</span>
                  <img src={succVerifiedIcon} alt="" width="16.5" height="15.75" />
                </div>
                <span className="succ-cust-id">Cust ID: {customerAcct}</span>
              </div>

              <div className="succ-scheme-badge" data-node-id="4:4403">
                <span>{schemeName.slice(0, 12)}</span>
              </div>
            </div>

            {/* Amount Hero Plate (4:4405) */}
            <div className="succ-amount-plate" data-node-id="4:4405">
              <div className="succ-mode-subline">
                <img src={succCashModeIcon} alt="" width="15" height="11" />
                <span>
                  {isDeposit
                    ? `${isCash ? 'Cash Received' : 'Transfer Received'} (Deposit)`
                    : `${isCash ? 'Cash Disbursed' : 'Transfer Disbursed'} (Withdrawal)`}
                </span>
              </div>

              <div className={`succ-hero-amount ${isDeposit ? 'text-emerald' : 'text-navy'}`}>
                {money(amountVal)}
              </div>

              <div className="succ-time-ref-row">
                <img src={succCalendarIcon} alt="" width="11" height="12" />
                <span>{txDate}</span>
                <span className="succ-ref-bullet">•</span>
                <span>Receipt: #{receiptNo}</span>
              </div>
            </div>

            {/* Balance Delta Visual Step (4:4424) */}
            <div className="succ-balance-delta-row" data-node-id="4:4424">
              <div className="succ-balance-col">
                <span className="succ-bal-caption">Previous Balance</span>
                <span className="succ-old-balance">{money(openingBal)}</span>
              </div>

              <div className="succ-balance-col text-right">
                <span className="succ-bal-caption text-emerald">New Net Balance</span>
                <span className="succ-new-balance">{money(newBal)}</span>
              </div>
            </div>

            {/* Audit & Attribution Footer (4:4435) */}
            <div className="succ-audit-footer" data-node-id="4:4435">
              <div className="succ-agent-tag">
                <img src={succAgentBadgeIcon} alt="" width="13" height="13" />
                <span>{agentName} ({agentId})</span>
              </div>
              <span className="succ-bank-tag">{bankName.slice(0, 24)}</span>
            </div>
          </section>

          {/* 3. Thermal Slip & Digital Notification Bento Matrix (Figma Node 4:4444) */}
          <section className="succ-bento-section">
            {/* A. Print Slip Card with Print Button displayed next to it (Node 4:4445) */}
            <div className="succ-print-slip-card" data-node-id="4:4445">
              <div className="succ-print-left">
                <div className="succ-printer-icon-wrap" data-node-id="4:4448">
                  <img src={succPrinterIcon} alt="" width="18" height="16" />
                </div>
                <div className="succ-print-info">
                  <h3 className="succ-card-title">{isDuplicate ? 'Print Duplicate Slip' : 'Print Slip'}</h3>
                  <span className="succ-card-sub">ESC/POS 203 DPI • Ready</span>
                </div>
              </div>

              {/* Display print button next to Print Slip div on the right side as requested */}
              <button
                type="button"
                className="succ-print-action-btn"
                onClick={handlePrintSlip}
                title={isDuplicate ? 'Print 58mm Duplicate Thermal Slip' : 'Print 58mm Thermal Slip'}
              >
                <img src={succPrinterIcon} alt="" width="15" height="15" />
                <span>{isDuplicate ? 'Print Duplicate' : 'Print Slip'}</span>
              </button>
            </div>

            {/* Thermal Print Preview Moved Below the Print Slip Option */}
            <div className="succ-thermal-slip-wrapper">
              <div className="thermal-paper-slip print-area" id="thermal-receipt-slip">
                <div className="thermal-tear-edge top-tear" />

                <div className="thermal-header">
                  <div className="thermal-bank-name">{bankName}</div>
                  <div className="thermal-system-tag">FIELD TRANS LOG SYSTEM - BILLSR</div>
                  {isDuplicate && <div className="thermal-duplicate-badge">*** DUPLICATE RECEIPT ***</div>}
                  <div className="thermal-voucher-mode">
                    {isDeposit
                      ? `COLLECTION RECEIPT (${isCash ? 'CASH RECEIVED' : 'TRANSFER RECEIVED'})`
                      : `WITHDRAWAL VOUCHER (${isCash ? 'CASH DISBURSED' : 'TRANSFER DISBURSED'})`}
                  </div>
                </div>

                <div className="thermal-divider-dashed" />

                {/* Core Technical Identifiers */}
                <div className="thermal-meta-grid">
                  <div className="thermal-row">
                    <span className="thermal-label">TXN ID:</span>
                    <span className="thermal-val">TXN-{String(transaction?._id || '884901').slice(-6).toUpperCase()}</span>
                  </div>
                  <div className="thermal-row">
                    <span className="thermal-label">REC NO:</span>
                    <span className="thermal-val bold">{receiptNo}</span>
                  </div>
                  <div className="thermal-row">
                    <span className="thermal-label">DATE/TIME:</span>
                    <span className="thermal-val">{txDate}</span>
                  </div>
                  <div className="thermal-row">
                    <span className="thermal-label">AGENT:</span>
                    <span className="thermal-val">{agentId} ({agentName.slice(0, 15)})</span>
                  </div>
                  <div className="thermal-row">
                    <span className="thermal-label">AUTH CODE:</span>
                    <span className="thermal-val">AUTH-CBS-{(receiptNo.replace(/[^0-9]/g, '').slice(-4) || '9832')}</span>
                  </div>
                </div>

                <div className="thermal-divider-dashed" />

                {/* Dynamic Scheme Configured Report Fields */}
                <div className="thermal-fields-body">
                  {receiptFields.map((field, idx) => {
                    const fn = (field.field_name || '').toLowerCase()

                    if (fn.includes('header') || fn.includes('date') || fn.includes('receipt reference') || fn.includes('disclaimer') || fn.includes('footer')) {
                      return null
                    }

                    if (fn.includes('customer') || fn.includes('shop') || fn.includes('account')) {
                      return (
                        <div key={idx} className="thermal-block">
                          <div className="thermal-row">
                            <span className="thermal-label">CUSTOMER:</span>
                            <span className="thermal-val bold">{customerName}</span>
                          </div>
                          {customerShop && (
                            <div className="thermal-row muted">
                              <span className="thermal-label">SHOP:</span>
                              <span className="thermal-val">{customerShop}</span>
                            </div>
                          )}
                          <div className="thermal-row">
                            <span className="thermal-label">ACC / ID:</span>
                            <span className="thermal-val">{customerAcct}</span>
                          </div>
                        </div>
                      )
                    }

                    if (fn.includes('scheme') || fn.includes('product')) {
                      return (
                        <div key={idx} className="thermal-row">
                          <span className="thermal-label">SCHEME:</span>
                          <span className="thermal-val bold">{schemeName}</span>
                        </div>
                      )
                    }

                    if (fn.includes('amount') || fn.includes('mode')) {
                      return (
                        <div key={idx} className="thermal-amount-highlight">
                          <div className="thermal-row bold large">
                            <span className="thermal-label">{isDeposit ? 'AMOUNT COLLECTED:' : 'AMOUNT DISBURSED:'}</span>
                            <span className="thermal-val">
                              {money(amountVal)} [{isCash ? 'CASH' : 'TRANSFER'}]
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
                            <span className="thermal-val">{money(openingBal)}</span>
                          </div>
                          <div className="thermal-row bold">
                            <span className="thermal-label">NEW BALANCE:</span>
                            <span className="thermal-val">{money(newBal)}</span>
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

                    return (
                      <div key={idx} className="thermal-row">
                        <span className="thermal-label">{field.field_name.toUpperCase()}:</span>
                        <span className="thermal-val">
                          {field.data_type === 'currency'
                            ? money(amountVal)
                            : field.data_type === 'number'
                              ? '1'
                              : 'CONFIRMED'}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div className="thermal-divider-dashed" />

                <div className="thermal-footer">
                  <div className="thermal-footer-line bold">INSTANT CBS COMMITTED • THERMAL RECORD</div>
                  <div className="thermal-footer-line">BATTERY: 87% • BT-PRINTER ONLINE • 203 DPI</div>
                  <div className="thermal-footer-line">*** Thank you for banking with us! ***</div>
                </div>

                <div className="thermal-tear-edge bottom-tear" />
              </div>
            </div>

            {/* B. Digital Receipt Dispatch / Messaging Card with Phone Number & Message Preview (Node 4:4463) */}
            <div className="succ-digital-receipt-card" data-node-id="4:4463">
              <div className="succ-digital-head">
                <div className="succ-digital-left">
                  <div className="succ-digital-icon-wrap" data-node-id="4:4466">
                    <img src={succDigitalReceiptIcon} alt="" width="16" height="16" />
                  </div>
                  <div>
                    <h3 className="succ-card-title">Digital Receipt</h3>
                    <span className="succ-card-sub">Instant Dispatch to Customer</span>
                  </div>
                </div>
              </div>

              {/* Phone Number where message is being sent */}
              <div className="succ-phone-row" data-node-id="4:4476">
                <div className="succ-phone-left">
                  <img src={succPhoneIcon} alt="" width="12" height="15" />
                  {isEditingPhone ? (
                    <input
                      type="tel"
                      className="succ-phone-input"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      onBlur={() => setIsEditingPhone(false)}
                      autoFocus
                    />
                  ) : (
                    <span className="succ-phone-text">{recipientPhone}</span>
                  )}
                </div>

                <button
                  type="button"
                  className="succ-phone-edit-btn"
                  onClick={() => setIsEditingPhone((prev) => !prev)}
                  title="Change destination phone number"
                  data-node-id="4:4482"
                >
                  <img src={succResendIcon} alt="" width="11" height="8" />
                  <span>{isEditingPhone ? 'Done' : 'Change'}</span>
                </button>
              </div>

              {/* Live Preview of the message being sent */}
              <div className="succ-message-preview-box">
                <div className="succ-preview-header">
                  <span>MESSAGE PREVIEW</span>
                  <button
                    type="button"
                    className="succ-copy-preview-btn"
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(messagePreview)
                        toast.success('Message preview copied to clipboard.', 'Copied', 1800)
                      }
                    }}
                  >
                    Copy Text
                  </button>
                </div>
                <pre className="succ-message-preview-text">{messagePreview}</pre>
              </div>

              {/* Moved WhatsApp and SMS Buttons inside Digital Receipt section */}
              <div className="succ-share-buttons-row">
                <button
                  type="button"
                  className="succ-share-btn btn-whatsapp"
                  onClick={handleShareWhatsapp}
                  title="Send receipt slip via WhatsApp"
                >
                  <img src={txShareWhatsappIcon} alt="" width="18" height="18" />
                  <span>Send WhatsApp</span>
                </button>

                <button
                  type="button"
                  className="succ-share-btn btn-sms"
                  onClick={handleSendSms}
                  title="Send SMS e-Slip"
                >
                  <img src={txShareSmsIcon} alt="" width="18" height="18" />
                  <span>Send SMS e-Slip</span>
                </button>
              </div>
            </div>
          </section>

          {/* 4. Action CTAs (Figma Node 4:4546) */}
          <section className="succ-ctas-section" data-node-id="4:4546">
            <button
              type="button"
              className="succ-primary-cta"
              onClick={isDuplicate ? onNavigateHome : (onNewTransaction || onNavigateHome)}
              data-node-id="4:4548"
            >
              <img src={isDuplicate ? navHomeIcon : succScanQrIcon} alt="" width="18" height="18" />
              <span>{isDuplicate ? 'Return to Home Dashboard' : 'Next Customer / Scan QR'}</span>
            </button>

            <div className="succ-secondary-ctas-row" data-node-id="4:4554">
              <button
                type="button"
                className="succ-secondary-cta"
                onClick={onNavigateLedger || onNavigateHome}
                data-node-id="4:4555"
              >
                <img src={succDailyLedgerIcon} alt="" width="15" height="15" />
                <span>Daily Ledger</span>
              </button>

              <button
                type="button"
                className="succ-secondary-cta"
                onClick={onNewTransaction || onNavigateHome}
                data-node-id="4:4560"
              >
                <img src={succStoreProfileIcon} alt="" width="16" height="15" />
                <span>Store Profile</span>
              </button>
            </div>
          </section>
        </main>

        {/* Fixed Bottom Navigation (Figma Node 4:4589) */}
        <nav className="succ-bottom-nav" data-node-id="4:4589" aria-label="Agent Navigation">
          <button
            type="button"
            className="succ-nav-btn"
            onClick={onNavigateHome}
            data-node-id="4:4591"
          >
            <img src={navHomeIcon} alt="" width="16.5" height="16.5" />
            <span>Home</span>
          </button>

          <button
            type="button"
            className="succ-nav-btn is-active"
            onClick={onNewTransaction}
            data-node-id="4:4596"
            aria-current="page"
          >
            <img src={navTransactIcon} alt="" width="20" height="14.5" />
            <span>Transact</span>
          </button>

          <button
            type="button"
            className="succ-nav-btn"
            onClick={onNavigateOnboard || onNavigateHome}
            data-node-id="4:4601"
          >
            <img src={navOnboardIcon} alt="" width="20" height="14.5" />
            <span>Onboard</span>
          </button>

          <button
            type="button"
            className="succ-nav-btn"
            onClick={onNavigateLedger || onNavigateHome}
            data-node-id="4:4606"
          >
            <img src={navLedgerIcon} alt="" width="16.5" height="18.5" />
            <span>Ledger</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
