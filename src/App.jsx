import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/layout/Layout'
import PayrollLayout from './components/layout/PayrollLayout'

import Login           from './pages/Login'
import Dashboard       from './pages/Dashboard'
import Employees       from './pages/Employees'
import Departments     from './pages/Departments'
import Settings        from './pages/Settings'

import DailyAttendance     from './pages/attendance/DailyAttendance'
import CheckInOut          from './pages/attendance/CheckInOut'
import AttendanceCalendar  from './pages/attendance/AttendanceCalendar'
import AttendanceReports   from './pages/attendance/Reports'

import Analytics       from './pages/analytics/Analytics'

import SalaryList      from './pages/payroll/SalaryList'
import PayrollProcess  from './pages/payroll/PayrollProcess'
import Payslips        from './pages/payroll/Payslips'
import SalaryHistory   from './pages/payroll/SalaryHistory'
import PayrollReports  from './pages/payroll/PayrollReports'
import PayStatus       from './pages/payroll/PayStatus'

function AppRoutes() {
  return (
    <Routes>
      {/* Login — always shown; validates hardcoded credentials */}
      <Route path="/login" element={<Login />} />

      {/* Protected shell */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"               element={<Dashboard />} />
        <Route path="employees"               element={<Employees />} />
        <Route path="departments"             element={<Departments />} />
        <Route path="analytics"               element={<Analytics />} />

        {/* Attendance */}
        <Route path="attendance/daily"        element={<DailyAttendance />} />
        <Route path="attendance/check-in-out" element={<CheckInOut />} />
        <Route path="attendance/calendar"     element={<AttendanceCalendar />} />
        <Route path="attendance/reports"      element={<AttendanceReports />} />

        {/* Payroll — all tabs wrapped in the tab-bar layout (admin only) */}
        <Route
          path="payroll"
          element={
            <ProtectedRoute adminOnly>
              <PayrollLayout />
            </ProtectedRoute>
          }
        >
          <Route index                element={<Navigate to="salary-list" replace />} />
          <Route path="salary-list"   element={<SalaryList />} />
          <Route path="process"       element={<PayrollProcess />} />
          <Route path="payslips"      element={<Payslips />} />
          <Route path="history"       element={<SalaryHistory />} />
          <Route path="reports"       element={<PayrollReports />} />
          <Route path="pay-status"    element={<PayStatus />} />
        </Route>

        {/* Settings — Admin only (not Finance) */}
        <Route path="settings" element={
          <ProtectedRoute adminOnly="strict"><Settings /></ProtectedRoute>
        } />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
