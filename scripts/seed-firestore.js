/**
 * seed-firestore.js — no authentication required
 * Requires Firestore rules:  allow read, write: if true;
 * Run: node scripts/seed-firestore.js
 */

const PROJECT = 'emsystem-22f0e'
const BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

function toFirestore(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined)  out[k] = { nullValue: null }
    else if (typeof v === 'string')     out[k] = { stringValue: v }
    else if (typeof v === 'number')     out[k] = { doubleValue: v }
    else if (typeof v === 'boolean')    out[k] = { booleanValue: v }
    else if (typeof v === 'object')     out[k] = { mapValue: { fields: toFirestore(v) } }
  }
  return out
}

async function write(collection, id, fields) {
  const url    = id ? `${BASE}/${collection}/${id}` : `${BASE}/${collection}`
  const method = id ? 'PATCH' : 'POST'
  const res    = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFirestore(fields) }),
  })
  const data = await res.json()
  if (data.error) throw new Error(`[${collection}] ${data.error.message}`)
  return data.name?.split('/').pop()
}

// ── Data ──────────────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { id: 'dept-eng',  name: 'Engineering',     description: 'Software development and technical operations' },
  { id: 'dept-hr',   name: 'Human Resources', description: 'People management and recruitment' },
  { id: 'dept-fin',  name: 'Finance',         description: 'Financial planning and accounting' },
  { id: 'dept-mkt',  name: 'Marketing',       description: 'Brand and customer engagement' },
  { id: 'dept-mgmt', name: 'Management',      description: 'Executive and administrative leadership' },
]

const EMPLOYEES = [
  { first_name: 'Ahmed',      last_name: 'Hassan',   email: 'ahmed.hassan@company.com',  role: 'administrator', status: 'active', job_title: 'CTO',                hire_date: '2020-01-15', dept_id: 'dept-eng',  phone: '+252 61 1001001' },
  { first_name: 'Fatima',     last_name: 'Omar',     email: 'fatima.omar@company.com',   role: 'manager',       status: 'active', job_title: 'Lead Developer',     hire_date: '2021-03-10', dept_id: 'dept-eng',  phone: '+252 61 1001002' },
  { first_name: 'Maryan',     last_name: 'Ali',      email: 'maryan@gmail.com',          role: 'administrator', status: 'active', job_title: 'HR Manager',         hire_date: '2019-06-01', dept_id: 'dept-hr',   phone: '+252 61 1001003' },
  { first_name: 'Mohamed',    last_name: 'Abdi',     email: 'mohamed.abdi@company.com',  role: 'employee',      status: 'active', job_title: 'HR Specialist',      hire_date: '2022-02-20', dept_id: 'dept-hr',   phone: '+252 61 1001004' },
  { first_name: 'Hodan',      last_name: 'Yusuf',    email: 'hodan.yusuf@company.com',   role: 'manager',       status: 'active', job_title: 'Finance Director',   hire_date: '2020-09-15', dept_id: 'dept-fin',  phone: '+252 61 1001005' },
  { first_name: 'Abdirahman', last_name: 'Mohamud',  email: 'abdirahman.m@company.com',  role: 'employee',      status: 'active', job_title: 'Accountant',         hire_date: '2021-11-01', dept_id: 'dept-fin',  phone: '+252 61 1001006' },
  { first_name: 'Sahra',      last_name: 'Ibrahim',  email: 'sahra.ibrahim@company.com', role: 'employee',      status: 'active', job_title: 'Marketing Lead',     hire_date: '2022-04-18', dept_id: 'dept-mkt',  phone: '+252 61 1001007' },
  { first_name: 'Mustafa',    last_name: 'Nor',      email: 'mustafa.nor@company.com',   role: 'employee',      status: 'active', job_title: 'Content Creator',    hire_date: '2023-01-10', dept_id: 'dept-mkt',  phone: '+252 61 1001008' },
  { first_name: 'Ifrah',      last_name: 'Warsame',  email: 'ifrah.warsame@company.com', role: 'manager',       status: 'active', job_title: 'Operations Manager', hire_date: '2020-07-22', dept_id: 'dept-mgmt', phone: '+252 61 1001009' },
  { first_name: 'Dahir',      last_name: 'Farah',    email: 'dahir.farah@company.com',   role: 'employee',      status: 'active', job_title: 'Executive Assistant',hire_date: '2022-08-30', dept_id: 'dept-mgmt', phone: '+252 61 1001010' },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔥 EMS Firestore Seed  (no-auth mode)\n' + '─'.repeat(42))

  // Test connection first
  const test = await fetch(`${BASE}/departments/dept-eng`)
  const testData = await test.json()
  if (testData.error?.status === 'PERMISSION_DENIED') {
    console.error('\n❌ Firestore rules are still restricted.\n')
    console.error('   Go to: Firebase Console → Firestore → Rules')
    console.error('   Change to:  allow read, write: if true;')
    console.error('   Publish → then re-run this script.\n')
    process.exit(1)
  }

  // Departments
  console.log('\n[1/3] Departments…')
  const deptMap = {}
  for (const d of DEPARTMENTS) {
    await write('departments', d.id, {
      name: d.name, description: d.description, created_at: new Date().toISOString(),
    })
    deptMap[d.id] = d
    console.log(`  ✅  ${d.name}`)
  }

  // Employees
  console.log('\n[2/3] Employees…')
  for (const e of EMPLOYEES) {
    const dept = deptMap[e.dept_id]
    await write('employees', null, {
      first_name:    e.first_name,
      last_name:     e.last_name,
      email:         e.email,
      role:          e.role,
      status:        e.status,
      job_title:     e.job_title,
      hire_date:     e.hire_date,
      phone_number:  e.phone,
      department_id: e.dept_id,
      departments:   { name: dept?.name ?? '' },
      avatar_url:    '',
      created_at:    new Date().toISOString(),
    })
    console.log(`  ✅  ${e.first_name} ${e.last_name}`)
  }

  // Admin user profile
  console.log('\n[3/3] Admin user…')
  await write('users', 'maryan@gmail.com', {
    username: 'maryan@gmail.com', role: 'Admin', employee_id: null, employees: null,
  })
  console.log('  ✅  maryan@gmail.com → Admin')

  console.log('\n' + '─'.repeat(42))
  console.log(`🎉 Done! ${DEPARTMENTS.length} departments + ${EMPLOYEES.length} employees seeded.`)
  console.log('\n   ⚠️  Now restore Firestore rules to:')
  console.log('       allow read, write: if request.auth != null;\n')
  process.exit(0)
}

main().catch(err => {
  console.error('\n❌ Error:', err.message)
  process.exit(1)
})
