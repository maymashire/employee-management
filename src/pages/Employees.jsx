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
  inactive:   { label: 'Inactive',   cls: 'bg-gray-100    text-gray-600    ring-1 ring-gray-200' },
  suspended:  { label: 'Suspended',  cls: 'bg-amber-100   text-amber-700   ring-1 ring-amber-200' },
  terminated: { label: 'Terminated', cls: 'bg-red-100     text-red-700     ring-1 ring-red-200' },
}

const ROLE_META = {
  employee:      { label: 'Employee',      cls: 'bg-slate-100  text-slate-600  ring-1 ring-slate-200' },
  manager:       { label: 'Manager',       cls: 'bg-violet-100 text-violet-700 ring-1 ring-violet-200' },
  administrator: { label: 'Administrator', cls: 'bg-blue-100   text-blue-700   ring-1 ring-blue-200' },
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

// ── duplicate detection ──────────────────────────────────────────────────────

function findDuplicates(employees) {
  const seen = {}
  const toDelete = []
  for (const emp of employees) {
    const key = `${(emp.first_name ?? '').toLowerCase().trim()}|${(emp.last_name ?? '').toLowerCase().trim()}`
    if (seen[key]) {
      toDelete.push(emp.id)
    } else {
      seen[key] = emp.id
    }
  }
  return toDelete
}

// ── shared UI ────────────────────────────────────────────────────────────────

function Spinner({ size = 20 }) {
  return <Loader2 size={size} className="animate-spin text-indigo-600" />
}

function EmployeeAvatar({ emp, size = 'md' }) {
  const ini = `${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}`.toUpperCase() || '?'
  const dim  = size === 'lg' ? 'w-14 h-14 text-base' : 'w-9 h-9 text-xs'
  if (emp.avatar_url) {
    return (
      <img src={emp.avatar_url} alt="" className={`${dim} rounded-full object-cover shrink-0`}
        onError={e => { e.currentTarget.style.display = 'none' }} />
    )
  }
  return (
    <div className={`${dim} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
      style={{ background: avatarGrad(emp.id) }}>
      {ini}
    </div>
  )
}

function Badge({ meta }) {
  if (!meta) return <span className="text-xs text-gray-400">—</span>
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.cls}`}>
      {meta.label}
    </span>
  )
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
    <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50
      flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium
      ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      {ok ? <CheckCircle2 size={17} className="text-emerald-500 shrink-0" />
           : <AlertCircle size={17} className="text-red-500 shrink-0" />}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="opacity-50 hover:opacity-100 ml-1"><X size={15} /></button>
    </div>
  )
}

// ── View Modal ───────────────────────────────────────────────────────────────

