import { useState, useEffect, useCallback } from 'react'
import * as db from '../lib/db'
import {
  UserPlus, Search, Pencil, Trash2, X,
  Loader2, CheckCircle2, AlertCircle,
  Users, UserCheck, UserX, Eye,
  Phone, Mail, Calendar, Briefcase, Building2,
  Hash, AlertTriangle, Sparkles,
} from 'lucide-react'

// ── constants ────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10)

const EMPTY_FORM = {
  first_name: '', last_name: '', email: '',
  role: 'employee', status: 'active', department_id: '',
  job_title: '', hire_date: TODAY, phone_number: '', avatar_url: '',
}

const STATUS_META = {
  active:     { label: 'Active',     cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
  inactive:   { label: 'Inactive',   cls: 'bg-gray-100    text-gray-500    ring-1 ring-gray-200' },
  suspended:  { label: 'Suspended',  cls: 'bg-amber-100   text-amber-700   ring-1 ring-amber-200' },
  terminated: { label: 'Terminated', cls: 'bg-red-100     text-red-700     ring-1 ring-red-200' },
}

const ROLE_META = {
  employee:      { label: 'Employee',      cls: 'bg-slate-100  text-slate-600' },
  manager:       { label: 'Manager',       cls: 'bg-violet-100 text-violet-700' },
  administrator: { label: 'Administrator', cls: 'bg-blue-100   text-blue-700' },
}

const AVATAR_GRADS = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#3b82f6,#06b6d4)',
  'linear-gradient(135deg,#10b981,#3b82f6)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#f43f5e,#a855f7)',
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
]

const fmtDate = iso =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const nullify = v => (v === '' || v == null) ? null : v

function avatarGrad(id = '') {
  let n = 0; for (const c of id) n += c.charCodeAt(0)
  return AVATAR_GRADS[n % AVATAR_GRADS.length]
}

function findDuplicates(employees) {
  const seen = {}; const toDelete = []
  for (const emp of employees) {
    const key = `${(emp.first_name ?? '').toLowerCase().trim()}|${(emp.last_name ?? '').toLowerCase().trim()}`
    if (seen[key]) toDelete.push(emp.id)
    else seen[key] = emp.id
  }
  return toDelete
}

// ── shared ───────────────────────────────────────────────────────────────────

function Spinner({ size = 18 }) {
  return <Loader2 size={size} className="animate-spin text-indigo-600" />
}

function EmpAvatar({ emp, size = 8 }) {
  const ini  = `${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}`.toUpperCase() || '?'
  const dim  = `w-${size} h-${size}`
  const font = size >= 12 ? 'text-lg' : size >= 10 ? 'text-sm' : 'text-xs'
  if (emp.avatar_url) {
    return <img src={emp.avatar_url} alt="" className={`${dim} rounded-full object-cover shrink-0`}
      onError={e => { e.currentTarget.style.display='none' }} />
  }
  return (
    <div className={`${dim} rounded-full flex items-center justify-center text-white font-bold shrink-0 ${font}`}
      style={{ background: avatarGrad(emp.id) }}>
      {ini}
    </div>
  )
}

