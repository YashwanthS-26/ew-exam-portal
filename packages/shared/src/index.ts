export type Role = 'admin' | 'teacher';

export type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'ENDED';

export type AttemptStatus = 'WAITING' | 'ACTIVE' | 'SUBMITTED' | 'ENDED_BY_ADMIN' | 'DISCONNECTED' | 'AUTO_SUBMITTED';

export interface User {
    id: string;
    email: string;
    full_name: string;
    role: Role;
}

export interface Exam {
    id: string;
    title: string;
    description: string;
    exam_code: string;
    start_time: string;
    duration_minutes: number;
    cooldown_minutes: number;
    total_questions_pool: number;
    questions_to_display: number;
    randomization_enabled: boolean;
    show_results_to_students: boolean;
    status: ExamStatus;
    created_at: string;
}

export interface Question {
    id: string;
    exam_id: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: string;
    marks: number;
    negative_marks: number;
    order_index: number;
}

export interface StudentAttempt {
    id: string;
    exam_id: string;
    student_name: string;
    roll_number: string;
    ip_address?: string;
    machine_name?: string;
    join_time: string;
    start_time?: string;
    submission_time?: string;
    end_time?: string;
    status: AttemptStatus;
    assigned_question_ids?: string[];
}

export interface StudentAnswer {
    id: string;
    attempt_id: string;
    question_id: string;
    selected_option: string | null;
    is_visited: boolean;
    saved_at: string;
}

// Socket Events Payloads
export interface JoinExamPayload {
    name: string;
    rollNumber: string;
    examCode: string;
    machineName: string;
}

export interface SaveAnswerPayload {
    attemptId: string;
    questionId: string;
    selectedOption: string | null;
}
