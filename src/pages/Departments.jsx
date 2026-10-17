/**
 * Departments — org structure: department cards with head, team, today's
 * attendance and (for payroll roles) salary cost; manage members (move / add),
 * unassigned employees, colours and department heads.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import * as db from '../lib/db'
import {
  Building2, Plus, Pencil, Trash2, Users, UserCheck, Crown, Search, Download, RefreshCw,
  ArrowUpDown, CalendarCheck, Wallet, UserPlus, Inbox, Check, ChevronRight, Layers, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  useToast, useArmed, downloadCSV, Toast, HeroCard, RateRing, StatCard, SearchBox, ToolButton, EmptyState,
  Avatar, Modal, ModalHeader, ErrorNote, PrimaryButton, INPUT_CLS, Checkbox,
} from '../components/ui'
import { DEPT_THEMES, deptTheme, empName, findDuplicates, EMP_STATUS } from '../lib/people'
import { ATTENDED, toDateStr } from '../lib/attendance'

const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const money = n => USD0.format(Number(n) || 0)
const TODAY = toDateStr(new Date())

const SORTS = {
  name:  { label: 'Name A–Z',     fn: (a, b) => a.dept.name.localeCompare(b.dept.name) },
  size:  { label: 'Largest team', fn: (a, b) => b.members.length - a.members.length },
  rate:  { label: 'Attendance',   fn: (a, b) => (b.rate ?? -1) - (a.rate ?? -1) },
}

function AvatarStack({ people, max = 5 }) {
  const shown = people.slice(0, max)
  return (
    <div className="flex items-center">
      {shown.map((e, i) => (
        <span key={e.id} className="ring-2 ring-white rounded-full" style={{ marginLeft: i ? -8 : 0, zIndex: max - i }}>
          <Avatar id={e.id} name={empName(e)} src={e.avatar_url || null} size="w-7 h-7 text-[10px]" rounded="rounded-full" />
        </span>
      ))}
      {people.length > max && (
        <span className="ring-2 ring-white rounded-full w-7 h-7 bg-gray-100 text-[10px] font-bold text-gray-500 flex items-center justify-center" style={{ marginLeft: -8 }}>
          +{people.length - max}
        </span>
      )}
      {!people.length && <span className="text-xs text-gray-300">No members yet</span>}
    </div>
  )
}

// ── Form ──────────────────────────────────────────────────────────────────────
function DeptForm({ dept, index, departments, employees, onClose, onSubmit }) {
  const isEdit = !!dept
  const [form, setForm] = useState({
    name: dept?.name ?? '', description: dept?.description ?? '',
    color: Number.isInteger(dept?.color) ? dept.color : index % DEPT_THEMES.length,
    head_id: dept?.head_id ?? '',
  })
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const set = p => { setForm(f => ({ ...f, ...p })); setError('') }

  async function submit(e) {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) return setError('Department name is required.')
    if (departments.some(d => d.id !== dept?.id && d.name.toLowerCase() === name.toLowerCase())) return setError('A department with this name already exists.')
    setBusy(true)
    try {
      await onSubmit({ name, description: form.description.trim() || null, color: form.color, head_id: form.head_id || null })
      onClose()
    } catch (err) { setError(err.message); setBusy(false) }
  }

  const theme = DEPT_THEMES[form.color]
  return (
    <Modal as="form" onSubmit={submit} onClose={onClose} maxWidth="520px">
      <ModalHeader title={isEdit ? `Edit ${dept.name}` : 'New department'} sub={isEdit ? 'Update details, colour and head' : 'Add a unit to your organisation'} onClose={onClose} />
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
        <div className="flex items-center gap-3 rounded-xl p-3 text-white" style={{ background: theme.gradient }}>
          <span className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Building2 size={18} /></span>
          <div className="min-w-0">
            <p className="font-bold truncate">{form.name || 'Department name'}</p>
            <p className="text-xs text-white/80 truncate">{form.description || 'Description'}</p>
          </div>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Name <span className="text-rose-400">*</span></span>
          <input value={form.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. Engineering" className={`${INPUT_CLS} mt-1`} maxLength={40} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Description</span>
          <textarea rows={2} value={form.description} onChange={e => set({ description: e.target.value })} placeholder="What does this team do?" className={`${INPUT_CLS} mt-1 resize-none`} maxLength={200} />
        </label>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Colour</p>
          <div className="flex gap-2">
            {DEPT_THEMES.map((t, i) => (
              <button key={t.name} type="button" title={t.name} onClick={() => set({ color: i })}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-white transition-transform ${form.color === i ? 'ring-2 ring-offset-2 ring-gray-900 scale-105' : 'hover:scale-105'}`}
                style={{ background: t.gradient }}>
                {form.color === i && <Check size={15} />}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><Crown size={12} /> Head of department</span>
          <select value={form.head_id} onChange={e => set({ head_id: e.target.value })} className={`${INPUT_CLS} mt-1`}>
            <option value="">— None —</option>
            {employees.filter(e => e.status === 'active').map(e => (
              <option key={e.id} value={e.id}>{empName(e)}{e.departments?.name ? ` · ${e.departments.name}` : ''}</option>
            ))}
          </select>
        </label>
        <ErrorNote>{error}</ErrorNote>
      </div>
      <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
        <PrimaryButton type="submit" disabled={busy} busy={busy}>{isEdit ? 'Save changes' : 'Create department'}</PrimaryButton>
      </div>
    </Modal>
  )
}

// ── Team modal (a department, or the unassigned pool) ─────────────────────────
function TeamModal({ card, departments, employees, canPay, onClose, onEdit, onDelete, onMove, onSetHead }) {
  const { dept, members } = card
  const [q, setQ]           = useState('')
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState(() => new Set())
  const [busy, setBusy]     = useState(false)
  const [confirm, setConfirm] = useState(false)
  const theme = dept ? card.theme : { gradient: 'linear-gradient(135deg,#475569,#64748b)' }

  const list = members.filter(e => !q || empName(e).toLowerCase().includes(q.toLowerCase()) || (e.job_title ?? '').toLowerCase().includes(q.toLowerCase()))
  const candidates = employees.filter(e => e.department_id !== dept?.id && e.status === 'active')

  async function run(fn) { setBusy(true); try { await fn() } finally { setBusy(false) } }

  return (
    <Modal onClose={onClose} maxWidth="620px">
      <div className="relative shrink-0 rounded-t-2xl overflow-hidden text-white" style={{ background: theme.gradient }}>
        <div className="absolute inset-0 opacity-25" style={{ background: 'radial-gradient(ellipse at 10% 10%, white 0%, transparent 55%)' }} />
        <div className="relative px-6 py-5 flex items-start gap-4">
          <span className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">{dept ? <Building2 size={22} /> : <Inbox size={22} />}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-extrabold tracking-tight truncate">{dept?.name ?? 'Unassigned employees'}</p>
            <p className="text-sm text-white/80 line-clamp-2">{dept ? dept.description || 'No description' : 'Active employees without a department'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15"><X size={16} /></button>
        </div>
        {dept && (
          <div className="relative grid grid-cols-4 gap-2 px-6 pb-5">
            {[
              ['Members', members.length],
              ['Active', card.active],
              ['In today', card.rate == null ? '—' : `${card.rate}%`],
              [canPay ? 'Avg salary' : 'Head', canPay ? (card.avgSalary ? money(card.avgSalary) : '—') : (card.head ? empName(card.head).split(' ')[0] : '—')],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-white/15 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-white/70">{l}</p>
                <p className="text-sm font-bold truncate">{v}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search members…" className={`${INPUT_CLS} pl-9`} />
          </div>
          {dept && (
            <button onClick={() => { setAdding(a => !a); setPicked(new Set()) }}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${adding ? 'bg-[#1e3a8a] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <UserPlus size={15} /> Add
            </button>
          )}
        </div>

        {adding && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">Add active employees to {dept.name}</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {candidates.length === 0 ? <p className="text-xs text-gray-400 py-2">Everyone is already here.</p> : candidates.map(e => (
                <label key={e.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer">
                  <Checkbox checked={picked.has(e.id)} onChange={() => setPicked(s => { const n = new Set(s); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n })} />
                  <Avatar id={e.id} name={empName(e)} src={e.avatar_url || null} size="w-7 h-7 text-[10px]" rounded="rounded-full" />
                  <span className="text-sm font-medium text-gray-700 flex-1 truncate">{empName(e)}</span>
                  <span className="text-[11px] text-gray-400 truncate">{e.departments?.name ?? 'Unassigned'}</span>
                </label>
              ))}
            </div>
            {candidates.length > 0 && (
              <div className="flex justify-end mt-2">
                <PrimaryButton disabled={!picked.size || busy} busy={busy}
                  onClick={() => run(async () => { await onMove([...picked], dept.id); setAdding(false); setPicked(new Set()) })}>
                  Add {picked.size || ''}
                </PrimaryButton>
              </div>
            )}
          </div>
        )}

        {list.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2 text-gray-400">
            <Users size={26} className="text-gray-300" />
            <p className="text-sm">{members.length ? 'No members match' : dept ? 'No members yet — use Add' : 'Everyone has a department'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {list.map(e => {
              const isHead = dept && dept.head_id === e.id
              return (
                <div key={e.id} className="flex items-center gap-3 py-2.5">
                  <Avatar id={e.id} name={empName(e)} src={e.avatar_url || null} size="w-9 h-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate flex items-center gap-1.5">
                      {empName(e)}
                      {isHead && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700"><Crown size={10} /> Head</span>}
                      {e.status !== 'active' && <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${EMP_STATUS[e.status]?.badge ?? ''}`}>{EMP_STATUS[e.status]?.label}</span>}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">{e.job_title || 'No title'}</p>
                  </div>
                  {dept && !isHead && e.status === 'active' && (
                    <button onClick={() => run(() => onSetHead(dept, e.id))} disabled={busy} title="Make head of department"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-amber-500 hover:bg-amber-50"><Crown size={14} /></button>
                  )}
                  <select value={e.department_id ?? ''} disabled={busy}
                    onChange={ev => run(() => onMove([e.id], ev.target.value || null))}
                    className="w-36 px-2 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20">
                    <option value="">Unassigned</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {dept && (
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={() => (confirm ? run(async () => { await onDelete(dept); onClose() }) : setConfirm(true))} disabled={busy}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 ${confirm ? 'bg-red-500 text-white hover:bg-red-600' : 'text-red-500 hover:bg-red-50'}`}>
            <Trash2 size={14} /> {confirm ? `Confirm — unassigns ${members.length}` : 'Delete department'}
          </button>
          <PrimaryButton onClick={onEdit}><Pencil size={14} /> Edit</PrimaryButton>
        </div>
      )}
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
export default function DepartmentsPage() {
  const { canAccessPayroll } = useAuth()
  const [departments, setDepartments] = useState([])
  const [employees,   setEmployees]   = useState([])
  const [todayAtt,    setTodayAtt]    = useState([])
  const [configs,     setConfigs]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [search,      setSearch]      = useState('')
  const [sort,        setSort]        = useState('name')
  const [form,        setForm]        = useState(null)    // { dept?, index }
  const [openId,      setOpenId]      = useState(null)    // dept id | '__none'
  const [toast, showToast, dismissToast] = useToast()
  const [armed, fire] = useArmed()
  const reqId = useRef(0)

  const fetchData = useCallback(async (soft = false) => {
    const id = ++reqId.current
    soft ? setRefreshing(true) : setLoading(true)
    try {
      const [depts, emps, att, cfgs] = await Promise.all([
        db.getDepartments(), db.getEmployees(), db.getAttendanceByDate(TODAY),
        canAccessPayroll ? db.getSalaryConfigs() : Promise.resolve([]),
      ])
      if (id !== reqId.current) return
      setDepartments(depts); setEmployees(emps); setTodayAtt(att); setConfigs(cfgs)
    } catch (err) {
      if (id === reqId.current) showToast('error', err.message)
    }
    if (id === reqId.current) { setLoading(false); setRefreshing(false) }
  }, [canAccessPayroll, showToast])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived ──
  const unique = useMemo(() => {
    const dup = new Set(findDuplicates(employees))
    return employees.filter(e => !dup.has(e.id))
  }, [employees])

  const cards = useMemo(() => {
    const attBy  = Object.fromEntries(todayAtt.map(a => [a.employee_id, a.status]))
    const salary = Object.fromEntries(configs.map(c => [c.employee_id, Number(c.basic_salary) || 0]))
    const build = (dept, idx, members) => {
      const active  = members.filter(e => e.status === 'active')
      const holiday = active.filter(e => attBy[e.id] === 'holiday').length
      const inToday = active.filter(e => ATTENDED.includes(attBy[e.id])).length
      const sal     = active.map(e => salary[e.id]).filter(v => v > 0)
      return {
        dept, theme: deptTheme(dept, idx), members, active: active.length, inToday,
        rate: active.length - holiday > 0 ? Math.round((inToday / (active.length - holiday)) * 100) : null,
        payroll: sal.reduce((s, v) => s + v, 0), avgSalary: sal.length ? sal.reduce((s, v) => s + v, 0) / sal.length : null,
        head: dept?.head_id ? unique.find(e => e.id === dept.head_id) : null,
      }
    }
    return departments.map((d, i) => build(d, i, unique.filter(e => e.department_id === d.id)))
  }, [departments, unique, todayAtt, configs])

  const known = new Set(departments.map(d => d.id))
  const unassigned = unique.filter(e => e.status === 'active' && (!e.department_id || !known.has(e.department_id)))

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cards.filter(c => !q || c.dept.name.toLowerCase().includes(q) || (c.dept.description ?? '').toLowerCase().includes(q)).sort(SORTS[sort].fn)
  }, [cards, search, sort])

  const stats = useMemo(() => {
    const active   = unique.filter(e => e.status === 'active')
    const assigned = active.length - unassigned.length
    const largest  = cards.reduce((b, c) => (!b || c.members.length > b.members.length ? c : b), null)
    const inToday  = cards.reduce((s, c) => s + c.inToday, 0)
    return {
      active: active.length, assigned,
      pct: active.length ? Math.round((assigned / active.length) * 100) : 0,
      largest, avgTeam: cards.length ? assigned / cards.length : 0,
      inToday, rateToday: active.length ? Math.round((inToday / active.length) * 100) : 0,
      payroll: cards.reduce((s, c) => s + c.payroll, 0),
    }
  }, [unique, unassigned.length, cards])

  const openCard = openId === '__none'
    ? { dept: null, members: unassigned }
    : cards.find(c => c.dept.id === openId) ?? null

  // ── Mutations ──
  async function saveDept(payload) {
    if (form?.dept) {
      await db.updateDepartment(form.dept.id, payload)
      showToast('success', `${payload.name} updated`)
    } else {
      await db.addDepartment(payload)
      showToast('success', `${payload.name} created`)
    }
    fetchData(true)
  }

  async function deleteDept(dept) {
    try {
      await db.deleteDepartment(dept.id)
      showToast('success', `${dept.name} deleted · members unassigned`)
      fetchData(true)
    } catch (err) { showToast('error', err.message); throw err }
  }

  async function moveEmployees(ids, deptId) {
    try {
      const patch = await db.batchUpdateEmployees(ids, { department_id: deptId })
      setEmployees(es => es.map(e => (ids.includes(e.id) ? { ...e, ...patch } : e)))
      const target = deptId ? departments.find(d => d.id === deptId)?.name : 'Unassigned'
      showToast('success', `${ids.length === 1 ? empName(employees.find(e => e.id === ids[0])) : `${ids.length} employees`} → ${target}`)
    } catch (err) { showToast('error', err.message) }
  }

  async function setHead(dept, empId) {
    try {
      await db.updateDepartment(dept.id, { head_id: empId })
      setDepartments(ds => ds.map(d => (d.id === dept.id ? { ...d, head_id: empId } : d)))
      showToast('success', `${empName(employees.find(e => e.id === empId))} is now head of ${dept.name}`)
    } catch (err) { showToast('error', err.message) }
  }

  async function quickDelete(c) {
    if (!fire(`del-${c.dept.id}`)) return
    try { await deleteDept(c.dept) } catch {}
  }

  function exportCSV() {
    downloadCSV(visible.map(c => ({
      Department: c.dept.name, Description: c.dept.description ?? '', Head: c.head ? empName(c.head) : '',
      Members: c.members.length, Active: c.active, 'In Today': c.inToday, 'Attendance %': c.rate ?? '',
      ...(canAccessPayroll ? { 'Monthly Base Payroll': c.payroll, 'Avg Salary': c.avgSalary ? Math.round(c.avgSalary) : '' } : {}),
    })), `departments-${TODAY}.csv`)
  }

  // ── Render ──
  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Departments</h2>
          <p className="text-sm text-gray-400 mt-1">Teams, heads and who works where</p>
        </div>
        <button onClick={() => setForm({ index: departments.length })}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#1e3a8a] text-white hover:bg-[#162d6e] shadow-sm transition-colors">
          <Plus size={16} /> New department
        </button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <HeroCard
          ring={<RateRing pct={stats.pct} label="assigned" />}
          eyebrow="Organisation"
          headline={`${departments.length} department${departments.length !== 1 ? 's' : ''}`}
          sub={`${stats.assigned} of ${stats.active} active employees assigned`}
          stats={[
            { label: 'Largest',  value: stats.largest ? `${stats.largest.dept.name} (${stats.largest.members.length})` : '—', Icon: Layers },
            { label: 'Avg team', value: stats.avgTeam ? stats.avgTeam.toFixed(1) : '—', Icon: Users },
          ]}
        />
        <StatCard label="Active employees" value={stats.active} Icon={UserCheck} iconCls="bg-emerald-50 text-emerald-500" sub={`${stats.assigned} in a department`} />
        <StatCard label="Unassigned" value={unassigned.length} Icon={Inbox} iconCls="bg-amber-50 text-amber-500"
          sub={unassigned.length ? 'Click to assign' : 'Everyone placed'} onClick={() => setOpenId('__none')} active={openId === '__none'} />
        <StatCard label="In today" value={`${stats.rateToday}%`} Icon={CalendarCheck} iconCls="bg-sky-50 text-sky-500" sub={`${stats.inToday} of ${stats.active} present`} />
        {canAccessPayroll
          ? <StatCard label="Monthly base payroll" value={money(stats.payroll)} Icon={Wallet} iconCls="bg-indigo-50 text-indigo-500" sub="across all departments" />
          : <StatCard label="Departments" value={departments.length} Icon={Building2} iconCls="bg-indigo-50 text-indigo-500" sub="in your organisation" />}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col md:flex-row md:items-center gap-2.5">
        <SearchBox value={search} onChange={setSearch} placeholder="Search departments…" />
        <div className="relative md:w-44">
          <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="w-full pl-8 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20">
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <ToolButton onClick={exportCSV} disabled={!visible.length} title="Export CSV"><Download size={15} /> <span className="hidden sm:inline">Export</span></ToolButton>
          <ToolButton onClick={() => fetchData(true)} title="Refresh" className="!px-2.5"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /></ToolButton>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {[0, 1, 2].map(i => <div key={i} className="h-64 bg-white rounded-2xl border border-gray-100 shimmer" />)}
        </div>
      ) : departments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <EmptyState Icon={Building2} title="No departments yet" sub="Create departments to organise your team."
            action={<button onClick={() => setForm({ index: 0 })} className="text-xs font-semibold text-[#1e3a8a] hover:underline">Create the first one</button>} />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {visible.map((c, idx) => (
            <div key={c.dept.id} onClick={() => setOpenId(c.dept.id)}
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
              <div className="relative h-24 px-5 flex items-end" style={{ background: c.theme.gradient }}>
                <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(ellipse at 10% 20%, white 0%, transparent 55%)' }} />
                <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setForm({ dept: c.dept, index: idx })} title="Edit"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-white/20 hover:bg-white/35 backdrop-blur"><Pencil size={14} /></button>
                  <button onClick={() => quickDelete(c)} title={armed === `del-${c.dept.id}` ? 'Click again — members become unassigned' : 'Delete'}
                    className={`h-8 rounded-lg flex items-center justify-center gap-1 text-white backdrop-blur transition-colors ${armed === `del-${c.dept.id}` ? 'px-2 bg-red-500 text-xs font-semibold' : 'w-8 bg-white/20 hover:bg-red-500/80'}`}>
                    <Trash2 size={14} />{armed === `del-${c.dept.id}` && 'Confirm'}
                  </button>
                </div>
                <div className="relative w-12 h-12 rounded-xl bg-white flex items-center justify-center translate-y-6 shadow-lg">
                  <Building2 size={22} style={{ color: c.theme.solid }} />
                </div>
              </div>
              <div className="pt-9 px-5 pb-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-extrabold text-gray-900 text-[15px] leading-tight truncate">{c.dept.name}</h3>
                  {c.head && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 shrink-0" title="Head of department">
                      <Crown size={11} /> {empName(c.head).split(' ')[0]}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-gray-400 mt-1.5 leading-relaxed line-clamp-2 min-h-[38px]">{c.dept.description || 'No description provided.'}</p>

                <div className="mt-3"><AvatarStack people={c.members} /></div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100">
                  <div><p className="text-[10px] text-gray-400 uppercase tracking-wider">Members</p><p className="text-sm font-bold text-gray-800">{c.members.length}</p></div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">In today</p>
                    <p className="text-sm font-bold text-gray-800">{c.rate == null ? '—' : `${c.rate}%`}</p>
                    <div className="h-1 rounded-full bg-gray-100 mt-1 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${c.rate ?? 0}%` }} /></div>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{canAccessPayroll ? 'Avg salary' : 'Active'}</p>
                    <p className="text-sm font-bold text-gray-800">{canAccessPayroll ? (c.avgSalary ? money(c.avgSalary) : '—') : c.active}</p>
                  </div>
                </div>
                <p className="flex items-center gap-0.5 text-xs font-bold text-[#1e3a8a] mt-3 opacity-0 group-hover:opacity-100 transition-opacity">Manage team <ChevronRight size={13} /></p>
              </div>
            </div>
          ))}

          {unassigned.length > 0 && !search && (
            <button onClick={() => setOpenId('__none')}
              className="rounded-2xl border-2 border-dashed border-gray-200 p-6 text-left hover:border-amber-300 hover:bg-amber-50/40 transition-colors">
              <span className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center"><Inbox size={22} /></span>
              <p className="font-extrabold text-gray-900 mt-4">Unassigned</p>
              <p className="text-sm text-gray-400 mt-1">{unassigned.length} active employee{unassigned.length !== 1 ? 's' : ''} without a department</p>
              <div className="mt-3"><AvatarStack people={unassigned} /></div>
              <p className="flex items-center gap-0.5 text-xs font-bold text-amber-700 mt-3">Assign now <ChevronRight size={13} /></p>
            </button>
          )}
        </div>
      )}

      {openCard && (
        <TeamModal card={openCard} departments={departments} employees={unique} canPay={canAccessPayroll}
          onClose={() => setOpenId(null)}
          onEdit={() => { const i = departments.findIndex(d => d.id === openCard.dept.id); setOpenId(null); setForm({ dept: openCard.dept, index: i }) }}
          onDelete={deleteDept} onMove={moveEmployees} onSetHead={setHead} />
      )}
      {form && (
        <DeptForm dept={form.dept} index={form.index ?? 0} departments={departments} employees={unique}
          onClose={() => setForm(null)} onSubmit={saveDept} />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
