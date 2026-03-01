import { useState, useEffect, useMemo } from 'react'
import { fetchDecisions } from '../api/client'
import RiskFeedPanel from './RiskFeedPanel'
import './ManagerDashboard.css'

function formatTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function exposureLevelLabel(riskLevel) {
  const r = (riskLevel || '').toUpperCase()
  if (r === 'HIGH') return 'STOP_VERIFY'
  if (r === 'MEDIUM') return 'REVIEW'
  return 'SAFE'
}

function computeCompanyRisk(decisions) {
  if (!decisions.length) return { level: 'LOW', reason: 'No activity recorded yet.' }
  const high = decisions.filter(d => (d.risk_level || '').toUpperCase() === 'HIGH')
  const medium = decisions.filter(d => (d.risk_level || '').toUpperCase() === 'MEDIUM')
  const criticalActions = ['SHARE_CODE', 'SEND_MONEY', 'GRANT_ACCESS']
  const hasCritical = decisions.some(d => criticalActions.includes(d.detected_action))
  if (high.length > 0 || hasCritical) {
    const action = high[0]?.detected_action || decisions.find(d => criticalActions.includes(d.detected_action))?.detected_action
    const reasons = {
      SHARE_CODE: 'Authentication credential or verification code shared with external party.',
      SEND_MONEY: 'Payment or transfer request detected with high-risk indicators.',
      GRANT_ACCESS: 'Access or authority request detected.',
    }
    return { level: 'HIGH', reason: reasons[action] || 'High-exposure action detected.' }
  }
  if (medium.length > 0) return { level: 'MEDIUM', reason: 'Unusual or review-level actions detected. Confirm intent and recipients.' }
  return { level: 'LOW', reason: 'Activity appears consistent with normal communication patterns.' }
}

function getBreakdown(decisions) {
  const credentialSharing = decisions.filter(d => d.detected_action === 'SHARE_CODE').length
  const externalDomain = decisions.filter(d => Array.isArray(d.recipients) && d.recipients.length > 0).length
  const urgentAuthority = decisions.filter(d => {
    const p = d.pressure_signals || []
    return p.some(s => s === 'urgency' || s === 'authority')
  }).length
  return { credentialSharing, externalDomain, urgentAuthority }
}

function incidentTitle(action) {
  const titles = {
    SHARE_CODE: 'Potential account takeover risk',
    SEND_MONEY: 'Payment or transfer risk',
    GRANT_ACCESS: 'Access or authority request risk',
    CLICK_LINK: 'Link or verification risk',
    DOWNLOAD: 'Download or attachment risk',
  }
  return titles[action] || 'Communication risk'
}

function sanitizeDraft(draft) {
  if (!draft || !draft.trim()) return '[No content]'
  const t = draft.trim().replace(/\s+/g, ' ')
  if (t.length <= 80) return t + ' [content redacted]'
  return t.slice(0, 80) + '… [content redacted]'
}

function getThreadSummary(record) {
  const conv = (record.conversation || '').trim()
  const draft = (record.draft || '').trim()
  const recipients = Array.isArray(record.recipients) ? record.recipients : []
  const convPreview = conv ? (conv.length > 300 ? conv.slice(0, 297) + '…' : conv) : '[No thread context]'
  const draftPreview = draft ? (draft.length > 200 ? draft.slice(0, 197) + '…' : draft) : '[No draft]'
  const toLine = recipients.length ? recipients.join(', ') : '—'
  return { convPreview, draftPreview, toLine }
}

