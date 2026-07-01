-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 003 — Create public.users table (if missing) + RLS policies
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Create the users table if it doesn't already exist ─────────────────
CREATE TABLE IF NOT EXISTS public.users (
  username     TEXT PRIMARY KEY,          -- Supabase Auth email
  role         TEXT NOT NULL              -- 'Admin' | 'HR' | 'Finance' | 'Manager'
                 CHECK (role IN ('Admin', 'HR', 'Finance', 'Manager')),
  employee_id  UUID REFERENCES public.employees(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.users IS
  'Maps a Supabase Auth email to a system role. Managed via the Settings page.';

-- ── 2. Enable RLS (safe if already enabled) ───────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ── 3. Drop any stale policies before recreating them ─────────────────────
DROP POLICY IF EXISTS "users: own read"      ON public.users;
DROP POLICY IF EXISTS "users: admin all"     ON public.users;
DROP POLICY IF EXISTS "dev: users all"       ON public.users;

-- ── 4. Authenticated users can read their own row (by email = username) ───
CREATE POLICY "users: own read"
  ON public.users FOR SELECT
  USING (auth.jwt() ->> 'email' = username);

-- ── 5. Admins can do everything ───────────────────────────────────────────
CREATE POLICY "users: admin all"
  ON public.users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.username = auth.jwt() ->> 'email'
        AND u2.role = 'Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.username = auth.jwt() ->> 'email'
        AND u2.role = 'Admin'
    )
  );

-- ── 6. DEV bypass — remove before production ──────────────────────────────
--    Allows the auth context to read the users table without needing
--    a perfectly bootstrapped RLS chain during development.
CREATE POLICY "dev: users all"
  ON public.users FOR ALL
  USING (true)
  WITH CHECK (true);
