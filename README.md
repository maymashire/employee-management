# VibeHR

> Better Culture, Better Work.

An Employee Management System covering employee/department directories, attendance
tracking, payroll processing, analytics, and role-based user access — built with
React, Tailwind CSS, and Supabase.

## Stack

| Layer       | Tech |
|-------------|------|
| Frontend    | React 18 (Vite), React Router v6, Tailwind CSS, Lucide React |
| Charts      | Recharts |
| Backend     | Supabase (PostgreSQL + Auth + Row Level Security) |

## Features

- **Dashboard** — headcount, attendance, and payroll summary tiles
- **Employees / Departments** — full CRUD directories
- **Attendance** — daily log, check-in/out, calendar view, reports
- **Payroll** — salary list, payroll processing (Unpaid → Processing → Paid), payslips, history, reports
- **Analytics** — employee, attendance, and performance dashboards with PDF/Excel export
- **Settings** — user access management mapping system roles (`Admin`, `HR`, `Finance`, `Manager`) to accounts

## Roles

System access roles live in `public.users.role` (`Admin` / `HR` / `Finance` / `Manager`).
This is separate from `public.employees.role`, which is a plain-text directory role
(`employee` / `manager` / `administrator`) describing where someone sits in the org chart —
the two are intentionally not the same field.

| Role    | Access |
|---------|--------|
| Admin   | Everything, including Settings (user management) |
| Finance | Payroll pages + standard access |
| HR      | Employee/attendance management, no payroll |
| Manager | Read-only dashboard/attendance/analytics |

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local` from **Supabase Dashboard → Project Settings → API**:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 3. Set up the database

In the Supabase SQL Editor, run in order:

1. `supabase/schema.sql` — tables, enums, RLS policies
2. `supabase/migrations/*.sql` — in filename order
3. `supabase/seeds/departments_seed.sql` — starter department data

### 4. Seed the admin account

`auth.users` rows can't be created by hand with a usable password (Supabase needs to
hash it itself), so use the seed script instead of raw SQL inserts:

1. Add your **service_role** key (Project Settings → API) to `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
   ```
   This key is server-only — never expose it to the browser or commit it.
2. Run:
   ```bash
   npm run seed
   ```
   This creates/updates the admin auth user, the linked `employees` row, and the
   `public.users` role mapping in one pass.

If you ever hit `employees_role_check` constraint errors from the `handle_new_user`
trigger, run `scripts/fix-trigger.sql` in the SQL Editor — it aligns the trigger's
insert with the constraint.

### 5. Run the app

```bash
npm run dev
```

## Auth bypass (development)

`src/context/AuthContext.jsx` has an `AUTH_BYPASS` flag at the top. While `true`, the
app skips Supabase Auth and grants immediate Admin access — useful while iterating on
features without fighting login state. Set it to `false` to require real sign-in.

## Project Structure

```
src/
  components/        shared layout (Sidebar, Header, ProtectedRoute, etc.)
  context/            AuthContext (Supabase session + role state)
  lib/                Supabase client
  pages/
    attendance/        daily log, check-in/out, calendar, reports
    payroll/            salary list, process, payslips, history, reports
    analytics/          employee / attendance / performance dashboards
scripts/
  seed-admin.js        creates the admin auth user via the Supabase Admin API
  fix-trigger.sql       SQL fix for the handle_new_user signup trigger
supabase/
  schema.sql            full DB schema (tables, enums, RLS)
  migrations/            incremental schema changes, run in order
  seeds/                 starter data
```

## Scripts

| Command         | Description |
|------------------|-------------|
| `npm run dev`     | Start the Vite dev server |
| `npm run build`   | Production build |
| `npm run preview` | Preview the production build locally |
| `npm run seed`    | Seed the default Admin account (requires service_role key) |
