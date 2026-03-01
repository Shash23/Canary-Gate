import { useState, useEffect, useMemo } from 'react'
import { fetchDecisions } from '../api/client'
import './SecurityDashboard.css'

function formatTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  } catch {
    return iso
  }
}

function formatTimeShort(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return iso
  }
}

function riskRowClass(riskLevel) {
  const r = (riskLevel || '').toUpperCase()
  if (r === 'HIGH') return 'risk-high'
  if (r === 'MEDIUM') return 'risk-medium'
  return 'risk-low'
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

function buildTimelineEntries(decisions) {
  const entries = []
  decisions.forEach((d, i) => {
    const ts = d.timestamp
    const action = d.detected_action || 'Communication'
    const level = exposureLevelLabel(d.risk_level)
    entries.push({ ts, type: 'detected', text: `${action} detected (${level})`, record: d })
    entries.push({ ts, type: 'decision', text: `Employee ${d.user_decision || 'analyzed'}`, record: d })
    const r = (d.risk_level || '').toUpperCase()
    if (r === 'HIGH' && (d.user_decision === 'sent' || d.user_decision === 'analyzed')) {
      entries.push({ ts, type: 'risk', text: 'Potential account takeover or data exposure risk', record: d })
    }
    if ((d.user_decision === 'edited' || d.user_decision === 'cancelled') && r !== 'LOW') {
      entries.push({ ts, type: 'prevented', text: 'Breach prevented — user modified or cancelled', record: d })
    }
  })
  entries.sort((a, b) => new Date(b.ts) - new Date(a.ts))
  return entries.slice(0, 50)
}

function SecurityDashboard() {
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [viewAs, setViewAs] = useState('all')

  const load = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await fetchDecisions()
      setDecisions(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load decisions')
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

  const users = useMemo(() => {
    const ids = new Set()
    decisions.forEach(d => { if (d.user_identifier) ids.add(d.user_identifier) })
    return Array.from(ids).sort()
  }, [decisions])

  const filtered = useMemo(() => {
    if (viewAs === 'all') return decisions
    return decisions.filter(d => d.user_identifier === viewAs)
  }, [decisions, viewAs])

  const companyRisk = useMemo(() => computeCompanyRisk(filtered), [filtered])
  const timeline = useMemo(() => buildTimelineEntries(filtered), [filtered])
  const prevented = useMemo(() => filtered.filter(d => d.user_decision === 'edited' || d.user_decision === 'cancelled'), [filtered])
  const highRisk = useMemo(() => filtered.filter(d => (d.risk_level || '').toUpperCase() === 'HIGH'), [filtered])

  if (loading && decisions.length === 0) {
    return (
      <div className="dashboard">
        <p className="dashboard-status">Loading…</p>
      </div>
    )
  }

  if (error && decisions.length === 0) {
    return (
      <div className="dashboard">
        <p className="dashboard-error" role="alert">{error}</p>
        <button type="button" className="dashboard-refresh" onClick={load}>Retry</button>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-controls">
        <label className="dashboard-view-label">
          View as
          <select
            className="dashboard-view-select"
            value={viewAs}
            onChange={(e) => setViewAs(e.target.value)}
            aria-label="View as organization or employee"
          >
            <option value="all">Organization (manager / legal)</option>
            {users.map(u => (
              <option key={u} value={u}>{u === 'gmail-extension' ? 'My activity (extension)' : u === 'web-simulated' ? 'My activity (web)' : u}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="dashboard-risk-card" aria-live="polite">
        <h2 className="dashboard-risk-title">Company Exposure Level</h2>
        <div className={`dashboard-risk-badge risk-${companyRisk.level.toLowerCase()}`}>
          {companyRisk.level === 'HIGH' ? 'HIGH' : companyRisk.level === 'MEDIUM' ? 'ELEVATED' : 'LOW'}
        </div>
        <p className="dashboard-risk-reason">{companyRisk.reason}</p>
      </section>

      <div className="dashboard-metrics">
        <div className="dashboard-metric">
          <span className="dashboard-metric-value">{filtered.length}</span>
          <span className="dashboard-metric-label">Messages analyzed</span>
        </div>
        <div className="dashboard-metric">
          <span className="dashboard-metric-value dashboard-metric-danger">{highRisk.length}</span>
          <span className="dashboard-metric-label">High-exposure events</span>
        </div>
        <div className="dashboard-metric">
          <span className="dashboard-metric-value dashboard-metric-success">{prevented.length}</span>
          <span className="dashboard-metric-label">Breaches prevented</span>
        </div>
      </div>

      <section className="dashboard-timeline-section">
        <h2 className="dashboard-section-title">Live incident feed</h2>
        <ul className="dashboard-timeline" aria-label="SOC-style incident timeline">
          {timeline.length === 0 ? (
            <li className="dashboard-timeline-empty">No events yet.</li>
          ) : (
            timeline.map((entry, i) => (
              <li
                key={i}
                className={`dashboard-timeline-item timeline-${entry.type}`}
                onClick={() => setSelected(entry.record)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(entry.record) } }}
              >
                <span className="dashboard-timeline-time">{formatTimeShort(entry.ts)}</span>
                <span className="dashboard-timeline-text">{entry.text}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      {prevented.length > 0 && (
        <section className="dashboard-prevented">
          <h2 className="dashboard-section-title">Breach prevented</h2>
          <p className="dashboard-prevented-copy">User modified or cancelled the message after warning.</p>
          <ul className="dashboard-prevented-list">
            {prevented.slice(0, 10).map((d, i) => (
              <li key={i} onClick={() => setSelected(d)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelected(d) }}>
                {formatTime(d.timestamp)} — {d.detected_action || 'Action'} ({d.user_decision})
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="dashboard-feed-section">
        <h2 className="dashboard-section-title">Detailed activity</h2>
        <div className="dashboard-feed">
          <table className="dashboard-table" aria-label="Human risk activity">
            <thead>
              <tr>
                <th>Time</th>
                <th>Data Action</th>
                <th>Exposure Level</th>
                <th>Employee Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr
                  key={i}
                  className={riskRowClass(d.risk_level)}
                  onClick={() => setSelected(selected === d ? null : d)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelected(selected === d ? null : d)
                    }
                  }}
                  aria-pressed={selected === d}
                >
                  <td>{formatTime(d.timestamp)}</td>
                  <td>{d.detected_action || '—'}</td>
                  <td>{exposureLevelLabel(d.risk_level) || '—'}</td>
                  <td>{d.user_decision || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="dashboard-empty">No activity for this view.</p>
          )}
        </div>
      </section>

      {selected && (
        <div className="dashboard-detail" role="dialog" aria-label="Communication event detail">
          <div className="dashboard-detail-header">
            <h2>Communication Event</h2>
            <button type="button" className="dashboard-detail-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
          </div>
          <dl className="dashboard-detail-dl">
            <dt>Time</dt>
            <dd>{formatTime(selected.timestamp)}</dd>
            <dt>Source</dt>
            <dd>{selected.user_identifier || '—'}</dd>
            <dt>Data action</dt>
            <dd>{selected.detected_action || '—'}</dd>
            <dt>Exposure level</dt>
            <dd>{exposureLevelLabel(selected.risk_level) || '—'}</dd>
            <dt>Employee action</dt>
            <dd>{selected.user_decision || '—'}</dd>
            <dt>Recipients</dt>
            <dd>{Array.isArray(selected.recipients) && selected.recipients.length ? selected.recipients.join(', ') : '—'}</dd>
          </dl>
          <h3>Full message</h3>
          <pre className="dashboard-detail-pre">{selected.draft || '(empty)'}</pre>
          <h3>Conversation context</h3>
          <pre className="dashboard-detail-pre">{selected.conversation || '(none)'}</pre>
          <h3>System explanation</h3>
          <pre className="dashboard-detail-pre">{selected.explanation || '—'}</pre>
        </div>
      )}
    </div>
  )
}

export default SecurityDashboard
