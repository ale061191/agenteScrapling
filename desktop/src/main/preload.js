const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // API configuration
  getApiUrl: () => ipcRenderer.invoke('get-api-url'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // Window controls
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  
  // External links
  openExternal: (url) => ipcRenderer.send('open-external', url),
  
  // Updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // Event listeners
  onNavigate: (callback) => {
    ipcRenderer.on('navigate', (event, section) => callback(section))
  },
  
  onTriggerSync: (callback) => {
    ipcRenderer.on('trigger-sync', () => callback())
  },
  
  onExportLeads: (callback) => {
    ipcRenderer.on('export-leads', () => callback())
  },
  
  onOpenSettings: (callback) => {
    ipcRenderer.on('open-settings', () => callback())
  },
  
  onShowAbout: (callback) => {
    ipcRenderer.on('show-about', () => callback())
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel)
  }
})

console.log('Preload script loaded successfully')