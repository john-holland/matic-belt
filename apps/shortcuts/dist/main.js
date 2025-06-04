"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const Store = __importStar(require("electron-store"));
const store = new Store();
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 800,
        height: 60,
        frame: false,
        transparent: true,
        alwaysOnTop: store.get('alwaysOnTop', true),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    // Hide window initially
    mainWindow.hide();
    // Register global shortcuts
    for (let i = 1; i <= 10; i++) {
        electron_1.globalShortcut.register(`CommandOrControl+Shift+${i}`, () => {
            const shortcut = store.get(`shortcut${i}`);
            if (shortcut) {
                executeCommand(shortcut.command);
            }
        });
    }
}
function executeCommand(command) {
    const { exec } = require('child_process');
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing command: ${error}`);
            return;
        }
        console.log(`Command output: ${stdout}`);
    });
}
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// IPC handlers
electron_1.ipcMain.on('toggle-window', () => {
    if (mainWindow) {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        }
        else {
            mainWindow.show();
        }
    }
});
electron_1.ipcMain.on('update-settings', (event, settings) => {
    store.set('alwaysOnTop', settings.alwaysOnTop);
    store.set('transparency', settings.transparency);
    if (mainWindow) {
        mainWindow.setAlwaysOnTop(settings.alwaysOnTop);
        mainWindow.setOpacity(settings.transparency);
    }
});
electron_1.ipcMain.on('update-shortcut', (event, { index, shortcut }) => {
    store.set(`shortcut${index}`, shortcut);
});
electron_1.ipcMain.handle('get-shortcuts', () => {
    const shortcuts = {};
    for (let i = 1; i <= 10; i++) {
        shortcuts[`shortcut${i}`] = store.get(`shortcut${i}`);
    }
    return shortcuts;
});
//# sourceMappingURL=main.js.map