import { useState, useEffect } from 'react'
import Landing from './components/Landing'
import LoginModal from './components/LoginModal'
import EmployeeView from './components/EmployeeView'
import ManagerDashboard from './components/ManagerDashboard'
import './App.css'

const AUTH_KEY = 'canarygate_role'
export const USER_ID_KEY = 'canarygate_user_id'

function ensureEmployeeUserId() {
  let id = localStorage.getItem(USER_ID_KEY)
  if (!id || !id.trim()) {
    id = 'emp-' + Math.random().toString(36).slice(2, 14)
    localStorage.setItem(USER_ID_KEY, id)
  }
  return id
}

function App() {
  const [user, setUser] = useState(null)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_KEY)
    if (saved === 'employee' || saved === 'manager') setUser({ role: saved })
  }, [])

  const handleLogin = (role) => {
    setUser({ role })
    localStorage.setItem(AUTH_KEY, role)
    if (role === 'employee') ensureEmployeeUserId()
    setShowLogin(false)
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem(AUTH_KEY)
  }

  if (user?.role === 'employee') {
    const userId = ensureEmployeeUserId()
    if (typeof window !== 'undefined') window.__CANARYGATE_USER_ID__ = userId
    return <EmployeeView onLogout={handleLogout} />
  }

  if (user?.role === 'manager') {
    return <ManagerDashboard onLogout={handleLogout} />
  }

  return (
    <>
      <Landing onLogin={() => setShowLogin(true)} />
      {showLogin && (
        <LoginModal
          onSelect={handleLogin}
          onClose={() => setShowLogin(false)}
        />
      )}
    </>
  )
}

export default App
