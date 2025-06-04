import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import * as path from 'path';
import Store from 'electron-store';

const store = new Store();

interface Shortcut {
  command: string;
  description: string;
}

interface Settings {
  shortcuts: { [key: string]: Shortcut };
  alwaysOnTop: boolean;
  transparency: number;
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 60,
    frame: false,
    transparent: true,
    alwaysOnTop: store.get('alwaysOnTop') as boolean ?? true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  
  // Hide window initially
  mainWindow.hide();

  // Register global shortcuts
  for (let i = 1; i <= 10; i++) {
    globalShortcut.register(`CommandOrControl+Shift+${i}`, () => {
      const shortcut = store.get(`shortcut${i}`) as Shortcut;
      if (shortcut) {
        executeCommand(shortcut.command);
      }
    });
  }
}

function executeCommand(command: string) {
  const { exec } = require('child_process');
  exec(command, (error: any, stdout: string, stderr: string) => {
    if (error) {
      console.error(`Error executing command: ${error}`);
      return;
    }
    console.log(`Command output: ${stdout}`);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.on('toggle-window', () => {
  if (mainWindow) {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  }
});

ipcMain.handle('get-setting', (event, key: string) => {
  return store.get(key);
});

ipcMain.handle('get-shortcuts', () => {
  const shortcuts: { [key: string]: Shortcut } = {};
  for (let i = 1; i <= 10; i++) {
    shortcuts[`shortcut${i}`] = store.get(`shortcut${i}`) as Shortcut;
  }
  return shortcuts;
});

ipcMain.handle('update-settings', async (event, settings: Settings) => {
  // Update shortcuts
  for (const [key, value] of Object.entries(settings.shortcuts)) {
    store.set(key, value);
  }

  // Update window settings
  store.set('alwaysOnTop', settings.alwaysOnTop);
  store.set('transparency', settings.transparency);

  if (mainWindow) {
    mainWindow.setAlwaysOnTop(settings.alwaysOnTop);
    mainWindow.setOpacity(settings.transparency);
  }

  // Re-register shortcuts
  globalShortcut.unregisterAll();
  for (let i = 1; i <= 10; i++) {
    const shortcut = settings.shortcuts[`shortcut${i}`];
    if (shortcut) {
      globalShortcut.register(`CommandOrControl+Shift+${i}`, () => {
        executeCommand(shortcut.command);
      });
    }
  }
}); 