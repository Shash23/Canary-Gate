import './LoginModal.css'

function LoginModal({ onSelect, onClose }) {
  return (
    <div className="login-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Log in">
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <div className="login-modal-header">
          <h2>Log in</h2>
          <button type="button" className="login-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="login-modal-hint">Choose your role to continue.</p>
        <div className="login-modal-buttons">
          <button type="button" className="login-modal-option" onClick={() => onSelect('employee')}>
            <span className="login-modal-option-title">Employee</span>
            <span className="login-modal-option-desc">Safety copilot — see your protection history only</span>
          </button>
          <button type="button" className="login-modal-option" onClick={() => onSelect('manager')}>
            <span className="login-modal-option-title">Manager / Legal</span>
            <span className="login-modal-option-desc">Risk dashboard — patterns and alerts, no email content by default</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoginModal
