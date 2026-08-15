import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://ew-exam-portal-backend.onrender.com';

class SocketService {
  private socket: Socket | null = null;
  private monitorExamId: string | null = null;

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.socket.on('connect', () => {
        console.log('Connected to real-time server:', this.socket?.id);
        // Re-join admin room on every reconnect (covers server restarts)
        this.socket?.emit('admin_join');
        if (this.monitorExamId) {
          this.socket?.emit('admin_monitor_exam', { examId: this.monitorExamId });
        }
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from real-time server — will auto-reconnect');
      });
    }
    return this.socket;
  }

  setMonitorExamId(examId: string | null) {
    this.monitorExamId = examId;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.monitorExamId = null;
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();
export default socketService;
