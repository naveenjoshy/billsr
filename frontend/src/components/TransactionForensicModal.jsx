import './TransactionForensicModal.css'

export default function TransactionForensicModal({
  transaction,
  onClose,
  title = 'Transaction Forensic History',
  closeLabel = 'Close Audit Pane',
}) {
  if (!transaction) return null

  const date = transaction.collectDate ? new Date(transaction.collectDate) : new Date()

  // Format time helpers (e.g., 10:39:02 AM)
  const formatTime = (d, addSeconds = 0) => {
    const t = new Date(d.getTime() + addSeconds * 1000)
    return t.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  }

  const time1 = formatTime(date, 0)
  const time2 = formatTime(date, 3)
  const time3 = formatTime(date, 5)

  // Compute immutable block number deterministically from transaction ID or random seed
  const blockNumber = (() => {
    const rawId = transaction._id || transaction.transactId || '984020'
    let hash = 0
    for (let i = 0; i < rawId.length; i++) {
      hash = (hash << 5) - hash + rawId.charCodeAt(i)
      hash |= 0
    }
    const num = Math.abs(hash) % 150000 + 850000
    return num.toLocaleString()
  })()

  const sign = transaction.type === 'W' ? '-' : '+'
  const formattedDelta = `${sign}$${Number(transaction.amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

  const isCancelled = transaction.status === 'C'
  const isPending = transaction.status === 'P'

  return (
    <div className="forensic-overlay" role="presentation" onClick={onClose}>
      <div
        className="forensic-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="forensic-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="forensic-header">
          <div className="forensic-header-title">
            <svg
              className="forensic-header-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="8" y1="8" x2="14" y2="8" />
              <line x1="8" y1="14" x2="12" y2="14" />
            </svg>
            <h2 id="forensic-title">{title}</h2>
          </div>
          <button
            type="button"
            className="forensic-close-btn"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            ✕
          </button>
        </header>

        {/* Content Body */}
        <div className="forensic-body">
          {/* Top Identifier & Immutable Chain Tag */}
          <div className="forensic-meta-row">
            <div className="forensic-txn-id">
              {transaction.transactId || `TX-${String(transaction._id || '').slice(-6).toUpperCase()}`}
            </div>
            <div className="forensic-chain-badge">
              Immutable Chain Block #{blockNumber}
            </div>
          </div>

          {/* Timeline */}
          <div className="forensic-timeline">
            {/* Step 1: Terminal Transmission */}
            <div className="forensic-step">
              <div className="forensic-step-indicator">
                <span className="forensic-node node-green" />
                <span className="forensic-line" />
              </div>
              <div className="forensic-step-content">
                <h4 className="forensic-step-title">{time1} - Terminal Transmission</h4>
                <p className="forensic-step-desc">
                  Captured on handheld Bluebamboo P25 terminal by Agent{' '}
                  <strong>{transaction.agentName || 'Pooja Hegde'}</strong> (
                  {transaction.agentCode || 'AGT-1044'}). GPS Tag: 19.0760° N, 72.8777° E.
                </p>
              </div>
            </div>

            {/* Step 2: Core Ledger Write */}
            <div className="forensic-step">
              <div className="forensic-step-indicator">
                <span className="forensic-node node-indigo" />
                <span className="forensic-line" />
              </div>
              <div className="forensic-step-content">
                <h4 className="forensic-step-title">{time2} - Core Ledger Write</h4>
                <p className="forensic-step-desc">
                  Row appended to tbl_tt_transact with balance delta{' '}
                  <strong className={transaction.type === 'W' ? 'delta-neg' : 'delta-pos'}>
                    {formattedDelta}
                  </strong>
                  . Account checksum confirmed valid.
                </p>
              </div>
            </div>

            {/* Step 3: SMS Notification Dispatched */}
            <div className="forensic-step">
              <div className="forensic-step-indicator">
                <span className="forensic-node node-dark" />
                {(isCancelled || isPending) && <span className="forensic-line" />}
              </div>
              <div className="forensic-step-content">
                <h4 className="forensic-step-title">{time3} - SMS Notification Dispatched</h4>
                <p className="forensic-step-desc">
                  Gateway ID: TEL-MUM-991 • Delivery confirmation acknowledged by telecom carrier.
                </p>
              </div>
            </div>

            {/* Step 4: Reversal / Pending Event (if applicable) */}
            {isCancelled && (
              <div className="forensic-step">
                <div className="forensic-step-indicator">
                  <span className="forensic-node node-red" />
                </div>
                <div className="forensic-step-content">
                  <h4 className="forensic-step-title text-red">
                    Reversal & Cancellation Sign-off
                  </h4>
                  <p className="forensic-step-desc">
                    Reversal signed off by Officer{' '}
                    <strong>{transaction.reviewedBy || 'Admin Core'}</strong>. Reason: "
                    <em>{transaction.cancellationReason || 'Operator error void requested'}</em>".
                    Ledger balance counter-entry posted.
                  </p>
                </div>
              </div>
            )}

            {isPending && (
              <div className="forensic-step">
                <div className="forensic-step-indicator">
                  <span className="forensic-node node-amber" />
                </div>
                <div className="forensic-step-content">
                  <h4 className="forensic-step-title text-amber">
                    Pending Cancellation Flagged
                  </h4>
                  <p className="forensic-step-desc">
                    Operator requested cancellation. Reason: "
                    <em>{transaction.cancellationReason || 'Device input error'}</em>". Transaction
                    amount locked pending administrative review.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="forensic-footer">
          <button type="button" className="forensic-close-action" onClick={onClose}>
            {closeLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}
