const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xveakbhekknxpuxzafju.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZWFrYmhla2tueHB1eHphZmp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTcxMDQ4NSwiZXhwIjoyMDk3Mjg2NDg1fQ.ZnNb3lbxGREG_LzjGrCOYdUXhsd7G0yxXvlKkkpx9C8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function createExam() {
  const examCode = 'PROD' + Math.floor(1000 + Math.random() * 9000);
  console.log('Creating exam with code:', examCode);

  const { data: exam, error: examError } = await supabase.from('exams').insert({
    title: 'Production Verification Exam',
    exam_code: examCode,
    start_time: new Date().toISOString(),
    duration_minutes: 60,
    total_questions_pool: 5,
    questions_to_display: 5,
    show_results_to_students: true,
    status: 'published'
  }).select().single();

  if (examError) throw examError;

  const questions = [];
  for (let i = 1; i <= 5; i++) {
    questions.push({
      exam_id: exam.id,
      question_text: `Production Dummy Question ${i}`,
      marks: 1,
      negative_marks: 0,
      option_a: 'Correct Answer',
      option_b: 'Wrong Answer 1',
      option_c: 'Wrong Answer 2',
      option_d: 'Wrong Answer 3',
      correct_option: 'A'
    });
  }

  const { error: qError } = await supabase.from('questions').insert(questions);
  if (qError) throw qError;

  console.log('Exam ID:', exam.id);
  console.log('--- SUCCESS ---');
  console.log('EXAM CODE:', examCode);
}

createExam().catch(console.error);
