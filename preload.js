const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  quit: () => ipcRenderer.send('app-quit'),
  toggleNotch: (show) => ipcRenderer.send('notch-toggle', show),
  resizeNotch: (width, height) => ipcRenderer.send('notch-resize', { width, height }),
});
