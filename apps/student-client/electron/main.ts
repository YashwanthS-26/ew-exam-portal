import { app, BrowserWindow, ipcMain, globalShortcut, Menu } from 'electron';
import * as path from 'path';
import { exec, execSync } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let isExamActive = false;
let taskbarHidden = false;

// Blocked processes
const BLOCKED_PROCESSES = [
    'chrome.exe', 'msedge.exe', 'firefox.exe', 'brave.exe', 'opera.exe',
    'ChatGPT.exe', 'Claude.exe', 'Gemini.exe',
    'Code.exe', 'Cursor.exe', 'windsurf.exe', 'Windsurf.exe',
    'Discord.exe', 'Telegram.exe', 'WhatsApp.exe',
    'AnyDesk.exe', 'TeamViewer.exe', 'TeamViewer_Service.exe',
];

// PowerShell snippet to hide/show Windows taskbar using Win32 API
// Use single quotes inside the class definition, or avoid them by using a script block
const TASKBAR_PS_SCRIPT = `
Add-Type -TypeDefinition "using System;using System.Runtime.InteropServices;public class WinBar{[DllImport(\\"user32.dll\\")]public static extern IntPtr FindWindow(string a,string b);[DllImport(\\"user32.dll\\")]public static extern bool ShowWindow(IntPtr h,int n);}" -ErrorAction SilentlyContinue;
`;

function hideTaskbar() {
    if (taskbarHidden) return;
    try {
        const script = Buffer.from(`${TASKBAR_PS_SCRIPT};[WinBar]::ShowWindow([WinBar]::FindWindow('Shell_TrayWnd',$null),0)`, 'utf16le').toString('base64');
        execSync(`powershell -EncodedCommand ${script}`, { timeout: 3000 });
        taskbarHidden = true;
    } catch (_) {
        // Non-fatal: taskbar stays visible but exam still works
    }
}

function showTaskbar() {
    if (!taskbarHidden) return;
    try {
        const script = Buffer.from(`${TASKBAR_PS_SCRIPT};[WinBar]::ShowWindow([WinBar]::FindWindow('Shell_TrayWnd',$null),1)`, 'utf16le').toString('base64');
        execSync(`powershell -EncodedCommand ${script}`, { timeout: 3000 });
        taskbarHidden = false;
    } catch (_) { }
}

function createWindow() {
    Menu.setApplicationMenu(null);


    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        fullscreen: true,
        kiosk: true,          // TRUE kiosk: hides taskbar chrome at OS level
        skipTaskbar: false,
        resizable: false,
        frame: false,
        movable: false,
        maximizable: false,
        minimizable: false,
        closable: false,
        alwaysOnTop: true,
        title: 'EW Exam Portal - Student',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            devTools: false,
        },
    });

    // Also hide taskbar via Win32 API as extra layer
    hideTaskbar();

    // Block DevTools
    mainWindow.webContents.on('devtools-opened', () => {
        mainWindow?.webContents.closeDevTools();
    });

    // Block right-click context menu
    mainWindow.webContents.on('context-menu', (e) => {
        e.preventDefault();
    });

    // Prevent navigation away from app
    mainWindow.webContents.on('will-navigate', (e, url) => {
        if (!url.startsWith('http://localhost:5174') && !url.startsWith('file://')) {
            e.preventDefault();
        }
    });

    // Block close attempts during exam
    mainWindow.on('close', (e) => {
        if (isExamActive) {
            e.preventDefault();
            mainWindow?.webContents.send('exam-violation', 'close_attempt');
        } else {
            showTaskbar();
        }
    });

    if (app.isPackaged) {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    } else {
        mainWindow.loadURL('http://localhost:5174');
    }
}

app.whenReady().then(() => {
    createWindow();

    // Register ALL blocking shortcuts immediately on launch
    registerBlockedShortcuts();

    // Re-register on focus (Windows can drop global shortcuts)
    app.on('browser-window-focus', () => {
        registerBlockedShortcuts();
        // Force window back on top
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
            mainWindow.focus();
        }
    });

    // Focus lost → refocus immediately
    app.on('browser-window-blur', () => {
        setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.setAlwaysOnTop(true, 'screen-saver');
                mainWindow.focus();
            }
        }, 80);
        if (isExamActive) {
            mainWindow?.webContents.send('exam-violation', 'focus_lost');
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Restore taskbar and quit cleanly
app.on('before-quit', () => {
    // Notify renderer so it can auto-submit if exam is active
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('before-quit');
        // Give renderer 1.5s to submit before actually quitting
    }
    showTaskbar();
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    showTaskbar();
    if (process.platform !== 'darwin') app.quit();
});

