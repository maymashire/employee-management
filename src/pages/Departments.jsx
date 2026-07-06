import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  Building2, Plus, Pencil, Trash2, X,
  Loader2, CheckCircle2, AlertCircle, Users,
} from 'lucide-react'

const EMPTY_FORM = { name: '', description: '' }

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 ' +
  'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/25 ' +
  'focus:border-[#1e3a8a] transition-colors'
const LABEL_CLS = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5'

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(onDismiss, 4500)
    return () => clearTimeout(id)
  }, [toast, onDismiss])

  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium
      ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}
    >
      {ok
        ? <CheckCircle2 size={17} className="text-emerald-500 shrink-0" />
        : <AlertCircle  size={17} className="text-red-500 shrink-0" />}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="opacity-50 hover:opacity-100 ml-1"><X size={15} /></button>
    </div>
  )
}

// ─── Delete confirmation modal ────────────────────────────────────────────────

function DeleteModal({ dept, loading, onConfirm, onCancel }) {
  if (!dept) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={24} className="text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Delete Department</h3>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Delete <span className="font-semibold text-gray-700">"{dept.name}"</span>?
          Employees in this department will become unassigned.
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── New / Edit department modal ──────────────────────────────────────────────

function DeptModal({ mode, formData, onChange, onClose, onSubmit, loading }) {
  const isEdit = mode === 'edit'
  const field  = name => e => onChange({ ...formData, [name]: e.target.value })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? 'Edit Department' : 'New Department'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEdit ? 'Update the department details below.' : 'Add a new department to your organisation.'}
            </p>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Fields */}
        <form onSubmit={onSubmit}>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className={LABEL_CLS}>
                Department Name <span className="text-red-400 normal-case tracking-normal">*</span>
              </label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={field('name')}
                placeholder="e.g. Engineering"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Description</label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={field('description')}
                placeholder="Brief description of what this department does..."
                className={`${INPUT_CLS} resize-none`}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1e3a8a] hover:bg-[#162d6e] text-white text-sm font-semibold transition-colors disabled:opacity-60">
              {loading && <Loader2 size={15} className="animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([])
  const [empCounts,   setEmpCounts]   = useState({})
  const [loading,     setLoading]     = useState(true)
  const [submitting,  setSubmitting]  = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [toast,       setToast]       = useState(null)
  const [modal,       setModal]       = useState({ open: false })
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // ── data fetching ──

  const fetchAll = useCallback(async () => {
    const [{ data: depts, error }, { data: emps }] = await Promise.all([
      supabase.from('departments').select('*').order('name'),
      supabase.from('employees').select('id, department_id').eq('status', 'active'),
    ])

    if (error) {
      console.error('departments fetch error:', error.message)
    }

    setDepartments(depts ?? [])

    const counts = {}
    ;(emps ?? []).forEach(e => {
      if (e.department_id) counts[e.department_id] = (counts[e.department_id] ?? 0) + 1
    })
    setEmpCounts(counts)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchAll().finally(() => setLoading(false))
  }, [fetchAll])

  // ── toast ──

  const showToast    = useCallback((type, message) => setToast({ type, message }), [])
  const dismissToast = useCallback(() => setToast(null), [])

  // ── modal helpers ──

  function openAdd() {
    setForm(EMPTY_FORM)
    setModal({ open: true, mode: 'add' })
  }

  function openEdit(dept) {
    setForm({ name: dept.name ?? '', description: dept.description ?? '' })
    setModal({ open: true, mode: 'edit', id: dept.id })
  }

  function closeModal() {
    setModal({ open: false })
    setForm(EMPTY_FORM)
  }

  // ── CRUD ──

  async function handleSave(e) {
    e.preventDefault()
    setSubmitting(true)

    const payload = {
      name:        form.name.trim(),
      description: form.description.trim() || null,
    }

    const { error } = modal.mode === 'add'
      ? await supabase.from('departments').insert([payload])
      : await supabase.from('departments').update(payload).eq('id', modal.id)

    setSubmitting(false)

    if (error) {
      showToast('error', error.message)
      return
    }

    closeModal()
    showToast('success', modal.mode === 'add' ? `"${payload.name}" created.` : `"${payload.name}" updated.`)
    await fetchAll()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('departments').delete().eq('id', deleteTarget.id)
    setDeleting(false)

    if (error) {
      showToast('error', error.message)
    } else {
      showToast('success', `"${deleteTarget.name}" deleted.`)
      setDepartments(prev => prev.filter(d => d.id !== deleteTarget.id))
    }
    setDeleteTarget(null)
  }

  // ── render ──

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Departments</h2>
          <p className="text-sm text-gray-400 mt-0.5">{departments.length} department{departments.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1e3a8a] hover:bg-[#162d6e] text-white text-sm font-semibold rounded-xl shadow-sm transition-colors">
          <Plus size={16} /> New Department
        </button>
      </div>

      {/* Department cards */}
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
          <Loader2 size={22} className="animate-spin text-blue-600" />
          <span className="text-sm">Loading departments…</span>
        </div>
      ) : departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
          <Building2 size={40} className="text-gray-200" />
          <p className="text-sm font-medium">No departments yet. Click "New Department" to create the first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map(dept => {
            const count = empCounts[dept.id] ?? 0
            return (
              <div key={dept.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow group">

                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Building2 size={20} className="text-[#1e3a8a]" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(dept)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteTarget(dept)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-gray-800 text-base">{dept.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 min-h-[32px]">
                  {dept.description ?? 'No description.'}
                </p>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Users size={13} />
                    {count} employee{count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
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
