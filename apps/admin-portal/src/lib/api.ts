import axios from 'axios';

// Configure the base URL for the backend API
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://ew-exam-portal-backend.onrender.com/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
