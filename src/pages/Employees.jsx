/**
 * Employees — directory with overview, filters, table/grid views, bulk
 * actions, a profile modal (with this month's attendance) and an add/edit
 * form with photo upload.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as db from '../lib/db'
import {
  UserPlus, Pencil, Trash2, Eye, Users, UserCheck, UserMinus, UserX, Ban, Download, RefreshCw,
  Mail, Phone, Calendar, Briefcase, Building2, Hash, AlertTriangle, Sparkles, LayoutGrid, List,
  ArrowUpDown, Camera, Upload, Copy, Check, Loader2, CalendarCheck, FolderInput, CalendarRange, X,
} from 'lucide-react'
import {
  useToast, useArmed, useSelection, downloadCSV, fmtDate,
  Toast, HeroCard, RateRing, StatCard, SearchBox, FilterPills, ToolButton, SkeletonRows,
  EmptyState, Checkbox, Th, Avatar, BulkBar, BulkAction, ListFooter, Modal, ModalHeader, ErrorNote,
  PrimaryButton, INPUT_CLS,
} from '../components/ui'
import {
  EMP_STATUS, EMP_STATUS_KEYS, EMP_ROLE, empName, findDuplicates, tenureMonths, tenureLabel,
} from '../lib/people'
import { summarize, toDateStr, fmtClock } from '../lib/attendance'
import { fileToAvatar } from '../lib/image'

const TODAY = toDateStr(new Date())
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMPTY_FORM = {
  first_name: '', last_name: '', email: '', role: 'employee', status: 'active', department_id: '',
  job_title: '', hire_date: TODAY, phone_number: '', avatar_url: '',
}
const nullify = v => (v === '' || v == null ? null : v)

const SORTS = {
  name:   { label: 'Name A–Z',     fn: (a, b) => empName(a).localeCompare(empName(b)) },
  newest: { label: 'Newest hires', fn: (a, b) => (b.hire_date ?? '').localeCompare(a.hire_date ?? '') },
  oldest: { label: 'Longest tenure', fn: (a, b) => (a.hire_date ?? '9999').localeCompare(b.hire_date ?? '9999') },
  dept:   { label: 'Department',   fn: (a, b) => (a.departments?.name ?? '~').localeCompare(b.departments?.name ?? '~') || empName(a).localeCompare(empName(b)) },
}

function readView() { try { return localStorage.getItem('emp_view') === 'grid' ? 'grid' : 'table' } catch { return 'table' } }

export function StatusBadge({ status }) {
  const m = EMP_STATUS[status]
  if (!m) return <span className="text-xs text-gray-400">—</span>
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${m.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} /> {m.label}
    </span>
  )
}

function RoleBadge({ role }) {
  const m = EMP_ROLE[role]
  if (!m) return <span className="text-xs text-gray-400">—</span>
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${m.badge}`}>{m.label}</span>
}

// ── Profile modal ─────────────────────────────────────────────────────────────
function ProfileModal({ emp, onClose, onEdit, onDelete }) {
  const [att, setAtt]       = useState(null)
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy]     = useState(false)

  useEffect(() => {
    let alive = true
    db.getAttendanceRange(`${TODAY.slice(0, 7)}-01`, TODAY)
      .then(list => alive && setAtt(summarize(list.filter(r => r.employee_id === emp.id))))
      .catch(() => alive && setAtt(summarize([])))
    return () => { alive = false }
  }, [emp.id])

  function copyEmail() {
    navigator.clipboard?.writeText(emp.email).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
  }

  async function remove() {
    if (!confirm) { setConfirm(true); return }
    setBusy(true)
    try { await onDelete(emp); onClose() } catch { setBusy(false) }
  }

  const months = tenureMonths(emp.hire_date)
  const rows = [
    { Icon: Hash,      label: 'Employee ID', value: `#${emp.id?.slice(-6).toUpperCase()}` },
    { Icon: Building2, label: 'Department',  value: emp.departments?.name ?? 'Unassigned' },
    { Icon: Briefcase, label: 'Job title',   value: emp.job_title },
    { Icon: Mail,      label: 'Email',       value: emp.email },
    { Icon: Phone,     label: 'Phone',       value: emp.phone_number },
    { Icon: Calendar,  label: 'Hire date',   value: emp.hire_date ? `${fmtDate(emp.hire_date)} · ${tenureLabel(emp.hire_date)}` : null },
  ].filter(r => r.value)

  return (
    <Modal onClose={onClose} maxWidth="560px">
      <div className="relative shrink-0 rounded-t-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #1e3a8a 100%)' }}>
        <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full opacity-25" style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
        <div className="relative flex items-center gap-4 px-6 py-5 text-white">
          <Avatar id={emp.id} name={empName(emp)} src={emp.avatar_url || null} size="w-16 h-16 text-lg" rounded="rounded-2xl" />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-extrabold tracking-tight truncate">{empName(emp)}</p>
            <p className="text-sm text-indigo-200 truncate">{emp.job_title || 'No title'}</p>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <StatusBadge status={emp.status} />
              <RoleBadge role={emp.role} />
            </div>
          </div>
          <button onClick={onClose} className="self-start w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10"><X size={16} /></button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
        {(emp.email || emp.phone_number) && (
          <div className="flex flex-wrap gap-2">
            {emp.email && (
              <a href={`mailto:${emp.email}`} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50 text-[#1e3a8a] hover:bg-indigo-100 transition-colors">
                <Mail size={14} /> Email
              </a>
            )}
            {emp.phone_number && (
              <a href={`tel:${emp.phone_number}`} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                <Phone size={14} /> Call
              </a>
            )}
            {emp.email && (
              <button onClick={copyEmail} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy email'}
              </button>
            )}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-x-4">
          {rows.map(r => (
            <div key={r.label} className="flex items-start gap-3 py-3 border-b border-gray-50">
              <span className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0"><r.Icon size={14} className="text-gray-400" /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{r.label}</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5 break-words">{r.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-gray-100 p-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <CalendarCheck size={12} /> Attendance this month
          </p>
          {!att ? (
            <div className="h-14 mt-3 rounded-lg bg-gray-50 animate-pulse" />
          ) : att.total === 0 ? (
            <p className="text-sm text-gray-400 mt-3">No attendance recorded yet this month.</p>
          ) : (
            <div className="grid grid-cols-5 gap-2 mt-3 text-center">
              {[
                ['Rate', att.rate == null ? '—' : `${Math.round(att.rate)}%`, 'text-gray-900'],
                ['Present', att.present, 'text-emerald-600'],
                ['Late', att.late, 'text-amber-600'],
                ['Absent', att.absent, 'text-rose-600'],
                ['Avg in', fmtClock(att.avgIn), 'text-gray-700'],
              ].map(([l, v, cls]) => (
                <div key={l}>
                  <p className={`text-lg font-extrabold leading-none ${cls}`}>{v}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{l}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        {months != null && months < 3 && (
          <p className="text-xs text-indigo-600 bg-indigo-50 rounded-xl px-3 py-2 flex items-center gap-2"><Sparkles size={13} /> New joiner — {tenureLabel(emp.hire_date)} with the team.</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
        <button onClick={remove} disabled={busy}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50
            ${confirm ? 'bg-red-500 text-white hover:bg-red-600' : 'text-red-500 hover:bg-red-50'}`}>
          <Trash2 size={14} /> {confirm ? 'Confirm delete' : 'Delete'}
        </button>
        <PrimaryButton onClick={onEdit}><Pencil size={14} /> Edit employee</PrimaryButton>
      </div>
    </Modal>
  )
}

// ── Add / edit form ───────────────────────────────────────────────────────────
function Field({ label, required, children, span }) {
  return (
    <label className={`block ${span ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-medium text-gray-500">{label}{required && <span className="text-rose-400"> *</span>}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function EmployeeForm({ emp, departments, titles, employees, onClose, onSubmit }) {
  const isEdit = !!emp
  const [form, setForm] = useState(() => emp ? {
    first_name: emp.first_name ?? '', last_name: emp.last_name ?? '', email: emp.email ?? '',
    role: emp.role ?? 'employee', status: emp.status ?? 'active', department_id: emp.department_id ?? '',
    job_title: emp.job_title ?? '', hire_date: emp.hire_date ?? TODAY, phone_number: emp.phone_number ?? '',
    avatar_url: emp.avatar_url ?? '',
  } : EMPTY_FORM)
  const [busy, setBusy]       = useState(false)
  const [photoBusy, setPhoto] = useState(false)
  const [error, setError]     = useState('')
  const fileRef = useRef(null)
  const set = patch => { setForm(f => ({ ...f, ...patch })); setError('') }

  const dupName = !isEdit && employees.some(e =>
    empName(e).toLowerCase() === `${form.first_name} ${form.last_name}`.trim().toLowerCase() && form.first_name.trim())
  const dupEmail = form.email.trim() && employees.some(e => e.id !== emp?.id && (e.email ?? '').toLowerCase() === form.email.trim().toLowerCase())

  async function pickPhoto(file) {
    if (!file) return
    setPhoto(true)
    try { set({ avatar_url: await fileToAvatar(file) }) } catch (err) { setError(err.message) }
    setPhoto(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) return setError('First and last name are required.')
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) return setError('Enter a valid email address.')
    if (dupEmail) return setError('Another employee already uses this email.')
    setBusy(true)
    try {
      await onSubmit({
        first_name: form.first_name.trim(), last_name: form.last_name.trim(),
        email: nullify(form.email.trim()), role: form.role, status: form.status,
        department_id: nullify(form.department_id), job_title: nullify(form.job_title.trim()),
        hire_date: nullify(form.hire_date), phone_number: nullify(form.phone_number.trim()), avatar_url: nullify(form.avatar_url),
      })
      onClose()
    } catch (err) {
      setError(err.message); setBusy(false)
    }
  }

  const name = `${form.first_name} ${form.last_name}`.trim() || 'New employee'

  return (
    <Modal as="form" onSubmit={submit} onClose={onClose} maxWidth="620px">
      <ModalHeader title={isEdit ? `Edit ${empName(emp)}` : 'Add employee'} sub={isEdit ? 'Update profile details' : 'Add a new member to the team'} onClose={onClose} />
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar id={emp?.id ?? name} name={name} src={form.avatar_url || null} size="w-16 h-16 text-lg" rounded="rounded-2xl" />
            {photoBusy && <div className="absolute inset-0 rounded-2xl bg-white/70 flex items-center justify-center"><Loader2 size={18} className="animate-spin text-[#1e3a8a]" /></div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">
              {form.avatar_url ? <Camera size={14} /> : <Upload size={14} />} {form.avatar_url ? 'Change photo' : 'Upload photo'}
            </button>
            {form.avatar_url && (
              <button type="button" onClick={() => set({ avatar_url: '' })} className="px-3 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50">Remove</button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => pickPhoto(e.target.files?.[0])} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="First name" required><input value={form.first_name} onChange={e => set({ first_name: e.target.value })} placeholder="Amina" className={INPUT_CLS} /></Field>
          <Field label="Last name" required><input value={form.last_name} onChange={e => set({ last_name: e.target.value })} placeholder="Hassan" className={INPUT_CLS} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={e => set({ email: e.target.value })} placeholder="amina@company.com" className={INPUT_CLS} /></Field>
          <Field label="Phone"><input type="tel" value={form.phone_number} onChange={e => set({ phone_number: e.target.value })} placeholder="+252 61 …" className={INPUT_CLS} /></Field>
          <Field label="Job title">
            <input list="emp-titles" value={form.job_title} onChange={e => set({ job_title: e.target.value })} placeholder="Software Engineer" className={INPUT_CLS} />
            <datalist id="emp-titles">{titles.map(t => <option key={t} value={t} />)}</datalist>
          </Field>
          <Field label="Department">
            <select value={form.department_id} onChange={e => set({ department_id: e.target.value })} className={INPUT_CLS}>
              <option value="">— Unassigned —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Role">
            <select value={form.role} onChange={e => set({ role: e.target.value })} className={INPUT_CLS}>
              {Object.entries(EMP_ROLE).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="Hire date"><input type="date" value={form.hire_date ?? ''} onChange={e => set({ hire_date: e.target.value })} className={INPUT_CLS} /></Field>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Status</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {EMP_STATUS_KEYS.map(k => {
              const m = EMP_STATUS[k]
              const on = form.status === k
              return (
                <button key={k} type="button" onClick={() => set({ status: k })}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-all
                    ${on ? `${m.badge} border-transparent` : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} /> {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {dupName && (
          <p className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <AlertTriangle size={14} /> An employee named {name} already exists.
          </p>
        )}
        <ErrorNote>{error}</ErrorNote>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
        <PrimaryButton type="submit" disabled={busy || photoBusy} busy={busy}>{isEdit ? 'Save changes' : 'Add employee'}</PrimaryButton>
      </div>
    </Modal>
  )
}

function MoveModal({ count, departments, onClose, onSubmit }) {
  const [deptId, setDeptId] = useState('')
  const [busy, setBusy] = useState(false)
  async function go(e) {
    e.preventDefault(); setBusy(true)
    try { await onSubmit(deptId || null); onClose() } catch { setBusy(false) }
  }
  return (
    <Modal as="form" onSubmit={go} onClose={onClose} maxWidth="420px">
      <ModalHeader title="Move to department" sub={`${count} employee${count !== 1 ? 's' : ''} selected`} onClose={onClose} />
      <div className="px-6 py-5">
        <select value={deptId} onChange={e => setDeptId(e.target.value)} className={INPUT_CLS}>
          <option value="">— Unassigned —</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
        <PrimaryButton type="submit" disabled={busy} busy={busy}>Move</PrimaryButton>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
export default function EmployeesPage() {
  const [employees,   setEmployees]   = useState([])
  const [departments, setDepartments] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [cleaning,    setCleaning]    = useState(false)
  const [search,      setSearch]      = useState('')
  const [dept,        setDept]        = useState('all')
  const [filter,      setFilter]      = useState('all')
  const [sort,        setSort]        = useState('name')
  const [view,        setView]        = useState(readView)
  const [form,        setForm]        = useState(null)   // { emp? }
  const [viewing,     setViewing]     = useState(null)   // employee id
  const [moving,      setMoving]      = useState(false)
  const [bulkBusy,    setBulkBusy]    = useState(false)
  const [toast, showToast, dismissToast] = useToast()
  const [armed, fire] = useArmed()
  const { selected, toggle, toggleAll, clear } = useSelection()
  const reqId = useRef(0)

  const fetchData = useCallback(async (soft = false) => {
    const id = ++reqId.current
    soft ? setRefreshing(true) : setLoading(true)
    try {
      const [emps, depts] = await Promise.all([db.getEmployees(), db.getDepartments()])
      if (id !== reqId.current) return
      setEmployees(emps); setDepartments(depts)
    } catch (err) {
      if (id === reqId.current) showToast('error', err.message)
    }
    if (id === reqId.current) { setLoading(false); setRefreshing(false) }
  }, [showToast])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { try { localStorage.setItem('emp_view', view) } catch {} }, [view])

  // Deep links from the dashboard / command palette: ?new=1, ?view=<id>, ?q=<text>
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    if (params.get('q')) setSearch(params.get('q'))
    if (params.get('new')) { setForm({}); setParams({}, { replace: true }) }
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = params.get('view')
    if (!id || !employees.length) return
    if (employees.some(e => e.id === id)) setViewing(id)
    setParams({}, { replace: true })
  }, [employees, params]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──
  const dupIds  = useMemo(() => findDuplicates(employees), [employees])
  const unique  = useMemo(() => employees.filter(e => !dupIds.includes(e.id)), [employees, dupIds])
  const deptNames = useMemo(() => [...new Set(unique.map(e => e.departments?.name).filter(Boolean))].sort(), [unique])
  const titles  = useMemo(() => [...new Set(unique.map(e => e.job_title).filter(Boolean))].sort(), [unique])

  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase()
    return unique.filter(e =>
      (dept === 'all' || (dept === '__none' ? !e.departments?.name : e.departments?.name === dept)) &&
      (!q || [empName(e), e.email, e.job_title, e.departments?.name, e.phone_number].some(v => (v ?? '').toLowerCase().includes(q))),
    )
  }, [unique, search, dept])

  const visible = useMemo(
    () => (filter === 'all' ? scoped : scoped.filter(e => e.status === filter)).sort(SORTS[sort].fn),
    [scoped, filter, sort],
  )

  const stats = useMemo(() => {
    const by = Object.fromEntries(EMP_STATUS_KEYS.map(k => [k, unique.filter(e => e.status === k).length]))
    const active = unique.filter(e => e.status === 'active')
    const tenures = active.map(e => tenureMonths(e.hire_date)).filter(v => v != null)
    const ago30 = toDateStr(new Date(Date.now() - 30 * 864e5))
    return {
      total: unique.length, by,
      pct: unique.length ? Math.round((by.active / unique.length) * 100) : 0,
      newHires: active.filter(e => e.hire_date && e.hire_date > ago30).length,
      avgTenure: tenures.length ? tenures.reduce((s, v) => s + v, 0) / tenures.length / 12 : null,
      unassigned: active.filter(e => !e.departments?.name).length,
    }
  }, [unique])

  const selectedRows  = unique.filter(e => selected.has(e.id))
  const allVisibleSel = visible.length > 0 && visible.every(e => selected.has(e.id))
  const viewingEmp    = viewing ? employees.find(e => e.id === viewing) : null

  // ── Mutations ──
  async function saveEmployee(payload) {
    if (form?.emp) {
      await db.updateEmployee(form.emp.id, payload)
      showToast('success', `${payload.first_name} ${payload.last_name} updated`)
    } else {
      await db.addEmployee(payload)
      showToast('success', `${payload.first_name} ${payload.last_name} added`)
    }
    fetchData(true)
  }

  async function deleteEmployees(list) {
    const ids = list.map(e => e.id)
    await db.batchDeleteEmployees(ids)
    setEmployees(es => es.filter(e => !ids.includes(e.id)))
    clear()
    showToast('success', list.length === 1 ? `${empName(list[0])} deleted` : `${list.length} employees deleted`)
  }

  async function bulkPatch(patch, label) {
    if (!selectedRows.length) return
    setBulkBusy(true)
    try {
      const written = await db.batchUpdateEmployees(selectedRows.map(e => e.id), patch)
      const ids = new Set(selectedRows.map(e => e.id))
      setEmployees(es => es.map(e => (ids.has(e.id) ? { ...e, ...written } : e)))
      showToast('success', `${ids.size} employee${ids.size !== 1 ? 's' : ''} ${label}`)
      clear()
    } catch (err) {
      showToast('error', err.message)
    }
    setBulkBusy(false)
  }

  async function bulkDelete() {
    if (!fire('bulk-del')) return
    setBulkBusy(true)
    try { await deleteEmployees(selectedRows) } catch (err) { showToast('error', err.message) }
    setBulkBusy(false)
  }

  async function rowDelete(emp) {
    if (!fire(`del-${emp.id}`)) return
    try { await deleteEmployees([emp]) } catch (err) { showToast('error', err.message) }
  }

  async function cleanDuplicates() {
    setCleaning(true)
    try {
      await db.batchDeleteEmployees(dupIds)
      showToast('success', `Removed ${dupIds.length} duplicate record${dupIds.length !== 1 ? 's' : ''}`)
      await fetchData(true)
    } catch (err) { showToast('error', err.message) }
    setCleaning(false)
  }

  function exportCSV(list = visible) {
    downloadCSV(list.map(e => ({
      Name: empName(e), Email: e.email ?? '', Phone: e.phone_number ?? '', 'Job Title': e.job_title ?? '',
      Department: e.departments?.name ?? '', Role: EMP_ROLE[e.role]?.label ?? e.role ?? '',
      Status: EMP_STATUS[e.status]?.label ?? e.status ?? '', 'Hire Date': e.hire_date ?? '', Tenure: tenureLabel(e.hire_date),
    })), `employees-${TODAY}.csv`)
  }

  const FILTERS = [
    { key: 'all', label: 'All', dot: 'bg-gray-400', count: scoped.length },
    ...EMP_STATUS_KEYS.map(k => ({ key: k, label: EMP_STATUS[k].label, dot: EMP_STATUS[k].dot, count: scoped.filter(e => e.status === k).length })),
  ]
  const toggleFilter = f => setFilter(cur => (cur === f ? 'all' : f))
  const pctOf = n => (stats.total ? Math.round((n / stats.total) * 100) : 0)

  // ── Row bits ──
  const personCell = e => (
    <div className="flex items-center gap-3 min-w-[220px]">
      <Avatar id={e.id} name={empName(e)} src={e.avatar_url || null} />
      <div className="min-w-0">
        <p className="font-semibold text-gray-800 truncate">{empName(e)}</p>
        <p className="text-xs text-gray-400 truncate">{e.email ?? 'No email'}</p>
      </div>
    </div>
  )
  const actions = e => (
    <div className="flex items-center justify-end gap-0.5" onClick={ev => ev.stopPropagation()}>
      <button onClick={() => setViewing(e.id)} title="View profile" className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#1e3a8a]"><Eye size={15} /></button>
      <button onClick={() => setForm({ emp: e })} title="Edit" className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#1e3a8a]"><Pencil size={15} /></button>
      <button onClick={() => rowDelete(e)} title={armed === `del-${e.id}` ? 'Click again to confirm' : 'Delete'}
        className={`h-8 rounded-lg inline-flex items-center justify-center gap-1 transition-colors ${armed === `del-${e.id}` ? 'px-2 bg-red-500 text-white text-xs font-semibold' : 'w-8 text-gray-400 hover:bg-red-50 hover:text-red-500'}`}>
        <Trash2 size={15} />{armed === `del-${e.id}` && 'Confirm'}
      </button>
    </div>
  )

  // ── Render ──
  return (
    <div className="space-y-5 pb-24">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Employees</h2>
          <p className="text-sm text-gray-400 mt-1">Your team directory · profiles, roles and status</p>
        </div>
        <button onClick={() => setForm({})}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#1e3a8a] text-white hover:bg-[#162d6e] shadow-sm transition-colors">
          <UserPlus size={16} /> Add employee
        </button>
      </div>

      {dupIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <span className="flex items-center gap-2.5"><AlertTriangle size={16} className="shrink-0" />
            {dupIds.length} duplicate record{dupIds.length !== 1 ? 's' : ''} found (same name) — hidden from the list.
          </span>
          <button onClick={cleanDuplicates} disabled={cleaning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-60">
            {cleaning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Remove duplicates
          </button>
        </div>
      )}

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <HeroCard
          ring={<RateRing pct={stats.pct} label="active" />}
          eyebrow="Workforce"
          headline={`${stats.by.active ?? 0} active`}
          sub={`${stats.total} people · ${departments.length} departments`}
          stats={[
            { label: 'New (30d)',  value: stats.newHires, Icon: UserPlus },
            { label: 'Avg tenure', value: stats.avgTenure == null ? '—' : `${stats.avgTenure.toFixed(1)} yrs`, Icon: CalendarRange },
          ]}
        />
        <StatCard label="Active" value={stats.by.active} pct={pctOf(stats.by.active)} sub={stats.unassigned ? `${stats.unassigned} without department` : 'All assigned'}
          Icon={UserCheck} iconCls={EMP_STATUS.active.icon} barCls={EMP_STATUS.active.bar}
          active={filter === 'active'} onClick={() => toggleFilter('active')} />
        <StatCard label="Inactive" value={stats.by.inactive} pct={pctOf(stats.by.inactive)}
          Icon={UserMinus} iconCls={EMP_STATUS.inactive.icon} barCls={EMP_STATUS.inactive.bar}
          active={filter === 'inactive'} onClick={() => toggleFilter('inactive')} />
        <StatCard label="Suspended" value={stats.by.suspended} pct={pctOf(stats.by.suspended)}
          Icon={Ban} iconCls={EMP_STATUS.suspended.icon} barCls={EMP_STATUS.suspended.bar}
          active={filter === 'suspended'} onClick={() => toggleFilter('suspended')} />
        <StatCard label="Terminated" value={stats.by.terminated} pct={pctOf(stats.by.terminated)}
          Icon={UserX} iconCls={EMP_STATUS.terminated.icon} barCls={EMP_STATUS.terminated.bar}
          active={filter === 'terminated'} onClick={() => toggleFilter('terminated')} />
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2.5">
            <SearchBox value={search} onChange={setSearch} placeholder="Search name, email, title, phone…" />
            <select value={dept} onChange={e => setDept(e.target.value)}
              className="md:w-48 px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]">
              <option value="all">All departments</option>
              {deptNames.map(d => <option key={d} value={d}>{d}</option>)}
              <option value="__none">Unassigned</option>
            </select>
            <div className="relative md:w-44">
              <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select value={sort} onChange={e => setSort(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]">
                {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center p-1 bg-gray-50 rounded-xl border border-gray-200">
                {[['table', List], ['grid', LayoutGrid]].map(([k, Icon]) => (
                  <button key={k} onClick={() => setView(k)} title={`${k} view`}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${view === k ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}>
                    <Icon size={15} />
                  </button>
                ))}
              </div>
              <ToolButton onClick={() => exportCSV()} disabled={!visible.length} title="Export CSV">
                <Download size={15} /> <span className="hidden sm:inline">Export</span>
              </ToolButton>
              <ToolButton onClick={() => fetchData(true)} title="Refresh" className="!px-2.5">
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              </ToolButton>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <FilterPills items={FILTERS} value={filter} onChange={setFilter} />
            {view === 'grid' && visible.length > 0 && (
              <button onClick={() => toggleAll(visible.map(e => e.id), allVisibleSel)} className="text-xs font-semibold text-[#1e3a8a] hover:underline whitespace-nowrap">
                {allVisibleSel ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
        </div>

        {loading ? <SkeletonRows /> : visible.length === 0 ? (
          <EmptyState Icon={Users}
            title={unique.length === 0 ? 'No employees yet' : 'No employees match these filters'}
            sub={unique.length === 0 ? 'Add your first team member to get started.' : null}
            action={unique.length === 0
              ? <button onClick={() => setForm({})} className="text-xs font-semibold text-[#1e3a8a] hover:underline">Add employee</button>
              : <button onClick={() => { setSearch(''); setDept('all'); setFilter('all') }} className="text-xs font-semibold text-[#1e3a8a] hover:underline">Clear filters</button>} />
        ) : view === 'grid' ? (
          <div className="p-4 grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map(e => {
              const isSel = selected.has(e.id)
              return (
                <div key={e.id} onClick={() => setViewing(e.id)}
                  className={`group cursor-pointer rounded-2xl border p-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${isSel ? 'border-[#1e3a8a] ring-2 ring-[#1e3a8a]/15 bg-indigo-50/30' : 'border-gray-100 bg-white'}`}>
                  <div className="flex items-start gap-3">
                    <span onClick={ev => ev.stopPropagation()}><Checkbox checked={isSel} onChange={() => toggle(e.id)} /></span>
                    <Avatar id={e.id} name={empName(e)} src={e.avatar_url || null} size="w-12 h-12 text-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 truncate">{empName(e)}</p>
                      <p className="text-xs text-gray-400 truncate">{e.job_title || 'No title'}</p>
                      <div className="mt-2"><StatusBadge status={e.status} /></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                    <div className="rounded-lg bg-gray-50 px-2.5 py-2 min-w-0"><p className="text-[10px] text-gray-400">Department</p><p className="font-semibold text-gray-700 truncate">{e.departments?.name ?? '—'}</p></div>
                    <div className="rounded-lg bg-gray-50 px-2.5 py-2"><p className="text-[10px] text-gray-400">Tenure</p><p className="font-semibold text-gray-700">{tenureLabel(e.hire_date)}</p></div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    <div className="flex gap-1" onClick={ev => ev.stopPropagation()}>
                      {e.email && <a href={`mailto:${e.email}`} title={e.email} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-indigo-50 hover:text-[#1e3a8a]"><Mail size={14} /></a>}
                      {e.phone_number && <a href={`tel:${e.phone_number}`} title={e.phone_number} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"><Phone size={14} /></a>}
                    </div>
                    {actions(e)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="pl-5 pr-2 py-3 w-10"><Checkbox checked={allVisibleSel} onChange={() => toggleAll(visible.map(e => e.id), allVisibleSel)} /></th>
                    <Th>Employee</Th><Th>Job title</Th><Th>Department</Th><Th>Role</Th><Th>Status</Th><Th>Tenure</Th><Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visible.map(e => {
                    const isSel = selected.has(e.id)
                    return (
                      <tr key={e.id} onClick={() => setViewing(e.id)}
                        className={`cursor-pointer transition-colors ${isSel ? 'bg-indigo-50/50' : 'hover:bg-gray-50/60'}`}>
                        <td className="pl-5 pr-2 py-3" onClick={ev => ev.stopPropagation()}><Checkbox checked={isSel} onChange={() => toggle(e.id)} /></td>
                        <td className="px-4 py-3">{personCell(e)}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{e.job_title ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{e.departments?.name ?? <span className="text-gray-300">Unassigned</span>}</td>
                        <td className="px-4 py-3"><RoleBadge role={e.role} /></td>
                        <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-xs font-semibold text-gray-700">{tenureLabel(e.hire_date)}</p>
                          <p className="text-[11px] text-gray-400">{e.hire_date ? fmtDate(e.hire_date) : '—'}</p>
                        </td>
                        <td className="pr-5 pl-2 py-3">{actions(e)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {visible.map(e => {
                const isSel = selected.has(e.id)
                return (
                  <div key={e.id} onClick={() => setViewing(e.id)} className={`p-4 space-y-2.5 ${isSel ? 'bg-indigo-50/50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span onClick={ev => ev.stopPropagation()}><Checkbox checked={isSel} onChange={() => toggle(e.id)} /></span>
                      <div className="flex-1 min-w-0">{personCell(e)}</div>
                      <StatusBadge status={e.status} />
                    </div>
                    <div className="flex items-center justify-between gap-2 pl-7">
                      <p className="text-xs text-gray-500 truncate">{[e.job_title, e.departments?.name].filter(Boolean).join(' · ') || '—'}</p>
                      {actions(e)}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
        {!loading && visible.length > 0 && <ListFooter shown={visible.length} total={unique.length} noun="employees" />}
      </div>

      <BulkBar count={selectedRows.length} busy={bulkBusy} onClear={clear}>
        {EMP_STATUS_KEYS.map(k => (
          <BulkAction key={k} dot={EMP_STATUS[k].dot} title={`Set ${EMP_STATUS[k].label}`} disabled={bulkBusy}
            onClick={() => bulkPatch({ status: k }, `set to ${EMP_STATUS[k].label}`)}>{EMP_STATUS[k].label}</BulkAction>
        ))}
        <BulkAction Icon={FolderInput} disabled={bulkBusy} onClick={() => setMoving(true)}>Move</BulkAction>
        <BulkAction Icon={Download} disabled={bulkBusy} onClick={() => exportCSV(selectedRows)}>Export</BulkAction>
        <BulkAction Icon={Trash2} danger disabled={bulkBusy} onClick={bulkDelete}>
          {armed === 'bulk-del' ? `Confirm · ${selectedRows.length}` : 'Delete'}
        </BulkAction>
      </BulkBar>

      {viewingEmp && (
        <ProfileModal emp={viewingEmp} onClose={() => setViewing(null)}
          onEdit={() => { setViewing(null); setForm({ emp: viewingEmp }) }}
          onDelete={async e => { try { await deleteEmployees([e]) } catch (err) { showToast('error', err.message); throw err } }} />
      )}
      {form && (
        <EmployeeForm emp={form.emp} departments={departments} titles={titles} employees={unique}
          onClose={() => setForm(null)} onSubmit={saveEmployee} />
      )}
      {moving && (
        <MoveModal count={selectedRows.length} departments={departments} onClose={() => setMoving(false)}
          onSubmit={deptId => bulkPatch({ department_id: deptId }, deptId ? `moved to ${departments.find(d => d.id === deptId)?.name}` : 'unassigned')} />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
