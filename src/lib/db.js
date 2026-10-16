/**
 * Firestore data-access layer.
 * Replaces supabaseClient.js — all functions return data directly and throw on error.
 *
 * Collections:
 *   employees          – staff records (denormalises departments.name)
 *   departments        – org units
 *   attendance         – daily check-in/out records
 *   users              – system-role mappings (docId = username/email)
 *   employee_salary_config – base salary per employee
 *   payroll_records    – monthly pay runs (denormalises employee_salary_config)
 */
import { db } from './firebase'
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  setDoc, query, where, orderBy,
} from 'firebase/firestore'

// ── helpers ──────────────────────────────────────────────────────────────────

const toObj = d => ({ id: d.id, ...d.data() })

const computeNet = r =>
  (Number(r.basic_salary) || 0)
  + (Number(r.overtime)   || 0)
  + (Number(r.bonus)      || 0)
  - (Number(r.deductions) || 0)
  - (Number(r.tax)        || 0)

// ── DEPARTMENTS ───────────────────────────────────────────────────────────────

export async function getDepartments() {
  const snap = await getDocs(query(collection(db, 'departments'), orderBy('name')))
  return snap.docs.map(toObj)
}

export async function addDepartment(data) {
  const payload = { ...data, created_at: new Date().toISOString() }
  const ref = await addDoc(collection(db, 'departments'), payload)
  return { id: ref.id, ...payload }
}

export async function updateDepartment(id, data) {
  await updateDoc(doc(db, 'departments', id), data)
}

export async function deleteDepartment(id) {
  await deleteDoc(doc(db, 'departments', id))
}

// ── EMPLOYEES ─────────────────────────────────────────────────────────────────
// departments.name is stored denormalised inside each employee doc as:
//   { departments: { name: 'Engineering' } }
// to match the shape Supabase returned from JOIN queries.

export async function getEmployees() {
  const snap = await getDocs(query(collection(db, 'employees'), orderBy('first_name')))
  return snap.docs.map(toObj)
}

export async function getEmployee(id) {
  const snap = await getDoc(doc(db, 'employees', id))
  return snap.exists() ? toObj(snap) : null
}

export async function addEmployee(data) {
  let departments = null
  if (data.department_id) {
    const dSnap = await getDoc(doc(db, 'departments', data.department_id))
    if (dSnap.exists()) departments = { name: dSnap.data().name }
  }
  const payload = { ...data, departments, created_at: new Date().toISOString() }
  const ref = await addDoc(collection(db, 'employees'), payload)
  return { id: ref.id, ...payload }
}

export async function updateEmployee(id, data) {
  const updates = { ...data }
  if (data.department_id !== undefined) {
    if (data.department_id) {
      const dSnap = await getDoc(doc(db, 'departments', data.department_id))
      updates.departments = dSnap.exists() ? { name: dSnap.data().name } : null
    } else {
      updates.departments = null
    }
  }
  await updateDoc(doc(db, 'employees', id), updates)
}

export async function deleteEmployee(id) {
  await deleteDoc(doc(db, 'employees', id))
}

// ── ATTENDANCE ────────────────────────────────────────────────────────────────

export async function getAttendanceByDate(date) {
  const snap = await getDocs(query(collection(db, 'attendance'), where('date', '==', date)))
  return snap.docs.map(toObj)
}

/** Returns the single attendance record for empId on date, or null. */
export async function getAttendanceByEmployeeDate(employeeId, date) {
  const snap = await getDocs(query(
    collection(db, 'attendance'),
    where('employee_id', '==', employeeId),
    where('date', '==', date),
  ))
  return snap.docs.length > 0 ? toObj(snap.docs[0]) : null
}

/** All attendance rows in [start, end] date range (YYYY-MM-DD strings). */
export async function getAttendanceRange(start, end) {
  const snap = await getDocs(query(
    collection(db, 'attendance'),
    where('date', '>=', start),
    where('date', '<=', end),
  ))
  return snap.docs.map(toObj)
}

export async function addAttendance(data) {
  const payload = { ...data, created_at: new Date().toISOString() }
  const ref = await addDoc(collection(db, 'attendance'), payload)
  return { id: ref.id, ...payload }
}

export async function updateAttendance(id, data) {
  await updateDoc(doc(db, 'attendance', id), data)
}

/** Upsert: update if a record exists for empId+date, otherwise insert. */
export async function upsertAttendance(employeeId, date, data) {
  const existing = await getAttendanceByEmployeeDate(employeeId, date)
  if (existing) {
    await updateAttendance(existing.id, data)
    return { ...existing, ...data }
  }
  return addAttendance({ employee_id: employeeId, date, ...data })
}

// ── SYSTEM USERS (role-based access) ─────────────────────────────────────────
// docId = username (email).  Stores employees: {first_name, last_name} denormalised.

export async function getSystemUsers() {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('role')))
  return snap.docs.map(toObj)
}

export async function addSystemUser({ username, role, employee_id }) {
  let employees = null
  if (employee_id) {
    const eSnap = await getDoc(doc(db, 'employees', employee_id))
    if (eSnap.exists()) {
      const e = eSnap.data()
      employees = { first_name: e.first_name, last_name: e.last_name }
    }
  }
  const payload = { username, role, employee_id: employee_id ?? null, employees }
  await setDoc(doc(db, 'users', username), payload)
  return { id: username, ...payload }
}

export async function updateSystemUser(username, { role, employee_id }) {
  let employees = null
  if (employee_id) {
    const eSnap = await getDoc(doc(db, 'employees', employee_id))
    if (eSnap.exists()) {
      const e = eSnap.data()
      employees = { first_name: e.first_name, last_name: e.last_name }
    }
  }
  await updateDoc(doc(db, 'users', username), {
    role,
    employee_id: employee_id ?? null,
    employees,
  })
}

