# EW SHIKEN - Complete Technical Documentation

This document serves as the comprehensive technical reference for the **EW SHIKEN** examination platform. It details the system architecture, technology stack, features, and an exhaustive file-by-file breakdown of the repository. This document is intended for developers, AI assistants, and maintainers.

---

## 1. System Architecture overview

EW SHIKEN is a distributed, real-time examination platform composed of three primary pillars and a cloud database layer:

1. **Admin Portal (`apps/admin-portal`)**: A web-based dashboard used by teachers to create exams, monitor students in real-time, and view automatically graded results.
2. **Student Client (`apps/student-client`)**: A deeply locked-down Windows desktop application (Electron) that students use to take the exam securely.
3. **Backend Server (`apps/backend`)**: A Node.js API and WebSocket server that acts as the central hub, managing state, evaluating answers, and relaying real-time monitoring data.
4. **Database (Supabase)**: A hosted PostgreSQL database providing persistent storage for exams, questions, student attempts, and answers.

---

## 2. Technology Stack

### General
*   **Monorepo Structure**: Managed via npm workspaces or standard folder segregation.
*   **Language**: TypeScript / JavaScript across all tiers.

### Backend (`apps/backend`)
*   **Runtime**: Node.js
*   **Web Framework**: Express.js
*   **Real-time Communication**: Socket.IO
*   **Database ORM/Client**: Supabase JS Client (`@supabase/supabase-js`)
*   **Hosting**: Render (Web Service)

### Admin Portal (`apps/admin-portal`)
*   **Framework**: React (Vite)
*   **Styling**: Tailwind CSS
*   **Real-time Communication**: Socket.IO Client
*   **Hosting**: Vercel

### Student Client (`apps/student-client`)
*   **Desktop Framework**: Electron
*   **UI Framework**: React (Vite)
*   **Styling**: Tailwind CSS
*   **Local Persistence**: IndexedDB (via `idb` wrapper) for offline caching
*   **Build Tool**: electron-builder (Targeting Windows `.exe`)

### Database (Supabase / PostgreSQL)
*   **Relational Database**: PostgreSQL
*   **Key Tables**: 
    *   `exams` (Core exam metadata)
    *   `questions` (Exam questions pool)
    *   `student_attempts` (Tracks individual student progress and state)
    *   `answers` (Stores individual student responses via atomic UPSERT)

---

## 3. Core Features

### Security & Anti-Cheat (Student Client)
*   **Pre-exam Process Scanner**: Scans and blocks blacklisted background applications (e.g., Discord, AnyDesk, ChatGPT.exe, browsers) before allowing entry.
*   **Gapless Native Fullscreen**: Bypasses Windows DWM borders to lock the application entirely over the screen using `thickFrame: false`, `fullscreen: true`, and stripping resizing controls.
*   **Taskbar Annihilation**: Executes raw Win32 API calls (`user32.dll ShowWindow`) via PowerShell to completely hide the Windows Taskbar (`Shell_TrayWnd`) at the OS level during the exam.
*   **Shortcut Blocking**: Globally registers and nullifies all common escape shortcuts (`Alt+Tab`, `Alt+F4`, `Windows Key`, `Ctrl+Shift+Esc`, Virtual Desktops).
*   **Focus Tracking**: Immediately regains focus if lost and reports blur events to the invigilator.

### Scalability & Reliability (Backend)
*   **Atomic Upserts**: Answer submissions utilize PostgreSQL `ON CONFLICT` (upsert) mechanics rather than vulnerable Read-Modify-Write cycles to prevent race conditions during mass concurrent submissions.
*   **Connection Resilience**: GZIP compression and aggressive exponential backoff logic on the client-side ensure the server isn't DDoSed by its own clients during network spikes.
*   **Stateless Scaling**: The backend is designed to handle Render's dynamic cycling without losing exam states, as all truth resides in Supabase.

### Real-Time Monitoring (Admin)
*   **Live Dashboards**: Invigilators can watch students' statuses (`JOINED`, `IN_PROGRESS`, `SUBMITTED`, `DISCONNECTED`) update instantly via WebSocket.
*   **Remote Reset**: Invigilators can remotely wipe a student's stalled attempt (e.g., due to a hardware crash) and allow them to re-enter.

---

## 4. File Structure & Responsibilities

### Root Directory
*   `USER_MANUAL.md`: The teacher and student instructional guide.
*   `package.json`: Root configuration file (potentially mapping workspaces).
*   `apps/`: Contains all sub-projects.
*   `supabase/`: Contains PostgreSQL migration files (e.g., `001_create_schema.sql`).

### Backend (`apps/backend`)
Handles API requests and Socket interactions.

