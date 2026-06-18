import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Setup Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || 'https://xveakbhekknxpuxzafju.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_service_role_key_here';
export const supabase = createClient(supabaseUrl, supabaseKey);

import { setupSocketHandlers } from './socket';

setupSocketHandlers(io);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

import authRoutes from './routes/authRoutes';
import examRoutes from './routes/examRoutes';
import studentRoutes from './routes/studentRoutes';

app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/attempts', studentRoutes);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`MYSPECIALSERVER listening on port ${PORT}`);
});

// Trigger nodemon restart

// Trigger nodemon restart 2
