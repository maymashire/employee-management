import { NavLink, Outlet } from 'react-router-dom'
import { List, Calculator, FileText, History, BarChart3, CheckCircle2 } from 'lucide-react'

const TABS = [
  { to: '/payroll/salary-list', label: 'Salary List',     Icon: List          },
  { to: '/payroll/process',     label: 'Payroll Process', Icon: Calculator    },
  { to: '/payroll/payslips',    label: 'Payslips',        Icon: FileText      },
  { to: '/payroll/history',     label: 'History',         Icon: History       },
  { to: '/payroll/reports',     label: 'Reports',         Icon: BarChart3     },
  { to: '/payroll/pay-status',  label: 'Pay Status',      Icon: CheckCircle2  },
]

export default function PayrollLayout() {
  return (
    <div className="space-y-5">

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 pb-0.5">
        <div className="flex items-center gap-1 p-1.5 bg-white border border-gray-100 rounded-2xl shadow-sm min-w-max sm:min-w-0 sm:flex-wrap">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold
                 whitespace-nowrap transition-all duration-150 select-none
                 ${isActive
                   ? 'bg-[#1e3a8a] text-white shadow-sm shadow-[#1e3a8a]/30'
                   : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                 }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* ── Active tab content ───────────────────────────────────────────────── */}
      <Outlet />
    </div>
  )
}
