import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import compression from 'compression';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(compression()); // Compress responses for Render Free
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

app.get('/api/ready', async (req, res) => {
  try {
    const { error } = await supabase.from('exams').select('id').limit(1);
    if (error) throw error;
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    console.error('Readiness check failed:', err);
    res.status(503).json({ status: 'unavailable' });
  }
});

import authRoutes from './routes/authRoutes';
import examRoutes from './routes/examRoutes';
import studentRoutes from './routes/studentRoutes';
import questionBankRoutes from './routes/questionBankRoutes';

app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/attempts', studentRoutes);
app.use('/api/question-bank', questionBankRoutes);

import { initRedis } from './redisClient';
import { startRedisSyncWorker } from './redisSyncWorker';

initRedis().then(() => {
    startRedisSyncWorker();
}).catch(console.error);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`MYSPECIALSERVER listening on port ${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('SIGTERM/SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed.');
    io.close(() => {
      console.log('Socket.IO closed.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Trigger nodemon restart

// Trigger nodemon restart 2
