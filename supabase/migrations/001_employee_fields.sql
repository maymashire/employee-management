-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 001 — Add direct employee fields + dev RLS bypass
-- Run this entire script in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Add the missing columns to employees ──────────────────────────────────
--    (IF NOT EXISTS = safe to re-run)

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS first_name   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name    text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email        text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS avatar_url   text,
  ADD COLUMN IF NOT EXISTS role         text NOT NULL DEFAULT 'employee'
    CHECK (role IN ('administrator', 'manager', 'employee'));

-- ── 2. Expand status to include 'suspended' ───────────────────────────────────

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_status_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_status_check
  CHECK (status IN ('active', 'inactive', 'suspended', 'terminated'));

-- ── 3. Unique email (nullable — only enforced when provided) ─────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'employees' AND indexname = 'employees_email_key'
  ) THEN
    CREATE UNIQUE INDEX employees_email_key
      ON public.employees (email)
      WHERE email IS NOT NULL;
  END IF;
END $$;

-- ── 4. TEMPORARY dev RLS bypass ───────────────────────────────────────────────
--    Allows the frontend to read/write without Auth (Phase 4 will replace these).
--    ⚠ DELETE THESE POLICIES before going to production.

DROP POLICY IF EXISTS "dev: employees all"      ON public.employees;
DROP POLICY IF EXISTS "dev: departments select" ON public.departments;

CREATE POLICY "dev: employees all"
  ON public.employees FOR ALL
  USING      (true)
  WITH CHECK (true);

CREATE POLICY "dev: departments select"
  ON public.departments FOR SELECT
  USING (true)
