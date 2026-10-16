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

  return (
    <>
      {/*
        Backdrop: below the fixed header (top-16) and respects the sidebar
        on desktop (lg:left-64). z-40 sits above sidebar (z-30), below drawer (z-50).
      */}
      <div
        className="fixed top-16 left-0 lg:left-64 right-0 bottom-0 bg-black/25 z-40"
        onClick={onClose}
      />

      {/*
        Drawer: starts at top-16 so the app header stays fully visible.
        flex-col with flex-1+min-h-0 on the scroll region keeps header/content
        sections pinned while the team member list scrolls independently.
      */}
      <div
        className="fixed top-16 bottom-0 right-0 z-50 flex flex-col bg-white shadow-2xl"
        style={{
          width: 'min(540px, 100vw)',
          animation: 'slideIn 0.22s cubic-bezier(.4,0,.2,1) forwards',
        }}
      >

        {/* Header */}
        <div className="relative px-5 pt-5 pb-5 shrink-0"
          style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#1e3a8a 100%)' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: pal.gradient }}>
              <Building2 size={18} className="text-white" />
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors">
              <X size={15} />
            </button>
          </div>

          <h2 className="text-lg font-extrabold text-white leading-tight">{dept.name}</h2>
          <p className="text-indigo-200/60 text-xs mt-1 leading-relaxed line-clamp-2">
            {dept.description || 'No description provided.'}
          </p>

          {/* Stats row */}
          <div className="flex gap-2 mt-4">
            {[
              { label: 'Total',    value: members.length,            valueClass: 'text-white' },
              { label: 'Active',   value: active,                    valueClass: 'text-emerald-400' },
              { label: 'Inactive', value: members.length - active,   valueClass: 'text-amber-400' },
            ].map(({ label, value, valueClass }) => (
              <div key={label} className="flex-1 px-3 py-2 rounded-xl text-center"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <p className={`font-extrabold text-base leading-none ${valueClass}`}>{value}</p>
                <p className="text-indigo-300/80 text-[10px] mt-0.5 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Edit button */}
        <div className="px-6 py-3 border-b border-gray-100 shrink-0 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Team Members</p>
          <button onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600
              bg-indigo-50 hover:bg-indigo-100 transition-colors">
            <Pencil size={12} /> Edit Department
          </button>
        </div>

        {/* Employee list — flex-1 + min-h-0 allows correct overflow in a flex-col parent */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <Users size={36} className="text-gray-200" />
              <p className="text-sm font-medium">No employees in this department.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {members.map(emp => {
                const ini       = `${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}`.toUpperCase()
                const statusMeta = STATUS_META[emp.status] ?? STATUS_META.inactive
                return (
                  <div key={emp.id} className="px-6 py-4 hover:bg-gray-50/60 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: avatarGrad(emp.id) }}>
                        {ini}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900 text-sm">
                            {emp.first_name} {emp.last_name}
                          </p>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${statusMeta.cls}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Briefcase size={11} className="shrink-0" />
                          {emp.job_title || 'No title'}
                        </p>
                        <div className="mt-2 flex flex-col gap-0.5">
                          {emp.email && (
                            <p className="text-xs text-gray-400 flex items-center gap-1.5">
                              <Mail size={11} className="shrink-0 text-gray-300" />
                              {emp.email}
                            </p>
                          )}
                          {emp.phone_number && (
                            <p className="text-xs text-gray-400 flex items-center gap-1.5">
                              <Phone size={11} className="shrink-0 text-gray-300" />
                              {emp.phone_number}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 flex items-center gap-1.5">
                            <Calendar size={11} className="shrink-0 text-gray-300" />
                            Hired {fmtDate(emp.hire_date)}
                          </p>
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

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept, idx) => {
            const count = empCounts[dept.id] ?? 0
            const pal   = palette(idx)
            return (
              <div key={dept.id}
                onClick={() => { setViewDept(dept); setViewIdx(idx) }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden">

                {/* Top gradient accent bar */}
                <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
                  style={{ background: pal.gradient }} />

                <div className="flex items-start justify-between mb-4 pt-1">
                  {/* Icon */}
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: pal.gradient }}>
                    <Building2 size={20} className="text-white" />
                  </div>

                  {/* Actions — show on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(dept)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteTarget(dept)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="font-extrabold text-gray-900 text-base leading-tight">{dept.name}</h3>
                <p className="text-xs text-gray-400 mt-1 line-clamp-2 min-h-[32px] leading-relaxed">
                  {dept.description ?? 'No description.'}
                </p>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
                    <Users size={14} className="text-gray-400" />
                    {count} employee{count !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-indigo-500 group-hover:gap-1 transition-all">
                    View team <ChevronRight size={13} />
                  </span>
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
