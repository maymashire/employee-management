-- fix-trigger.sql
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Fixes:
--   1. employees.role now inserts 'employee' (lowercase) to satisfy
--      the employees_role_check constraint.
--   2. Added ON CONFLICT (id) DO NOTHING so re-registering the same
--      email doesn't crash the trigger with a duplicate-key error.
--   3. COALESCE on first/last name so the row is always created even
--      when signup metadata is empty (e.g. admin-created users).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.employees (id, first_name, last_name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name',  ''),
    NEW.email,
    'employee',            -- lowercase satisfies employees_role_check
    'active'::employee_status
  )
  ON CONFLICT (id) DO NOTHING;   -- safe if the row already exists

  RETURN NEW;
END;
$$;

-- Verify the trigger is still attached (should already exist):
-- SELECT tgname, tgtype FROM pg_trigger
-- WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_created';
