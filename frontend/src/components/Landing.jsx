import './Landing.css'

function Landing({ onLogin }) {
  return (
    <div className="landing">
      <header className="landing-header">
        <a href="/" className="landing-brand" aria-label="CanaryGate home">
          <img src="/logo.png" alt="CanaryGate" className="landing-logo" />
          <span className="landing-brand-name">CanaryGate</span>
        </a>
        <button type="button" className="landing-login-btn" onClick={onLogin} aria-label="Log in">
          Log in
        </button>
      </header>
      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-logo-wrap">
            <img src="/logo.png" alt="" className="landing-hero-logo" aria-hidden />
          </div>
          <h1 className="landing-title">Safety for communication</h1>
          <p className="landing-tagline">
            Clear guidance before you send. Risk visibility without surveillance.
          </p>
          <p className="landing-desc">
            CanaryGate is a human-layer safety system. It helps people avoid risky decisions before they send — and gives organizations visibility into exposure without reading anyone’s email.
          </p>
        </section>
        <section className="landing-features">
          <div className="landing-feature">
            <h2>For employees</h2>
            <p>Instant feedback before you send. Clear explanations and safer alternatives — like spell-check for risky actions. Your protection history is private; managers never see your messages.</p>
          </div>
          <div className="landing-feature">
            <h2>For managers &amp; legal</h2>
            <p>Company risk level and anonymized patterns only. No names, no email bodies by default. Details only when policy is violated and only what’s needed to understand the risk.</p>
          </div>
        </section>
        <section className="landing-cta">
          <button type="button" className="landing-cta-btn" onClick={onLogin}>
            Log in to get started
          </button>
        </section>
      </main>
      <footer className="landing-footer">
        <p>Human-layer security. No surveillance.</p>
      </footer>
    </div>
  )
}

export default Landing
