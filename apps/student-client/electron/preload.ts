import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Process scanning
    scanProcesses: () => ipcRenderer.invoke('scan-processes'),

    // Quit app (only before exam)
    quitApp: () => ipcRenderer.send('quit-app'),

    // Exam lockdown control
    startLockdown: () => ipcRenderer.send('start-exam-lockdown'),
    endLockdown: () => ipcRenderer.send('end-exam-lockdown'),

    // Log a violation from renderer
    logViolation: (violationType: string) => ipcRenderer.send('log-violation', violationType),

    // Listen for violations from main process
    onExamViolation: (callback: (violation: string) => void) => {
        ipcRenderer.on('exam-violation', (_event, violation) => callback(violation));
    },

    // Remove violation listener
    removeViolationListener: () => {
        ipcRenderer.removeAllListeners('exam-violation');
    },

    // Listen for before-quit event (so renderer can auto-submit exam)
    onBeforeQuit: (callback: () => void) => {
        ipcRenderer.on('before-quit', () => callback());
    },
    removeBeforeQuitListener: () => {
        ipcRenderer.removeAllListeners('before-quit');
    },
});

