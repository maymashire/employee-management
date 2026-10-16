import { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '../lib/firebase'
import { signInWithEmailAndPassword, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

export const AUTH_BYPASS = false

// ──────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext(null)

async function fetchUserProfile(email) {
  if (!email) return null
  try {
    const snap = await getDocs(query(
      collection(db, 'users'),
      where('username', '==', email),
    ))
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() }

    // First-time login for the admin account — auto-create the profile row
    if (email === 'maryan@gmail.com') {
      const profile = { username: email, role: 'Admin', employee_id: null, employees: null }
      await setDoc(doc(db, 'users', email), profile)
      return { id: email, ...profile }
    }
    return null
  } catch (err) {
    console.warn('[AuthContext] fetchUserProfile error:', err)
    return null
  }
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (AUTH_BYPASS) return

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setUser({ id: fbUser.uid, email: fbUser.email })
        const prof = await fetchUserProfile(fbUser.email)
        setProfile(prof)
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => unsub()
  }, [])

  // ── Auth actions ───────────────────────────────────────────────────────────
  const signIn = AUTH_BYPASS
    ? () => Promise.resolve({ data: null, error: null })
    : (email, password) => signInWithEmailAndPassword(auth, email, password)
      .then(c => ({ data: c, error: null }))
      .catch(e => ({ data: null, error: e }))

  const signOut = AUTH_BYPASS
    ? () => { sessionStorage.removeItem('wf_auth'); return Promise.resolve() }
    : () => fbSignOut(auth)

  // ── Role flags ─────────────────────────────────────────────────────────────
  const isAdmin   = profile?.role === 'Admin'
  const isHR      = profile?.role === 'HR'
  const isFinance = profile?.role === 'Finance'
  const isManager = profile?.role === 'Manager'
  const canAccessPayroll = isAdmin || isFinance

  const fullEmail   = user?.email ?? ''
  const displayName = fullEmail.split('@')[0] || 'User'
  const roleLabel   = profile?.role ?? null
  const initials    = displayName.slice(0, 2).toUpperCase()

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      isAdmin, isHR, isFinance, isManager, canAccessPayroll,
      displayName, fullEmail, roleLabel, initials,
      signIn, signOut,
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