export async function deleteSystemUser(username) {
  await deleteDoc(doc(db, 'users', username))
}

// ── SALARY CONFIG ─────────────────────────────────────────────────────────────

export async function getSalaryConfigs() {
  const snap = await getDocs(query(collection(db, 'employee_salary_config'), orderBy('employee_name')))
  return snap.docs.map(toObj)
}

export async function getSalaryConfigByEmployee(employeeId) {
  const snap = await getDocs(query(
    collection(db, 'employee_salary_config'),
    where('employee_id', '==', employeeId),
  ))
  return snap.docs.length > 0 ? toObj(snap.docs[0]) : null
}

export async function addSalaryConfig(data) {
  const payload = { ...data, created_at: new Date().toISOString() }
  const ref = await addDoc(collection(db, 'employee_salary_config'), payload)
  return { id: ref.id, ...payload }
}

export async function updateSalaryConfig(id, data) {
  await updateDoc(doc(db, 'employee_salary_config', id), data)
}

export async function deleteSalaryConfig(id) {
  await deleteDoc(doc(db, 'employee_salary_config', id))
}

// ── PAYROLL RECORDS ───────────────────────────────────────────────────────────
// net_salary was GENERATED in Supabase; computed here and stored.
// employee_salary_config is denormalised inside each payroll record for fast reads.

export async function getPayrollRecords() {
  const snap = await getDocs(collection(db, 'payroll_records'))
  const rows = snap.docs.map(toObj)
  rows.sort((a, b) => {
    const pp = (b.pay_period ?? '').localeCompare(a.pay_period ?? '')
    return pp !== 0 ? pp : (a.employee_salary_config?.employee_name ?? '').localeCompare(
      b.employee_salary_config?.employee_name ?? '',
    )
  })
  return rows
}

export async function getPayrollRecordsByPeriod(period) {
  const snap = await getDocs(query(
    collection(db, 'payroll_records'),
    where('pay_period', '==', period),
  ))
  return snap.docs.map(toObj)
}

export async function getPayrollRecordsByYear(year) {
  const snap = await getDocs(query(
    collection(db, 'payroll_records'),
    where('pay_period', '>=', `${year}-01-01`),
    where('pay_period', '<=', `${year}-12-31`),
  ))
  return snap.docs.map(toObj)
}

export async function addPayrollRecord(data) {
  // Fetch config for denormalization
  let cfgShape = null
  if (data.salary_config_id) {
    const cfgSnap = await getDoc(doc(db, 'employee_salary_config', data.salary_config_id))
    if (cfgSnap.exists()) {
      const c = cfgSnap.data()
      cfgShape = { employee_name: c.employee_name, department: c.department, employee_id: c.employee_id }
    }
  }
  const payload = {
    ...data,
    net_salary:              computeNet(data),
    status:                  data.status ?? 'Unpaid',
    created_at:              new Date().toISOString(),
    employee_salary_config:  cfgShape,
  }
  const ref = await addDoc(collection(db, 'payroll_records'), payload)
  return { id: ref.id, ...payload }
}

export async function updatePayrollRecord(id, data) {
  const updates = { ...data }
  // Recompute net_salary when any financial field changes
  if (
    'basic_salary' in data || 'overtime' in data || 'bonus' in data ||
    'deductions' in data   || 'tax' in data
  ) {
    const snap = await getDoc(doc(db, 'payroll_records', id))
    if (snap.exists()) {
      updates.net_salary = computeNet({ ...snap.data(), ...updates })
    }
  }
  await updateDoc(doc(db, 'payroll_records', id), updates)
}

export async function deletePayrollRecord(id) {
  await deleteDoc(doc(db, 'payroll_records', id))
}

/**
 * Batch upsert for PayrollProcess.
 * rows: array of { salary_config_id, employee_id, pay_period, basic_salary, overtime, bonus, deductions, tax }
 * configsMap: { [salary_config_id]: { employee_name, department } }  — pre-fetched from getSalaryConfigs()
 * Returns { newRows, updatedRows, lockedRows }
 */
export async function batchUpsertPayrollRecords(rows, payPeriod, configsMap = {}) {
  // Fetch all existing records for the period
  const existingSnap = await getDocs(query(
    collection(db, 'payroll_records'),
    where('pay_period', '==', payPeriod),
  ))
  const existingMap = {}
  existingSnap.docs.forEach(d => {
    existingMap[d.data().employee_id] = { id: d.id, ...d.data() }
  })

  const newRows    = []
  const updatedRows = []
  const lockedRows  = []

  for (const row of rows) {
    const existing = existingMap[row.employee_id]
    if (!existing) {
      newRows.push(row)
    } else if (existing.status === 'Unpaid') {
      updatedRows.push({ ...row, _existingId: existing.id })
    } else {
      lockedRows.push(row)
    }
  }

  const now = new Date().toISOString()
  const ops = []

  for (const row of newRows) {
    const cfg = configsMap[row.salary_config_id]
    ops.push(
      addDoc(collection(db, 'payroll_records'), {
        ...row,
        net_salary:             computeNet(row),
        status:                 'Unpaid',
        created_at:             now,
        employee_salary_config: cfg
          ? { employee_name: cfg.employee_name, department: cfg.department, employee_id: cfg.employee_id }
          : null,
      }),
    )
  }

  for (const row of updatedRows) {
    const { _existingId, ...fields } = row
    ops.push(
      updateDoc(doc(db, 'payroll_records', _existingId), {
        ...fields,
        net_salary: computeNet(fields),
      }),
    )
  }

  await Promise.all(ops)
  return { newRows, updatedRows, lockedRows }
}