*   **`src/server.ts`**: The main entry point. Bootstraps Express, mounts middleware (compression, CORS, JSON body parser), attaches HTTP routes, and initializes the Socket.IO server.
*   **`src/config/supabase.ts`**: Initializes and exports the Supabase client connection.
*   **`src/routes/`**:
    *   `authRoutes.ts`: Admin login and authentication endpoints.
    *   `examRoutes.ts`: Endpoints for CRUD operations on exams and questions.
    *   `studentRoutes.ts`: Endpoints for student joining, fetching questions, and submitting answers.
*   **`src/controllers/`**:
    *   `authController.ts`: Business logic for admin authentication.
    *   `examController.ts`: Handles exam creation, publishing, and dashboard metrics.
    *   `studentController.ts`: Critical logic for student operations, including the resilient `upsert` mechanism for `submit_answers`.
    *   `evaluationController.ts`: Auto-grading logic that compares student answers against correct options.
*   **`src/socket/index.ts`**: Central WebSocket handler. Listens to `join_exam`, `submit_exam`, and `student_disconnect`, emitting state changes back to the Admin Portal.
*   **`src/middleware/authMiddleware.ts`**: Protects admin routes.
*   **`prod-load-test.js`**: A rigorous load-testing script capable of simulating 70+ concurrent student WebSocket and HTTP connections to verify production stability.

### Admin Portal (`apps/admin-portal`)
The teacher's command center.

*   **`src/main.tsx` & `src/App.tsx`**: React entry points and routing definitions.
*   **`src/lib/api.ts`**: Axios wrapper for making HTTP requests to the backend. Points to the live Render URL in production.
*   **`src/lib/socket.ts`**: Socket.IO client instance configured for the admin UI.
*   **`src/pages/`**:
    *   `AdminLogin.tsx`: Login interface.
    *   `AdminDashboard.tsx`: Overview of metrics and gateway to live exams.
    *   `CreateExam.tsx` & `QuestionBuilder.tsx`: UI for generating exam metadata and question pools.
    *   `ExamManagement.tsx`: Tabular view of all exams with ability to Publish/Start.
    *   `LiveMonitoring.tsx`: The real-time WebSocket dashboard displaying student connection states and violation alerts.
    *   `Results.tsx`: Displays final auto-graded scores and answers.
*   **`tailwind.config.js`**: Custom theme and color configurations.

### Student Client (`apps/student-client`)
The secure examination environment.

*   **`electron/main.ts`**: The Electron main process. This is the **most critical security file**. It handles window creation (`fullscreen`, `kiosk`), IPC routing, the `hideTaskbar()`/`showTaskbar()` Win32 PowerShell overrides, global shortcut blocking, and the background process scanner.
*   **`electron/preload.ts`**: Safely exposes IPC channels to the React frontend (e.g., `scan-processes`, `start-exam-lockdown`).
*   **`src/main.tsx` & `src/App.tsx`**: React entry points for the student UI.
*   **`src/lib/db.ts`**: IndexedDB wrapper allowing the app to cache answers locally if the internet connection drops, ensuring no data loss.
*   **`src/pages/`**:
    *   `StudentWelcome.tsx`: Initial screen handling the background process scan and fetching the Exam Code.
    *   `ExamInterface.tsx`: The primary test-taking UI. It pulls questions from the backend, manages local state, sends periodic heartbeat syncs via HTTP to the backend, and handles the final WebSocket submission.

---

## 5. Critical Technical Context for AI Maintainers

When updating this codebase, adhere to the following strict rules based on past production incidents:

1. **Never use Read-Modify-Write for answers**: In `studentController.ts`, never fetch the `answers` JSON block, modify it in JS, and push it back. Under load (70+ students), race conditions will cause data loss. Always rely on Postgres atomic upserts or raw SQL RPC calls.
2. **Electron Fullscreen Constraints**: In `electron/main.ts`, do NOT apply explicit `width` or `height`, nor `resizable: true`. To achieve gapless fullscreen on Windows without exposing the window edge to dragging, you must use `fullscreen: true`, `thickFrame: false`, `resizable: false`, and `movable: false` simultaneously.
3. **Taskbar Hiding**: Standard Electron `kiosk` mode fails on certain Windows 11 builds. The app must execute `[WinBar]::ShowWindow([WinBar]::FindWindow('Shell_TrayWnd',$null),0)` via unencoded PowerShell to guarantee the taskbar is suppressed. 
4. **Render Free Tier Limits**: The backend is hosted on a free tier which goes to sleep. The student client has built-in retry logic to wake it up. Do not implement features that require continuous background polling that would exhaust free tier hours unnecessarily. Use WebSocket events specifically bounded to the `ACTIVE` exam period.
