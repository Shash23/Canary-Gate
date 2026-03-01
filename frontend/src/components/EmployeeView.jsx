import { useState, useEffect, useMemo } from 'react'
import { fetchDecisions } from '../api/client'
import { USER_ID_KEY } from '../App'
import './EmployeeView.css'

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

function EmployeeView({ onLogout }) {
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [investigationRecord, setInvestigationRecord] = useState(null)

  const myUserId = typeof window !== 'undefined' ? localStorage.getItem(USER_ID_KEY) || '' : ''

  const myDecisions = useMemo(() => {
    return decisions.filter(d =>
      d.user_identifier === myUserId || d.user_identifier === 'web-simulated'
    )
  }, [decisions, myUserId])

  const stats = useMemo(() => {
    const analyzed = myDecisions.length
    const high = myDecisions.filter(d => (d.risk_level || '').toUpperCase() === 'HIGH').length
    const medium = myDecisions.filter(d => (d.risk_level || '').toUpperCase() === 'MEDIUM').length
    const prevented = myDecisions.filter(d => d.user_decision === 'edited' || d.user_decision === 'cancelled').length
    const flagged = high + medium
    const actionCounts = {}
    myDecisions.forEach(d => {
      const a = d.detected_action || 'Other'
      actionCounts[a] = (actionCounts[a] || 0) + 1
    })
    const sortedActions = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])
    const mostCommonRisk = sortedActions[0]
      ? `${sortedActions[0][0].replace(/_/g, ' ').toLowerCase()} (${sortedActions[0][1]} time${sortedActions[0][1] > 1 ? 's' : ''})`
      : 'None yet'
    return { analyzed, flagged, prevented, mostCommonRisk }
  }, [myDecisions])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      setLoading(true)
      try {
        const data = await fetchDecisions()
        if (!cancelled) setDecisions(Array.isArray(data) ? data : [])
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (loading && myDecisions.length === 0) {
    return (
      <div className="employee-view">
        <header className="employee-header">
          <span className="employee-brand">CanaryGate</span>
          <button type="button" className="employee-logout" onClick={onLogout}>Log out</button>
        </header>
        <main className="employee-main">
          <p className="employee-loading">Loading your protection history…</p>
        </main>
      </div>
    )
  }

  if (error && myDecisions.length === 0) {
    return (
      <div className="employee-view">
        <header className="employee-header">
          <span className="employee-brand">CanaryGate</span>
          <button type="button" className="employee-logout" onClick={onLogout}>Log out</button>
        </header>
        <main className="employee-main">
          <p className="employee-error" role="alert">{error}</p>
        </main>
      </div>
    )
  }

  return (
    <div className="employee-view">
      <header className="employee-header">
        <span className="employee-brand">CanaryGate — Your safety</span>
        <button type="button" className="employee-logout" onClick={onLogout}>Log out</button>
      </header>
      <main className="employee-main">
        <h1 className="employee-title">Personal protection history</h1>
        <p className="employee-intro">This page is only visible to you. Managers cannot see your messages or this summary.</p>

        <div className="employee-stats">
          <div className="employee-stat-card">
            <span className="employee-stat-value">{stats.prevented}</span>
            <span className="employee-stat-label">Potential incidents you prevented</span>
          </div>
          <div className="employee-stat-card">
            <span className="employee-stat-value">{stats.analyzed}</span>
            <span className="employee-stat-label">Messages analyzed</span>
          </div>
          <div className="employee-stat-card">
            <span className="employee-stat-value">{stats.flagged}</span>
            <span className="employee-stat-label">Times you were warned (SAFE / CHECK / STOP)</span>
          </div>
        </div>

        <section className="employee-common">
          <h2>Most common risk in your traffic</h2>
          <p>{stats.mostCommonRisk}</p>
        </section>

        <section className="employee-alerts">
          <h2 className="employee-section-title">Your incident alerts</h2>
          <p className="employee-alerts-hint">Checks from your account. Click a HIGH severity item for details.</p>
          <div className="employee-cards">
            {myDecisions.slice(0, 30).map((d, i) => {
              const isHigh = (d.risk_level || '').toUpperCase() === 'HIGH'
              const title = incidentTitle(d.detected_action)
              const external = Array.isArray(d.recipients) && d.recipients.length > 0 ? 'Yes' : '—'
              const actionDesc = d.user_decision === 'analyzed'
                ? 'Message analyzed; no send recorded'
                : d.user_decision === 'sent'
                  ? 'Sent after warning'
                  : d.user_decision === 'edited' || d.user_decision === 'cancelled'
                    ? 'You modified or cancelled'
                    : d.user_decision || '—'
              return (
                <div
                  key={i}
                  className={`employee-card ${isHigh ? 'employee-card-high' : ''}`}
                  onClick={() => isHigh && setInvestigationRecord(d)}
                  role={isHigh ? 'button' : undefined}
                  tabIndex={isHigh ? 0 : undefined}
                  onKeyDown={e => isHigh && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setInvestigationRecord(d))}
                >
                  <h3 className="employee-card-title">{title}</h3>
                  <dl className="employee-card-dl">
                    <dt>External recipient</dt>
                    <dd>{external}</dd>
                    <dt>Your action</dt>
                    <dd>{actionDesc}</dd>
                    <dt>Exposure level</dt>
                    <dd>{exposureLevelLabel(d.risk_level)}</dd>
                  </dl>
                  {isHigh && <span className="employee-card-expand">Click for details</span>}
                </div>
              )
            })}
          </div>
          {myDecisions.length === 0 && <p className="employee-empty">No incident alerts yet.</p>}
        </section>

        {investigationRecord && (
          <div className="employee-detail-backdrop" onClick={() => setInvestigationRecord(null)} role="dialog" aria-label="Check detail">
            <div className="employee-detail" onClick={e => e.stopPropagation()}>
              <div className="employee-detail-header">
                <h2>Check detail (HIGH severity)</h2>
                <button type="button" className="employee-detail-close" onClick={() => setInvestigationRecord(null)} aria-label="Close">×</button>
              </div>
              <dl className="employee-detail-dl">
                <dt>Time</dt>
                <dd>{formatTime(investigationRecord.timestamp)}</dd>
                <dt>Data action</dt>
                <dd>{investigationRecord.detected_action || '—'}</dd>
                <dt>Your decision</dt>
                <dd>{investigationRecord.user_decision || '—'}</dd>
              </dl>
              {(() => {
                const sum = getThreadSummary(investigationRecord)
                return (
                  <>
                    <h3>Email / thread summary</h3>
                    <div className="employee-detail-summary">
                      <p><strong>Thread context:</strong> {sum.convPreview}</p>
                      <p><strong>Your message:</strong> {sum.draftPreview}</p>
                      <p><strong>Recipients:</strong> {sum.toLine}</p>
                    </div>
                  </>
                )
              })()}
              <h3>Sanitized message</h3>
              <pre className="employee-detail-pre">{sanitizeDraft(investigationRecord.draft)}</pre>
              <h3>Why this was flagged</h3>
              <pre className="employee-detail-pre">{investigationRecord.explanation || '—'}</pre>
            </div>
          </div>
        )}

        <p className="employee-footer">Use the Gmail extension to get instant feedback before you send. You’ll see SAFE, CHECK, or STOP & VERIFY plus a safer alternative when needed. Open this page in the same browser as the extension so your checks appear here.</p>
      </main>
    </div>
  )
}

export default EmployeeView
