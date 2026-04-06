const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const PORT = 11434;
const PROJECT_DIR = path.join(require('os').homedir(), '.gemma4-local');
const VENV_DIR = path.join(PROJECT_DIR, '.venv');
const VENV_PATH = path.join(VENV_DIR, 'bin');
const MODEL = 'mlx-community/gemma-4-e4b-it-4bit';

// Ensure PROJECT_DIR exists
if (!fs.existsSync(PROJECT_DIR)) fs.mkdirSync(PROJECT_DIR, { recursive: true });

let mainWindow = null;
let serverProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 600,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function startServer() {
  const vmlxBin = path.join(VENV_PATH, 'vmlx');

  // nice -n 10: baja la prioridad de CPU para no congelar el Mac al cargar el modelo
  serverProcess = spawn('nice', [
    '-n', '10',
    vmlxBin,
    'serve', MODEL,
    '--port', String(PORT),
    '--host', '127.0.0.1',
    '--reasoning-parser', 'gemma4'
  ], {
    env: {
      ...process.env,
      PATH: `${VENV_PATH}:${process.env.PATH}`,
      VIRTUAL_ENV: VENV_DIR
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  serverProcess.stdout.on('data', (data) => {
    const msg = data.toString();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-log', msg);
    }
  });

  serverProcess.stderr.on('data', (data) => {
    const msg = data.toString();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-log', msg);
    }
  });

  serverProcess.on('close', (code) => {
    serverProcess = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-status', { status: 'stopped', code });
    }
  });

  waitForServer();
}

function waitForServer(attempts = 0) {
  if (attempts > 90) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-status', { status: 'error', message: 'Timeout esperando al servidor' });
    }
    return;
  }

  const req = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const health = JSON.parse(body);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('server-status', {
            status: 'ready',
            memory: health.memory,
            model: health.model_name
          });
        }
      } catch {
        setTimeout(() => waitForServer(attempts + 1), 2000);
      }
    });
  });

  req.on('error', () => {
    setTimeout(() => waitForServer(attempts + 1), 2000);
  });

  req.end();
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    const proc = serverProcess;
    setTimeout(() => {
      try { if (!proc.killed) proc.kill('SIGKILL'); } catch {}
    }, 5000);
    serverProcess = null;
  }
}

// IPC handlers — Setup
ipcMain.handle('check-setup', () => {
  const vmlxBin = path.join(VENV_PATH, 'vmlx');
  return { installed: fs.existsSync(vmlxBin) };
});

ipcMain.handle('run-setup', () => {
  return new Promise((resolve, reject) => {
    const sendProgress = (msg) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('setup-progress', msg);
      }
    };

    sendProgress('Creating virtual environment...');

    const createVenv = spawn('python3', ['-m', 'venv', VENV_DIR], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    createVenv.stderr.on('data', (data) => sendProgress(data.toString()));

    createVenv.on('close', (code) => {
      if (code !== 0) {
        sendProgress('Error: failed to create virtual environment.');
        return reject(new Error('venv creation failed'));
      }

      sendProgress('Virtual environment created. Installing vMLX...');

      const pipBin = path.join(VENV_PATH, 'pip');
      const installVmlx = spawn(pipBin, ['install', 'vmlx'], {
        env: {
          ...process.env,
          PATH: `${VENV_PATH}:${process.env.PATH}`,
          VIRTUAL_ENV: VENV_DIR
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      installVmlx.stdout.on('data', (data) => sendProgress(data.toString()));
      installVmlx.stderr.on('data', (data) => sendProgress(data.toString()));

      installVmlx.on('close', (installCode) => {
        if (installCode !== 0) {
          sendProgress('Error: failed to install vMLX.');
          return reject(new Error('pip install vmlx failed'));
        }
        sendProgress('vMLX installed successfully!');
        resolve({ success: true });
      });
    });
  });
});

// IPC handlers — App
ipcMain.handle('get-config', () => ({
  port: PORT,
  model: MODEL
}));

ipcMain.handle('start-server', () => {
  if (!serverProcess) startServer();
});

ipcMain.handle('quit-app', () => {
  stopServer();
  app.quit();
});

// =================== CONVERSATIONS ===================

const CONV_DIR = path.join(PROJECT_DIR, 'conversations');

function ensureConvDir() {
  if (!fs.existsSync(CONV_DIR)) fs.mkdirSync(CONV_DIR, { recursive: true });
}

function safeId(id) { return /^[a-z0-9]+$/i.test(id) ? id : null; }

ipcMain.handle('conv-save', (_, conversation) => {
  ensureConvDir();
  const id = safeId(conversation.id);
  if (!id) return false;
  const filePath = path.join(CONV_DIR, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2), 'utf-8');
  return true;
});

ipcMain.handle('conv-list', async () => {
  ensureConvDir();
  const files = fs.readdirSync(CONV_DIR).filter(f => f.endsWith('.json'));
  const reads = files.map(file =>
    fs.promises.readFile(path.join(CONV_DIR, file), 'utf-8')
      .then(raw => { const d = JSON.parse(raw); return { id: d.id, title: d.title, created: d.created, updated: d.updated, messageCount: (d.messages || []).length }; })
      .catch(() => null)
  );
  const convos = (await Promise.all(reads)).filter(Boolean);
  convos.sort((a, b) => new Date(b.updated) - new Date(a.updated));
  return convos;
});

ipcMain.handle('conv-load', (_, id) => {
  const sid = safeId(id);
  if (!sid) return null;
  const filePath = path.join(CONV_DIR, `${sid}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
});

ipcMain.handle('conv-delete', (_, id) => {
  const sid = safeId(id);
  if (!sid) return false;
  const filePath = path.join(CONV_DIR, `${sid}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return true;
});

ipcMain.handle('conv-search', async (_, query) => {
  ensureConvDir();
  const q = query.toLowerCase();
  const files = fs.readdirSync(CONV_DIR).filter(f => f.endsWith('.json'));
  const reads = files.map(file =>
    fs.promises.readFile(path.join(CONV_DIR, file), 'utf-8')
      .then(raw => {
        const d = JSON.parse(raw);
        const titleMatch = (d.title || '').toLowerCase().includes(q);
        const contentMatch = (d.messages || []).some(m => (m.content || '').toLowerCase().includes(q));
        if (titleMatch || contentMatch) return { id: d.id, title: d.title, created: d.created, updated: d.updated, messageCount: (d.messages || []).length, matchType: titleMatch ? 'title' : 'content' };
        return null;
      })
      .catch(() => null)
  );
  const results = (await Promise.all(reads)).filter(Boolean);
  results.sort((a, b) => new Date(b.updated) - new Date(a.updated));
  return results;
});

app.whenReady().then(() => {
  createWindow();
  // No auto-start: espera a que el usuario pulse "Arrancar"
});

app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});

app.on('before-quit', () => {
  stopServer();
});
