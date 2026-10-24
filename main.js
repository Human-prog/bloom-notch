const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  // Notch window dimensions
  const notchWidth = 180;
  const notchHeight = 32; // collapsed height
  const notchX = Math.floor((screenWidth - notchWidth) / 2); // center horizontally
  const notchY = 0; // pinned to top (camera/notch area)

  mainWindow = new BrowserWindow({
    x: notchX,
    y: notchY,
    width: notchWidth,
    height: notchHeight,
    minWidth: 150,
    minHeight: 32,
    maxWidth: 440,
    maxHeight: 420,
    frame: false,           // no OS window chrome
    transparent: true,      // let the notch blend into the desktop
    alwaysOnTop: true,      // stay above other windows
    fullscreenable: false,
    focusable: true,
    skipTaskbar: true,      // don't show in Windows taskbar
    hasShadow: false,
    resizable: true,
    movable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the notch HTML
  mainWindow.loadFile(path.join(__dirname, 'bloom-notch.html'));

  // Optional: open dev tools in dev mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // On macOS it's common to keep the app running; here we quit on close.
  if (process.platform !== 'darwin') app.quit();
});

// IPC: resize window when notch expands/collapses
ipcMain.on('notch-resize', (event, { width, height }) => {
  if (mainWindow && typeof width === 'number' && typeof height === 'number') {
    const safeW = Math.max(150, Math.min(440, Math.round(width)));
    const safeH = Math.max(32, Math.min(420, Math.round(height)));
    mainWindow.setSize(safeW, safeH, true);
    const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
    const x = Math.floor((screenWidth - safeW) / 2);
    mainWindow.setPosition(x, 0);
  }
});

// IPC: let the notch ask to hide/show (toggle)
ipcMain.on('notch-toggle', (event, show) => {
  if (mainWindow && (show === true || show === false)) {
    if (show) mainWindow.show();
    else mainWindow.hide();
  }
});