// ─── IPC: Quit app (only allowed before exam starts) ─────────────────────────
ipcMain.on('quit-app', () => {
    if (!isExamActive) {
        showTaskbar();
        globalShortcut.unregisterAll();
        app.exit(0);
    }
});

// ─── IPC: Scan running processes for blocked apps ─────────────────────────────
ipcMain.handle('scan-processes', async () => {
    return new Promise((resolve) => {
        // Try PowerShell first (more robust on modern Windows)
        exec('powershell -NoProfile -Command "Get-Process | Select-Object -ExpandProperty Name"', (err, stdout) => {
            if (!err && stdout) {
                const running = stdout.toLowerCase().split('\n').map(l => l.trim());
                const blocked = BLOCKED_PROCESSES
                    .map(p => p.replace('.exe', '').toLowerCase())
                    .filter(p => running.includes(p));
                
                resolve({ success: true, blocked });
                return;
            }

            // Fallback to tasklist if PS fails
            exec('tasklist /fo csv /nh', (err2, stdout2) => {
                if (err2) {
                    // Both failed - return error so frontend can block
                    resolve({ success: false, error: 'Failed to scan background processes. Please contact invigilator.', blocked: [] });
                    return;
                }
                const lines = stdout2.toLowerCase();
                const blocked = BLOCKED_PROCESSES
                    .map(p => p.toLowerCase())
                    .filter(p => lines.includes(p))
                    .map(p => p.replace('.exe', ''));
                resolve({ success: true, blocked });
            });
        });
    });
});

// ─── IPC: Start exam lockdown ────────────────────────────────────────────────
ipcMain.on('start-exam-lockdown', () => {
    isExamActive = true;
    if (mainWindow) {
        mainWindow.setKiosk(true);
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        mainWindow.setClosable(false);
        registerBlockedShortcuts();
        hideTaskbar();
    }
});

// ─── IPC: End exam lockdown ───────────────────────────────────────────────────
ipcMain.on('end-exam-lockdown', () => {
    isExamActive = false;
    if (mainWindow) {
        mainWindow.setAlwaysOnTop(false);
        mainWindow.setClosable(true);
    }
    showTaskbar();
    globalShortcut.unregisterAll();
});

// ─── IPC: Log violation from renderer ────────────────────────────────────────
ipcMain.on('log-violation', (_event, violationType: string) => {
    console.log(`[VIOLATION] ${new Date().toISOString()} - ${violationType}`);
    mainWindow?.webContents.send('exam-violation', violationType);
});

// ─── Blocked shortcuts ────────────────────────────────────────────────────────
function registerBlockedShortcuts() {
    const shortcuts = [
        // Clipboard / editing
        'CommandOrControl+C', 'CommandOrControl+V', 'CommandOrControl+X',
        'CommandOrControl+A', 'CommandOrControl+Z',
        // DevTools / refresh
        'CommandOrControl+Shift+I', 'CommandOrControl+R', 'CommandOrControl+Shift+R',
        'CommandOrControl+F5', 'F12', 'F5', 'F11',
        // New window / tab
        'CommandOrControl+N', 'CommandOrControl+T', 'CommandOrControl+W',
        // System
        'Alt+F4',
        'Alt+Tab',
        'CommandOrControl+Escape',
        // Windows key combos
        'Super+D',        // Show desktop
        'Super+L',        // Lock screen
        'Super+Tab',      // Task view
        'Super+E',        // File explorer
        'Super+R',        // Run dialog
        'Super+S',        // Search
        'Super+I',        // Settings
        'Super+M',        // Minimize all
        'Super+P',        // Projection
        // Virtual desktop switching (3-finger swipe maps to these)
        'CommandOrControl+Super+Left',
        'CommandOrControl+Super+Right',
        'CommandOrControl+Super+D',   // New virtual desktop
        'CommandOrControl+Super+F4',  // Close virtual desktop
        // Task manager
        'CommandOrControl+Shift+Escape',
        'CommandOrControl+Alt+Delete',
        // Screenshot
        'Super+Shift+S', 'PrintScreen',
    ];

    shortcuts.forEach(sc => {
        try {
            if (!globalShortcut.isRegistered(sc)) {
                globalShortcut.register(sc, () => {
                    if (isExamActive) {
                        mainWindow?.webContents.send('exam-violation', `blocked_shortcut:${sc}`);
                    }
                    // Regardless of exam state, block the shortcut (return nothing)
                });
            }
        } catch (_) { /* Some shortcuts may not register on all OSes */ }
    });
}