function Badge({ meta }) {
  if (!meta) return <span className="text-xs text-gray-400">—</span>
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
}

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDismiss, 4500)
    return () => clearTimeout(t)
  }, [toast, onDismiss])
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium max-w-sm
      ${ok ? 'bg-white border-emerald-200 text-emerald-800' : 'bg-white border-red-200 text-red-800'}`}>
      {ok ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
           : <AlertCircle  size={16} className="text-red-500 shrink-0" />}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="text-gray-300 hover:text-gray-500 ml-1"><X size={14} /></button>
    </div>
  )
}

// ── View Drawer (right side) ──────────────────────────────────────────────────

function ViewDrawer({ emp, onClose, onEdit }) {
  if (!emp) return null
  const statusMeta = STATUS_META[emp.status]
  const roleMeta   = ROLE_META[emp.role]
  const shortId    = emp.id?.slice(-6).toUpperCase() ?? '——'

  // Lock body scroll while drawer is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Close on Escape key
  useEffect(() => {
    const handle = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  const Row = ({ icon: Icon, label, value }) => {
    if (!value) return null
    return (
      <div className="flex items-start gap-3 py-3.5 border-b border-gray-50 last:border-0">
        <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
          <Icon size={14} className="text-gray-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5 break-words">{value}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/*
        Backdrop: starts below the fixed header (top-16 = 64px) and to the right
        of the sidebar on desktop (lg:left-64). z-40 sits above the sidebar (z-30)
        but below the drawer (z-50).
      */}
      <div
        className="fixed top-16 left-0 lg:left-64 right-0 bottom-0 bg-black/25 z-40"
        onClick={onClose}
      />

      {/*
        Drawer: starts at top-16 (below the 64px fixed header) so the app header
        remains fully visible. Uses flex-col so header/footer stay pinned while the
        middle section scrolls independently.
      */}
      <div
        className="fixed top-16 bottom-0 right-0 z-50 flex flex-col bg-white shadow-2xl"
        style={{
          width: 'min(460px, 100vw)',
          animation: 'slideRight .22s cubic-bezier(.4,0,.2,1) forwards',
        }}
      >
        {/* ── Pinned header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Employee Profile</p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">

          {/* Profile summary */}
          <div className="px-5 py-5 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <EmpAvatar emp={emp} size={14} />
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-gray-900 text-lg leading-tight truncate">
                  {emp.first_name} {emp.last_name}
                </p>
                <p className="text-gray-500 text-sm truncate mt-0.5">{emp.job_title || 'No title'}</p>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {statusMeta && (
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${statusMeta.cls}`}>
                      {statusMeta.label}
                    </span>
                  )}
                  {roleMeta && (
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${roleMeta.cls}`}>
                      {roleMeta.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Info rows */}
          <div className="px-5 py-2">
            <Row icon={Hash}      label="Employee ID" value={`#${shortId}`} />
            <Row icon={Building2} label="Department"  value={emp.departments?.name} />
            <Row icon={Mail}      label="Email"       value={emp.email} />
            <Row icon={Phone}     label="Phone"       value={emp.phone_number} />
            <Row icon={Calendar}  label="Hire Date"   value={fmtDate(emp.hire_date)} />
            <Row icon={Briefcase} label="Job Title"   value={emp.job_title} />
          </div>
        </div>

        {/* ── Pinned footer ── */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex gap-3 bg-white">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all shadow-sm whitespace-nowrap"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#3b82f6)' }}
          >
            <Pencil size={13} /> Edit
          </button>
        </div>
      </div>

      <style>{`@keyframes slideRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
    </>
  )
}

// ── Delete Modal ──────────────────────────────────────────────────────────────

function DeleteModal({ employee, loading, onConfirm, onCancel }) {
  if (!employee) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} className="text-red-500" />
        </div>
        <h3 className="text-base font-bold text-gray-900">Delete Employee</h3>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Delete <span className="font-semibold text-gray-800">{employee.first_name} {employee.last_name}</span>?
          This <span className="text-red-600 font-semibold">cannot be undone</span>.
        </p>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors disabled:opacity-60">
            {loading ? <Spinner size={14} /> : <Trash2 size={13} />} Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Employee Form Modal ───────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full rounded-xl border border-gray-200 bg-gray-50/80 px-3.5 py-2.5 text-sm text-gray-900 ' +
  'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 ' +
  'focus:border-indigo-400 focus:bg-white transition-all'
const LABEL_CLS = 'block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5'

function EmployeeModal({ mode, formData, departments, onChange, onClose, onSubmit, loading }) {
  const isEdit = mode === 'edit'
  const field  = name => e => onChange({ ...formData, [name]: e.target.value })
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">{isEdit ? 'Edit Employee' : 'Add Employee'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{isEdit ? 'Update employee details.' : 'Fill in the form to add a new team member.'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>First Name *</label>
                <input required type="text" placeholder="John" value={formData.first_name} onChange={field('first_name')} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Last Name *</label>
                <input required type="text" placeholder="Doe" value={formData.last_name} onChange={field('last_name')} className={INPUT_CLS} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Email</label>
                <input type="email" placeholder="john@company.com" value={formData.email} onChange={field('email')} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Phone</label>
                <input type="tel" placeholder="+1 555 000 0000" value={formData.phone_number} onChange={field('phone_number')} className={INPUT_CLS} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Job Title</label>
                <input type="text" placeholder="Software Engineer" value={formData.job_title} onChange={field('job_title')} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Department</label>
                <select value={formData.department_id} onChange={field('department_id')} className={INPUT_CLS}>
                  <option value="">— Select —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Role</label>
                <select value={formData.role} onChange={field('role')} className={INPUT_CLS}>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="administrator">Administrator</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Status</label>
                <select value={formData.status} onChange={field('status')} className={INPUT_CLS}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
            </div>
            <div>
              <label className={LABEL_CLS}>Hire Date</label>
              <input type="date" value={formData.hire_date} onChange={field('hire_date')} className={INPUT_CLS} />
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/40 rounded-b-2xl">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-60 min-w-[130px] justify-center"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#3b82f6)', boxShadow: '0 3px 12px rgba(79,70,229,0.3)' }}>
              {loading && <Spinner size={14} />}
              {isEdit ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const [employees,    setEmployees]   = useState([])
  const [departments,  setDepartments] = useState([])
  const [loading,      setLoading]     = useState(true)
  const [submitting,   setSubmitting]  = useState(false)
  const [deleting,     setDeleting]    = useState(false)
  const [cleaning,     setCleaning]    = useState(false)
  const [search,       setSearch]      = useState('')
  const [toast,        setToast]       = useState(null)
  const [modal,        setModal]       = useState({ open: false })
  const [form,         setForm]        = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [viewEmp,      setViewEmp]     = useState(null)
  const [dupIds,       setDupIds]      = useState([])

  const showToast    = useCallback((type, message) => setToast({ type, message }), [])
  const dismissToast = useCallback(() => setToast(null), [])

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await db.getEmployees()
      setEmployees(data)
      setDupIds(findDuplicates(data))
    } catch (err) { showToast('error', err.message) }
  }, [showToast])

  const fetchDepartments = useCallback(async () => {
    try { setDepartments(await db.getDepartments()) } catch {}
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchEmployees(), fetchDepartments()]).finally(() => setLoading(false))
  }, [fetchEmployees, fetchDepartments])

  async function handleCleanDuplicates() {
    if (!dupIds.length) return
    setCleaning(true)
    try {
      await Promise.all(dupIds.map(id => db.deleteEmployee(id)))
      showToast('success', `Removed ${dupIds.length} duplicate record${dupIds.length > 1 ? 's' : ''}.`)
      await fetchEmployees()
    } catch (err) { showToast('error', err.message) }
    setCleaning(false)
  }

  function openAdd() { setForm(EMPTY_FORM); setModal({ open: true, mode: 'add' }) }

  function openEdit(emp) {
    setViewEmp(null)
    setForm({
      first_name: emp.first_name ?? '', last_name: emp.last_name ?? '',
      email: emp.email ?? '', role: emp.role ?? 'employee', status: emp.status ?? 'active',
      department_id: emp.department_id ?? '', job_title: emp.job_title ?? '',
      hire_date: emp.hire_date ?? TODAY, phone_number: emp.phone_number ?? '', avatar_url: emp.avatar_url ?? '',
    })
    setModal({ open: true, mode: 'edit', id: emp.id })
  }

  function closeModal() { setModal({ open: false }); setForm(EMPTY_FORM) }

  async function handleSave(e) {
    e.preventDefault(); setSubmitting(true)
    const payload = {
      first_name: form.first_name.trim(), last_name: form.last_name.trim(),
      email: nullify(form.email), role: form.role, status: form.status,
      department_id: nullify(form.department_id), job_title: nullify(form.job_title),
      hire_date: nullify(form.hire_date), phone_number: nullify(form.phone_number), avatar_url: nullify(form.avatar_url),
    }
    try {
      if (modal.mode === 'add') await db.addEmployee(payload)
      else await db.updateEmployee(modal.id, payload)
    } catch (err) { showToast('error', err.message); setSubmitting(false); return }
    setSubmitting(false); closeModal()
    showToast('success', modal.mode === 'add'
      ? `${payload.first_name} ${payload.last_name} added.`
      : `${payload.first_name} ${payload.last_name} updated.`)
    await fetchEmployees()
  }

  async function handleDelete() {
    if (!deleteTarget) return; setDeleting(true)
    try {
      await db.deleteEmployee(deleteTarget.id)
      showToast('success', `${deleteTarget.first_name} ${deleteTarget.last_name} deleted.`)
      setEmployees(prev => prev.filter(e => e.id !== deleteTarget.id))
      setDupIds(prev => prev.filter(id => id !== deleteTarget.id))
    } catch (err) { showToast('error', err.message) }
    setDeleting(false); setDeleteTarget(null)
  }

  const uniqueEmployees = employees.filter(e => !dupIds.includes(e.id))

  const filtered = uniqueEmployees.filter(emp => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(q)
      || (emp.email ?? '').toLowerCase().includes(q)
      || (emp.job_title ?? '').toLowerCase().includes(q)
      || (emp.departments?.name ?? '').toLowerCase().includes(q)
      || (emp.role ?? '').toLowerCase().includes(q)
  })

  const activeCount   = uniqueEmployees.filter(e => e.status === 'active').length
  const inactiveCount = uniqueEmployees.filter(e => e.status !== 'active').length

  return (
    <div className="space-y-4 fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Employees</h2>
          <p className="text-sm text-gray-400 mt-0.5">{uniqueEmployees.length} team member{uniqueEmployees.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-white text-sm font-bold rounded-xl shadow-sm transition-all"
          style={{ background: 'linear-gradient(135deg,#4f46e5,#3b82f6)', boxShadow: '0 3px 12px rgba(79,70,229,0.28)' }}>
          <UserPlus size={15} /> Add Employee
        </button>
      </div>

      {/* ── Duplicate warning ── */}
      {dupIds.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 flex-1 font-medium">
            {dupIds.length} duplicate record{dupIds.length > 1 ? 's' : ''} found — hidden from list.
          </p>
          <button onClick={handleCleanDuplicates} disabled={cleaning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 transition-colors disabled:opacity-60 shrink-0">
            {cleaning ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {cleaning ? 'Removing…' : 'Remove all'}
          </button>
        </div>
      )}

      {/* ── Compact stat row ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users,     label: 'Total',    value: uniqueEmployees.length, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
          { icon: UserCheck, label: 'Active',   value: activeCount,            color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { icon: UserX,     label: 'Inactive', value: inactiveCount,          color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
        ].map(({ icon: Icon, label, value, color, bg, border }) => (
          <div key={label} className={`bg-white rounded-xl border ${border} p-4 flex items-center gap-3 transition-all hover:-translate-y-0.5`}
            style={{ boxShadow: '0 1px 5px rgba(0,0,0,0.05)' }}>
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={17} className={color} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400">{label}</p>
              <p className="text-xl font-extrabold text-gray-900 leading-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)' }}>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" placeholder="Search name, email, title…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50/80
                text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15
                focus:border-indigo-400 focus:bg-white transition-all" />
          </div>
          {search && (
            <button onClick={() => setSearch('')} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
              <X size={12} /> Clear
            </button>
          )}
          {!loading && (
            <p className="ml-auto text-xs text-gray-400 shrink-0">
              {filtered.length} / {uniqueEmployees.length}
            </p>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-gray-400">
            <Spinner size={20} /><span className="text-sm">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Users size={36} className="text-gray-200" />
            <p className="text-sm font-semibold text-gray-500">{search ? 'No results' : 'No employees yet'}</p>
            <p className="text-xs text-gray-400">{search ? `No match for "${search}"` : 'Click "Add Employee" to get started.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[740px]">
              <thead>
                <tr className="border-b border-gray-100" style={{ background: '#fafafa' }}>
                  {['Employee', 'Job Title', 'Department', 'Role', 'Status', 'Hire Date', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider last:w-24">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                    onClick={() => setViewEmp(emp)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <EmpAvatar emp={emp} size={9} />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{emp.first_name} {emp.last_name}</p>
                          <p className="text-xs text-gray-400 truncate">{emp.email ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm whitespace-nowrap">{emp.job_title ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm whitespace-nowrap">{emp.departments?.name ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge meta={ROLE_META[emp.role]} /></td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge meta={STATUS_META[emp.status]} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap font-medium">{fmtDate(emp.hire_date)}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setViewEmp(emp)} title="View"
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors">
                          <Eye size={13} />
                        </button>
                        <button onClick={() => openEdit(emp)} title="Edit"
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-100 hover:text-blue-600 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setDeleteTarget(emp)} title="Delete"
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors">
                          <Trash2 size={13} />
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

      {/* Drawer / Modals */}
      {viewEmp && <ViewDrawer emp={viewEmp} onClose={() => setViewEmp(null)} onEdit={() => openEdit(viewEmp)} />}

      {modal.open && (
        <EmployeeModal mode={modal.mode} formData={form} departments={departments}
          onChange={setForm} onClose={closeModal} onSubmit={handleSave} loading={submitting} />
      )}

      <DeleteModal employee={deleteTarget} loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
