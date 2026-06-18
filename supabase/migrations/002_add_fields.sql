-- Migration 002: Add department, submit_reason to student_attempts
ALTER TABLE student_attempts ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE student_attempts ADD COLUMN IF NOT EXISTS submit_reason VARCHAR(50) DEFAULT 'normal';
