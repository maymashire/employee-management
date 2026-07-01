import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  UserPlus, Search, Pencil, Trash2, X,
  Loader2, CheckCircle2, AlertCircle,
  Users, UserCheck, UserX,
} from 'lucide-react'

// ─── constants ────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10)

const EMPTY_FORM = {
  first_name:    '',
  last_name:     '',
  email:         '',
  role:          'employee',    // employees_role_check constraint enforces lowercase
  status:        'active',
  department_id: '',
  job_title:     '',
  hire_date:     TODAY,
  phone_number:  '',
  avatar_url:    '',
}

const STATUS_META = {
  active:     { label: 'Active',     cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
  inactive:   { label: 'Inactive',   cls: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200' },
  suspended:  { label: 'Suspended',  cls: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' },
  terminated: { label: 'Terminated', cls: 'bg-red-100 text-red-700 ring-1 ring-red-200' },
}

const ROLE_META = {
  employee:      { label: 'Employee',      cls: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' },
  manager:       { label: 'Manager',       cls: 'bg-violet-100 text-violet-700 ring-1 ring-violet-200' },
  administrator: { label: 'Administrator', cls: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' },
}

const fmtDate = iso =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

// Convert form field to null if empty — prevents NOT NULL or enum constraint errors
const nullify = v => (v === '' || v == null) ? null : v

// ─── shared UI ────────────────────────────────────────────────────────────────

function Spinner({ size = 20 }) {
  return <Loader2 size={size} className="animate-spin text-blue-600" />
}

function EmployeeAvatar({ firstName, lastName, avatarUrl }) {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?'
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="w-9 h-9 rounded-full object-cover shrink-0"
        onError={e => { e.currentTarget.style.display = 'none' }}
      />
    )
  }
  return (
    <div className="w-9 h-9 rounded-full bg-[#1e3a8a] flex items-center justify-center text-white text-xs font-bold shrink-0">
      {initials}
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

function StatCard({ icon, iconBg, label, value }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDismiss, 4500)
    return () => clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium max-w-sm
      ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      {ok
        ? <CheckCircle2 size={17} className="text-emerald-500 shrink-0" />
        : <AlertCircle  size={17} className="text-red-500 shrink-0" />}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="opacity-50 hover:opacity-100 ml-1"><X size={15} /></button>
    </div>
  )
}

// ─── Delete modal ─────────────────────────────────────────────────────────────

function DeleteModal({ employee, loading, onConfirm, onCancel }) {
  if (!employee) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={24} className="text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Delete Employee</h3>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-gray-700">{employee.first_name} {employee.last_name}</span>?
          <br />This action <span className="font-semibold text-red-600">cannot be undone</span>.
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
            {loading ? <Spinner size={16} /> : <Trash2 size={15} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Employee modal ───────────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 ' +
  'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/25 ' +
  'focus:border-[#1e3a8a] transition-colors'
const LABEL_CLS = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5'

function EmployeeModal({ mode, formData, departments, onChange, onClose, onSubmit, loading }) {
  const isEdit = mode === 'edit'
  const field  = name => e => onChange({ ...formData, [name]: e.target.value })

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-10">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? 'Edit Employee' : 'Add New Employee'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEdit ? 'Update the details and click Save Changes.' : 'Fill in the details to add a new team member.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="px-6 py-5 space-y-4">

            {/* Name */}
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

            {/* Contact */}
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

            {/* Job */}
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

            {/* Role & Status */}
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

            {/* Hire date & Avatar */}
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

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1e3a8a] hover:bg-[#162d6e] text-white text-sm font-semibold transition-colors disabled:opacity-60 min-w-[140px] justify-center">
              {loading && <Spinner size={15} />}
              {isEdit ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const [employees,    setEmployees]   = useState([])
  const [departments,  setDepartments] = useState([])
  const [loading,      setLoading]     = useState(true)
  const [submitting,   setSubmitting]  = useState(false)
  const [deleting,     setDeleting]    = useState(false)
  const [search,       setSearch]      = useState('')
  const [toast,        setToast]       = useState(null)
  const [modal,        setModal]       = useState({ open: false })
  const [form,         setForm]        = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const showToast    = useCallback((type, message) => setToast({ type, message }), [])
  const dismissToast = useCallback(() => setToast(null), [])

  // ── fetch ──

  const fetchEmployees = useCallback(async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*, departments(name)')
      .order('first_name')
    if (error) showToast('error', error.message)
    else setEmployees(data ?? [])
  }, [showToast])

  const fetchDepartments = useCallback(async () => {
    const { data } = await supabase.from('departments').select('id, name').order('name')
    setDepartments(data ?? [])
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchEmployees(), fetchDepartments()]).finally(() => setLoading(false))
  }, [fetchEmployees, fetchDepartments])

  // ── modal ──

  function openAdd() {
    setForm(EMPTY_FORM)
    setModal({ open: true, mode: 'add' })
  }

  function openEdit(emp) {
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

    // Only send columns that actually exist in the table.
    // Nullify empty strings so optional columns get NULL, not ''.
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

    const { error } = modal.mode === 'add'
      ? await supabase.from('employees').insert([payload])
      : await supabase.from('employees').update(payload).eq('id', modal.id)

    setSubmitting(false)

    if (error) {
      showToast('error', error.message)
      return
    }

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
    const { error } = await supabase.from('employees').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) {
      showToast('error', error.message)
    } else {
      showToast('success', `${deleteTarget.first_name} ${deleteTarget.last_name} deleted.`)
      setEmployees(prev => prev.filter(e => e.id !== deleteTarget.id))
    }
    setDeleteTarget(null)
  }

  // ── filter ──

  const filtered = employees.filter(emp => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(q) ||
      (emp.email        ?? '').toLowerCase().includes(q) ||
      (emp.job_title    ?? '').toLowerCase().includes(q) ||
      (emp.departments?.name ?? '').toLowerCase().includes(q) ||
      (emp.role         ?? '').toLowerCase().includes(q)
    )
  })

  const activeCount   = employees.filter(e => e.status === 'active').length
  const inactiveCount = employees.filter(e => e.status !== 'active').length

  // ── render ──

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employees</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {employees.length} team member{employees.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <button onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1e3a8a] hover:bg-[#162d6e] text-white text-sm font-semibold rounded-xl shadow-sm transition-colors self-start sm:self-auto">
          <UserPlus size={16} /> Add Employee
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<Users size={20} className="text-blue-600" />}       iconBg="bg-blue-50"    label="Total Employees"     value={employees.length} />
        <StatCard icon={<UserCheck size={20} className="text-emerald-600" />} iconBg="bg-emerald-50" label="Active"               value={activeCount} />
        <StatCard icon={<UserX size={20} className="text-amber-600" />}       iconBg="bg-amber-50"   label="Inactive / Suspended" value={inactiveCount} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Search toolbar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search name, email, title, department…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 placeholder:text-gray-400 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/25 focus:border-[#1e3a8a] transition-colors"
            />
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
              <p className="text-xs mt-1">
                {search ? `No employees match "${search}"` : 'Click "Add Employee" to create the first one.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[780px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Employee', 'Job Title', 'Department', 'Role', 'Status', 'Hire Date', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider last:text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(emp => (
                  <tr key={emp.id} className="group hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar firstName={emp.first_name} lastName={emp.last_name} avatarUrl={emp.avatar_url} />
                        <div className="leading-tight min-w-0">
                          <p className="font-semibold text-gray-800 truncate">{emp.first_name} {emp.last_name}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{emp.email ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{emp.job_title ?? '—'}</td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{emp.departments?.name ?? '—'}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap"><Badge meta={ROLE_META[emp.role]} /></td>
                    <td className="px-5 py-3.5 whitespace-nowrap"><Badge meta={STATUS_META[emp.status]} /></td>
                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-xs">{fmtDate(emp.hire_date)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
            Showing <span className="font-semibold text-gray-600">{filtered.length}</span> of{' '}
            <span className="font-semibold text-gray-600">{employees.length}</span> employees
          </div>
        )}
      </div>

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
