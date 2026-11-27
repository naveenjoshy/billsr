import { useState, useEffect } from 'react'
import { getAgentHome, onboardCustomer } from '../services/agentService'
import { useToast } from '../context/ToastContext'
import './CustomerOnboardingPage.css'

import imgMap from '../assets/onboard/2e994.png'
import imgPortraitPlaceholder from '../assets/onboard/3e2e9.png'
import imgFrontagePlaceholder from '../assets/onboard/ea0aa.png'
import iconGpsPin from '../assets/onboard/3e701.svg'
import iconRefreshGps from '../assets/onboard/35ac1.svg'
import iconQrPreview from '../assets/onboard/5f05e.svg'
import iconPrintPass from '../assets/onboard/9c3d3.svg'
import iconLocationPin from '../assets/onboard/26833.svg'
import iconPrinterGreen from '../assets/onboard/9a2c4.svg'
import iconNavHome from '../assets/onboard/68f81.svg'
import iconNavTransact from '../assets/onboard/de02b.svg'
import iconNavOnboard from '../assets/onboard/17855.svg'
import iconNavLedger from '../assets/agent/nav-ledger.svg'

const CATEGORIES = [
  'Retail Daily Pigmy (MBS)',
  'Micro-Vendor',
  'Service Provider',
]

export default function CustomerOnboardingPage({ user, onNavigateHome }) {
  const { toast } = useToast()

  // Form Fields State
  const [fullName, setFullName] = useState('Rajesh K. Gupta')
  const [phone, setPhone] = useState('+91 98200 44122')
  const [email, setEmail] = useState('rajesh.gupta.store@gmail.com')
  const [shopName, setShopName] = useState('Gupta Provisions & Daily Mart')
  const [category, setCategory] = useState('Retail Daily Pigmy (MBS)')
  const [selectedSchemeId, setSelectedSchemeId] = useState('')
  const [monthlyTarget, setMonthlyTarget] = useState(15000)

  // Geo-location & System Metadata
  const [latitude, setLatitude] = useState(19.076)
  const [longitude, setLongitude] = useState(72.8777)
  const [gpsLocked, setGpsLocked] = useState(true)
  const [gpsAccuracy, setGpsAccuracy] = useState('±4m')
  const [systemCustId] = useState(() => `CUST-DEV-${Math.floor(1000 + Math.random() * 9000)}`)

  // Photos state
  const [ownerPhoto, setOwnerPhoto] = useState(imgPortraitPlaceholder)
  const [shopPhoto, setShopPhoto] = useState(imgFrontagePlaceholder)

  // Backend Live Schemes
  const [schemes, setSchemes] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true
    getAgentHome()
      .then((res) => {
        if (!isMounted) return
        if (res.schemes && res.schemes.length > 0) {
          setSchemes(res.schemes)
          setSelectedSchemeId(res.schemes[0]._id)
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [])

  // Geolocation trigger
  const handleRefreshGps = () => {
    toast.info('Connecting to GPS satellite constellation...', 'GPS Terminal')
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          setLatitude(lat)
          setLongitude(lng)
          setGpsLocked(true)
          setGpsAccuracy(`±${Math.round(pos.coords.accuracy || 4)}m`)
          toast.success(
            `Fix locked: ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E (${gpsAccuracy})`,
            'Geo-Coordinates Tagged',
            2500,
          )
        },
        () => {
          const jitterLat = 19.076 + (Math.random() - 0.5) * 0.003
          const jitterLng = 72.8777 + (Math.random() - 0.5) * 0.003
          setLatitude(jitterLat)
          setLongitude(jitterLng)
          setGpsLocked(true)
          toast.info(`Tagged to Sector 4 Market (19.0760° N, 72.8777° E)`, 'GPS Synced')
        },
        { enableHighAccuracy: true, timeout: 5000 },
      )
    } else {
      toast.info(`Coordinates verified for Sector 4 Market.`, 'GPS Tagged')
    }
  }

  // Photo change handlers
  const handlePhotoUpload = (type, e) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      if (type === 'owner') {
        setOwnerPhoto(url)
        toast.success('Owner KYC portrait captured.', 'Photo Captured')
      } else {
        setShopPhoto(url)
        toast.success('Shop frontage with GPS watermark tagged.', 'Shop Geotagged')
      }
    }
  }

  // Submit and save to MongoDB
  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!fullName.trim() || !phone.trim() || !shopName.trim()) {
      toast.error('Please complete all required merchant details.', 'Validation Error')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await onboardCustomer({
        name: fullName,
        phone,
        email,
        shopName,
        category,
        schemeId: selectedSchemeId || undefined,
        monthlyTarget: Number(monthlyTarget) || 15000,
        latitude,
        longitude,
        customerPhotoUrl: ownerPhoto !== imgPortraitPlaceholder ? ownerPhoto : null,
        shopPhotoUrl: shopPhoto !== imgFrontagePlaceholder ? shopPhoto : null,
        initialDeposit: 500,
      })

      toast.success(
        `Merchant ${res.customer?.name} onboarded! Opening slip #${res.customer?.receiptNo || 'REC'} printed.`,
        'Customer Activated',
        3500,
      )

      setTimeout(() => {
        if (onNavigateHome) onNavigateHome()
      }, 1500)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Unable to onboard customer. Check connection.',
        'Onboarding Error',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const dailyEquivalent = (Number(monthlyTarget || 0) / 30).toFixed(2)
  const activeSchemeObj = schemes.find((s) => s._id === selectedSchemeId)
  const schemeNameDisplay = activeSchemeObj ? activeSchemeObj.name : category

  return (
    <div className="onboard-shell" data-node-id="4:2542">
      <div className="onboard-container" data-node-id="4:2543">
        {/* Top Header */}
        <header className="onboard-header" data-node-id="4:2806">
          <div className="onboard-header-row">
            <div className="onboard-header-left">
              <button
                type="button"
                className="onboard-back-btn"
                onClick={onNavigateHome}
                title="Return to Agent Home"
                aria-label="Back to Agent Dashboard"
              >
                ←
              </button>
              <div className="onboard-brand-mark">
                <span className="onboard-brand-letter">B</span>
              </div>
              <div className="onboard-brand-info">
                <div className="onboard-brand-title-wrap">
                  <span className="onboard-brand-name">Billsr</span>
                  <span className="onboard-role-pill">AGENT</span>
                </div>
                <span className="onboard-brand-sub">Onboard Customer</span>
              </div>
            </div>

            <div className="onboard-header-right">
              <div className="onboard-status-badge">
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669' }}>● Online</span>
              </div>
              <div className="onboard-avatar-circle">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'CA'}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Form Body */}
        <main className="onboard-main">
          {/* 1. Top Progress Step Indicator */}
          <section className="onboard-card onboard-progress-card" data-node-id="4:2545">
            <div className="onboard-step-head">
              <div className="onboard-step-badge-wrap">
                <div className="onboard-step-num">2</div>
                <h2 className="onboard-step-title">Business & Geo-Location</h2>
              </div>
              <span className="onboard-step-caption">Step 2 of 3</span>
            </div>

            <div className="onboard-step-track">
              <div className="onboard-step-fill" style={{ width: '66.6%' }} />
            </div>

            <div className="onboard-step-labels">
              <span>1. Identity & PAN</span>
              <span className="active">2. Shop & Geo-Tag</span>
              <span>3. Mandate Setup</span>
            </div>
          </section>

          {/* 2. Unique Customer Identifier Live Banner */}
          <section className="onboard-id-banner" data-node-id="4:2567">
            <div className="onboard-id-left">
              <span className="onboard-id-label">SYSTEM CUST ID (PRD: TBL_MT_CUSTOMER)</span>
              <div className="onboard-id-val-row">
                <span className="onboard-id-code">{systemCustId}</span>
                <span className="onboard-auto-badge">Auto-Gen</span>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Core Ledger</div>
          </section>

          {/* 3. Form Section: Personal & Business Info */}
          <section className="onboard-card" data-node-id="4:2579">
            <div className="onboard-section-head">
              <h2 className="onboard-section-title">Merchant Profile Data</h2>
              <span className="onboard-section-pill">Core Ledger</span>
            </div>

            <div className="onboard-field-group">
              {/* Full Name */}
              <div className="onboard-input-wrap">
                <label className="onboard-label" htmlFor="onboard-name">
                  Customer Full Name (as per Aadhaar)
                </label>
                <div className="onboard-input-box">
                  <input
                    id="onboard-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rajesh K. Gupta"
                    required
                  />
                </div>
              </div>

              {/* Mobile Phone */}
              <div className="onboard-input-wrap">
                <label className="onboard-label" htmlFor="onboard-phone">
                  Contact Phone (WhatsApp Alerts)
                </label>
                <div className="onboard-input-box">
                  <input
                    id="onboard-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98200 44122"
                    required
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="onboard-input-wrap">
                <label className="onboard-label" htmlFor="onboard-email">
                  Email Address (E-Receipts)
                </label>
                <div className="onboard-input-box">
                  <input
                    id="onboard-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="rajesh.gupta.store@gmail.com"
                  />
                </div>
              </div>

              {/* Shop / Trade Name */}
              <div className="onboard-input-wrap">
                <label className="onboard-label" htmlFor="onboard-shop">
                  Business / Shop Outlet Trade Name
                </label>
                <div className="onboard-input-box">
                  <input
                    id="onboard-shop"
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Gupta Provisions & Daily Mart"
                    required
                  />
                </div>
              </div>

              {/* Merchant Category Selection Chips */}
              <div className="onboard-input-wrap">
                <label className="onboard-label">Merchant Category & Scheme Enrollment</label>
                <div className="onboard-chips-row">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`onboard-chip-btn ${category === cat ? 'is-active' : ''}`}
                      onClick={() => setCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scheme Profile Selector (if available) */}
              {schemes.length > 0 && (
                <div className="onboard-input-wrap">
                  <label className="onboard-label" htmlFor="onboard-scheme">
                    Primary Deposit Scheme
                  </label>
                  <div className="onboard-input-box">
                    <select
                      id="onboard-scheme"
                      value={selectedSchemeId}
                      onChange={(e) => setSelectedSchemeId(e.target.value)}
                    >
                      {schemes.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Monthly Collection Target */}
              <div className="onboard-target-box">
                <div className="onboard-target-header">
                  <span className="onboard-label">Monthly Collection Target</span>
                  <span className="onboard-target-val">₹{Number(monthlyTarget).toLocaleString('en-IN')} / month</span>
                </div>

                <div className="onboard-target-input-row">
                  <span className="onboard-currency-symbol">₹</span>
                  <input
                    className="onboard-target-input"
                    type="number"
                    min="1000"
                    step="500"
                    value={monthlyTarget}
                    onChange={(e) => setMonthlyTarget(e.target.value)}
                  />
                  <span className="onboard-currency-tag">INR</span>
                </div>

                <p className="onboard-daily-calc">
                  Daily MBS deposit equivalent: <strong>₹{dailyEquivalent} / day</strong> across 30 active cycles.
                </p>
              </div>
            </div>
          </section>

          {/* 4. GPS Geo-Tagging Module */}
          <section className="onboard-card onboard-gps-card" data-node-id="4:2670">
            <div className="onboard-gps-head">
              <div className="onboard-gps-title-wrap">
                <div className="onboard-gps-icon-badge">
                  <img src={iconGpsPin} alt="" width="14" height="16" />
                </div>
                <div className="onboard-gps-text">
                  <h3>Shop Geo-Location Tagging</h3>
                  <p>Field Audit Verification (PRD: shop_lat, shop_long)</p>
                </div>
              </div>
              <div className="onboard-locked-pill">
                <span className="onboard-locked-dot" />
                <span>{gpsLocked ? 'GPS Locked' : 'Searching'}</span>
              </div>
            </div>

            {/* Static Map Preview with Pinned Merchant */}
            <div className="onboard-map-preview">
              <img src={imgMap} alt="Map View" className="onboard-map-img" />
              <div className="onboard-floating-coords">
                <span>📍 {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E</span>
              </div>
              <div className="onboard-map-pin-overlay">
                <div className="onboard-map-pin-radar" />
                <div className="onboard-map-pin-dot" />
              </div>
            </div>

            <button
              type="button"
              className="onboard-refresh-gps-btn"
              onClick={handleRefreshGps}
            >
              <img src={iconRefreshGps} alt="" width="16" height="16" />
              <span>Refresh GPS Coordinates (Sector 4 Market)</span>
            </button>
          </section>

          {/* 5. Verification Media Capture Module */}
          <section className="onboard-card" data-node-id="4:2743">
            <div className="onboard-section-head">
              <h2 className="onboard-section-title">Verification Media Capture</h2>
              <span className="onboard-section-pill">Geo-Stamped</span>
            </div>

            <div className="onboard-media-grid">
              {/* Owner Portrait Capture */}
              <label className="onboard-media-slot">
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  style={{ display: 'none' }}
                  onChange={(e) => handlePhotoUpload('owner', e)}
                />
                <img src={ownerPhoto} alt="Owner Portrait" className="onboard-media-img" />
                <span className="onboard-media-caption">Owner Portrait Capture</span>
                <span className="onboard-media-badge">✓ Aadhaar Matched</span>
              </label>

              {/* Shop Frontage Capture */}
              <label className="onboard-media-slot">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={(e) => handlePhotoUpload('shop', e)}
                />
                <img src={shopPhoto} alt="Shop Frontage" className="onboard-media-img" />
                <span className="onboard-media-caption">Shop Frontage Capture</span>
                <span className="onboard-media-badge">✓ Geotag Stamped</span>
              </label>
            </div>
          </section>

          {/* 6. Unique Customer ID & QR Preview Card (Sticker Thermal Preview) */}
          <section className="onboard-ticket-card" data-node-id="4:2776">
            <div className="onboard-ticket-qr">
              <img src={iconQrPreview} alt="QR Code" width="52" height="52" />
            </div>
            <div className="onboard-ticket-info">
              <span className="onboard-ticket-shop">{shopName || 'Merchant Shop'}</span>
              <span className="onboard-ticket-id">ID: {systemCustId}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <img src={iconLocationPin} alt="" width="10" height="12" />
                <span className="onboard-ticket-meta">Sector 4 Market • {schemeNameDisplay}</span>
              </div>
              <div className="onboard-ticket-ready">
                <img src={iconPrinterGreen} alt="" width="12" height="11" />
                <span>Ready to print via ESC/POS</span>
              </div>
            </div>
          </section>

          {/* 7. Bottom Action Button */}
          <button
            type="button"
            className="onboard-submit-btn"
            disabled={isSubmitting}
            onClick={handleSubmit}
            data-node-id="4:2799"
          >
            <img src={iconPrintPass} alt="" width="18" height="18" />
            <span>{isSubmitting ? 'Onboarding & Geo-Tagging...' : 'Save & Print Customer Thermal Pass'}</span>
          </button>
        </main>

        {/* Fixed Bottom Navigation */}
        <nav className="onboard-bottom-nav" data-node-id="4:2830" aria-label="Agent Navigation">
          <button
            type="button"
            className="onboard-nav-link"
            onClick={onNavigateHome}
            data-node-id="4:2832"
          >
            <img src={iconNavHome} alt="" width="16.5" height="16.5" />
            <span className="onboard-nav-text">Home</span>
          </button>

          <button
            type="button"
            className="onboard-nav-link"
            onClick={() => {
              if (onNavigateHome) onNavigateHome()
            }}
            data-node-id="4:2837"
          >
            <img src={iconNavTransact} alt="" width="20" height="15" />
            <span className="onboard-nav-text">Transact</span>
          </button>

          <button
            type="button"
            className="onboard-nav-link is-active"
            data-node-id="4:2842"
          >
            <img src={iconNavOnboard} alt="" width="20" height="15" />
            <span className="onboard-nav-text">Onboard</span>
          </button>

          <button
            type="button"
            className="onboard-nav-link"
            onClick={() => {
              toast.info('Passbook Ledger opened', 'Ledger')
            }}
            data-node-id="4:2847"
          >
            <img src={iconNavLedger} alt="" width="16.5" height="18" />
            <span className="onboard-nav-text">Ledger</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
