import { useState, useEffect, useCallback } from 'react'
import * as db from '../lib/db'
import {
  Building2, Plus, Pencil, Trash2, X,
  Loader2, CheckCircle2, AlertCircle, Users,
  ChevronRight, Mail, Phone, Calendar, Briefcase,
} from 'lucide-react'

// ── department color palette ──────────────────────────────────────────────────

const DEPT_PALETTES = [
  { gradient: 'linear-gradient(135deg,#4f46e5,#6366f1)', icon: 'bg-indigo-50', iconText: 'text-indigo-600', pill: 'bg-indigo-100 text-indigo-700' },
  { gradient: 'linear-gradient(135deg,#0891b2,#06b6d4)', icon: 'bg-cyan-50',   iconText: 'text-cyan-600',   pill: 'bg-cyan-100 text-cyan-700' },
  { gradient: 'linear-gradient(135deg,#059669,#10b981)', icon: 'bg-emerald-50', iconText: 'text-emerald-600', pill: 'bg-emerald-100 text-emerald-700' },
  { gradient: 'linear-gradient(135deg,#d97706,#f59e0b)', icon: 'bg-amber-50',  iconText: 'text-amber-600',  pill: 'bg-amber-100 text-amber-700' },
  { gradient: 'linear-gradient(135deg,#dc2626,#f43f5e)', icon: 'bg-rose-50',   iconText: 'text-rose-600',   pill: 'bg-rose-100 text-rose-700' },
  { gradient: 'linear-gradient(135deg,#7c3aed,#a855f7)', icon: 'bg-purple-50', iconText: 'text-purple-600', pill: 'bg-purple-100 text-purple-700' },
]

function palette(idx) { return DEPT_PALETTES[idx % DEPT_PALETTES.length] }

// ── helpers ───────────────────────────────────────────────────────────────────

const AVATAR_GRADS = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#3b82f6,#06b6d4)',
  'linear-gradient(135deg,#10b981,#3b82f6)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#f43f5e,#a855f7)',
]
function avatarGrad(id = '') {
  let n = 0; for (const c of id) n += c.charCodeAt(0)
  return AVATAR_GRADS[n % AVATAR_GRADS.length]
}

const STATUS_META = {
  active:     { label: 'Active',     cls: 'bg-emerald-100 text-emerald-700' },
  inactive:   { label: 'Inactive',   cls: 'bg-gray-100    text-gray-600' },
  suspended:  { label: 'Suspended',  cls: 'bg-amber-100   text-amber-700' },
  terminated: { label: 'Terminated', cls: 'bg-red-100     text-red-700' },
}

const fmtDate = iso =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const INPUT_CLS =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 ' +
  'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ' +
  'focus:border-indigo-500 focus:bg-white transition-all'
const LABEL_CLS = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5'

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(onDismiss, 4500)
    return () => clearTimeout(id)
  }, [toast, onDismiss])
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50
      flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium
      ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      {ok ? <CheckCircle2 size={17} className="text-emerald-500 shrink-0" />
           : <AlertCircle  size={17} className="text-red-500 shrink-0" />}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="opacity-50 hover:opacity-100 ml-1"><X size={15} /></button>
    </div>
  )
}

// ── Department View Drawer ────────────────────────────────────────────────────

