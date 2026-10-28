import { useCallback, useEffect, useState } from 'react'
import BankShell from '../components/BankShell'
import {
  createBankScheme,
  deleteBankScheme,
  getBankDashboard,
  getBankSchemes,
  updateBankScheme,
} from '../services/bankService'
import './SchemesReceiptsPage.css'

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

const QUICK_FIELD_SUGGESTIONS = [
  { name: 'GSTIN / Tax ID', type: 'string' },
  { name: 'Agent Mobile Contact', type: 'string' },
  { name: 'Penalty / Late Surcharge', type: 'currency' },
  { name: 'Deposit Passbook Page', type: 'number' },
  { name: 'Customer Shop Ward', type: 'string' },
]

/**
 * Live 58mm Thermal Receipt Slip Component.
 * Dynamically renders receipt rows based on configured scheme fields.
 */
function ThermalPaperSlip({
  bankName,
  schemeName,
  fields,
  previewMode = 'deposit',
  paperWidth = '58mm',
}) {
  const activeFields = Array.isArray(fields) ? fields : DEFAULT_THERMAL_FIELDS
  const isWithdrawal = previewMode === 'withdrawal'

  const hasField = (keyword) =>
    activeFields.some((f) => f.field_name.toLowerCase().includes(keyword.toLowerCase()))

  const hasFooter = hasField('footer') || hasField('disclaimer')

  return (
    <div className={`thermal-paper-slip ${paperWidth === '80mm' ? 'slip-80mm' : 'slip-58mm'}`}>
      {/* Receipt Serrated Tear Marks & Header */}
      <div className="slip-header">
        <div className="slip-bank-name">
          {bankName || 'Devicolam Taluk Agrl & Rural Development Bank'}
        </div>
        <div className="slip-scheme-name">{schemeName || 'MBS DAILY PIGMY'}</div>
        <div className="slip-dpi-tag">ESC/POS 203 DPI • {paperWidth.toUpperCase()}</div>
      </div>

      <div className="slip-divider" />

      {/* Dynamic Ordered Field Rows */}
      <div className="slip-content-body">
        {activeFields.map((field) => {
          const fn = field.field_name.toLowerCase()

          if (fn.includes('header')) {
            // Already rendered at top
            return null
          }

          if (fn.includes('date') || fn.includes('time')) {
            return (
              <div className="slip-row" key={field.field_name}>
                <span className="slip-label">DATE:</span>
                <span className="slip-val">2026-10-26 10:42 AM</span>
              </div>
            )
          }

          if (fn.includes('receipt') && !fn.includes('amount')) {
            return (
              <div className="slip-row" key={field.field_name}>
                <span className="slip-label">RECEIPT:</span>
                <span className="slip-val">REC-2026-984020</span>
              </div>
            )
          }

          if (fn.includes('customer') || fn.includes('shop') || fn.includes('account')) {
            return (
              <div key={field.field_name}>
                <div className="slip-row">
                  <span className="slip-label">CUST A/C:</span>
                  <span className="slip-val">#1042-9981-01</span>
                </div>
                <div className="slip-row muted">
                  <span className="slip-label">NAME:</span>
                  <span className="slip-val">S. RAGHAVAN &amp; SONS</span>
                </div>
              </div>
            )
          }

          if (fn.includes('scheme code') || fn.includes('product code')) {
            return (
              <div className="slip-row" key={field.field_name}>
                <span className="slip-label">SCHEME:</span>
                <span className="slip-val">{schemeName || 'MBS-DAILY-01'}</span>
              </div>
            )
          }

          if (fn.includes('amount') || fn.includes('mode')) {
            return (
              <div key={field.field_name}>
                <div className="slip-divider" />
                <div className="slip-row bold highlight">
                  <span className="slip-label">{isWithdrawal ? 'WITHDRAWAL:' : 'AMOUNT:'}</span>
                  <span className="slip-val">
                    {isWithdrawal ? '$200.00 [CASH]' : '$500.00 [CASH]'}
                  </span>
                </div>
              </div>
            )
          }

          if (fn.includes('balance') || fn.includes('ledger')) {
            return (
              <div className="slip-row bold" key={field.field_name}>
                <span className="slip-label">BALANCE:</span>
                <span className="slip-val">{isWithdrawal ? '$4,510.00' : '$4,710.00'}</span>
              </div>
            )
          }

          if (fn.includes('agent') || fn.includes('gps')) {
            return (
              <div key={field.field_name}>
                <div className="slip-row">
                  <span className="slip-label">AGENT:</span>
                  <span className="slip-val">AGT-1021 (R. Iyer)</span>
                </div>
                <div className="slip-row muted">
                  <span className="slip-label">GPS PING:</span>
                  <span className="slip-val">10.0889°N, 77.0595°E</span>
                </div>
              </div>
            )
          }

          if (fn.includes('footer') || fn.includes('disclaimer')) {
            // Rendered at footer
            return null
          }

          // Custom user-defined field
          return (
            <div className="slip-row" key={field.field_name}>
              <span className="slip-label">{field.field_name.toUpperCase()}:</span>
              <span className="slip-val">
                {field.data_type === 'currency'
                  ? '$25.00'
                  : field.data_type === 'number'
                  ? '42'
                  : field.data_type === 'date'
                  ? '2026-10-26'
                  : 'REF-32091'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Thermal Footer Disclaimer */}
      {hasFooter && (
        <div className="slip-footer">
          <div className="slip-divider" />
          <div className="slip-footer-line bold">* THANK YOU FOR BANKING WITH US *</div>
          <div className="slip-footer-line">IMMUTABLE BLOCK #891,002</div>
          <div className="slip-footer-sub">POWERED BY BILLSR TAMPER-PROOF CORE</div>
        </div>
      )}
    </div>
  )
}

export default function SchemesReceiptsPage({ user, onUserUpdated, onLoggedOut, onNavigate }) {
  const [dashboard, setDashboard] = useState(null)
  const [schemes, setSchemes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)

  // Configuration Modal State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSchemeId, setEditingSchemeId] = useState(null)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formPermitted, setFormPermitted] = useState('A')
  const [formStatus, setFormStatus] = useState('A')
  const [formReceiptFields, setFormReceiptFields] = useState(DEFAULT_THERMAL_FIELDS)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState('string')
  const [saving, setSaving] = useState(false)

  // Preview Mode Controls
  const [previewMode, setPreviewMode] = useState('deposit') // 'deposit' | 'withdrawal'
  const [paperWidth, setPaperWidth] = useState('58mm') // '58mm' | '80mm'

  // Standalone Quick Receipt Preview Modal
  const [previewScheme, setPreviewScheme] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [dashRes, schemesRes] = await Promise.all([
        getBankDashboard().catch(() => null),
        getBankSchemes(),
      ])
      if (dashRes) setDashboard(dashRes)
      setSchemes(schemesRes.schemes || [])
      setError('')
    } catch (err) {
      setError(err.message || 'Unable to load financial schemes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  // Close modals on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (previewScheme) setPreviewScheme(null)
        if (isFormOpen) setIsFormOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewScheme, isFormOpen])

  const openCreateForm = () => {
    setEditingSchemeId(null)
    setFormName('')
    setFormDesc('')
    setFormPermitted('A')
    setFormStatus('A')
    setFormReceiptFields(DEFAULT_THERMAL_FIELDS)
    setIsFormOpen(true)
  }

  const openEditForm = (scheme) => {
    setEditingSchemeId(scheme._id)
    setFormName(scheme.scheme_name || '')
    setFormDesc(scheme.scheme_description || '')
    setFormPermitted(scheme.permitted_operation || 'A')
    setFormStatus(scheme.status || 'A')
    const fields =
      scheme.receipt_config?.fields && scheme.receipt_config.fields.length > 0
        ? scheme.receipt_config.fields
        : DEFAULT_THERMAL_FIELDS
    setFormReceiptFields(fields)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingSchemeId(null)
  }

  const handleAddField = () => {
    if (!newFieldName.trim()) return
    const nextOrder = formReceiptFields.length + 1
    setFormReceiptFields([
      ...formReceiptFields,
      {
        field_name: newFieldName.trim(),
        data_type: newFieldType,
        is_mandatory: false,
        print_order: nextOrder,
      },
    ])
    setNewFieldName('')
  }

  const handleAddQuickField = (suggestion) => {
    if (formReceiptFields.some((f) => f.field_name.toLowerCase() === suggestion.name.toLowerCase())) {
      return
    }
    const nextOrder = formReceiptFields.length + 1
    setFormReceiptFields([
      ...formReceiptFields,
      {
        field_name: suggestion.name,
        data_type: suggestion.type,
        is_mandatory: false,
        print_order: nextOrder,
      },
    ])
  }

  const handleRemoveField = (index) => {
    const updated = formReceiptFields.filter((_, i) => i !== index)
    setFormReceiptFields(updated.map((f, i) => ({ ...f, print_order: i + 1 })))
  }

  const handleMoveField = (index, direction) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= formReceiptFields.length) return
    const updated = [...formReceiptFields]
    const [moved] = updated.splice(index, 1)
    updated.splice(targetIndex, 0, moved)
    setFormReceiptFields(updated.map((f, i) => ({ ...f, print_order: i + 1 })))
  }

  const handleToggleMandatory = (index) => {
    setFormReceiptFields(
      formReceiptFields.map((f, i) => (i === index ? { ...f, is_mandatory: !f.is_mandatory } : f))
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formName.trim()) {
      setNotice({ type: 'error', text: 'Scheme name cannot be empty.' })
      return
    }

    setSaving(true)
    const payload = {
      scheme_name: formName.trim(),
      scheme_description: formDesc.trim(),
      permitted_operation: formPermitted,
      status: formStatus,
      receipt_config: {
        fields: formReceiptFields,
      },
    }

    try {
      if (editingSchemeId) {
        const res = await updateBankScheme(editingSchemeId, payload)
        setNotice({ type: 'success', text: res.message || 'Scheme updated successfully.' })
      } else {
        const res = await createBankScheme(payload)
        setNotice({ type: 'success', text: res.message || 'New scheme configured successfully.' })
      }
      closeForm()
      await loadData()
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Operation failed.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (scheme) => {
    if (!window.confirm(`Are you sure you want to delete scheme "${scheme.scheme_name}"?`)) {
      return
    }
    try {
      const res = await deleteBankScheme(scheme._id)
      setNotice({ type: 'success', text: res.message || `Scheme "${scheme.scheme_name}" deleted.` })
      await loadData()
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to delete scheme.' })
    }
  }

  const handleToggleStatus = async (scheme) => {
    const nextStatus = scheme.status === 'A' ? 'S' : 'A'
    try {
      await updateBankScheme(scheme._id, { status: nextStatus })
      setNotice({
        type: 'success',
        text: `Scheme "${scheme.scheme_name}" marked as ${nextStatus === 'A' ? 'Active' : 'Suspended'}.`,
      })
      await loadData()
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to toggle scheme status.' })
    }
  }

  const handlePrintSlip = () => {
    window.print()
  }

  const bankDisplayName = dashboard?.bank?.name || 'Devicolam Taluk Agrl & Rural Development Bank'

  return (
    <BankShell
      active="schemes"
      bank={dashboard?.bank}
      designation={dashboard?.user?.designation}
      displayName={user?.name || dashboard?.user?.name}
      onLoggedOut={onLoggedOut}
      onNavigate={onNavigate}
      onUserUpdated={onUserUpdated}
      pendingCancellationsCount={dashboard?.kpis?.pendingCount ?? 0}
      user={user}
    >
      <div className="schemes-page">
        {/* Subbar breadcrumb */}
        <div className="schemes-subbar">
          <div className="schemes-breadcrumb">
            <span className="crumb-category">FINANCIAL PRODUCTS & HARDWARE TEMPLATES</span>
            <span className="crumb-divider">•</span>
            <span className="crumb-table">tbl_mt_schemes</span>
            <span className="crumb-divider">•</span>
            <span className="crumb-sync">
              <span className="sync-dot" />
              Synchronized Core
            </span>
          </div>
        </div>

        {/* Main Header */}
        <div className="schemes-header">
          <div>
            <h1 className="schemes-title">Schemes & Thermal Receipt Configuration</h1>
            <p className="schemes-subtitle">
              Manage core deposit/withdrawal products and define 58mm/80mm Bluetooth ESC/POS thermal receipt slip templates for field agents.
            </p>
          </div>
          <div className="schemes-header-actions">
            <button type="button" className="btn-primary-action" onClick={openCreateForm}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Configure New Scheme
            </button>
          </div>
        </div>

        {/* Notice alert */}
        {notice && (
          <div className={`schemes-notice ${notice.type}`} role="alert">
            <span>{notice.text}</span>
            <button type="button" className="notice-close" onClick={() => setNotice(null)}>
              ✕
            </button>
          </div>
        )}

        {/* Existing Schemes Table Card */}
        <div className="schemes-table-card">
          <div className="schemes-table-header-bar">
            <div className="schemes-table-title-group">
              <h2 className="schemes-table-title">Registered Financial Schemes & Slip Models</h2>
              <span className="schemes-table-count">{schemes.length} Registered Products</span>
            </div>
            <div className="schemes-table-badges">
              <span className="badge-legend active">Active: {schemes.filter((s) => s.status === 'A').length}</span>
              <span className="badge-legend suspended">Suspended: {schemes.filter((s) => s.status === 'S').length}</span>
            </div>
          </div>

          {loading ? (
            <div className="schemes-empty">Loading financial schemes from database...</div>
          ) : error ? (
            <div className="schemes-empty" style={{ color: '#ef4444' }}>
              {error}
            </div>
          ) : schemes.length === 0 ? (
            <div className="schemes-empty">
              No financial schemes found in database. Click &quot;Configure New Scheme&quot; above to create one for testing.
            </div>
          ) : (
            <table className="schemes-table">
              <thead>
                <tr>
                  <th>Scheme Name & Details</th>
                  <th>Permitted Mode</th>
                  <th>Status</th>
                  <th>Enrolled Customers</th>
                  <th>Ledger Transactions</th>
                  <th>Thermal Slip Model</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schemes.map((scheme) => {
                  const fieldCount = scheme.receipt_config?.fields?.length || DEFAULT_THERMAL_FIELDS.length
                  return (
                    <tr key={scheme._id}>
                      <td>
                        <div className="scheme-name-cell">
                          <span className="scheme-primary-name">{scheme.scheme_name}</span>
                          <span className="scheme-desc">
                            {scheme.scheme_description || 'Standard daily collection scheme'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="permitted-tag">
                          {scheme.permitted_operation === 'A' ? 'All (Deposits & Withdrawals)' : 'Deposit Only'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge-status ${scheme.status === 'A' ? 'active' : 'suspended'}`}>
                          {scheme.status === 'A' ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td>
                        <strong>{scheme.enrolledCustomersCount || 0}</strong> Customers
                      </td>
                      <td>
                        <strong>{scheme.activeTransactionsCount || 0}</strong> Txns
                      </td>
                      <td>
                        <div className="receipt-model-cell">
                          <span className="receipt-field-pill">{fieldCount} Fields Configured</span>
                          <button
                            type="button"
                            className="btn-preview-slip-link"
                            onClick={() => setPreviewScheme(scheme)}
                            title="Preview 58mm thermal receipt"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            Live Slip
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className="schemes-actions-cell">
                          <button
                            type="button"
                            className="btn-table-edit"
                            onClick={() => openEditForm(scheme)}
                            title="Configure scheme & receipt"
                          >
                            Configure
                          </button>
                          <button
                            type="button"
                            className="btn-table-status"
                            onClick={() => handleToggleStatus(scheme)}
                            title="Toggle Active / Suspended status"
                          >
                            {scheme.status === 'A' ? 'Suspend' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            className="btn-table-delete"
                            onClick={() => handleDelete(scheme)}
                            title="Delete scheme (use for test cleanup)"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* MODAL 1: Scheme & Thermal Receipt Configurator Modal */}
        {isFormOpen && (
          <div
            className="scheme-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scheme-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeForm()
            }}
          >
            <div className="scheme-modal-container">
              <div className="scheme-modal-header">
                <div>
                  <div className="scheme-modal-tag">ESC/POS 203 DPI HARDWARE SPECIFICATION</div>
                  <h2 id="scheme-modal-title" className="scheme-modal-title">
                    {editingSchemeId
                      ? 'Edit Scheme & Thermal Receipt Configuration'
                      : 'Configure New Financial Scheme & Receipt Layout'}
                  </h2>
                </div>
                <button
                  type="button"
                  className="scheme-modal-close"
                  onClick={closeForm}
                  aria-label="Close configuration modal"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="scheme-modal-body">
                <div className="scheme-modal-grid">
                  {/* Left Column: Form Configuration Inputs & Field Builder */}
                  <div className="form-inputs-pane">
                    <div className="form-section-header">
                      <span className="section-step">01</span>
                      <div>
                        <h3 className="section-title">Core Scheme Identity &amp; Governance</h3>
                        <p className="section-desc">Define banking scheme nomenclature and operation permissions.</p>
                      </div>
                    </div>

                    <div className="form-row-2">
                      <div className="form-field">
                        <label htmlFor="scheme-name-input">
                          Scheme Name <span className="req-star">*</span>
                        </label>
                        <input
                          id="scheme-name-input"
                          type="text"
                          placeholder="e.g. MBS Daily Pigmy, Recurring Deposit"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-field">
                        <label htmlFor="scheme-operation-select">Permitted Operations</label>
                        <select
                          id="scheme-operation-select"
                          value={formPermitted}
                          onChange={(e) => setFormPermitted(e.target.value)}
                        >
                          <option value="A">All Operations (Deposits &amp; Withdrawals)</option>
                          <option value="S">Single Mode (Deposit Only)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-row-2">
                      <div className="form-field">
                        <label htmlFor="scheme-status-select">Status</label>
                        <select
                          id="scheme-status-select"
                          value={formStatus}
                          onChange={(e) => setFormStatus(e.target.value)}
                        >
                          <option value="A">Active (Available on Handheld Terminals)</option>
                          <option value="S">Suspended (Locked from Field Transactions)</option>
                        </select>
                      </div>
                      <div className="form-field">
                        <label htmlFor="scheme-desc-input">Description / Product Notes</label>
                        <input
                          id="scheme-desc-input"
                          type="text"
                          placeholder="Short description of scheme target customers"
                          value={formDesc}
                          onChange={(e) => setFormDesc(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Section 02: Thermal Receipt Layout Field Builder */}
                    <div className="receipt-fields-section">
                      <div className="form-section-header">
                        <span className="section-step">02</span>
                        <div>
                          <h3 className="section-title">Bluetooth 58mm Thermal Printer Slip Builder</h3>
                          <p className="section-desc">
                            Select, reorder, or add custom fields printed on the portable ESC/POS thermal printer.
                          </p>
                        </div>
                      </div>

                      {/* Quick Suggestions Chips */}
                      <div className="quick-suggestions-bar">
                        <span className="suggestions-label">Quick Add Common Fields:</span>
                        <div className="suggestions-chips">
                          {QUICK_FIELD_SUGGESTIONS.map((sug) => (
                            <button
                              key={sug.name}
                              type="button"
                              className="chip-suggestion-btn"
                              onClick={() => handleAddQuickField(sug)}
                            >
                              + {sug.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Reorderable Fields List */}
                      <div className="receipt-fields-list">
                        {formReceiptFields.map((field, idx) => (
                          <div className="receipt-field-item" key={idx}>
                            <div className="receipt-field-info">
                              <span className="receipt-field-order">#{field.print_order}</span>
                              <div className="field-name-group">
                                <span className="receipt-field-name">{field.field_name}</span>
                                <span className="receipt-field-type">{field.data_type}</span>
                              </div>
                            </div>

                            <div className="receipt-field-actions">
                              <button
                                type="button"
                                className={`btn-mandatory-toggle ${field.is_mandatory ? 'is-mandatory' : ''}`}
                                onClick={() => handleToggleMandatory(idx)}
                                title="Toggle mandatory status"
                              >
                                {field.is_mandatory ? 'Required' : 'Optional'}
                              </button>

                              <button
                                type="button"
                                className="btn-reorder"
                                disabled={idx === 0}
                                onClick={() => handleMoveField(idx, -1)}
                                title="Move Up"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                className="btn-reorder"
                                disabled={idx === formReceiptFields.length - 1}
                                onClick={() => handleMoveField(idx, 1)}
                                title="Move Down"
                              >
                                ▼
                              </button>
                              <button
                                type="button"
                                className="btn-remove-field"
                                onClick={() => handleRemoveField(idx)}
                                title="Remove field"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Custom Receipt Field */}
                      <div className="add-field-bar">
                        <input
                          type="text"
                          placeholder="Custom slip field name (e.g. GSTIN, Member PIN, Ward)"
                          value={newFieldName}
                          onChange={(e) => setNewFieldName(e.target.value)}
                          className="add-field-input"
                        />
                        <select
                          value={newFieldType}
                          onChange={(e) => setNewFieldType(e.target.value)}
                          className="add-field-select"
                        >
                          <option value="string">String (Text)</option>
                          <option value="currency">Currency ($)</option>
                          <option value="date">Date / Timestamp</option>
                          <option value="number">Numeric Code</option>
                        </select>
                        <button
                          type="button"
                          className="btn-add-field"
                          onClick={handleAddField}
                        >
                          + Add Field
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Thermal Paper Live Preview Model */}
                  <div className="thermal-preview-pane">
                    <div className="thermal-preview-toolbar">
                      <div>
                        <div className="preview-indicator">
                          <span className="preview-dot" />
                          <span className="thermal-preview-title">LIVE 58MM THERMAL PREVIEW</span>
                        </div>
                        <span className="preview-device-meta">Handheld BT Printer (ESC/POS)</span>
                      </div>

                      {/* Preview Controls (Mode & Width) */}
                      <div className="preview-controls-group">
                        <div className="toggle-pill-group">
                          <button
                            type="button"
                            className={`toggle-pill ${previewMode === 'deposit' ? 'active' : ''}`}
                            onClick={() => setPreviewMode('deposit')}
                          >
                            Deposit
                          </button>
                          <button
                            type="button"
                            className={`toggle-pill ${previewMode === 'withdrawal' ? 'active' : ''}`}
                            onClick={() => setPreviewMode('withdrawal')}
                          >
                            Withdrawal
                          </button>
                        </div>

                        <div className="toggle-pill-group">
                          <button
                            type="button"
                            className={`toggle-pill ${paperWidth === '58mm' ? 'active' : ''}`}
                            onClick={() => setPaperWidth('58mm')}
                          >
                            58mm
                          </button>
                          <button
                            type="button"
                            className={`toggle-pill ${paperWidth === '80mm' ? 'active' : ''}`}
                            onClick={() => setPaperWidth('80mm')}
                          >
                            80mm
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Centered Realistic Thermal Paper Slip */}
                    <div className="slip-viewport">
                      <ThermalPaperSlip
                        bankName={bankDisplayName}
                        schemeName={formName || 'MBS Daily'}
                        fields={formReceiptFields}
                        previewMode={previewMode}
                        paperWidth={paperWidth}
                      />
                    </div>

                    <div className="slip-preview-actions">
                      <button
                        type="button"
                        className="btn-slip-action"
                        onClick={handlePrintSlip}
                        title="Simulate print to ESC/POS thermal printer"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 6 2 18 2 18 9" />
                          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                          <rect x="6" y="14" width="12" height="8" />
                        </svg>
                        Test Print
                      </button>
                      <span className="slip-fidelity-badge">✓ Tamper-Evident Hash</span>
                    </div>
                  </div>
                </div>

                <div className="scheme-form-footer">
                  <div className="form-footer-left">
                    <span className="form-fields-counter">
                      {formReceiptFields.length} Thermal Fields Configured
                    </span>
                  </div>
                  <div className="form-footer-right">
                    <button type="button" className="btn-secondary-action" onClick={closeForm}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary-action" disabled={saving}>
                      {saving ? 'Saving...' : editingSchemeId ? 'Update Scheme' : 'Save Scheme Configuration'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: Quick Standalone Receipt Preview Modal */}
        {previewScheme && (
          <div
            className="scheme-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPreviewScheme(null)
            }}
          >
            <div className="scheme-modal-container preview-only-modal">
              <div className="scheme-modal-header">
                <div>
                  <div className="scheme-modal-tag">LIVE THERMAL RECEIPT SLIP INSPECTION</div>
                  <h2 id="preview-modal-title" className="scheme-modal-title">
                    {previewScheme.scheme_name} • 58mm Thermal Preview
                  </h2>
                </div>
                <button
                  type="button"
                  className="scheme-modal-close"
                  onClick={() => setPreviewScheme(null)}
                  aria-label="Close preview modal"
                >
                  ✕
                </button>
              </div>

              <div className="preview-modal-body">
                <div className="preview-modal-controls">
                  <div className="toggle-pill-group">
                    <button
                      type="button"
                      className={`toggle-pill ${previewMode === 'deposit' ? 'active' : ''}`}
                      onClick={() => setPreviewMode('deposit')}
                    >
                      Deposit Preview ($500.00)
                    </button>
                    <button
                      type="button"
                      className={`toggle-pill ${previewMode === 'withdrawal' ? 'active' : ''}`}
                      onClick={() => setPreviewMode('withdrawal')}
                    >
                      Withdrawal Preview ($200.00)
                    </button>
                  </div>
                </div>

                <div className="slip-viewport">
                  <ThermalPaperSlip
                    bankName={bankDisplayName}
                    schemeName={previewScheme.scheme_name}
                    fields={previewScheme.receipt_config?.fields || DEFAULT_THERMAL_FIELDS}
                    previewMode={previewMode}
                    paperWidth="58mm"
                  />
                </div>
              </div>

              <div className="scheme-form-footer">
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => setPreviewScheme(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={() => {
                    const toEdit = previewScheme
                    setPreviewScheme(null)
                    openEditForm(toEdit)
                  }}
                >
                  Edit Configuration
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </BankShell>
  )
}
