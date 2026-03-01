import { useState, useEffect } from 'react'
import { fetchRiskFeed } from '../api/client'
import './RiskFeedPanel.css'

function relativeTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const now = new Date()
    const sec = Math.floor((now - d) / 1000)
    if (sec < 60) return 'just now'
    const min = Math.floor(sec / 60)
    if (min === 1) return '1 min ago'
    if (min < 60) return `${min} min ago`
    const hr = Math.floor(min / 60)
    if (hr === 1) return '1 hr ago'
    return `${hr} hr ago`
  } catch {
    return iso
  }
}

function metricsLine(metrics) {
  if (!metrics || typeof metrics !== 'object') return null
  const parts = []
  if (typeof metrics.count === 'number') parts.push(`${metrics.count} events`)
  if (typeof metrics.window_minutes === 'number') parts.push(`${metrics.window_minutes}m window`)
  if (metrics.action) parts.push(metrics.action.replace(/_/g, ' '))
  return parts.length ? parts.join(' · ') : null
}

export default function RiskFeedPanel() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setError(null)
    try {
      const data = await fetchRiskFeed()
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load risk feed')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [])

  if (loading && items.length === 0) {
    return (
      <section className="risk-feed-panel" aria-label="Company exposure feed">
        <h2 className="risk-feed-panel-title">Company exposure feed</h2>
        <p className="risk-feed-panel-empty">Loading…</p>
      </section>
    )
  }

  return (
    <section className="risk-feed-panel" aria-label="Company exposure feed">
      <h2 className="risk-feed-panel-title">Company exposure feed</h2>
      {error && items.length === 0 && (
        <p className="risk-feed-panel-error" role="alert">{error}</p>
      )}
      {!error && items.length === 0 && (
        <p className="risk-feed-panel-empty">No emerging behavioral risks detected.</p>
      )}
      {items.length > 0 && (
        <div className="risk-feed-list">
          {items.map((n) => (
            <article
              key={n.id}
              className={`risk-feed-card risk-feed-card--${n.severity || 'info'}`}
            >
              <h3 className="risk-feed-card-title">{n.title}</h3>
              <p className="risk-feed-card-desc">{n.description}</p>
              {metricsLine(n.supporting_metrics) && (
                <p className="risk-feed-card-metrics">{metricsLine(n.supporting_metrics)}</p>
              )}
              <time className="risk-feed-card-time" dateTime={n.timestamp}>
                {relativeTime(n.timestamp)}
              </time>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
