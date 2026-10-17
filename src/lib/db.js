/**
 * Firestore data-access layer.
 * Replaces supabaseClient.js — all functions return data directly and throw on error.
 *
 * Collections:
 *   employees          – staff records (denormalises departments.name)
 *   departments        – org units
 *   attendance         – daily check-in/out records
 *   users              – login accounts: role, status, password hash, avatar (docId = email)
 *   settings           – company-wide settings (doc: company)
 *   employee_salary_config – base salary per employee
 *   payroll_records    – monthly pay runs (denormalises employee_salary_config)
 */
import { db } from './firebase'
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  setDoc, query, where, orderBy, writeBatch,
} from 'firebase/firestore'
import { hashPassword } from './password'

// ── helpers ──────────────────────────────────────────────────────────────────

const toObj = d => ({ id: d.id, ...d.data() })

export const computeNet = r =>
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

async function employeesInDepartment(id) {
  const snap = await getDocs(query(collection(db, 'employees'), where('department_id', '==', id)))
  return snap.docs.map(d => d.id)
}

/** Updates a department; a rename is propagated to the name denormalised on its employees. */
export async function updateDepartment(id, data) {
  await updateDoc(doc(db, 'departments', id), data)
  if (data.name) {
    const ids = await employeesInDepartment(id)
    for (let i = 0; i < ids.length; i += 450) {
      const batch = writeBatch(db)
      ids.slice(i, i + 450).forEach(eid => batch.update(doc(db, 'employees', eid), { departments: { name: data.name } }))
      await batch.commit()
    }
  }
}

/** Deletes a department and unassigns its employees. */
export async function deleteDepartment(id) {
  const ids = await employeesInDepartment(id)
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db)
    ids.slice(i, i + 450).forEach(eid => batch.update(doc(db, 'employees', eid), { department_id: null, departments: null }))
    await batch.commit()
  }
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

/**
 * Patch many employees at once. When `department_id` is in the patch the
 * department name is denormalised once and applied to all of them.
 * Returns the patch actually written.
 */
export async function batchUpdateEmployees(ids, data) {
  const patch = { ...data }
  if ('department_id' in data) {
    patch.departments = null
    if (data.department_id) {
      const dSnap = await getDoc(doc(db, 'departments', data.department_id))
      if (dSnap.exists()) patch.departments = { name: dSnap.data().name }
    }
  }
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db)
    ids.slice(i, i + 450).forEach(id => batch.update(doc(db, 'employees', id), patch))
    await batch.commit()
  }
  return patch
}

export async function batchDeleteEmployees(ids) {
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db)
    ids.slice(i, i + 450).forEach(id => batch.delete(doc(db, 'employees', id)))
    await batch.commit()
  }
}

// ── ATTENDANCE ────────────────────────────────────────────────────────────────

export async function getAttendanceByDate(date) {
  const snap = await getDocs(query(collection(db, 'attendance'), where('date', '==', date)))
  return snap.docs.map(toObj)
}

