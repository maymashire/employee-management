-- Department seed data
-- Run this once in Supabase SQL Editor after the schema and migrations are applied.
-- Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING.

INSERT INTO public.departments (name, description)
VALUES
  (
    'Engineering',
    'Responsible for software development, system architecture, and technical infrastructure.'
  ),
  (
    'Human Resources',
    'Manages recruitment, onboarding, employee relations, benefits, and organisational policies.'
  ),
  (
    'Finance',
    'Handles budgeting, payroll processing, financial reporting, and cost control.'
  ),
  (
    'Marketing',
    'Drives brand awareness, lead generation, content creation, and market research.'
  ),
  (
    'Operations',
    'Oversees day-to-day business processes, logistics, and cross-team coordination.'
  ),
  (
    'Sales',
    'Manages client acquisition, account management, and revenue generation.'
  ),
  (
    'Customer Support',
    'Provides technical and product assistance to customers post-sale.'
  ),
  (
    'Legal & Compliance',
    'Ensures regulatory compliance, contract management, and risk mitigation.'
  )
ON CONFLICT (name) DO NOTHING;
