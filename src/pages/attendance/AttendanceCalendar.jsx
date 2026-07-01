import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { ChevronLeft, ChevronRight, Loader2, User } from 'lucide-react'

const DAYS   = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const STATUS_CONFIG = {
  present:  { dot: 'bg-emerald-500', cell: 'bg-emerald-50  border-emerald-200', num: 'text-emerald-700', label: 'Present'  },
  late:     { dot: 'bg-amber-400',   cell: 'bg-amber-50   border-amber-200',   num: 'text-amber-700',   label: 'Late'     },
  absent:   { dot: 'bg-red-500',     cell: 'bg-red-50     border-red-200',     num: 'text-red-600',     label: 'Absent'   },
  half_day: { dot: 'bg-blue-400',    cell: 'bg-blue-50    border-blue-200',    num: 'text-blue-600',    label: 'Half Day' },
  holiday:  { dot: 'bg-purple-400',  cell: 'bg-purple-50  border-purple-200',  num: 'text-purple-600',  label: 'Holiday'  },
}

function buildCells(year, month) {
  const firstDow    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function pad2(n) { return String(n).padStart(2, '0') }
function toDateStr(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

export default function AttendanceCalendar() {
  const today    = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const [year,       setYear]       = useState(today.getFullYear())
  const [month,      setMonth]      = useState(today.getMonth())
  const [employees,  setEmployees]  = useState([])
  const [selected,   setSelected]   = useState(null)
  const [attMap,     setAttMap]     = useState({})
  const [loading,    setLoading]    = useState(false)
  const [empLoading, setEmpLoading] = useState(true)

  // ── load employees once ────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('employees')
      .select('id, first_name, last_name, job_title')
      .eq('status', 'active')
      .order('first_name')
      .then(({ data }) => {
        const list = data ?? []
        setEmployees(list)
        if (list.length) setSelected(list[0])
        setEmpLoading(false)
      })
  }, [])

  // ── fetch attendance when employee / month changes ─────────────────────────
  const fetchAttendance = useCallback(async () => {
    if (!selected) return
    setLoading(true)

    const start = toDateStr(year, month, 1)
    const end   = new Date(year, month + 1, 0).toISOString().slice(0, 10)

    const { data } = await supabase
      .from('attendance')
      .select('date, status')
      .eq('employee_id', selected.id)
      .gte('date', start)
      .lte('date', end)

    const map = {}
    ;(data ?? []).forEach(r => { map[r.date] = r.status })
    setAttMap(map)
    setLoading(false)
  }, [selected, year, month])

  useEffect(() => { fetchAttendance() }, [fetchAttendance])

  // ── month navigation ───────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const cells  = buildCells(year, month)
  const counts = Object.fromEntries(
    Object.keys(STATUS_CONFIG).map(k => [k, Object.values(attMap).filter(s => s === k).length])
  )
  const totalMarked = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4">

      {/* ── Control bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          {/* Employee selector */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <User size={15} className="text-gray-400" />
            </div>
            {empLoading ? (
              <div className="h-9 w-52 bg-gray-100 rounded-xl animate-pulse" />
            ) : (
              <select
                value={selected?.id ?? ''}
                onChange={e => setSelected(employees.find(x => x.id === e.target.value) ?? null)}
                className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-gray-800
                  bg-white min-w-[200px] cursor-pointer transition-colors
                  focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]"
              >
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-3 justify-center">
            <button
              onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200
                hover:bg-gray-50 transition-colors text-gray-500 hover:text-gray-800"
            >
              <ChevronLeft size={16} />
            </button>

            <h2 className="text-lg font-bold text-gray-900 min-w-[155px] text-center tabular-nums">
              {MONTHS[month]} {year}
            </h2>

            <button
              onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200
                hover:bg-gray-50 transition-colors text-gray-500 hover:text-gray-800"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Legend — only Present / Late / Absent shown (matching reference image) */}
          <div className="flex items-center gap-5 text-sm text-gray-600 justify-end">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              Present
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
              Late
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
              Absent
            </span>
          </div>
        </div>
      </div>

      {/* ── Calendar grid ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-widest py-2.5">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
            <Loader2 size={22} className="animate-spin text-blue-500" />
            <span className="text-sm">Loading attendance…</span>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {cells.map((day, i) => {
              /* empty cell */
              if (!day) {
                return <div key={`empty-${i}`} className="aspect-square" />
              }

              const ds     = toDateStr(year, month, day)
              const status = attMap[ds]
              const cfg    = STATUS_CONFIG[status]
              const isToday = ds === todayStr

              return (
                <div
                  key={ds}
                  className={`
                    aspect-square rounded-xl flex flex-col items-center justify-center
                    relative border transition-all duration-150 select-none
                    ${cfg
                      ? `${cfg.cell} shadow-sm`
                      : isToday
                        ? 'bg-[#1e3a8a]/5 border-[#1e3a8a]/25'
                        : 'bg-gray-50 border-gray-100 hover:bg-gray-100/80 hover:border-gray-200'
                    }
                  `}
                >
                  {/* Today blue dot (top-right) */}
                  {isToday && !cfg && (
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#1e3a8a]" />
                  )}

                  {/* Day number */}
                  <span className={`text-sm font-semibold leading-none
                    ${cfg ? cfg.num : isToday ? 'text-[#1e3a8a]' : 'text-gray-500'}`}>
                    {day}
                  </span>

                  {/* Status indicator dot */}
                  {cfg && (
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${cfg.dot}`} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Monthly summary strip ────────────────────────────────────────────── */}
      {selected && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const bgCls = cfg.cell.split(' ')[0]
            return (
              <div key={key} className={`${bgCls} rounded-xl px-4 py-3 flex items-center gap-3`}>
                <span className={`w-3 h-3 rounded-full shrink-0 ${cfg.dot}`} />
                <div>
                  <p className="text-xs text-gray-500 leading-none mb-1">{cfg.label}</p>
                  <p className={`text-2xl font-bold leading-none ${cfg.num}`}>{counts[key]}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Record count note */}
      {selected && !loading && (
        <p className="text-xs text-gray-400 text-right">
          {totalMarked} day{totalMarked !== 1 ? 's' : ''} recorded for{' '}
          {selected.first_name} {selected.last_name} in {MONTHS[month]} {year}
        </p>
      )}
    </div>
  )
}