function ViewModal({ emp, onClose, onEdit }) {
  if (!emp) return null
  const statusMeta = STATUS_META[emp.status]
  const roleMeta   = ROLE_META[emp.role]
  const shortId    = emp.id?.slice(-6).toUpperCase() ?? '——'

  const InfoRow = ({ icon: Icon, label, value }) => (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={14} className="text-indigo-500" />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-gray-800 mt-0.5">{value || '—'}</p>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden fade-in">

        {/* Header gradient */}
        <div className="relative px-6 pt-8 pb-6 text-center"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #1e3a8a 100%)' }}>
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <X size={16} />
          </button>

          <div className="flex justify-center mb-3">
            <EmployeeAvatar emp={emp} size="lg" />
          </div>
          <h2 className="text-lg font-extrabold text-white">
            {emp.first_name} {emp.last_name}
          </h2>
          <p className="text-indigo-300 text-sm mt-0.5">{emp.job_title || 'No title'}</p>

          <div className="flex items-center justify-center gap-2 mt-3">
            {statusMeta && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/15 text-white">
                {statusMeta.label}
              </span>
            )}
            {roleMeta && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/10 text-indigo-200">
                {roleMeta.label}
              </span>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="px-6 py-2">
          <InfoRow icon={Hash}       label="Employee ID"  value={`#${shortId}`} />
          <InfoRow icon={Building2}  label="Department"   value={emp.departments?.name} />
          <InfoRow icon={Mail}       label="Email"        value={emp.email} />
          <InfoRow icon={Phone}      label="Phone"        value={emp.phone_number} />
          <InfoRow icon={Calendar}   label="Hire Date"    value={fmtDate(emp.hire_date)} />
          <InfoRow icon={Briefcase}  label="Job Title"    value={emp.job_title} />
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-2 flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Close
          </button>
          <button onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#3b82f6)' }}>
            <Pencil size={14} /> Edit Employee
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({ employee, loading, onConfirm, onCancel }) {
  if (!employee) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center fade-in">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={24} className="text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Delete Employee</h3>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-gray-700">{employee.first_name} {employee.last_name}</span>?
          <br />This <span className="font-semibold text-red-600">cannot be undone</span>.
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-60">
            {loading ? <Spinner size={16} /> : <Trash2 size={15} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Employee Form Modal ───────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 ' +
  'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ' +
  'focus:border-indigo-500 focus:bg-white transition-all'
const LABEL_CLS = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5'

function EmployeeModal({ mode, formData, departments, onChange, onClose, onSubmit, loading }) {
  const isEdit = mode === 'edit'
  const field  = name => e => onChange({ ...formData, [name]: e.target.value })

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-10 fade-in">

        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? 'Edit Employee' : 'Add New Employee'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEdit ? 'Update the details and click Save Changes.' : 'Fill in the details to add a new team member.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="px-6 py-5 space-y-4">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLS}>First Name <span className="text-red-400 normal-case tracking-normal">*</span></label>
                <input required type="text" placeholder="John"
                  value={formData.first_name} onChange={field('first_name')} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Last Name <span className="text-red-400 normal-case tracking-normal">*</span></label>
                <input required type="text" placeholder="Doe"
                  value={formData.last_name} onChange={field('last_name')} className={INPUT_CLS} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLS}>Email</label>
                <input type="email" placeholder="john@company.com"
                  value={formData.email} onChange={field('email')} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Phone Number</label>
                <input type="tel" placeholder="+1 555 000 0000"
                  value={formData.phone_number} onChange={field('phone_number')} className={INPUT_CLS} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLS}>Job Title</label>
                <input type="text" placeholder="Software Engineer"
                  value={formData.job_title} onChange={field('job_title')} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Department</label>
                <select value={formData.department_id} onChange={field('department_id')} className={INPUT_CLS}>
                  <option value="">— Select department —</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLS}>Hire Date</label>
                <input type="date" value={formData.hire_date} onChange={field('hire_date')} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Avatar URL <span className="normal-case tracking-normal font-normal text-gray-400">(optional)</span></label>
                <input type="url" placeholder="https://example.com/photo.jpg"
                  value={formData.avatar_url} onChange={field('avatar_url')} className={INPUT_CLS} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold
                transition-all disabled:opacity-60 min-w-[140px] justify-center shadow-md"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#3b82f6)', boxShadow: '0 4px 14px rgba(79,70,229,0.35)' }}>
              {loading && <Spinner size={15} />}
              {isEdit ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

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
  const [viewTarget,   setViewTarget]  = useState(null)
  const [dupIds,       setDupIds]      = useState([])

  const showToast    = useCallback((type, message) => setToast({ type, message }), [])
  const dismissToast = useCallback(() => setToast(null), [])

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await db.getEmployees()
      setEmployees(data)
      setDupIds(findDuplicates(data))
    } catch (err) {
      showToast('error', err.message)
    }
  }, [showToast])

  const fetchDepartments = useCallback(async () => {
    try {
      const data = await db.getDepartments()
      setDepartments(data)
    } catch {}
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchEmployees(), fetchDepartments()]).finally(() => setLoading(false))
  }, [fetchEmployees, fetchDepartments])

  // ── clean duplicates ──

  async function handleCleanDuplicates() {
    if (!dupIds.length) return
    setCleaning(true)
    try {
      await Promise.all(dupIds.map(id => db.deleteEmployee(id)))
      showToast('success', `Removed ${dupIds.length} duplicate record${dupIds.length > 1 ? 's' : ''}.`)
      await fetchEmployees()
    } catch (err) {
      showToast('error', err.message)
    }
    setCleaning(false)
  }

  // ── modal ──

  function openAdd() {
    setForm(EMPTY_FORM)
    setModal({ open: true, mode: 'add' })
  }

  function openEdit(emp) {
    setViewTarget(null)
    setForm({
      first_name:    emp.first_name    ?? '',
      last_name:     emp.last_name     ?? '',
      email:         emp.email         ?? '',
      role:          emp.role          ?? 'employee',
      status:        emp.status        ?? 'active',
      department_id: emp.department_id ?? '',
      job_title:     emp.job_title     ?? '',
      hire_date:     emp.hire_date     ?? TODAY,
      phone_number:  emp.phone_number  ?? '',
      avatar_url:    emp.avatar_url    ?? '',
    })
    setModal({ open: true, mode: 'edit', id: emp.id })
  }

  function closeModal() {
    setModal({ open: false })
    setForm(EMPTY_FORM)
  }

  // ── save ──

  async function handleSave(e) {
    e.preventDefault()
    setSubmitting(true)
    const payload = {
      first_name:    form.first_name.trim(),
      last_name:     form.last_name.trim(),
      email:         nullify(form.email),
      role:          form.role,
      status:        form.status,
      department_id: nullify(form.department_id),
      job_title:     nullify(form.job_title),
      hire_date:     nullify(form.hire_date),
      phone_number:  nullify(form.phone_number),
      avatar_url:    nullify(form.avatar_url),
    }
    try {
      if (modal.mode === 'add') await db.addEmployee(payload)
      else await db.updateEmployee(modal.id, payload)
    } catch (err) {
      showToast('error', err.message)
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    closeModal()
    showToast('success',
      modal.mode === 'add'
        ? `${payload.first_name} ${payload.last_name} added successfully.`
        : `${payload.first_name} ${payload.last_name} updated successfully.`
    )
    await fetchEmployees()
  }

  // ── delete ──

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await db.deleteEmployee(deleteTarget.id)
    } catch (err) {
      showToast('error', err.message)
      setDeleting(false)
      return
    }
    setDeleting(false)
    showToast('success', `${deleteTarget.first_name} ${deleteTarget.last_name} deleted.`)
    setEmployees(prev => prev.filter(e => e.id !== deleteTarget.id))
    setDupIds(prev => prev.filter(id => id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  // ── filter (hide duplicates in the list) ──

  const uniqueEmployees = employees.filter(e => !dupIds.includes(e.id))

  const filtered = uniqueEmployees.filter(emp => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(q) ||
      (emp.email             ?? '').toLowerCase().includes(q) ||
      (emp.job_title         ?? '').toLowerCase().includes(q) ||
      (emp.departments?.name ?? '').toLowerCase().includes(q) ||
      (emp.role              ?? '').toLowerCase().includes(q)
    )
  })

  const activeCount   = uniqueEmployees.filter(e => e.status === 'active').length
  const inactiveCount = uniqueEmployees.filter(e => e.status !== 'active').length

  // ── render ──

  return (
    <div className="space-y-5 fade-in">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Employees</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {uniqueEmployees.length} team member{uniqueEmployees.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <button onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-white text-sm font-bold rounded-xl shadow-md
            transition-all self-start sm:self-auto"
          style={{ background: 'linear-gradient(135deg,#4f46e5,#3b82f6)', boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }}>
          <UserPlus size={16} /> Add Employee
        </button>
      </div>

      {/* ── Duplicate warning banner ── */}
      {dupIds.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.35)' }}>
          <AlertTriangle size={18} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            <span className="font-bold">{dupIds.length} duplicate record{dupIds.length > 1 ? 's' : ''} detected.</span>{' '}
            These are hidden from the list below.
          </p>
          <button onClick={handleCleanDuplicates} disabled={cleaning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 transition-colors disabled:opacity-60 shrink-0">
            {cleaning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {cleaning ? 'Removing…' : 'Remove duplicates'}
          </button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: Users, label: 'Total Employees', value: uniqueEmployees.length,
            gradient: 'linear-gradient(135deg,#4f46e5,#6366f1)', glow: 'rgba(79,70,229,0.2)',
          },
          {
            icon: UserCheck, label: 'Active', value: activeCount,
            gradient: 'linear-gradient(135deg,#059669,#10b981)', glow: 'rgba(5,150,105,0.2)',
          },
          {
            icon: UserX, label: 'Inactive / Suspended', value: inactiveCount,
            gradient: 'linear-gradient(135deg,#d97706,#f59e0b)', glow: 'rgba(217,119,6,0.2)',
          },
        ].map(({ icon: Icon, label, value, gradient, glow }) => (
          <div key={label} className="rounded-2xl p-5 relative overflow-hidden"
            style={{ background: gradient, boxShadow: `0 8px 24px ${glow}` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-white/70 font-medium">{label}</p>
                <p className="text-3xl font-extrabold text-white mt-1">{value}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Icon size={20} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Search toolbar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" placeholder="Search name, email, title, department…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50
                placeholder:text-gray-400 text-gray-700 focus:outline-none focus:ring-2
                focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all" />
          </div>
          {search && (
            <button onClick={() => setSearch('')}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-gray-400">
            <Spinner size={22} />
            <span className="text-sm">Loading employees…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <Users size={40} className="text-gray-200" />
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-500">
                {search ? 'No results found' : 'No employees yet'}
              </p>
              <p className="text-xs mt-1 text-gray-400">
                {search ? `No match for "${search}"` : 'Click "Add Employee" to get started.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fafbff' }}>
                  {['Employee', 'Job Title', 'Department', 'Role', 'Status', 'Hire Date', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider last:text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(emp => (
                  <tr key={emp.id} className="group hover:bg-indigo-50/40 transition-colors cursor-pointer"
                    onClick={() => setViewTarget(emp)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar emp={emp} />
                        <div className="leading-tight min-w-0">
                          <p className="font-bold text-gray-900 truncate">{emp.first_name} {emp.last_name}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{emp.email ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{emp.job_title ?? '—'}</td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{emp.departments?.name ?? '—'}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap"><Badge meta={ROLE_META[emp.role]} /></td>
                    <td className="px-5 py-3.5 whitespace-nowrap"><Badge meta={STATUS_META[emp.status]} /></td>
                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-xs font-medium">{fmtDate(emp.hire_date)}</td>
                    <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setViewTarget(emp)} title="View"
                          className="p-2 rounded-lg text-gray-400 hover:bg-indigo-100 hover:text-indigo-700 transition-colors">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => openEdit(emp)} title="Edit"
                          className="p-2 rounded-lg text-gray-400 hover:bg-blue-100 hover:text-blue-700 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(emp)} title="Delete"
                          className="p-2 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
            <span>
              Showing <span className="font-semibold text-gray-600">{filtered.length}</span> of{' '}
              <span className="font-semibold text-gray-600">{uniqueEmployees.length}</span> employees
            </span>
            <span className="text-gray-300">Click any row to view details</span>
          </div>
        )}
      </div>

      {/* Modals */}
      {viewTarget && (
        <ViewModal
          emp={viewTarget}
          onClose={() => setViewTarget(null)}
          onEdit={() => openEdit(viewTarget)}
        />
      )}

      {modal.open && (
        <EmployeeModal
          mode={modal.mode}
          formData={form}
          departments={departments}
          onChange={setForm}
          onClose={closeModal}
          onSubmit={handleSave}
          loading={submitting}
        />
      )}

      <DeleteModal
        employee={deleteTarget}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
