/**
 * Users — create and manage the accounts that can sign in to the system.
 * Each account: name, email, role, password (stored as a salted hash), status.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import * as db from '../lib/db'
import {
  UserPlus, Pencil, Trash2, KeyRound, Download, RefreshCw, ShieldCheck, UserX, UserCheck,
  Users as UsersIcon, LogIn, Link2, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ROLE_META, ROLE_KEYS, RoleBadge, RolePicker } from '../components/roles'
import { NewPasswordFields } from '../components/PasswordInput'
import { validateNewPassword } from '../lib/password'
import {
  useToast, useArmed, useSelection, fmtDate, fmtDateTime, downloadCSV, fullName,
  Toast, HeroCard, RateRing, StatCard, SearchBox, FilterPills, ToolButton, SkeletonRows, EmptyState,
  Checkbox, Th, Avatar, BulkBar, BulkAction, ListFooter, Modal, ModalHeader, ErrorNote, PrimaryButton, INPUT_CLS,
} from '../components/ui'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WEEK_MS  = 7 * 24 * 60 * 60 * 1000

const nameOf = u => u.name?.trim() || (u.username ?? '').split('@')[0] || 'User'

function timeAgo(iso) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d < 30 ? `${d} day${d !== 1 ? 's' : ''} ago` : fmtDate(iso)
}

// ── Add / edit modal ──────────────────────────────────────────────────────────
function UserModal({ user, employees, takenEmails, isSelf, onClose, onSubmit }) {
  const isEdit = !!user
  const [form, setForm] = useState({
    employee_id: user?.employee_id ?? '',
    name:        user?.name ?? '',
    email:       user?.username ?? '',
    role:        user?.role ?? 'HR',
    status:      user?.status ?? 'active',
    password:    '',
    confirm:     '',
  })
  const [setPw, setSetPw] = useState(!isEdit)
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState('')
  const set = patch => { setForm(f => ({ ...f, ...patch })); setError('') }

  function linkEmployee(id) {
    const e = employees.find(x => x.id === id)
    set({
      employee_id: id,
      ...(e && !form.name.trim() ? { name: fullName(e) } : {}),
      ...(e?.email && !isEdit && !form.email.trim() ? { email: e.email } : {}),
    })
  }

  async function submit(e) {
    e.preventDefault()
    const email = form.email.trim().toLowerCase()
    if (!form.name.trim())                     return setError('Enter the user’s full name.')
    if (!isEdit && !EMAIL_RE.test(email))      return setError('Enter a valid email address.')
    if (!isEdit && takenEmails.has(email))     return setError('A user with this email already exists.')
    if (setPw) {
      const pwErr = validateNewPassword(form.password, form.confirm)
      if (pwErr) return setError(pwErr)
    }
    setBusy(true)
    try {
      await onSubmit({
        name: form.name.trim(), email, role: form.role, status: form.status,
        employee_id: form.employee_id || null, password: setPw ? form.password : null,
      })
      onClose()
    } catch (err) {
      setError(err.message); setBusy(false)
    }
  }

  return (
    <Modal as="form" onSubmit={submit} onClose={onClose} maxWidth="560px">
      <ModalHeader
        person={isEdit ? { id: user.id, name: nameOf(user) } : null}
        title={isEdit ? nameOf(user) : 'Add new user'}
        sub={isEdit ? user.username : 'They can sign in with this email and password'}
        onClose={onClose}
      />

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
        <label className="block">
          <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><Link2 size={12} /> Link to employee <span className="text-gray-400">(optional)</span></span>
          <select value={form.employee_id} onChange={e => linkEmployee(e.target.value)} className={`${INPUT_CLS} mt-1`}>
            <option value="">— Not linked —</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{fullName(e)}{e.departments?.name ? ` · ${e.departments.name}` : ''}</option>
            ))}
          </select>
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Full name <span className="text-rose-400">*</span></span>
            <input value={form.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. Hodan Jaamac"
              autoComplete="off" className={`${INPUT_CLS} mt-1`} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Email <span className="text-rose-400">*</span></span>
            <input type="email" value={form.email} onChange={e => set({ email: e.target.value })} disabled={isEdit}
              placeholder="name@company.com" autoComplete="off"
              className={`${INPUT_CLS} mt-1 disabled:opacity-60 disabled:cursor-not-allowed`} />
          </label>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Role <span className="text-rose-400">*</span></p>
          <RolePicker value={form.role} onChange={role => set({ role })} />
        </div>

        {isEdit && !isSelf && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Account active</p>
              <p className="text-[11px] text-gray-400">Disabled users can't sign in.</p>
            </div>
            <Toggle on={form.status !== 'disabled'} onChange={on => set({ status: on ? 'active' : 'disabled' })} />
          </div>
        )}

        <div className="rounded-xl border border-gray-100 p-4">
          {isEdit && (
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer select-none mb-1">
              <input type="checkbox" checked={setPw} onChange={e => setSetPw(e.target.checked)} className="w-4 h-4 accent-[#1e3a8a]" />
              Set a new password
            </label>
          )}
          {setPw ? (
            <div className={isEdit ? 'mt-3' : ''}>
              <NewPasswordFields
                value={form.password} confirm={form.confirm}
                onChange={v => set({ password: v })} onConfirm={v => set({ confirm: v })}
                labels={['Password', 'Confirm password']}
              />
              <p className="text-[11px] text-gray-400 mt-3">Share the password with the user securely — it can't be viewed again later.</p>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 ml-6">
              {user.password_hash ? `Current password set ${fmtDate(user.password_updated_at)}.` : 'No password set yet — this user cannot sign in.'}
            </p>
          )}
        </div>

        <ErrorNote>{error}</ErrorNote>
      </div>

      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
        <PrimaryButton type="submit" disabled={busy} busy={busy}>{isEdit ? 'Save changes' : 'Create user'}</PrimaryButton>
      </div>
    </Modal>
  )
}

function ResetPasswordModal({ user, onClose, onSubmit }) {
  const [pw,      setPw]      = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState('')

  async function submit(e) {
    e.preventDefault()
    const err = validateNewPassword(pw, confirm)
    if (err) return setError(err)
    setBusy(true)
    try { await onSubmit(pw); onClose() }
    catch (ex) { setError(ex.message); setBusy(false) }
  }

  return (
    <Modal as="form" onSubmit={submit} onClose={onClose} maxWidth="460px">
      <ModalHeader person={{ id: user.id, name: nameOf(user) }} title="Reset password" sub={user.username} onClose={onClose} />
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
        <NewPasswordFields value={pw} confirm={confirm} onChange={v => { setPw(v); setError('') }} onConfirm={v => { setConfirm(v); setError('') }} />
        <p className="text-[11px] text-gray-400">The old password stops working immediately.</p>
        <ErrorNote>{error}</ErrorNote>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
        <PrimaryButton type="submit" disabled={busy} busy={busy}>Set password</PrimaryButton>
      </div>
    </Modal>
  )
}

function Toggle({ on, onChange, disabled, title }) {
  return (
    <button type="button" role="switch" aria-checked={on} title={title} disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}>
      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
export default function Users() {
  const { profile: me, refreshProfile } = useAuth()
  const [users,      setUsers]      = useState([])
  const [employees,  setEmployees]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search,     setSearch]     = useState('')
  const [filter,     setFilter]     = useState('all')
  const [modal,      setModal]      = useState(null)    // { id? } — id → edit
  const [resetFor,   setResetFor]   = useState(null)
  const [busyIds,    setBusyIds]    = useState(() => new Set())
  const [bulkBusy,   setBulkBusy]   = useState(false)
  const [toast, showToast, dismissToast] = useToast()
  const [armed, fire] = useArmed()
  const { selected, toggle, toggleAll, clear } = useSelection()
  const reqId = useRef(0)

  const fetchData = useCallback(async (soft = false) => {
    const id = ++reqId.current
    soft ? setRefreshing(true) : setLoading(true)
    try {
      const [us, emps] = await Promise.all([db.getSystemUsers(), db.getEmployees()])
      if (id !== reqId.current) return
      setUsers(us); setEmployees(emps.filter(e => e.status === 'active'))
    } catch (err) {
      if (id === reqId.current) showToast('error', err.message)
    }
    if (id === reqId.current) { setLoading(false); setRefreshing(false) }
  }, [showToast])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived ──
  const rows = useMemo(() => users.map(u => ({
    ...u,
    display:  nameOf(u),
    isMe:     u.id === me?.id,
    hasPw:    !!u.password_hash,
    disabled: u.status === 'disabled',
  })), [users, me?.id])

  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => !q || r.display.toLowerCase().includes(q) || (r.username ?? '').toLowerCase().includes(q))
  }, [rows, search])

  const matches = (r, f) =>
    f === 'all' ? true : f === 'disabled' ? r.disabled : f === 'nopw' ? !r.hasPw : r.role === f
  const visible = useMemo(() => scoped.filter(r => matches(r, filter)), [scoped, filter])

  const stats = useMemo(() => {
    const active = rows.filter(r => !r.disabled)
    return {
      total:  rows.length,
      active: active.length,
      pct:    rows.length ? Math.round((active.length / rows.length) * 100) : 0,
      week:   rows.filter(r => r.last_login && Date.now() - new Date(r.last_login).getTime() < WEEK_MS).length,
      noPw:   rows.filter(r => !r.hasPw).length,
      byRole: Object.fromEntries(ROLE_KEYS.map(k => [k, rows.filter(r => r.role === k).length])),
    }
  }, [rows])

  const takenEmails   = useMemo(() => new Set(users.map(u => (u.username ?? '').toLowerCase())), [users])
  const selectedRows  = rows.filter(r => selected.has(r.id))
  const allVisibleSel = visible.length > 0 && visible.every(r => selected.has(r.id))

  /** Returns an error message when the change would lock everyone out. */
  function guard(targets, change) {
    const ids = new Set(targets.map(t => t.id))
    if ((change === 'delete' || change === 'disable') && ids.has(me?.id)) {
      return `You can't ${change} your own account.`
    }
    const removesAdmin = change === 'delete' || change === 'disable' || (change.startsWith('role:') && change !== 'role:Admin')
    if (removesAdmin) {
      const left = rows.filter(r => r.role === 'Admin' && !r.disabled && !ids.has(r.id))
      if (!left.length) return 'At least one active Admin account is required.'
    }
    return ''
  }

  // ── Mutations ──
  const mergeUser = (id, patch) => setUsers(list => list.map(u => (u.id === id ? { ...u, ...patch } : u)))

  async function saveUser(values) {
    if (modal?.id) {
      const target = rows.find(r => r.id === modal.id)
      const change = values.status === 'disabled' && !target.disabled ? 'disable' : `role:${values.role}`
      const err = target.role === 'Admin' || values.status === 'disabled' ? guard([target], change) : ''
      if (err) throw new Error(err)
      const patch = await db.updateSystemUser(target.id, {
        name: values.name, role: values.role, status: values.status, employee_id: values.employee_id,
      })
      let pwPatch = {}
      if (values.password) pwPatch = await db.setUserPassword(target.id, values.password)
      mergeUser(target.id, { ...patch, ...pwPatch })
      if (target.id === me?.id) refreshProfile()
      showToast('success', `${values.name.split(' ')[0]} updated${values.password ? ' · new password set' : ''}`)
    } else {
      const created = await db.createSystemUser(values)
      setUsers(list => [...list, created].sort((a, b) => nameOf(a).localeCompare(nameOf(b))))
      showToast('success', `${values.name.split(' ')[0]} can now sign in as ${values.role}`)
    }
  }

  async function resetPassword(user, pw) {
    const patch = await db.setUserPassword(user.id, pw)
    mergeUser(user.id, patch)
    showToast('success', `Password updated for ${user.display.split(' ')[0]}`)
  }

  async function setStatus(targets, status, bulk = false) {
    const list = targets.filter(r => r.status !== status && (status === 'active' ? r.disabled : !r.disabled))
    if (!list.length) return
    const err = status === 'disabled' ? guard(list, 'disable') : ''
    if (err) return showToast('error', err)
    bulk ? setBulkBusy(true) : setBusyIds(s => new Set([...s, ...list.map(r => r.id)]))
    try {
      const patch = await db.batchUpdateSystemUsers(list.map(r => r.id), { status })
      list.forEach(r => mergeUser(r.id, patch))
      if (bulk) clear()
      showToast('success', list.length === 1
        ? `${list[0].display.split(' ')[0]} ${status === 'disabled' ? 'disabled' : 'enabled'}`
        : `${list.length} users ${status === 'disabled' ? 'disabled' : 'enabled'}`)
    } catch (e) {
      showToast('error', e.message)
    }
    bulk ? setBulkBusy(false) : setBusyIds(s => { const n = new Set(s); list.forEach(r => n.delete(r.id)); return n })
  }

  async function setRole(targets, role) {
    const list = targets.filter(r => r.role !== role)
    if (!list.length) return
    const err = guard(list, `role:${role}`)
    if (err) return showToast('error', err)
    setBulkBusy(true)
    try {
      const patch = await db.batchUpdateSystemUsers(list.map(r => r.id), { role })
      list.forEach(r => mergeUser(r.id, patch))
      if (list.some(r => r.isMe)) refreshProfile()
      clear()
      showToast('success', `${list.length} user${list.length !== 1 ? 's' : ''} → ${role}`)
    } catch (e) {
      showToast('error', e.message)
    }
    setBulkBusy(false)
  }

  async function removeUsers(targets, key) {
    if (!targets.length) return
    const err = guard(targets, 'delete')
    if (err) return showToast('error', err)
    if (!fire(key)) return
    const ids = targets.map(r => r.id)
    targets.length > 1 ? setBulkBusy(true) : setBusyIds(s => new Set([...s, ...ids]))
    try {
      await db.batchDeleteSystemUsers(ids)
      setUsers(list => list.filter(u => !ids.includes(u.id)))
      clear()
      showToast('success', targets.length === 1 ? `${targets[0].display} removed` : `${targets.length} users removed`)
    } catch (e) {
      showToast('error', e.message)
    }
    setBulkBusy(false)
    setBusyIds(s => { const n = new Set(s); ids.forEach(i => n.delete(i)); return n })
  }

  function exportCSV() {
    downloadCSV(visible.map(r => ({
      Name: r.display, Email: r.username, Role: r.role ?? '', Status: r.disabled ? 'Disabled' : 'Active',
      'Password set': r.hasPw ? 'Yes' : 'No', 'Last login': r.last_login ? fmtDateTime(r.last_login) : 'Never',
      Created: r.created_at ? fmtDate(r.created_at) : '',
    })), `users-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const FILTERS = [
    { key: 'all', label: 'All', dot: 'bg-gray-400', count: scoped.length },
    ...ROLE_KEYS.map(k => ({ key: k, label: ROLE_META[k].label, dot: ROLE_META[k].dot, count: scoped.filter(r => r.role === k).length })),
    { key: 'disabled', label: 'Disabled', dot: 'bg-gray-300', count: scoped.filter(r => r.disabled).length },
    ...(stats.noPw ? [{ key: 'nopw', label: 'No password', dot: 'bg-rose-400', count: scoped.filter(r => !r.hasPw).length }] : []),
  ]
  const toggleFilter = f => setFilter(cur => (cur === f ? 'all' : f))

  const editingUser = modal?.id ? rows.find(r => r.id === modal.id) : null
  const resetUser   = resetFor ? rows.find(r => r.id === resetFor) : null

  // ── Row bits ──
  const userCell = r => (
    <div className="flex items-center gap-3 min-w-[220px]">
      <Avatar id={r.id} name={r.display} src={r.avatar_url} />
      <div className="min-w-0">
        <p className="font-semibold text-gray-800 truncate flex items-center gap-1.5">
          {r.display}
          {r.isMe && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-[#1e3a8a]">You</span>}
        </p>
        <p className="text-xs text-gray-400 truncate">{r.username}</p>
      </div>
    </div>
  )
  const pwCell = r => r.hasPw ? (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500"><CheckCircle2 size={13} className="text-emerald-500" /> {fmtDate(r.password_updated_at)}</span>
  ) : (
    <button onClick={() => setResetFor(r.id)}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100 transition-colors">
      <AlertTriangle size={12} /> Set password
    </button>
  )
  const actions = r => (
    <div className="flex items-center justify-end gap-0.5">
      <button onClick={() => setResetFor(r.id)} title="Reset password"
        className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-amber-600 transition-colors"><KeyRound size={15} /></button>
      <button onClick={() => setModal({ id: r.id })} title="Edit user"
        className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#1e3a8a] transition-colors"><Pencil size={15} /></button>
      <button onClick={() => removeUsers([r], `del-${r.id}`)} disabled={r.isMe || busyIds.has(r.id)}
        title={r.isMe ? "You can't delete yourself" : armed === `del-${r.id}` ? 'Click again to confirm' : 'Delete user'}
        className={`h-8 rounded-lg inline-flex items-center justify-center gap-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed
          ${armed === `del-${r.id}` ? 'px-2 bg-red-500 text-white text-xs font-semibold' : 'w-8 text-gray-400 hover:bg-red-50 hover:text-red-500'}`}>
        <Trash2 size={15} />{armed === `del-${r.id}` && 'Confirm'}
      </button>
    </div>
  )

  // ── Render ──
  return (
    <div className="space-y-5 pb-24">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">System users</h2>
          <p className="text-sm text-gray-400 mt-1">Accounts that can sign in · roles control what each person can access</p>
        </div>
        <button onClick={() => setModal({})}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#1e3a8a] text-white hover:bg-[#162d6e] shadow-sm transition-colors">
          <UserPlus size={16} /> Add user
        </button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <HeroCard
          ring={<RateRing pct={stats.pct} label="active" />}
          eyebrow="System users"
          headline={`${stats.total} account${stats.total !== 1 ? 's' : ''}`}
          sub={`${stats.active} active · ${stats.total - stats.active} disabled`}
          stats={[
            { label: 'Signed in this week', value: stats.week, Icon: LogIn },
            { label: 'No password', value: stats.noPw, Icon: KeyRound },
          ]}
        />
        {ROLE_KEYS.map(k => {
          const m = ROLE_META[k]
          return (
            <StatCard key={k} label={m.label} value={stats.byRole[k]} sub={m.desc}
              pct={stats.total ? Math.round((stats.byRole[k] / stats.total) * 100) : 0}
              Icon={m.Icon} iconCls={m.icon} barCls={m.bar}
              active={filter === k} onClick={() => toggleFilter(k)} />
          )
        })}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2.5">
            <SearchBox value={search} onChange={setSearch} placeholder="Search name or email…" />
            <div className="flex items-center gap-2">
              <ToolButton onClick={exportCSV} disabled={!visible.length} title="Export CSV">
                <Download size={15} /> <span className="hidden sm:inline">Export</span>
              </ToolButton>
              <ToolButton onClick={() => fetchData(true)} title="Refresh" className="!px-2.5">
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              </ToolButton>
            </div>
          </div>
          <FilterPills items={FILTERS} value={filter} onChange={setFilter} />
        </div>

        {loading ? <SkeletonRows /> : visible.length === 0 ? (
          <EmptyState
            Icon={UsersIcon}
            title={rows.length === 0 ? 'No users yet' : 'No users match these filters'}
            action={rows.length === 0 ? (
              <button onClick={() => setModal({})} className="text-xs font-semibold text-[#1e3a8a] hover:underline">Add the first user</button>
            ) : (
              <button onClick={() => { setSearch(''); setFilter('all') }} className="text-xs font-semibold text-[#1e3a8a] hover:underline">Clear filters</button>
            )}
          />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="pl-5 pr-2 py-3 w-10">
                      <Checkbox checked={allVisibleSel} onChange={() => toggleAll(visible.map(r => r.id), allVisibleSel)} />
                    </th>
                    <Th>User</Th><Th>Role</Th><Th>Active</Th><Th>Password</Th><Th>Last sign-in</Th><Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visible.map(r => {
                    const isSel = selected.has(r.id)
                    return (
                      <tr key={r.id} className={`transition-colors ${isSel ? 'bg-indigo-50/50' : 'hover:bg-gray-50/60'} ${r.disabled ? 'opacity-60' : ''}`}>
                        <td className="pl-5 pr-2 py-3"><Checkbox checked={isSel} onChange={() => toggle(r.id)} /></td>
                        <td className="px-4 py-3">{userCell(r)}</td>
                        <td className="px-4 py-3"><RoleBadge role={r.role} /></td>
                        <td className="px-4 py-3">
                          <Toggle on={!r.disabled} disabled={r.isMe || busyIds.has(r.id) || bulkBusy}
                            title={r.isMe ? "You can't disable yourself" : r.disabled ? 'Enable account' : 'Disable account'}
                            onChange={on => setStatus([r], on ? 'active' : 'disabled')} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{pwCell(r)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500" title={r.last_login ? fmtDateTime(r.last_login) : ''}>
                          {timeAgo(r.last_login)}
                        </td>
                        <td className="pr-5 pl-2 py-3">{actions(r)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-gray-100">
              {visible.map(r => {
                const isSel = selected.has(r.id)
                return (
                  <div key={r.id} className={`p-4 space-y-3 ${isSel ? 'bg-indigo-50/50' : ''} ${r.disabled ? 'opacity-70' : ''}`}>
                    <div className="flex items-center gap-3">
                      <Checkbox checked={isSel} onChange={() => toggle(r.id)} />
                      <div className="flex-1 min-w-0">{userCell(r)}</div>
                      <Toggle on={!r.disabled} disabled={r.isMe || busyIds.has(r.id) || bulkBusy}
                        onChange={on => setStatus([r], on ? 'active' : 'disabled')} />
                    </div>
                    <div className="flex items-center justify-between gap-2 pl-7">
                      <div className="flex items-center gap-2 flex-wrap">
                        <RoleBadge role={r.role} />
                        <span className="text-[11px] text-gray-400">{timeAgo(r.last_login)}</span>
                      </div>
                      {actions(r)}
                    </div>
                    {!r.hasPw && <div className="pl-7">{pwCell(r)}</div>}
                  </div>
                )
              })}
            </div>

            <ListFooter shown={visible.length} total={rows.length} noun="users" />
          </>
        )}
      </div>

      {/* Role reference */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={16} className="text-[#1e3a8a]" />
          <h3 className="text-base font-bold text-gray-900">What each role can access</h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ROLE_KEYS.map(k => {
            const m = ROLE_META[k]
            return (
              <div key={k} className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${m.icon}`}><m.Icon size={15} /></span>
                  <span className="text-sm font-bold text-gray-800">{m.label}</span>
                  <span className="ml-auto text-xs text-gray-400">{stats.byRole[k]}</span>
                </div>
                <ul className="space-y-1.5">
                  {m.perms.map(p => (
                    <li key={p} className="flex items-center gap-1.5 text-xs text-gray-500">
                      <CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      <BulkBar count={selectedRows.length} busy={bulkBusy} onClear={clear}>
        {ROLE_KEYS.map(k => (
          <BulkAction key={k} dot={ROLE_META[k].dot} title={`Make ${ROLE_META[k].label}`} disabled={bulkBusy}
            onClick={() => setRole(selectedRows, k)}>{ROLE_META[k].label}</BulkAction>
        ))}
        <BulkAction Icon={UserCheck} disabled={bulkBusy} onClick={() => setStatus(selectedRows, 'active', true)}>Enable</BulkAction>
        <BulkAction Icon={UserX} disabled={bulkBusy} onClick={() => setStatus(selectedRows, 'disabled', true)}>Disable</BulkAction>
        <BulkAction Icon={Trash2} danger disabled={bulkBusy} onClick={() => removeUsers(selectedRows, 'bulk-del')}>
          {armed === 'bulk-del' ? `Confirm · ${selectedRows.length}` : 'Delete'}
        </BulkAction>
      </BulkBar>

      {modal && (
        <UserModal
          user={editingUser}
          employees={employees}
          takenEmails={takenEmails}
          isSelf={editingUser?.isMe}
          onClose={() => setModal(null)}
          onSubmit={saveUser}
        />
      )}

      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetFor(null)} onSubmit={pw => resetPassword(resetUser, pw)} />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
