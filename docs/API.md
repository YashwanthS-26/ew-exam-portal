# EW Exam Portal - API Documentation

## Auth Endpoints
### `POST /api/auth/login`
- **Body**: `{ email, password }`
- **Response**: `{ message, token, user }`

## Exam Endpoints
### `POST /api/exams/`
- **Body**: `{ title, description, exam_code, start_time, duration_minutes, cooldown_minutes, total_questions_pool, questions_to_display, randomization_enabled, show_results_to_students }`
- **Response**: `Exam object`

### `GET /api/exams/`
- **Response**: `List of Exam objects`

### `POST /api/exams/:id/publish`
- **Description**: Publishes an exam, making it available for students to join.
- **Response**: `Exam object`

## Student Endpoints
### `POST /api/attempts/join`
- **Body**: `{ name, rollNumber, examCode, ipAddress, machineName }`
- **Response**: `{ message, attemptId, examId }`

### `GET /api/attempts/:attemptId/questions`
- **Description**: Fetch randomized questions assigned to the specific attempt. Correct answers are NOT included.
- **Response**: `List of Question objects`

### `POST /api/attempts/:attemptId/submit`
- **Description**: Force evaluate and submit an attempt via REST.
- **Response**: `{ message }`
