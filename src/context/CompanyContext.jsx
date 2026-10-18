/**
 * Company-wide settings (Firestore doc settings/company), editable by Admins
 * in Settings → Company: work hours (late detection, overtime) and payroll
 * days per month (absence-deduction rate). Branding is fixed to the product
 * (components/Brand.jsx) and is not configurable.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as db from '../lib/db'

export const COMPANY_DEFAULTS = {
  shift_start:  '09:00',
  shift_end:    '17:00',
  payroll_days: 30,
}

// Only these keys are read from Firestore — older saves may still carry a
// company name / tagline, which are ignored.
const pick = c => Object.fromEntries(
  Object.keys(COMPANY_DEFAULTS).filter(k => c?.[k] != null && c[k] !== '').map(k => [k, c[k]]),
)

let current = COMPANY_DEFAULTS

const CompanyContext = createContext(null)

export function CompanyProvider({ children }) {
  const [company, setCompany] = useState(COMPANY_DEFAULTS)

  useEffect(() => {
    db.getCompanySettings()
      .then(c => {
        if (!c) return
        current = { ...COMPANY_DEFAULTS, ...pick(c) }
        setCompany(current)
      })
      .catch(() => {})
  }, [])

  const saveCompany = useCallback(async patch => {
    const clean = pick(patch)
    await db.saveCompanySettings(clean)
    current = { ...current, ...clean }
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
