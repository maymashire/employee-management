/**
 * Company-wide settings (Firestore doc settings/company), editable by Admins
 * in Settings → Company. Used for branding, attendance shift start and the
 * payroll absence-deduction rate.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as db from '../lib/db'
import { BRAND } from '../components/Brand'

export const COMPANY_DEFAULTS = {
  name:         BRAND.name,
  tagline:      BRAND.slogan,
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
      .then(c => {
        if (!c) return
        // Older saves stored the previous product defaults — show the new brand instead
        const legacy = { name: ['WorkForce', 'VibeHR'], tagline: ['Employee Management', 'Employee Management System'] }
        const clean = { ...c }
        Object.entries(legacy).forEach(([k, olds]) => { if (olds.includes(clean[k])) delete clean[k] })
        current = { ...COMPANY_DEFAULTS, ...clean }
        setCompany(current)
      })
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
