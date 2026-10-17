/**
 * Auth backed by the Firestore `users` collection.
 * - Sign-in verifies a salted PBKDF2 hash (lib/password.js).
 * - Session = a small profile snapshot in localStorage ("remember me") or
 *   sessionStorage; it's refreshed from Firestore on load so role / status
 *   changes and deletions take effect.
 * - Optional per-user idle auto sign-out (preferences.idle_timeout, minutes).
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import * as db from '../lib/db'
import { verifyPassword } from '../lib/password'

const SESSION_KEY = 'wf_session'
export const LOGOUT_REASON_KEY = 'wf_logout_reason'

// Bootstrap admin: only accepted while that account has no password set yet.
// The first successful sign-in stores a proper hash, after which this is ignored.
const BOOTSTRAP = { email: 'maryan@gmail.com', password: '123456', name: 'Maryan' }

export const ROLES = ['Admin', 'HR', 'Finance', 'Manager']

const AuthContext = createContext(null)

const SNAPSHOT_KEYS = [
  'id', 'username', 'name', 'phone', 'role', 'status', 'employee_id', 'avatar_url',
  'preferences', 'last_login', 'created_at', 'password_updated_at',
]
const snapshot = u => Object.fromEntries(SNAPSHOT_KEYS.map(k => [k, u[k] ?? null]))

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem('wf_auth') } catch {}
}
function writeSession(u, remember) {
  try {
    const keep = remember ?? !!localStorage.getItem(SESSION_KEY)
    clearSession()
    ;(keep ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(snapshot(u)))
  } catch {}
}

export function AuthProvider({ children }) {
  // The cached snapshot renders immediately; Firestore refresh follows.
  const [initial]             = useState(readSession)
  const [profile, setProfile] = useState(initial)
  const loading = false
  const idleTimer = useRef(null)

  const applyProfile = useCallback((u, remember) => {
    setProfile(u)
    if (u) writeSession(u, remember)
  }, [])

  // Refresh the stored session from Firestore
  useEffect(() => {
    if (!initial?.id) return
    let alive = true
    db.getSystemUser(initial.id)
      .then(u => {
        if (!alive) return
        if (!u || u.status === 'disabled') {
          clearSession(); setProfile(null)
          if (u) sessionStorage.setItem(LOGOUT_REASON_KEY, 'disabled')
        } else {
          applyProfile(u)
        }
      })
      .catch(() => {})            // offline: keep the cached snapshot
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ──
  const signIn = useCallback(async (email, password, remember = false) => {
    const key = email.trim().toLowerCase()
    let u = await db.findSystemUserByEmail(key)

    if (u?.password_hash) {
      if (!(await verifyPassword(password, u.password_salt, u.password_hash))) {
        throw new Error('Invalid email or password.')
      }
    } else if (key === BOOTSTRAP.email) {
      if (password !== BOOTSTRAP.password) throw new Error('Invalid email or password.')
      if (!u) {
        u = await db.createSystemUser({ email: key, name: BOOTSTRAP.name, role: 'Admin', password })
      } else {
        u = { ...u, ...(await db.setUserPassword(u.id, password)), role: u.role ?? 'Admin' }
      }
    } else if (u && !u.password_hash) {
      throw new Error('This account has no password yet. Ask an administrator to set one.')
    } else {
      throw new Error('Invalid email or password.')
    }

    if (u.status === 'disabled') throw new Error('This account has been disabled. Contact your administrator.')

    const last_login = new Date().toISOString()
    db.updateSystemUser(u.id, { last_login }).catch(() => {})
    u = { ...u, last_login }
    sessionStorage.removeItem(LOGOUT_REASON_KEY)
    applyProfile(u, remember)
    return u
  }, [applyProfile])

  const signOut = useCallback(async reason => {
    clearSession()
    if (typeof reason === 'string') sessionStorage.setItem(LOGOUT_REASON_KEY, reason)
    setProfile(null)
  }, [])

  const updateMe = useCallback(async patch => {
    if (!profile?.id) return
    await db.updateSystemUser(profile.id, patch)
    applyProfile({ ...profile, ...patch })
  }, [profile, applyProfile])

  const changePassword = useCallback(async (current, next) => {
    const fresh = await db.getSystemUser(profile?.id)
    if (!fresh) throw new Error('Your account could not be found.')
    if (!(await verifyPassword(current, fresh.password_salt, fresh.password_hash))) {
      throw new Error('Current password is incorrect.')
    }
    const patch = await db.setUserPassword(fresh.id, next)
    applyProfile({ ...profile, password_updated_at: patch.password_updated_at })
  }, [profile, applyProfile])

  const refreshProfile = useCallback(async () => {
    if (!profile?.id) return
    const u = await db.getSystemUser(profile.id)
    if (u) applyProfile(u)
  }, [profile, applyProfile])

  // ── Idle auto sign-out ──
  const idleMinutes = Number(profile?.preferences?.idle_timeout) || 0
  useEffect(() => {
    if (!profile || !idleMinutes) return
    const reset = () => {
      clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => signOut('idle'), idleMinutes * 60 * 1000)
    }
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(idleTimer.current)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [profile, idleMinutes, signOut])

  // ── Derived ──
  const role        = profile?.role ?? null
  const isAdmin     = role === 'Admin'
  const isHR        = role === 'HR'
  const isFinance   = role === 'Finance'
  const isManager   = role === 'Manager'
  const fullEmail   = profile?.username ?? ''
  const displayName = profile?.name?.trim() || fullEmail.split('@')[0] || 'User'
  const initials    = displayName.split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || 'U'
  const user        = profile ? { id: profile.id, email: fullEmail } : null

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      isAdmin, isHR, isFinance, isManager, canAccessPayroll: isAdmin || isFinance,
      displayName, fullEmail, roleLabel: role, initials, avatarUrl: profile?.avatar_url ?? null,
      landingPage: profile?.preferences?.landing ?? '/dashboard',
      signIn, signOut, updateMe, changePassword, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
