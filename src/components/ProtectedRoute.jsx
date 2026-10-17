import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// adminOnly={true}     → Admin + Finance (payroll pages)
// adminOnly="strict"   → Admin only (Users)
// adminOnly={false}    → any signed-in user
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { profile, isAdmin, isFinance } = useAuth()

  if (!profile) return <Navigate to="/login" replace />
  if (adminOnly === 'strict' && !isAdmin) return <Navigate to="/dashboard" replace />
  if (adminOnly === true && !isAdmin && !isFinance) return <Navigate to="/dashboard" replace />

  return children
}
