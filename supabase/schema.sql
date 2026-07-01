-- ============================================================
-- WorkForce Management Suite — Supabase Schema
-- Idempotent: safe to run multiple times in SQL Editor.
-- ============================================================

-- ─────────────────────────────────────────────
-- 0. EXTENSIONS
-- ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";


-- ─────────────────────────────────────────────
-- 1. DEPARTMENTS
-- ─────────────────────────────────────────────
create table if not exists public.departments (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  description text,
  manager_id  uuid,                          -- FK to employees added below
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.departments is 'Company departments (Engineering, HR, Finance, etc.)';


-- ─────────────────────────────────────────────
-- 2. PROFILES
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  avatar_url  text,
  role        text not null default 'employee' check (role in ('admin', 'employee')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'One-to-one extension of auth.users; stores display name and role.';


-- ─────────────────────────────────────────────
-- 3. EMPLOYEES
-- ─────────────────────────────────────────────
create table if not exists public.employees (
  id              uuid primary key default uuid_generate_v4(),
  profile_id      uuid unique references public.profiles(id) on delete set null,
  department_id   uuid references public.departments(id) on delete set null,
  first_name      text not null default '',
  last_name       text not null default '',
  email           text,
  phone_number    text,
  avatar_url      text,
  role            text not null default 'employee'
                    check (role in ('administrator', 'manager', 'employee')),
  employee_code   text unique,
  job_title       text,
  hire_date       date not null default current_date,
  base_salary     numeric(12, 2) not null default 0 check (base_salary >= 0),
  status          text not null default 'active'
                    check (status in ('active', 'inactive', 'terminated', 'suspended')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.employees is 'Employee records; profile_id links to the Supabase auth user.';

-- Unique partial index on employee email (ignores NULLs)
create unique index if not exists idx_employees_email_unique
  on public.employees (email)
  where email is not null;

-- Add FK from departments.manager_id → employees (safe if already exists)
do $$ begin
  alter table public.departments
    add constraint departments_manager_id_fkey
    foreign key (manager_id) references public.employees(id) on delete set null;
exception when duplicate_object then null;
end $$;


-- ─────────────────────────────────────────────
-- 4. ATTENDANCE
-- ─────────────────────────────────────────────
create table if not exists public.attendance (
  id           uuid primary key default uuid_generate_v4(),
  employee_id  uuid not null references public.employees(id) on delete cascade,
  date         date not null default current_date,
  clock_in     time,
  clock_out    time,
  status       text not null default 'present'
                 check (status in ('present', 'absent', 'late', 'half_day', 'holiday')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (employee_id, date)
);

comment on table public.attendance is 'Daily clock-in / clock-out records per employee.';


-- ─────────────────────────────────────────────
-- 5. PAYROLL
-- ─────────────────────────────────────────────
create table if not exists public.payroll (
  id               uuid primary key default uuid_generate_v4(),
  employee_id      uuid not null references public.employees(id) on delete cascade,
  pay_period_start date not null,
  pay_period_end   date not null,
  base_salary      numeric(12, 2) not null default 0,
  bonuses          numeric(12, 2) not null default 0,
  deductions       numeric(12, 2) not null default 0,
  net_salary       numeric(12, 2) generated always as
                     (base_salary + bonuses - deductions) stored,
  status           text not null default 'draft'
                     check (status in ('draft', 'processed', 'paid')),
  processed_at     timestamptz,
  paid_at          timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (pay_period_end >= pay_period_start),
  unique (employee_id, pay_period_start, pay_period_end)
);

comment on table public.payroll is 'Monthly/period payroll records. net_salary is auto-computed.';


-- ─────────────────────────────────────────────
-- 6. INDEXES
-- ─────────────────────────────────────────────
create index if not exists idx_employees_department  on public.employees(department_id);
create index if not exists idx_employees_status      on public.employees(status);
create index if not exists idx_attendance_employee   on public.attendance(employee_id);
create index if not exists idx_attendance_date       on public.attendance(date);
create index if not exists idx_payroll_employee      on public.payroll(employee_id);
create index if not exists idx_payroll_status        on public.payroll(status);


-- ─────────────────────────────────────────────
-- 7. UPDATED_AT TRIGGER
-- ─────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Drop and recreate triggers so this is idempotent
drop trigger if exists trg_departments_updated_at on public.departments;
create trigger trg_departments_updated_at
  before update on public.departments
  for each row execute procedure public.handle_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at
  before update on public.employees
  for each row execute procedure public.handle_updated_at();

drop trigger if exists trg_attendance_updated_at on public.attendance;
create trigger trg_attendance_updated_at
  before update on public.attendance
  for each row execute procedure public.handle_updated_at();

drop trigger if exists trg_payroll_updated_at on public.payroll;
create trigger trg_payroll_updated_at
  before update on public.payroll
  for each row execute procedure public.handle_updated_at();


-- ─────────────────────────────────────────────
-- 8. AUTO-CREATE PROFILE ON SIGN-UP
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'employee')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─────────────────────────────────────────────
-- 9. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
create or replace function public.current_user_role()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.profiles    enable row level security;
alter table public.departments enable row level security;
alter table public.employees   enable row level security;
alter table public.attendance  enable row level security;
alter table public.payroll     enable row level security;

-- ── PROFILES ──
drop policy if exists "profiles: own read"      on public.profiles;
drop policy if exists "profiles: own update"    on public.profiles;
drop policy if exists "profiles: admin insert"  on public.profiles;
drop policy if exists "profiles: admin delete"  on public.profiles;
drop policy if exists "dev: profiles read"      on public.profiles;

create policy "profiles: own read"
  on public.profiles for select
  using (auth.uid() = id or public.current_user_role() = 'admin');

create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles: admin insert"
  on public.profiles for insert
  with check (public.current_user_role() = 'admin');

create policy "profiles: admin delete"
  on public.profiles for delete
  using (public.current_user_role() = 'admin');

-- Dev bypass — remove before production
create policy "dev: profiles read"
  on public.profiles for select using (true);

-- ── DEPARTMENTS ──
drop policy if exists "departments: authenticated read" on public.departments;
drop policy if exists "departments: admin all"          on public.departments;
drop policy if exists "dev: departments select"         on public.departments;

create policy "departments: authenticated read"
  on public.departments for select
  using (auth.role() = 'authenticated');

create policy "departments: admin all"
  on public.departments for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Dev bypass — remove before production
create policy "dev: departments select"
  on public.departments for select using (true);

-- ── EMPLOYEES ──
drop policy if exists "employees: own read"    on public.employees;
drop policy if exists "employees: admin mutate" on public.employees;
drop policy if exists "dev: employees all"      on public.employees;

create policy "employees: own read"
  on public.employees for select
  using (profile_id = auth.uid() or public.current_user_role() = 'admin');

create policy "employees: admin mutate"
  on public.employees for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Dev bypass — remove before production
create policy "dev: employees all"
  on public.employees for all using (true) with check (true);

-- ── ATTENDANCE ──
drop policy if exists "attendance: own read"   on public.attendance;
drop policy if exists "attendance: own insert" on public.attendance;
drop policy if exists "attendance: own update" on public.attendance;
drop policy if exists "attendance: admin delete" on public.attendance;
drop policy if exists "dev: attendance all"    on public.attendance;

create policy "attendance: own read"
  on public.attendance for select
  using (
    employee_id in (select id from public.employees where profile_id = auth.uid())
    or public.current_user_role() = 'admin'
  );

create policy "attendance: own insert"
  on public.attendance for insert
  with check (
    employee_id in (select id from public.employees where profile_id = auth.uid())
    or public.current_user_role() = 'admin'
  );

create policy "attendance: own update"
  on public.attendance for update
  using (
    employee_id in (select id from public.employees where profile_id = auth.uid())
    or public.current_user_role() = 'admin'
  );

create policy "attendance: admin delete"
  on public.attendance for delete
  using (public.current_user_role() = 'admin');

-- Dev bypass — remove before production
create policy "dev: attendance all"
  on public.attendance for all using (true) with check (true);

-- ── PAYROLL ──
drop policy if exists "payroll: own read"    on public.payroll;
drop policy if exists "payroll: admin mutate" on public.payroll;
drop policy if exists "dev: payroll all"     on public.payroll;

create policy "payroll: own read"
  on public.payroll for select
  using (
    employee_id in (select id from public.employees where profile_id = auth.uid())
    or public.current_user_role() = 'admin'
  );

create policy "payroll: admin mutate"
  on public.payroll for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Dev bypass — remove before production
create policy "dev: payroll all"
  on public.payroll for all using (true) with check (true);


-- ─────────────────────────────────────────────
-- 10. SEED DATA
-- ─────────────────────────────────────────────
insert into public.departments (name, description) values
  ('Engineering',       'Software development, system architecture, and technical infrastructure'),
  ('Human Resources',   'Recruitment, onboarding, employee relations, and benefits'),
  ('Finance',           'Accounting, budgeting, payroll processing, and financial reporting'),
  ('Marketing',         'Brand awareness, campaigns, content creation, and market research'),
  ('Operations',        'Day-to-day business processes, logistics, and cross-team coordination'),
  ('Sales',             'Client acquisition, account management, and revenue generation'),
  ('Customer Support',  'Technical and product assistance to customers post-sale')
on conflict (name) do nothing;
