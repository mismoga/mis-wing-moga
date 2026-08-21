-- MIS Wing Moga: safe database bootstrap for Supabase Postgres
-- Run this once in Supabase SQL Editor if you want to recreate the table manually.
-- The website also performs the same idempotent initialization at startup.

CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY,
  block_name TEXT NOT NULL DEFAULT '',
  school_name TEXT NOT NULL DEFAULT '',
  udise_code TEXT NOT NULL DEFAULT '',
  pen_number TEXT NOT NULL DEFAULT '',
  student_name TEXT NOT NULL DEFAULT '',
  new_class TEXT NOT NULL DEFAULT '',
  new_section TEXT NOT NULL DEFAULT '',
  new_gender TEXT NOT NULL DEFAULT '',
  bmis_remarks TEXT NOT NULL DEFAULT '',
  document_path TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE students ADD COLUMN IF NOT EXISTS block_name TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_name TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS udise_code TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS pen_number TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_name TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS new_class TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS new_section TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS new_gender TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS;
ALTER TABLE students ADD COLUMN IF NOT EXISTS bmis_remarks TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS document_path TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE students DROP COLUMN IF EXISTS father_name;
ALTER TABLE students DROP COLUMN IF EXISTS old_class;
ALTER TABLE students DROP COLUMN IF EXISTS old_gender;

CREATE UNIQUE INDEX IF NOT EXISTS students_pen_number_unique
ON students (pen_number)
WHERE pen_number IS NOT NULL AND BTRIM(pen_number) <> '';

ALTER TABLE students DROP COLUMN IF EXISTS email_id;
