# EW Exam Portal - Setup Instructions

## 1. Prerequisites
- Node.js (v18+)
- Supabase Project
- Git

## 2. Database Setup (Supabase)
1. Log in to your Supabase Dashboard.
2. Go to **SQL Editor**.
3. Copy the contents of `supabase/migrations/001_create_schema.sql` and run it.
4. Go to **Table Editor** > `users` table > **Insert row**. Add your default admin:
   - `email`: `admin@gmail.com`
   - `password_hash`: `$2a$10$X.a6sJ5Zg5xNq5yX/tLwMeM6NqE6XzD7O7zXzXzXzXzXzXzXzXzX` (Bcrypt hash for `12345678`)
   - `full_name`: `Admin User`
   - `role`: `admin`

## 3. Environment Variables
In `apps/backend/`, create a `.env` file:
```env
PORT=3000
SUPABASE_URL=https://xveakbhekknxpuxzafju.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=super_secret_exam_key
```

## 4. Running the Project Locally

### Install Dependencies
From the root folder (`ew-exam-portal/`):
```bash
npm install
```

### Run Backend
```bash
npm run start:backend
```

### Run Admin Portal (Teacher Web App)
```bash
npm run start:admin
```
Access at: `http://localhost:5173`

### Run Student Client (Electron Desktop App)
```bash
npm run start:student
```
This will launch the secure desktop window.

## 5. Security Notes
- The Student Client requires Windows for process scanning (`tasklist`). To test on Mac, you must mock `ipcMain.handle('scan-processes')` to always return `[]`.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the React apps. It is only meant for the Node.js backend.
