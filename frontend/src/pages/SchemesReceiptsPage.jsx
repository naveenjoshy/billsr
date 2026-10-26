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
  { field_name: 'Receipt No & QR Code', data_type: 'string', is_mandatory: true, print_order: 3 },
  { field_name: 'Customer ID & Shop Name', data_type: 'string', is_mandatory: true, print_order: 4 },
  { field_name: 'Financial Scheme Code', data_type: 'string', is_mandatory: true, print_order: 5 },
  { field_name: 'Transaction Amount & Mode', data_type: 'currency', is_mandatory: true, print_order: 6 },
  { field_name: 'Ledger Balance Snapshot', data_type: 'currency', is_mandatory: true, print_order: 7 },
  { field_name: 'Field Agent ID & GPS Tag', data_type: 'string', is_mandatory: false, print_order: 8 },
  { field_name: 'Thermal Footer Disclaimer', data_type: 'string', is_mandatory: false, print_order: 9 },
]

export default function SchemesReceiptsPage({ user, onUserUpdated, onLoggedOut, onNavigate }) {
  const [dashboard, setDashboard] = useState(null)
  const [schemes, setSchemes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)

  // Form State
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
    window.scrollTo({ top: 120, behavior: 'smooth' })
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

  const handleRemoveField = (index) => {
    const updated = formReceiptFields.filter((_, i) => i !== index)
    setFormReceiptFields(updated.map((f, i) => ({ ...f, print_order: i + 1 })))
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
          </div>
          <div className="schemes-header-actions">
            {!isFormOpen ? (
              <button type="button" className="btn-primary-action" onClick={openCreateForm}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Configure New Scheme
              </button>
            ) : (
              <button type="button" className="btn-secondary-action" onClick={closeForm}>
                Close Config Form
              </button>
            )}
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

        {/* Form Container (When Open) */}
        {isFormOpen && (
          <form className="scheme-form-card" onSubmit={handleSubmit}>
            <div className="scheme-form-header">
              <h3 className="scheme-form-title">
                {editingSchemeId ? 'Edit Scheme & Thermal Receipt Configuration' : 'Add New Financial Scheme & Receipt Layout'}
              </h3>
              <button type="button" className="notice-close" onClick={closeForm}>
                ✕
              </button>
            </div>

            <div className="scheme-form-grid">
              {/* Left Column: Form Inputs */}
              <div className="form-inputs-pane">
                <div className="form-row-2">
                  <div className="form-field">
                    <label htmlFor="scheme-name-input">Scheme Name *</label>
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
                      <option value="A">All Operations (Deposits & Withdrawals)</option>
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
                      <option value="A">Active</option>
                      <option value="S">Suspended</option>
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

                {/* Thermal Receipt Configuration Field Builder */}
                <div className="receipt-fields-section">
                  <div className="receipt-fields-title">Thermal Printer ESC/POS Fields</div>
                  <div className="receipt-fields-hint">
                    Fields sent to the handheld Bluetooth thermal printer when issuing collection receipts.
                  </div>

                  <div className="receipt-fields-list">
                    {formReceiptFields.map((field, idx) => (
                      <div className="receipt-field-item" key={idx}>
                        <div className="receipt-field-info">
                          <span className="receipt-field-order">#{field.print_order}</span>
                          <span className="receipt-field-name">{field.field_name}</span>
                          <span className="receipt-field-type">{field.data_type}</span>
                          {field.is_mandatory && (
                            <span style={{ fontSize: '10px', color: '#059669', fontWeight: 600 }}>
                              Mandatory
                            </span>
                          )}
                        </div>
                        <div className="receipt-field-actions">
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
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <input
                      type="text"
                      placeholder="Add custom slip field (e.g. GSTIN, Penalty)"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    />
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    >
                      <option value="string">String</option>
                      <option value="currency">Currency</option>
                      <option value="date">Date</option>
                      <option value="number">Number</option>
                    </select>
                    <button
                      type="button"
                      className="btn-secondary-action"
                      onClick={handleAddField}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      + Add Field
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Thermal Paper Live Preview */}
              <div className="thermal-preview-pane">
                <p className="thermal-preview-title">Live 58mm Thermal Preview</p>
                <div className="thermal-paper-slip">
                  <div className="slip-header">
                    <div className="slip-bank-name">{dashboard?.bank?.name || 'BILLS COOP BANK'}</div>
                    <div className="slip-scheme-name">{formName || 'SCHEME RECEIPT'}</div>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>ESC/POS 203 DPI</div>
                  </div>
                  <div className="slip-row">
                    <span>DATE:</span>
                    <span>2026-10-26 10:42 AM</span>
                  </div>
                  <div className="slip-row">
                    <span>RECEIPT:</span>
                    <span>REC-2026-984020</span>
                  </div>
                  <div className="slip-row">
                    <span>CUST A/C:</span>
                    <span>#1042-9981-01</span>
                  </div>
                  <div className="slip-divider" />
                  <div className="slip-row bold">
                    <span>AMOUNT:</span>
                    <span>$500.00 [CASH]</span>
                  </div>
                  <div className="slip-row">
                    <span>BALANCE:</span>
                    <span>$4,710.00</span>
                  </div>
                  <div className="slip-row">
                    <span>AGENT:</span>
                    <span>AGT-1021 (R. Iyer)</span>
                  </div>
                  <div className="slip-qr-placeholder">[ QR CODE ]</div>
                  <div className="slip-footer">
                    <div>* THANK YOU FOR BANKING WITH US *</div>
                    <div>IMMUTABLE BLOCK #891,002</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="scheme-form-footer">
              <button type="button" className="btn-secondary-action" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="btn-primary-action" disabled={saving}>
                {saving ? 'Saving...' : editingSchemeId ? 'Update Scheme' : 'Save Scheme'}
              </button>
            </div>
          </form>
        )}

        {/* Existing Schemes Table */}
        <div className="schemes-table-card">
          {loading ? (
            <div className="schemes-empty">Loading financial schemes from database...</div>
          ) : error ? (
            <div className="schemes-empty" style={{ color: '#ef4444' }}>
              {error}
            </div>
          ) : schemes.length === 0 ? (
            <div className="schemes-empty">
              No financial schemes found in database. Click "Configure New Scheme" above to create one for testing.
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
                  <th>Receipt Layout</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schemes.map((scheme) => (
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
                      {scheme.permitted_operation === 'A' ? 'All (Deposits & Withdrawals)' : 'Deposit Only'}
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
                      <span style={{ fontSize: '11px', color: '#475569' }}>
                        {(scheme.receipt_config?.fields?.length || 9)} fields configured
                      </span>
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
                          className="btn-table-edit"
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
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </BankShell>
  )
}
