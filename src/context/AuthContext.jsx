import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// ── Auth bypass ────────────────────────────────────────────────────────────────
// true  → skip Supabase Auth entirely; grant immediate Admin access
// false → real Supabase sign-in required (re-enable when auth is stable)
export const AUTH_BYPASS = true

const BYPASS_USER = {
  id:    '7114700c-735e-4bf9-a95d-2b1fc980b981',
  email: 'maryan@gmail.com',
}
const BYPASS_PROFILE = {
  id:          '7114700c-735e-4bf9-a95d-2b1fc980b981',
  username:    'maryan@gmail.com',
  role:        'Admin',
  employee_id: '7114700c-735e-4bf9-a95d-2b1fc980b981',
}

// ──────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext(null)

// Fetch the row from public.users — tries by username (email) first,
// then by id as a fallback (covers manual upserts where id = auth uid).
async function fetchUserProfile(email, userId) {
  if (!email && !userId) return null
  try {
    if (email) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', email)
        .maybeSingle()
      if (!error && data) return data
      if (error) console.warn('[AuthContext] username lookup error:', error.message)
    }
    if (userId) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (!error && data) return data
      if (error) console.warn('[AuthContext] id lookup error:', error.message)
    }
    return null
  } catch (err) {
    console.warn('[AuthContext] fetchUserProfile exception:', err)
    return null
  }
}

export function AuthProvider({ children }) {
  // Hooks are always called regardless of bypass (React rules of hooks).
  // When bypassed the initial values are pre-filled so no effects are needed.
  const [user,    setUser]    = useState(AUTH_BYPASS ? BYPASS_USER    : null)
  const [profile, setProfile] = useState(AUTH_BYPASS ? BYPASS_PROFILE : undefined)
  const [loading, setLoading] = useState(AUTH_BYPASS ? false          : true)

  useEffect(() => {
    if (AUTH_BYPASS) return   // no Supabase subscriptions when bypassed

    let cancelled = false

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (cancelled) return
        const u = session?.user ?? null
        setUser(u)
        const prof = u ? await fetchUserProfile(u.email, u.id) : null
        if (!cancelled) { setProfile(prof); setLoading(false) }
      })
      .catch(err => {
        console.warn('[AuthContext] getSession error:', err)
        if (!cancelled) { setProfile(null); setLoading(false) }
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (cancelled) return
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          const prof = await fetchUserProfile(u.email, u.id)
          if (!cancelled) setProfile(prof)
        } else {
          setProfile(null)
        }
        if (!cancelled) setLoading(false)
      }
    )

    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  // ── Auth actions ───────────────────────────────────────────────────────────
  const signIn = AUTH_BYPASS
    ? () => Promise.resolve({ data: null, error: null })
    : (email, password) => supabase.auth.signInWithPassword({ email, password })

  const signOut = AUTH_BYPASS
    ? () => Promise.resolve()
    : () => supabase.auth.signOut()

  // ── Role flags ─────────────────────────────────────────────────────────────
  const isAdmin   = profile?.role === 'Admin'
  const isHR      = profile?.role === 'HR'
  const isFinance = profile?.role === 'Finance'
  const isManager = profile?.role === 'Manager'
  const canAccessPayroll = isAdmin || isFinance

  // ── Derived display values ─────────────────────────────────────────────────
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
