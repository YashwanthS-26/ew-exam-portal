import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

// Placeholders for the pages being converted by the subagent
import StudentWelcome from './pages/StudentWelcome';
import ExamInterface from './pages/ExamInterface';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/welcome" element={<StudentWelcome />} />
        <Route path="/exam" element={<ExamInterface />} />
        
        <Route path="/" element={<Navigate to="/welcome" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
