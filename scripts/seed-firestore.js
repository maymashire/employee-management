/**
 * seed-firestore.js
 * Adds demo departments + employees to Firestore.
 * Run:  node scripts/seed-firestore.js
 *
 * Requires Firebase Auth "Email/Password" to be ENABLED in the Firebase Console
 * AND the user maryan@gmail.com to exist (created by this script on first run).
 */

// Node 18+ has globalThis.fetch built-in — no import needed.

// ── helper: call Firebase Auth REST API ─────────────────────────────────────
async function authFetch(path, body) {
  const API_KEY = 'AIzaSyDtPMpKGT0wBUpxXl9bHB-njVRIjRrOhDM'
  const res = await globalThis.fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

// ── helper: call Firestore REST API ──────────────────────────────────────────
async function firestoreWrite(idToken, collection, id, fields) {
  const PROJECT = 'emsystem-22f0e'
  const base    = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

  // Convert JS object → Firestore field map
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

  const url = id ? `${base}/${collection}/${id}` : `${base}/${collection}`
  const method = id ? 'PATCH' : 'POST'

  const res = await globalThis.fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ fields: toFirestore(fields) }),
  })
  const data = await res.json()
  if (data.error) throw new Error(`Firestore ${method} ${collection}: ${data.error.message}`)
  // Extract auto-generated doc id from name  "projects/.../documents/col/AUTO_ID"
  const name = data.name ?? ''
  return name.split('/').pop()
}

// ── seed data ─────────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { id: 'dept-eng',  name: 'Engineering',     description: 'Software development and technical operations' },
  { id: 'dept-hr',   name: 'Human Resources', description: 'People management and recruitment' },
  { id: 'dept-fin',  name: 'Finance',         description: 'Financial planning and accounting' },
  { id: 'dept-mkt',  name: 'Marketing',       description: 'Brand and customer engagement' },
  { id: 'dept-mgmt', name: 'Management',      description: 'Executive and administrative leadership' },
]

