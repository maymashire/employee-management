/**
 * Company-wide settings (Firestore doc settings/company), editable by Admins
 * in Settings → Company. Used for branding, attendance shift start and the
 * payroll absence-deduction rate.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as db from '../lib/db'

export const COMPANY_DEFAULTS = {
  name:         'WorkForce',
  tagline:      'Employee Management',
  shift_start:  '09:00',
  shift_end:    '17:00',
  payroll_days: 30,
}

let current = COMPANY_DEFAULTS
/** Latest company settings for non-React code (e.g. payslip printing). */
export const companyNow = () => current

const CompanyContext = createContext(null)

export function CompanyProvider({ children }) {
  const [company, setCompany] = useState(COMPANY_DEFAULTS)

  useEffect(() => {
    db.getCompanySettings()
      .then(c => { if (c) { current = { ...COMPANY_DEFAULTS, ...c }; setCompany(current) } })
      .catch(() => {})
  }, [])

  const saveCompany = useCallback(async patch => {
    await db.saveCompanySettings(patch)
    current = { ...current, ...patch }
    setCompany(current)
  }, [])

  return (
    <CompanyContext.Provider value={{ company, saveCompany }}>
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  return useContext(CompanyContext) ?? { company: current, saveCompany: async () => {} }
}
