/**
 * Settings — Phase 3: User Access Management
 *
 * Maps system roles (Admin / HR / Finance / Manager) to the custom
 * `public.users` table.  Supabase Auth handles passwords separately.
 *
 * public.users schema expected:
 *   username     TEXT UNIQUE  — the Supabase Auth email
 *   role         user_role    — enum: 'Admin'|'HR'|'Finance'|'Manager'
 *   employee_id  UUID FK → employees.id  (nullable)
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  ShieldCheck, UserPlus, Pencil, Trash2, X,
  Loader2, CheckCircle2, AlertCircle,
  Crown, Users, DollarSign, Briefcase, Mail,
} from 'lucide-react'

// ── Role config ────────────────────────────────────────────────────────────────
const USER_ROLES = ['Admin', 'HR', 'Finance', 'Manager']

const ROLE_META = {
  Admin:   { label: 'Admin',   Icon: Crown,      cls: 'bg-amber-100   text-amber-700',   badge: 'bg-amber-50   text-amber-600   border-amber-200'   },
  HR:      { label: 'HR',      Icon: Users,      cls: 'bg-emerald-100 text-emerald-700', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Finance: { label: 'Finance', Icon: DollarSign, cls: 'bg-blue-100    text-blue-700',    badge: 'bg-blue-50    text-blue-600    border-blue-200'     },
  Manager: { label: 'Manager', Icon: Briefcase,  cls: 'bg-purple-100  text-purple-700',  badge: 'bg-purple-50  text-purple-700  border-purple-200'   },
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(onDismiss, 4500)
    return () => clearTimeout(id)
  }, [toast, onDismiss])
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium max-w-sm
      ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      {ok ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
           : <AlertCircle  size={16} className="text-red-500 shrink-0" />}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="opacity-50 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

// ── Role badge ─────────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const meta = ROLE_META[role]
  if (!meta) return <span className="text-xs text-gray-400">—</span>
  const { Icon } = meta
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.badge}`}>
      <Icon size={11} />
      {meta.label}
    </span>
  )
}

// ── Grant / Edit modal ─────────────────────────────────────────────────────────
function AccessModal({ mode, initial, employees, onClose, onSave, loading }) {
  const [username,    setUsername]   = useState(initial?.username    ?? '')
  const [role,        setRole]       = useState(initial?.role        ?? 'HR')
  const [employeeId,  setEmployeeId] = useState(initial?.employee_id ?? '')

  const isEdit = mode === 'edit'

  function handleSubmit(e) {
    e.preventDefault()
    onSave({ username: username.trim(), role, employee_id: employeeId || null })
  }

  const inputCls =
    'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 ' +
    'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/25 focus:border-[#1e3a8a] transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {isEdit ? 'Edit System Role' : 'Grant System Access'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEdit
                ? 'Change the role assigned to this user.'
                : 'Link a Supabase Auth email to a system role.'
              }
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Email / username */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Email (Supabase Auth)
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="email"
                required
                placeholder="user@company.com"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={isEdit}
                className={`${inputCls} pl-9 ${isEdit ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''}`}
              />
            </div>
            {!isEdit && (
              <p className="text-[11px] text-gray-400 mt-1.5">
                The user must first be created in Supabase Auth (Dashboard → Authentication → Users).
              </p>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              System Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              {USER_ROLES.map(r => {
                const meta = ROLE_META[r]
                const Icon = meta.Icon
                const active = role === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-sm font-semibold transition-all
                      ${active
                        ? `${meta.cls} border-current ring-2 ring-current/20`
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <Icon size={15} />
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Employee link (optional) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Link to Employee <span className="normal-case font-normal text-gray-400">(optional)</span>
            </label>
            <select
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              className={inputCls}
            >
              <option value="">— Not linked —</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name}{e.email ? ` (${e.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1e3a8a] hover:bg-[#162d6e] text-white text-sm font-semibold transition-colors disabled:opacity-60">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Save Changes' : 'Grant Access'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Revoke confirmation modal ──────────────────────────────────────────────────
function RevokeModal({ user, loading, onConfirm, onCancel }) {
  if (!user) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">Revoke Access</h3>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Remove system access for{' '}
          <span className="font-semibold text-gray-800">{user.username}</span>?<br />
          Their Supabase Auth account and employee record will remain intact.
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
            {loading && <Loader2 size={14} className="animate-spin" />}
            Revoke
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [users,       setUsers]       = useState([])
  const [employees,   setEmployees]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [revoking,    setRevoking]    = useState(false)
  const [toast,       setToast]       = useState(null)
  const [modal,       setModal]       = useState(null)   // { mode: 'add'|'edit', initial? }
  const [revokeTarget, setRevokeTarget] = useState(null)

  const showToast    = useCallback((type, msg) => setToast({ type, message: msg }), [])
  const dismissToast = useCallback(() => setToast(null), [])

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    // Try joined query first; fall back if FK not in schema cache
    let { data, error } = await supabase
      .from('users')
      .select('username, role, employee_id, employees(first_name, last_name)')
      .order('role')
    if (error?.message?.toLowerCase().includes('relationship')) {
      ;({ data, error } = await supabase
        .from('users').select('username, role, employee_id').order('role'))
    }
    if (error) showToast('error', error.message)
    setUsers(data ?? [])
  }, [showToast])

  const fetchEmployees = useCallback(async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, first_name, last_name, email')
      .eq('status', 'active')
      .order('first_name')
    setEmployees(data ?? [])
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchUsers(), fetchEmployees()]).finally(() => setLoading(false))
  }, [fetchUsers, fetchEmployees])

  // ── Save (add or edit) ─────────────────────────────────────────────────────
  async function handleSave({ username, role, employee_id }) {
    setSaving(true)

    let error
    if (modal.mode === 'add') {
      // Check for duplicate
      const { data: existing } = await supabase
        .from('users').select('username').eq('username', username).maybeSingle()
      if (existing) {
        showToast('error', `${username} already has system access. Use "Edit Role" instead.`)
        setSaving(false)
        return
      }
      ;({ error } = await supabase.from('users').insert({ username, role, employee_id }))
    } else {
      ;({ error } = await supabase.from('users').update({ role, employee_id }).eq('username', username))
    }

    setSaving(false)
    if (error) {
      showToast('error', error.message)
      return
    }

    showToast('success', modal.mode === 'add'
      ? `Access granted to ${username} as ${role}.`
      : `Role updated to ${role}.`)
    setModal(null)
    fetchUsers()
  }

  // ── Revoke ─────────────────────────────────────────────────────────────────
  async function handleRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    const { error } = await supabase.from('users').delete().eq('username', revokeTarget.username)
    setRevoking(false)
    if (error) {
      showToast('error', error.message)
    } else {
      showToast('success', `Access revoked for ${revokeTarget.username}.`)
      setUsers(prev => prev.filter(u => u.username !== revokeTarget.username))
    }
    setRevokeTarget(null)
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const roleCount = USER_ROLES.reduce((acc, r) => {
    acc[r] = users.filter(u => u.role === r).length
    return acc
  }, {})

  const getEmpName = user => {
    if (user.employees) return `${user.employees.first_name} ${user.employees.last_name}`
    if (user.employee_id) {
      const emp = employees.find(e => e.id === user.employee_id)
      return emp ? `${emp.first_name} ${emp.last_name}` : '—'
    }
    return '—'
  }

  const initials = (email = '') => email.slice(0, 2).toUpperCase()

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">User Access Management</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage which accounts can log in and what they can access.
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1e3a8a] hover:bg-[#162d6e] text-white text-sm font-semibold rounded-xl shadow-sm transition-colors self-start sm:self-auto"
        >
          <UserPlus size={15} /> Grant Access
        </button>
      </div>

      {/* Role stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {USER_ROLES.map(r => {
          const { Icon, cls } = ROLE_META[r]
          return (
            <div key={r} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500 font-medium">{r}</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-1">{roleCount[r]}</p>
              </div>
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${cls}`}>
                <Icon size={20} />
              </div>
            </div>
          )
        })}
      </div>

      {/* How access works — info strip */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex items-start gap-3">
        <ShieldCheck size={18} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 leading-relaxed">
          <span className="font-semibold">How it works: </span>
          Create the user in <span className="font-semibold">Supabase Auth → Authentication → Users</span> first (they'll get a password email).
          Then click <span className="font-semibold">"Grant Access"</span> here to assign their system role.
          The DB trigger auto-creates their employee profile on first login.
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">
            Active System Users
            <span className="ml-2 text-gray-400 font-normal">({users.length})</span>
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-gray-400">
            <Loader2 size={22} className="animate-spin text-blue-500" />
            <span className="text-sm">Loading users…</span>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <ShieldCheck size={40} className="text-gray-200" />
            <p className="text-sm font-medium">No users configured yet.</p>
            <button onClick={() => setModal({ mode: 'add' })}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline underline-offset-2">
              Grant the first access record →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['User','Role','Linked Employee','Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider last:text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.username} className="group hover:bg-gray-50/40 transition-colors">

                    {/* User */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-indigo-600">{initials(u.username)}</span>
                        </div>
                        <p className="font-semibold text-gray-800 text-xs truncate max-w-[180px]">{u.username}</p>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-4"><RoleBadge role={u.role} /></td>

                    {/* Linked employee */}
                    <td className="px-5 py-4 text-gray-500 text-xs">{getEmpName(u)}</td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setModal({ mode: 'edit', initial: u })}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-500 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
                          title="Edit role"
                        >
                          <Pencil size={12} /> Edit Role
                        </button>
                        <button
                          onClick={() => setRevokeTarget(u)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-500 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Revoke access"
                        >
                          <Trash2 size={12} /> Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role permission reference */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-bold text-gray-800 mb-4">Role Permissions Reference</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              role: 'Admin',
              perms: ['Full system access', 'User management', 'Payroll & Reports', 'All employee data'],
            },
            {
              role: 'HR',
              perms: ['Employee management', 'Attendance tracking', 'Department management', 'View analytics'],
            },
            {
              role: 'Finance',
              perms: ['Payroll processing', 'Salary management', 'Financial reports', 'Payslips'],
            },
            {
              role: 'Manager',
              perms: ['View team attendance', 'View employee list', 'Dashboard access', 'Read-only analytics'],
            },
          ].map(({ role, perms }) => {
            const { cls, Icon } = ROLE_META[role]
            return (
              <div key={role} className={`rounded-xl p-4 ${cls.replace('bg-', 'bg-').replace('text-', 'border-')} border`}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={14} />
                  <span className="text-xs font-bold">{role}</span>
                </div>
                <ul className="space-y-1">
                  {perms.map(p => (
                    <li key={p} className="flex items-start gap-1.5 text-[11px] opacity-80">
                      <CheckCircle2 size={10} className="shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modals */}
      {modal && (
        <AccessModal
          mode={modal.mode}
          initial={modal.initial}
          employees={employees}
          onClose={() => setModal(null)}
          onSave={handleSave}
          loading={saving}
        />
      )}

      <RevokeModal
        user={revokeTarget}
        loading={revoking}
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