function DeptDrawer({ dept, employees, paletteIdx, onClose, onEdit }) {
  if (!dept) return null
  const pal     = palette(paletteIdx)
  const members = employees.filter(e => e.department_id === dept.id)
  const active  = members.filter(e => e.status === 'active').length
  const inactive = members.length - active

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const handle = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  return (
    <>
      {/* Full-viewport overlay — click outside to close */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)' }}
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-2xl w-full flex flex-col shadow-2xl"
          style={{
            maxWidth: 620,
            maxHeight: '90vh',
            animation: 'deptModalIn .2s cubic-bezier(.4,0,.2,1) forwards',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Department Details</p>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
              <X size={15} />
            </button>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 min-h-0 overflow-y-auto">

            {/* Department profile — centered */}
            <div className="px-6 pt-6 pb-5 border-b border-gray-100 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4"
                style={{ background: pal.gradient }}>
                <Building2 size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">{dept.name}</h2>
              <p className="text-sm text-gray-400 mt-1.5 leading-relaxed max-w-sm mx-auto">
                {dept.description || 'No description provided.'}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mt-5">
                {[
                  { label: 'Total',    value: members.length, bg: 'bg-slate-50',   border: 'border-slate-100',   num: 'text-gray-900',    sub: 'text-slate-400' },
                  { label: 'Active',   value: active,         bg: 'bg-emerald-50', border: 'border-emerald-100', num: 'text-emerald-700', sub: 'text-emerald-400' },
                  { label: 'Inactive', value: inactive,       bg: 'bg-amber-50',   border: 'border-amber-100',   num: 'text-amber-700',   sub: 'text-amber-400' },
                ].map(({ label, value, bg, border, num, sub }) => (
                  <div key={label} className={`${bg} border ${border} rounded-xl py-3`}>
                    <p className={`text-2xl font-extrabold ${num} leading-none`}>{value}</p>
                    <p className={`text-[11px] font-semibold ${sub} mt-1`}>{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Team members */}
            <div className="px-6 py-5">
              <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-4">
                Team Members
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold">{members.length}</span>
              </p>

              {members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                    <Users size={22} className="text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">No team members yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {members.map(emp => {
                    const ini        = `${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}`.toUpperCase()
                    const statusMeta = STATUS_META[emp.status] ?? STATUS_META.inactive
                    return (
                      <div key={emp.id}
                        className="bg-gray-50/60 border border-gray-100 rounded-xl p-4 hover:bg-indigo-50/30 hover:border-indigo-100 transition-all">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-extrabold shrink-0"
                            style={{ background: avatarGrad(emp.id) }}>
                            {ini}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-gray-900 text-sm">{emp.first_name} {emp.last_name}</p>
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${statusMeta.cls}`}>
                                {statusMeta.label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                              <Briefcase size={10} className="shrink-0 text-gray-400" />
                              {emp.job_title || 'No title'}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                              {emp.email && (
                                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                  <Mail size={10} className="text-gray-300 shrink-0" />{emp.email}
                                </p>
                              )}
                              {emp.phone_number && (
                                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                  <Phone size={10} className="text-gray-300 shrink-0" />{emp.phone_number}
                                </p>
                              )}
                              {emp.hire_date && (
                                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                  <Calendar size={10} className="text-gray-300 shrink-0" />Joined {fmtDate(emp.hire_date)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex gap-3">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Close
            </button>
            <button onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#3b82f6)', boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }}>
              <Pencil size={13} /> Edit Department
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes deptModalIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </>
  )
}

// ── Delete Modal ──────────────────────────────────────────────────────────────

function DeleteModal({ dept, loading, onConfirm, onCancel }) {
  if (!dept) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center fade-in">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={24} className="text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Delete Department</h3>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Delete <span className="font-semibold text-gray-700">"{dept.name}"</span>?<br />
          Employees in this department will become unassigned.
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-60">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dept Form Modal ───────────────────────────────────────────────────────────

function DeptModal({ mode, formData, onChange, onClose, onSubmit, loading }) {
  const isEdit = mode === 'edit'
  const field  = name => e => onChange({ ...formData, [name]: e.target.value })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg fade-in">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? 'Edit Department' : 'New Department'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEdit ? 'Update the department details.' : 'Add a new department to your organisation.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className={LABEL_CLS}>Department Name <span className="text-red-400 normal-case tracking-normal">*</span></label>
              <input required type="text" value={formData.name} onChange={field('name')}
                placeholder="e.g. Engineering" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Description</label>
              <textarea rows={3} value={formData.description} onChange={field('description')}
                placeholder="Brief description of what this department does…"
                className={`${INPUT_CLS} resize-none`} />
            </div>
          </div>
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-60 shadow-md"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#3b82f6)', boxShadow: '0 4px 14px rgba(79,70,229,0.35)' }}>
              {loading && <Loader2 size={15} className="animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DepartmentsPage() {
  const [departments,  setDepartments]  = useState([])
  const [allEmployees, setAllEmployees] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [submitting,   setSubmitting]   = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [toast,        setToast]        = useState(null)
  const [modal,        setModal]        = useState({ open: false })
  const [form,         setForm]         = useState({ name: '', description: '' })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [viewDept,     setViewDept]     = useState(null)
  const [viewIdx,      setViewIdx]      = useState(0)

  const fetchAll = useCallback(async () => {
    try {
      const [depts, emps] = await Promise.all([db.getDepartments(), db.getEmployees()])
      setDepartments(depts)
      setAllEmployees(emps)
    } catch (err) {
      console.error(err.message)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchAll().finally(() => setLoading(false))
  }, [fetchAll])

  const showToast    = useCallback((type, message) => setToast({ type, message }), [])
  const dismissToast = useCallback(() => setToast(null), [])

  function openAdd() {
    setForm({ name: '', description: '' })
    setModal({ open: true, mode: 'add' })
  }

  function openEdit(dept) {
    setViewDept(null)
    setForm({ name: dept.name ?? '', description: dept.description ?? '' })
    setModal({ open: true, mode: 'edit', id: dept.id })
  }

  function closeModal() {
    setModal({ open: false })
    setForm({ name: '', description: '' })
  }

  async function handleSave(e) {
    e.preventDefault()
    setSubmitting(true)
    const payload = { name: form.name.trim(), description: form.description.trim() || null }
    try {
      if (modal.mode === 'add') await db.addDepartment(payload)
      else await db.updateDepartment(modal.id, payload)
    } catch (err) {
      showToast('error', err.message)
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    closeModal()
    showToast('success', modal.mode === 'add' ? `"${payload.name}" created.` : `"${payload.name}" updated.`)
    await fetchAll()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await db.deleteDepartment(deleteTarget.id)
      showToast('success', `"${deleteTarget.name}" deleted.`)
      setDepartments(prev => prev.filter(d => d.id !== deleteTarget.id))
      if (viewDept?.id === deleteTarget.id) setViewDept(null)
    } catch (err) {
      showToast('error', err.message)
    }
    setDeleting(false)
    setDeleteTarget(null)
  }

  // Compute emp count per department (unique employees only — deduplicate by name)
  const empCounts = {}
  const seenNames = {}
  for (const emp of allEmployees) {
    const key = `${(emp.first_name ?? '').toLowerCase()}|${(emp.last_name ?? '').toLowerCase()}`
    if (seenNames[key]) continue
    seenNames[key] = true
    if (emp.department_id) empCounts[emp.department_id] = (empCounts[emp.department_id] ?? 0) + 1
  }

  // Unique employees for the drawer list
  const uniqueEmployees = []
  const seen2 = {}
  for (const emp of allEmployees) {
    const key = `${(emp.first_name ?? '').toLowerCase()}|${(emp.last_name ?? '').toLowerCase()}`
    if (seen2[key]) continue
    seen2[key] = true
    uniqueEmployees.push(emp)
  }

  const totalEmployees = Object.values(empCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-5 fade-in">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Departments</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {departments.length} department{departments.length !== 1 ? 's' : ''} · {totalEmployees} total employees
          </p>
        </div>
        <button onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-white text-sm font-bold rounded-xl shadow-md transition-all self-start sm:self-auto"
          style={{ background: 'linear-gradient(135deg,#4f46e5,#3b82f6)', boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }}>
          <Plus size={16} /> New Department
        </button>
      </div>

      {/* Department grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
          <Loader2 size={22} className="animate-spin text-indigo-600" />
          <span className="text-sm">Loading departments…</span>
        </div>
      ) : departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
          <Building2 size={40} className="text-gray-200" />
          <p className="text-sm font-medium">No departments yet. Click "New Department" to create the first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept, idx) => {
            const count = empCounts[dept.id] ?? 0
            const pal   = palette(idx)
            return (
              <div key={dept.id}
                onClick={() => { setViewDept(dept); setViewIdx(idx) }}
                className="bg-white rounded-2xl overflow-hidden cursor-pointer group transition-all duration-200 hover:-translate-y-1"
                style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.06)'}
              >
                {/* ── Hero gradient banner ── */}
                <div className="relative h-[88px] flex items-end px-5 pb-0"
                  style={{ background: pal.gradient }}>

                  {/* Subtle shine overlay */}
                  <div className="absolute inset-0 opacity-20"
                    style={{ background: 'radial-gradient(ellipse at 10% 20%, white 0%, transparent 55%)' }} />

                  {/* Hover actions — top right */}
                  <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(dept)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white transition-colors"
                      style={{ background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(4px)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.38)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDeleteTarget(dept)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white transition-colors"
                      style={{ background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(4px)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.7)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}>
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Icon — overlaps hero/body boundary */}
                  <div className="relative z-10 w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-lg translate-y-6"
                    style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}>
                    <Building2 size={22} className={pal.iconText} />
                  </div>
                </div>

                {/* ── Card body ── */}
                <div className="pt-9 px-5 pb-5">
                  <h3 className="font-extrabold text-gray-900 text-[15px] leading-tight tracking-tight">
                    {dept.name}
                  </h3>
                  <p className="text-[13px] text-gray-400 mt-1.5 leading-relaxed line-clamp-2 min-h-[38px]">
                    {dept.description ?? 'No description provided.'}
                  </p>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 rounded-md ${pal.icon} flex items-center justify-center`}>
                        <Users size={12} className={pal.iconText} />
                      </div>
                      <span className="text-sm font-bold text-gray-700">
                        {count}
                      </span>
                      <span className="text-sm text-gray-400">
                        {count === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                    <span className="flex items-center gap-0.5 text-xs font-bold text-indigo-500 opacity-0 group-hover:opacity-100 group-hover:gap-1.5 transition-all">
                      View team <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Department drawer */}
      {viewDept && (
        <DeptDrawer
          dept={viewDept}
          employees={uniqueEmployees}
          paletteIdx={viewIdx}
          onClose={() => setViewDept(null)}
          onEdit={() => openEdit(viewDept)}
        />
      )}

      {/* Modals */}
      {modal.open && (
        <DeptModal
          mode={modal.mode}
          formData={form}
          onChange={setForm}
          onClose={closeModal}
          onSubmit={handleSave}
          loading={submitting}
        />
      )}

      <DeleteModal
        dept={deleteTarget}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
