import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Store from 'electron-store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize secure store
const store = new Store({
  name: 'openai-realtime-auth',
  encryptionKey: 'openai-realtime-secure-key'
});

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    show: false
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, 'dist/index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
});

// Handle app protocol for better security in production
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('openai-realtime', process.execPath, [
      join(__dirname, '.')
    ]);
  }
} else {
  app.setAsDefaultProtocolClient('openai-realtime');
}

// IPC handlers for secure store operations
ipcMain.handle('store-get', async (event, key) => {
  try {
    const encryptedValue = store.get(key);
    if (!encryptedValue) return null;
    
    // If safeStorage is available, decrypt the value
    if (safeStorage.isEncryptionAvailable() && Buffer.isBuffer(encryptedValue)) {
      return safeStorage.decryptString(encryptedValue);
    }
    
    // Fallback for non-encrypted values (backward compatibility)
    return encryptedValue;
  } catch (error) {
    console.error('Error getting from store:', error);
    return null;
  }
});

ipcMain.handle('store-set', async (event, key, value) => {
  try {
    // If safeStorage is available, encrypt the value
    if (safeStorage.isEncryptionAvailable()) {
      const encryptedValue = safeStorage.encryptString(value);
      store.set(key, encryptedValue);
    } else {
      // Fallback for systems without encryption
      store.set(key, value);
    }
    return true;
  } catch (error) {
    console.error('Error setting to store:', error);
    return false;
  }
});

ipcMain.handle('store-delete', async (event, key) => {
  try {
    store.delete(key);
    return true;
  } catch (error) {
    console.error('Error deleting from store:', error);
    return false;
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('store-clear', async () => {
  try {
    store.clear();
    return true;
  } catch (error) {
    console.error('Error clearing store:', error);
    return false;
  }
});