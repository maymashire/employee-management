import { Navigate } from 'react-router-dom'
import { useAuth, AUTH_BYPASS } from '../context/AuthContext'
import { Loader2 } from 'lucide-react'
import { auth } from '../lib/firebase'
import { signOut as fbSignOut } from 'firebase/auth'

// adminOnly={true}     → Admin + Finance (payroll pages)
// adminOnly="strict"   → Admin only (Settings / User Management)
// adminOnly={false}    → any authenticated + profiled user
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading, isAdmin, isFinance } = useAuth()

  // When AUTH_BYPASS is on, context already has Admin state.
  // Still require the user to have passed through the login page (session flag).
  if (AUTH_BYPASS) {
    if (!sessionStorage.getItem('wf_auth')) return <Navigate to="/login" replace />
    return children
  }

  // ── Initial session check in progress ──────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-[#1e3a8a]" />
          <p className="text-sm text-gray-400 font-medium">Checking session…</p>
        </div>
      </div>
    )
  }

  // ── Not authenticated ───────────────────────────────────────────────────────
  if (!user) return <Navigate to="/login" replace />

  // ── Authenticated but profile row not found in users table ────────────────
  // In DEV mode: show the raw user info so we can debug the lookup failure.
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Account Not Configured</h2>
          <p className="text-sm text-gray-500 mb-4">
            Your email is authenticated but no matching row was found in the <code className="bg-gray-100 px-1 rounded">users</code> table.
          </p>
          {import.meta.env.DEV && user && (
            <div className="text-left bg-gray-50 rounded-xl border border-gray-200 p-4 mb-5 text-xs font-mono space-y-1">
              <p className="font-semibold text-gray-700 mb-2">🔍 Debug Info</p>
              <p><span className="text-gray-400">Auth email:</span> <span className="text-gray-900">{user.email}</span></p>
              <p><span className="text-gray-400">Auth ID:</span> <span className="text-gray-900 break-all">{user.id}</span></p>
              <p className="mt-2 text-orange-600 text-[10px]">
                Make sure the <strong>users</strong> table has a row where<br />
                <code>username = '{user.email}'</code><br />
                or <code>id = '{user.id}'</code>
              </p>
            </div>
          )}
          <button
            onClick={() => fbSignOut(auth)}
            className="px-5 py-2.5 bg-[#1e3a8a] text-white text-sm font-semibold rounded-xl hover:bg-[#162d6e] transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }


  // ── Role-gated sections ───────────────────────────────────────────────────
  // adminOnly="strict" → Admin only (Settings / User Management)
  if (adminOnly === 'strict' && !isAdmin) return <Navigate to="/dashboard" replace />
  // adminOnly={true}   → Admin + Finance (Payroll)
  if (adminOnly === true && !isAdmin && !isFinance) return <Navigate to="/dashboard" replace />

  return children
}