/** Returns the single attendance record for empId on date, or null. */
export async function getAttendanceByEmployeeDate(employeeId, date) {
  // Filter by date only (single-field query, no composite index needed),
  // then find the matching employee client-side.
  const snap = await getDocs(query(
    collection(db, 'attendance'),
    where('date', '==', date),
  ))
  const found = snap.docs.find(d => d.data().employee_id === employeeId)
  return found ? toObj(found) : null
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

export async function deleteAttendance(id) {
  await deleteDoc(doc(db, 'attendance', id))
}

/**
 * Set the status of many employees on one date using batched writes.
 * items: [{ employee_id, id?, status }] — `id` is the existing attendance doc, if any.
 */
export async function batchSetAttendanceStatus(date, items) {
  const created_at = new Date().toISOString()
  for (let i = 0; i < items.length; i += 450) {
    const batch = writeBatch(db)
    items.slice(i, i + 450).forEach(({ employee_id, id, status }) => {
      if (id) {
        batch.update(doc(db, 'attendance', id), { status })
      } else {
        batch.set(doc(collection(db, 'attendance')), {
          employee_id, date, status, clock_in: null, clock_out: null, created_at,
        })
      }
    })
    await batch.commit()
  }
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

// ── SYSTEM USERS (login accounts) ────────────────────────────────────────────
// docId = lower-cased email. Login is verified against a salted PBKDF2 hash
// (see lib/password.js); plain passwords are never stored.

const userKey = email => (email ?? '').trim().toLowerCase()

async function employeeShape(employee_id) {
  if (!employee_id) return null
  const eSnap = await getDoc(doc(db, 'employees', employee_id))
  if (!eSnap.exists()) return null
  const e = eSnap.data()
  return { first_name: e.first_name, last_name: e.last_name }
}

export async function getSystemUsers() {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map(toObj).sort((a, b) =>
    (a.name || a.username || '').localeCompare(b.name || b.username || ''))
}

export async function getSystemUser(id) {
  if (!id) return null
  const snap = await getDoc(doc(db, 'users', id))
  return snap.exists() ? toObj(snap) : null
}

/** Case-insensitive lookup by email (older docs may not use the lower-cased id). */
export async function findSystemUserByEmail(email) {
  const key = userKey(email)
  const direct = await getSystemUser(key)
  if (direct) return direct
  const all = await getSystemUsers()
  return all.find(u => userKey(u.username) === key) ?? null
}

export async function createSystemUser({ email, name, role, password, employee_id = null, status = 'active' }) {
  const id = userKey(email)
  if (await findSystemUserByEmail(id)) throw new Error('A user with this email already exists.')
  const { hash, salt } = await hashPassword(password)
  const now = new Date().toISOString()
  const payload = {
    username: id, name: (name ?? '').trim(), role, status,
    employee_id: employee_id || null, employees: await employeeShape(employee_id),
    password_hash: hash, password_salt: salt, password_updated_at: now,
    avatar_url: null, preferences: {}, created_at: now, updated_at: now, last_login: null,
  }
  await setDoc(doc(db, 'users', id), payload)
  return { id, ...payload }
}

export async function updateSystemUser(id, data) {
  const updates = { ...data, updated_at: new Date().toISOString() }
  if ('employee_id' in data) updates.employees = await employeeShape(data.employee_id)
  await updateDoc(doc(db, 'users', id), updates)
  return updates
}

export async function setUserPassword(id, password) {
  const { hash, salt } = await hashPassword(password)
  const now = new Date().toISOString()
  const patch = { password_hash: hash, password_salt: salt, password_updated_at: now, updated_at: now }
  await updateDoc(doc(db, 'users', id), patch)
  return patch
}

export async function deleteSystemUser(id) {
  await deleteDoc(doc(db, 'users', id))
}

export async function batchUpdateSystemUsers(ids, data) {
  const patch = { ...data, updated_at: new Date().toISOString() }
  const batch = writeBatch(db)
  ids.forEach(id => batch.update(doc(db, 'users', id), patch))
  await batch.commit()
  return patch
}

export async function batchDeleteSystemUsers(ids) {
  const batch = writeBatch(db)
  ids.forEach(id => batch.delete(doc(db, 'users', id)))
  await batch.commit()
}

// ── COMPANY SETTINGS ──────────────────────────────────────────────────────────
// Single doc: settings/company

export async function getCompanySettings() {
  const snap = await getDoc(doc(db, 'settings', 'company'))
  return snap.exists() ? snap.data() : null
}

export async function saveCompanySettings(data) {
  await setDoc(doc(db, 'settings', 'company'), { ...data, updated_at: new Date().toISOString() }, { merge: true })
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

/**
 * Create or update many salary configs with batched writes.
 * items: [{ id?, employee_id, employee_name, department, basic_salary }]
 * Returns the saved configs (new ones get their generated id).
 */
export async function batchSaveSalaryConfigs(items) {
  const now   = new Date().toISOString()
  const saved = []
  for (let i = 0; i < items.length; i += 450) {
    const batch = writeBatch(db)
    items.slice(i, i + 450).forEach(({ id, ...data }) => {
      if (id) {
        const patch = { ...data, updated_at: now }
        batch.update(doc(db, 'employee_salary_config', id), patch)
        saved.push({ id, ...patch })
      } else {
        const ref     = doc(collection(db, 'employee_salary_config'))
        const payload = { ...data, created_at: now, updated_at: now }
        batch.set(ref, payload)
        saved.push({ id: ref.id, ...payload })
      }
    })
    await batch.commit()
  }
  return saved
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
 * Apply many payroll-record patches with batched writes.
 * items: [{ id, ...patch }] — when a patch touches a financial field it must
 * carry the full set (basic_salary, overtime, bonus, deductions, tax) so
 * net_salary can be recomputed without a read.
 */
export async function batchUpdatePayrollRecords(items) {
  for (let i = 0; i < items.length; i += 450) {
    const batch = writeBatch(db)
    items.slice(i, i + 450).forEach(({ id, ...patch }) => {
      const updates = 'basic_salary' in patch ? { ...patch, net_salary: computeNet(patch) } : patch
      batch.update(doc(db, 'payroll_records', id), updates)
    })
    await batch.commit()
  }
}

export async function batchDeletePayrollRecords(ids) {
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db)
    ids.slice(i, i + 450).forEach(id => batch.delete(doc(db, 'payroll_records', id)))
    await batch.commit()
  }
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

  const now  = new Date().toISOString()
  const ops  = []

  for (const row of newRows) {
    const cfg = configsMap[row.salary_config_id]
    ops.push(b => b.set(doc(collection(db, 'payroll_records')), {
      ...row,
      net_salary:             computeNet(row),
      status:                 'Unpaid',
      created_at:             now,
      employee_salary_config: cfg
        ? { employee_name: cfg.employee_name, department: cfg.department, employee_id: cfg.employee_id }
        : null,
    }))
  }

  for (const row of updatedRows) {
    const { _existingId, ...fields } = row
    ops.push(b => b.update(doc(db, 'payroll_records', _existingId), {
      ...fields,
      net_salary: computeNet(fields),
    }))
  }

  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db)
    ops.slice(i, i + 450).forEach(op => op(batch))
    await batch.commit()
  }
  return { newRows, updatedRows, lockedRows }
}