function ManagerDashboard({ onLogout }) {
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [investigationRecord, setInvestigationRecord] = useState(null)

  const load = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await fetchDecisions()
      setDecisions(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load')
      setDecisions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [])

  const companyRisk = useMemo(() => computeCompanyRisk(decisions), [decisions])
  const breakdown = useMemo(() => getBreakdown(decisions), [decisions])
  const highSeverityOnly = useMemo(() => decisions.filter(d => (d.risk_level || '').toUpperCase() === 'HIGH'), [decisions])

  if (loading && decisions.length === 0) {
    return (
      <div className="manager-view">
        <header className="manager-header">
          <span className="manager-brand">CanaryGate — Risk dashboard</span>
          <button type="button" className="manager-logout" onClick={onLogout}>Log out</button>
        </header>
        <main className="manager-main"><p className="manager-loading">Loading…</p></main>
      </div>
    )
  }

  if (error && decisions.length === 0) {
    return (
      <div className="manager-view">
        <header className="manager-header">
          <span className="manager-brand">CanaryGate</span>
          <button type="button" className="manager-logout" onClick={onLogout}>Log out</button>
        </header>
        <main className="manager-main"><p className="manager-error" role="alert">{error}</p><button type="button" onClick={load}>Retry</button></main>
      </div>
    )
  }

  return (
    <div className="manager-view">
      <header className="manager-header">
        <span className="manager-brand">CanaryGate — Risk dashboard</span>
        <button type="button" className="manager-logout" onClick={onLogout}>Log out</button>
      </header>
      <main className="manager-main">
        <p className="manager-disclaimer">Patterns and anonymized risk only. No employee email content by default.</p>

        <RiskFeedPanel />

        {/* Tier 1 — Company overview (no names) */}
        <section className="manager-tier1">
          <h1 className="manager-tier1-title">Company human risk level</h1>
          <div className={`manager-risk-badge risk-${companyRisk.level.toLowerCase()}`}>
            {companyRisk.level === 'HIGH' ? 'HIGH' : companyRisk.level === 'MEDIUM' ? 'MEDIUM' : 'LOW'}
          </div>
          <p className="manager-tier1-reason">{companyRisk.reason}</p>
          <dl className="manager-breakdown">
            <dt>Credential sharing attempts</dt>
            <dd>{breakdown.credentialSharing}</dd>
            <dt>External domain interactions</dt>
            <dd>{breakdown.externalDomain}</dd>
            <dt>Urgent / authority pressure messages</dt>
            <dd>{breakdown.urgentAuthority}</dd>
          </dl>
        </section>

        {/* Tier 2 — Incident alerts (no email body) */}
        <section className="manager-tier2">
          <h2 className="manager-section-title">Incident alerts</h2>
          <p className="manager-tier2-hint">
            {decisions.length} incident{decisions.length !== 1 ? 's' : ''} · Updates every 3s · Includes every analysis (extension + web). New extension runs appear here. Security-relevant only. No names. Click HIGH severity for restricted investigation view.
          </p>
          <div className="manager-cards">
            {decisions.slice(0, 30).map((d, i) => {
              const isHigh = (d.risk_level || '').toUpperCase() === 'HIGH'
              const title = incidentTitle(d.detected_action)
              const role = d.role || 'General'
              const external = Array.isArray(d.recipients) && d.recipients.length > 0 ? 'Yes' : '—'
              const actionDesc = d.user_decision === 'analyzed'
                ? 'Message analyzed; no send recorded'
                : d.user_decision === 'sent'
                  ? 'Sent after warning'
                  : d.user_decision === 'edited' || d.user_decision === 'cancelled'
                    ? 'User modified or cancelled'
                    : d.user_decision || '—'
              return (
                <div
                  key={`${d.timestamp || i}-${i}`}
                  className={`manager-card ${isHigh ? 'manager-card-high' : ''}`}
                  onClick={() => isHigh && setInvestigationRecord(d)}
                  role={isHigh ? 'button' : undefined}
                  tabIndex={isHigh ? 0 : undefined}
                  onKeyDown={e => isHigh && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setInvestigationRecord(d))}
                >
                  <h3 className="manager-card-title">{title}</h3>
                  <dl className="manager-card-dl">
                    <dt>Employee role</dt>
                    <dd>{role}</dd>
                    <dt>External recipient domain</dt>
                    <dd>{external}</dd>
                    <dt>Action</dt>
                    <dd>{actionDesc}</dd>
                    <dt>Exposure level</dt>
                    <dd>{exposureLevelLabel(d.risk_level)}</dd>
                  </dl>
                  {isHigh && <span className="manager-card-expand">Click for investigation view (restricted)</span>}
                </div>
              )
            })}
          </div>
          {decisions.length === 0 && <p className="manager-empty">No incidents yet.</p>}
        </section>

        {/* Tier 3 — Investigation mode (HIGH only, sanitized) */}
        {investigationRecord && (
          <div className="manager-investigation-backdrop" onClick={() => setInvestigationRecord(null)} role="dialog" aria-label="Investigation detail">
            <div className="manager-investigation" onClick={e => e.stopPropagation()}>
              <div className="manager-investigation-header">
                <h2>Investigation view (HIGH severity only)</h2>
                <button type="button" className="manager-investigation-close" onClick={() => setInvestigationRecord(null)} aria-label="Close">×</button>
              </div>
              <p className="manager-investigation-notice">Sanitized content only. Not full message or inbox.</p>
              <dl className="manager-investigation-dl">
                <dt>Time</dt>
                <dd>{formatTime(investigationRecord.timestamp)}</dd>
                <dt>Employee role</dt>
                <dd>{investigationRecord.role || 'General'}</dd>
                <dt>Data action</dt>
                <dd>{investigationRecord.detected_action || '—'}</dd>
                <dt>Employee decision</dt>
                <dd>{investigationRecord.user_decision || '—'}</dd>
              </dl>
              {(() => {
                const sum = getThreadSummary(investigationRecord)
                return (
                  <>
                    <h3>Email / thread summary</h3>
                    <div className="manager-investigation-summary">
                      <p><strong>Thread context:</strong> {sum.convPreview}</p>
                      <p><strong>Message:</strong> {sum.draftPreview}</p>
                      <p><strong>Recipients:</strong> {sum.toLine}</p>
                    </div>
                  </>
                )
              })()}
              <h3>Sanitized message</h3>
              <pre className="manager-investigation-pre">{sanitizeDraft(investigationRecord.draft)}</pre>
              <h3>Detected risky content</h3>
              <pre className="manager-investigation-pre">{investigationRecord.explanation || '—'}</pre>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default ManagerDashboard
