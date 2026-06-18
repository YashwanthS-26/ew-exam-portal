import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import ExamManagement from './pages/ExamManagement';
import CreateExam from './pages/CreateExam';
import QuestionBuilder from './pages/QuestionBuilder';
import LiveMonitoring from './pages/LiveMonitoring';
import Results from './pages/Results';

import AdminLayout from './components/layout/AdminLayout';

// Guard that redirects to /login if no token; renders AdminLayout with Outlet otherwise
function ProtectedLayout() {
  const token = localStorage.getItem('auth_token');
  if (!token) return <Navigate to="/login" replace />;
  return <AdminLayout />;
}

// Results wrapper: supports /exams/:id/results with pre-selected exam
function ExamResults() {
  const { id } = useParams<{ id: string }>();
  return <Results preSelectedExamId={id} />;
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        
        {/* Protected layout routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<AdminDashboard />} />
          <Route path="/exams" element={<ExamManagement />} />
          <Route path="/results" element={<Results />} />
          <Route path="/exams/create" element={<CreateExam />} />
          <Route path="/exams/:id/questions" element={<QuestionBuilder />} />
          <Route path="/exams/:id/live" element={<LiveMonitoring />} />
          <Route path="/exams/:id/results" element={<ExamResults />} />
        </Route>
        
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
