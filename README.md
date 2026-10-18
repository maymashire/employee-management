# Teamora

> Where teams come together.

**Teamora** is an employee management system covering the people
directory, departments, daily attendance and check-in, payroll and payslips,
analytics, and role-based user accounts. It is built with React, Tailwind CSS and
Firebase Firestore.

## Features

- **Dashboard**: live overview with KPIs and trends, an attendance heatmap, ranked insights, the payroll pipeline, and department health. Widgets can be shown or hidden per user.
- **Employees / Departments**: directory with table and grid views, bulk actions, profiles with attendance, department heads and member management.
- **Attendance**: daily marking with bulk actions, a check-in/out kiosk, team and individual calendar, and period reports with comparisons.
- **Payroll**: salary structure, monthly payroll runs (Draft → Processing → Paid), payslips with printing, history, reports, and payment status.
- **Analytics**: workforce, attendance and performance views by year.
- **Users & Settings**: login accounts with roles, profile photo, password change, preferences such as start page and idle sign-out, and company settings (work hours, payroll days).
- **Command palette**: press `Ctrl/⌘ + K` to jump to any page or employee. Press `Ctrl/⌘ + B` to collapse the sidebar.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18 (Vite), React Router v6, Tailwind CSS, Lucide icons |
| Charts   | Recharts |
| Data     | Firebase Cloud Firestore |
| Hosting  | Vercel (SPA rewrite in `vercel.json`) |

## Roles

| Role    | Access |
|---------|--------|
| Admin   | Everything, including Users and company settings |
| Finance | Payroll, plus the standard pages |
| HR      | Employees, departments, attendance and analytics |
| Manager | Dashboard, directory, attendance and analytics |

Accounts live in the Firestore `users` collection. Passwords are stored only as salted
PBKDF2 hashes (`src/lib/password.js`). The bootstrap admin account is defined in
`src/context/AuthContext.jsx` and works only until it has a password set. Sign in
once, then change the password in **Settings → Security**.

> Sign-in is checked in the browser against Firestore. That is fine for a
> demo or school project. A production deployment should move to Firebase
> Authentication and lock down Firestore security rules.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the VITE_FIREBASE_* values from the Firebase console
npm run dev
```

Optional sample data: `npm run seed:firestore` (requires Firestore rules that allow writes).

## Project structure

```
src/
  components/      layout (Sidebar, Header), ui kit, brand, command palette
  context/         AuthContext (accounts, session), CompanyContext (company settings)
  lib/             firebase + db access layer, password, attendance and people helpers
  pages/
    dashboard/     dashboard data model and widgets
    attendance/    daily, check-in/out, calendar, reports
    payroll/       salary list, process, payslips, history, reports, pay status
    analytics/     workforce / attendance / performance
public/favicon.svg app icon (dotted-ring mark)
```

## Scripts

| Command                  | Description |
|--------------------------|-------------|
| `npm run dev`            | Start the Vite dev server |
| `npm run build`          | Production build |
| `npm run preview`        | Preview the production build |
| `npm run seed:firestore` | Load sample data into Firestore |