const EMPLOYEES = [
  { first_name: 'Ahmed',      last_name: 'Hassan',   email: 'ahmed.hassan@company.com',   role: 'administrator', status: 'active', job_title: 'CTO',                  hire_date: '2020-01-15', dept_id: 'dept-eng',  phone_number: '+252 61 1001001' },
  { first_name: 'Fatima',     last_name: 'Omar',     email: 'fatima.omar@company.com',    role: 'manager',       status: 'active', job_title: 'Lead Developer',        hire_date: '2021-03-10', dept_id: 'dept-eng',  phone_number: '+252 61 1001002' },
  { first_name: 'Maryan',     last_name: 'Ali',      email: 'maryan@gmail.com',           role: 'administrator', status: 'active', job_title: 'HR Manager',            hire_date: '2019-06-01', dept_id: 'dept-hr',   phone_number: '+252 61 1001003' },
  { first_name: 'Mohamed',    last_name: 'Abdi',     email: 'mohamed.abdi@company.com',   role: 'employee',      status: 'active', job_title: 'HR Specialist',         hire_date: '2022-02-20', dept_id: 'dept-hr',   phone_number: '+252 61 1001004' },
  { first_name: 'Hodan',      last_name: 'Yusuf',    email: 'hodan.yusuf@company.com',    role: 'manager',       status: 'active', job_title: 'Finance Director',      hire_date: '2020-09-15', dept_id: 'dept-fin',  phone_number: '+252 61 1001005' },
  { first_name: 'Abdirahman', last_name: 'Mohamud',  email: 'abdirahman.m@company.com',   role: 'employee',      status: 'active', job_title: 'Accountant',            hire_date: '2021-11-01', dept_id: 'dept-fin',  phone_number: '+252 61 1001006' },
  { first_name: 'Sahra',      last_name: 'Ibrahim',  email: 'sahra.ibrahim@company.com',  role: 'employee',      status: 'active', job_title: 'Marketing Lead',        hire_date: '2022-04-18', dept_id: 'dept-mkt',  phone_number: '+252 61 1001007' },
  { first_name: 'Mustafa',    last_name: 'Nor',      email: 'mustafa.nor@company.com',    role: 'employee',      status: 'active', job_title: 'Content Creator',       hire_date: '2023-01-10', dept_id: 'dept-mkt',  phone_number: '+252 61 1001008' },
  { first_name: 'Ifrah',      last_name: 'Warsame',  email: 'ifrah.warsame@company.com',  role: 'manager',       status: 'active', job_title: 'Operations Manager',    hire_date: '2020-07-22', dept_id: 'dept-mgmt', phone_number: '+252 61 1001009' },
  { first_name: 'Dahir',      last_name: 'Farah',    email: 'dahir.farah@company.com',    role: 'employee',      status: 'active', job_title: 'Executive Assistant',   hire_date: '2022-08-30', dept_id: 'dept-mgmt', phone_number: '+252 61 1001010' },
]

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔥 EMS Firestore Seed Script')
  console.log('─'.repeat(46))

  // 1. Authenticate
  console.log('\n[1/3] Authenticating with Firebase…')
  let idToken

  const PASSWORDS = ['123456', 'maryan875@']  // try new password first, then old

  let authResult
  for (const pwd of PASSWORDS) {
    authResult = await authFetch('accounts:signInWithPassword', {
      email: 'maryan@gmail.com', password: pwd, returnSecureToken: true,
    })
    if (authResult.idToken) {
      idToken = authResult.idToken
      if (pwd !== '123456') {
        // Migrate old password → 123456
        console.log('      Updating password to 123456…')
        await authFetch('accounts:update', { idToken, password: '123456', returnSecureToken: false })
        console.log('      ✅ Password updated to 123456')
      } else {
        console.log('      ✅ Signed in as maryan@gmail.com')
      }
      break
    }
  }

  if (!idToken) {
    // Account doesn't exist yet — create it
    const created = await authFetch('accounts:signUp', {
      email: 'maryan@gmail.com', password: '123456', returnSecureToken: true,
    })
    if (created.idToken) {
      idToken = created.idToken
      console.log('      ✅ Firebase Auth account created (maryan@gmail.com / 123456)')
    } else {
      console.error('\n❌ Auth failed:', created.error?.message)
      console.error('   FIX: Firebase Console → Authentication → Sign-in method → Enable Email/Password')
      process.exit(1)
    }
  }

  // 2. Write departments
  console.log('\n[2/3] Writing departments…')
  const deptMap = {} // id → { id, name }
  for (const d of DEPARTMENTS) {
    await firestoreWrite(idToken, 'departments', d.id, {
      name:        d.name,
      description: d.description,
      created_at:  new Date().toISOString(),
    })
    deptMap[d.id] = d
    console.log(`      ✅ ${d.name}`)
  }

  // 3. Write employees
  console.log('\n[3/3] Writing employees…')
  for (const e of EMPLOYEES) {
    const dept = deptMap[e.dept_id]
    await firestoreWrite(idToken, 'employees', null, {
      first_name:    e.first_name,
      last_name:     e.last_name,
      email:         e.email,
      role:          e.role,
      status:        e.status,
      job_title:     e.job_title,
      hire_date:     e.hire_date,
      phone_number:  e.phone_number,
      department_id: e.dept_id,
      departments:   { name: dept?.name ?? '' },
      avatar_url:    '',
      created_at:    new Date().toISOString(),
    })
    console.log(`      ✅ ${e.first_name} ${e.last_name} (${dept?.name ?? 'no dept'})`)
  }

  // 4. Write admin system user
  console.log('\n[+] Writing Admin user record…')
  await firestoreWrite(idToken, 'users', 'maryan@gmail.com', {
    username:    'maryan@gmail.com',
    role:        'Admin',
    employee_id: null,
    employees:   null,
  })
  console.log('      ✅ maryan@gmail.com → Admin')

  console.log('\n' + '─'.repeat(46))
  console.log(`🎉 Done!  ${DEPARTMENTS.length} departments + ${EMPLOYEES.length} employees added.\n`)
  console.log('   Open the app:  npm run dev\n')
  process.exit(0)
}

main().catch(err => {
  console.error('\n❌ Unexpected error:', err.message)
  process.exit(1)
})
