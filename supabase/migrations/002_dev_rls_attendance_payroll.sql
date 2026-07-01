-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 002 — Dev RLS bypass for attendance & payroll tables
-- Run in: Supabase Dashboard → SQL Editor
-- ⚠ Remove these policies before production (Phase 4 auth replaces them)
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "dev: attendance all" ON public.attendance;
DROP POLICY IF EXISTS "dev: payroll all"    ON public.payroll;
DROP POLICY IF EXISTS "dev: profiles read"  ON public.profiles;

CREATE POLICY "dev: attendance all"
  ON public.attendance FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "dev: payroll all"
  ON public.payroll FOR ALL
  USING (true) WITH CHECK (true);

-- Profiles need to be readable so the auth context can fetch role
CREATE POLICY "dev: profiles read"
  ON public.profiles FOR SELECT
  USING (true);
