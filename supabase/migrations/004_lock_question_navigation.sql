-- Migration 004: Add lock_question_navigation to exams table
ALTER TABLE exams ADD COLUMN IF NOT EXISTS lock_question_navigation BOOLEAN DEFAULT FALSE;
