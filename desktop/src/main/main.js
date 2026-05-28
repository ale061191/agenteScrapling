const { app, BrowserWindow, ipcMain, Menu, Tray, shell, nativeImage } = require('electron')
const path = require('path')
const { spawn, execSync } = require('child_process')
const fs = require('fs')
const log = require('electron-log')

// Configure logging
log.transports.file.level = 'info'
log.transports.file.maxSize = 10 * 1024 * 1024 // 10MB
log.transports.console.level = 'debug'

// Global exception handler
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error)
  app.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// Globals
let mainWindow = null
let tray = null
let pythonServer = null
let isQuitting = false
const isDev = !app.isPackaged

const PYTHON_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'python')
  : path.join(__dirname, '..', 'python')

const PYTHON_SCRIPT = path.join(PYTHON_DIR, 'api_server.py')

// Get Python executable
function getPythonExe() {
  if (process.platform === 'win32') {
    if (app.isPackaged) {
      return path.join(PYTHON_DIR, 'python', 'python.exe')
    }
    return 'C:\\Users\\Voltaje Plus\\AppData\\Local\\Python\\bin\\python.exe'
  }
  return 'python3'
}

function getPort() {
  return 8765
}

function getDashboardUrl() {
  if (isDev) {
    return 'http://localhost:3000'
  }
  if (process.platform === 'win32') {
    return path.join(__dirname, '..', 'resources', 'dashboard', 'index.html')
  }
  return `file://${path.join(__dirname, '..', 'resources', 'dashboard', 'index.html')}`
}

function logStartup(message) {
  log.info(`[Startup] ${message}`)
}

function logPython(message) {
  log.info(`[Python] ${message}`)
}

// Start Python backend server
function startPythonServer() {
  return new Promise((resolve, reject) => {
    const port = getPort()
    const pythonExe = getPythonExe()
    const dbPath = path.join(app.getPath('userData'), 'leads.db')
    
    // Ensure Python directory exists
    if (!fs.existsSync(PYTHON_DIR)) {
      logPython(`Python directory not found: ${PYTHON_DIR}`)
      reject(new Error('Python directory not found'))
      return
    }

    // Copy api_server.py to temp if in dev mode
    let serverScript = PYTHON_SCRIPT
    if (isDev) {
      serverScript = path.join(__dirname, '..', 'python', 'api_server.py')
    }

    logPython(`Starting Python server with: ${pythonExe} ${serverScript}`)
    logPython(`Database path: ${dbPath}`)
    logPython(`Port: ${port}`)

    const env = {
      ...process.env,
      DATABASE_URL: dbPath,
      PORT: String(port),
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
    }

    const proc = spawn(pythonExe, [serverScript], {
      cwd: isDev ? path.join(__dirname, '..', 'python') : PYTHON_DIR,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdoutData = ''
    let stderrData = ''
    let serverReady = false

    proc.stdout.on('data', (data) => {
      const text = data.toString()
      stdoutData += text
      logPython(`[stdout] ${text.trim()}`)
      
      if (text.includes('Running on') || text.includes('Uvicorn running') || text.includes('Flask server started')) {
        if (!serverReady) {
          serverReady = true
          resolve()
        }
      }
    })

    proc.stderr.on('data', (data) => {
      const text = data.toString()
      stderrData += text
      logPython(`[stderr] ${text.trim()}`)
    })

    proc.on('error', (err) => {
      logPython(`Error starting Python: ${err.message}`)
      reject(err)
    })

    proc.on('close', (code) => {
      logPython(`Python server exited with code ${code}`)
      if (!serverReady && code !== 0) {
        reject(new Error(`Python server exited with code ${code}: ${stderrData}`))
      }
    })

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!serverReady) {
        logPython('Python server startup timeout')
        reject(new Error('Python server startup timeout'))
      }
    }, 30000)

    pythonServer = proc
  })
}

// Create main window
function createWindow() {
  const dashboardUrl = isDev 
    ? 'http://localhost:3000/dashboard'
    : getDashboardUrl()

  logStartup(`Loading dashboard: ${dashboardUrl}`)

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Lead Finder Venezuela',
    backgroundColor: '#F9FAFB',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Intercept API requests and redirect to Python backend when in production
  if (!isDev) {
    const { session } = require('electron')
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (details.url.includes('/api/')) {
        // Strip /api prefix and redirect to Python backend
        const apiPath = details.url.split('/api/')[1]
        callback({ redirectURL: `http://localhost:${getPort()}/${apiPath}` })
      } else if (details.url.includes('/dashboard') && !details.url.includes('localhost')) {
        // Serve from embedded dashboard
        callback({})
      } else {
        callback({})
      }
    })
  }

  // Remove menu bar in production
  if (!isDev) {
    mainWindow.setMenuBarVisibility(false)
    mainWindow.setMenu(null)
  }

  mainWindow.loadURL(dashboardUrl)

  mainWindow.once('ready-to-show', () => {
    logStartup('Window ready to show')
    mainWindow.show()
  })

  // Handle window close
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
      if (tray) {
        tray.displayBalloon({
          title: 'Lead Finder',
          content: 'Application minimized to tray. Running in background.'
        })
      }
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }
}

// Create system tray
function createTray() {
  // Create a simple tray icon (16x16 PNG encoded as base64)
  const iconData = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEASURBVDiNpZMxTgJBEMf/s7MJIQgtiIVYWIiFlS9gYWXhI9gILcRCYWEhWFhZUFhZiIWFhYWFhQWJhf8gBAux8DK7s7OzS/xgYIA7M8+8/2Z2ZgYX8F8opRBCCLIsS7+01k8hhHjvP0VEvPcREXlLkuTe87y0VvDOO7dSKgXQ8dxjKeU0DMNXTdPsGGNsvV5PqqqKAPDeG2NMWlXVnff+KcbY9N27d3lZlhLwH8aYL8/z8izL3r4aY0yM8dnzvL8kSaLv+10qivJBa+0BzCzL0lprgJlpmj4Mw/C+1toDeO8hpfw0TfM1iqJ7rfVfAGaW3wL4B7y8Bf0ePZb+AAAAAElFTkSuQmCC'
  )

  tray = new Tray(iconData)
  tray.setToolTip('Lead Finder Venezuela')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Lead Finder',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      label: 'New Search',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
          mainWindow.webContents.send('navigate', 'search')
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Sync Now',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('trigger-sync')
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// Setup IPC handlers
function setupIPC() {
  // Get API URL for renderer
  ipcMain.handle('get-api-url', () => {
    return isDev ? `http://localhost:${getPort()}` : `http://localhost:${getPort()}`
  })

  // Get app info
  ipcMain.handle('get-app-info', () => {
    return {
      version: app.getVersion(),
      platform: process.platform,
      userData: app.getPath('userData'),
      isDev,
    }
  })

  // Minimize to tray
  ipcMain.on('minimize-to-tray', () => {
    if (mainWindow) {
      mainWindow.hide()
    }
  })

  // Check for updates (placeholder for future)
  ipcMain.handle('check-for-updates', async () => {
    return { updateAvailable: false }
  })

  // Open external URL
  ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url)
  })
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Search',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('navigate', 'search')
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Export Leads...',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('export-leads')
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('open-settings')
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('navigate', 'dashboard')
          }
        },
        {
          label: 'Pipeline',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('navigate', 'pipeline')
          }
        },
        {
          label: 'All Leads',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('navigate', 'leads')
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Lead Finder',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-about')
            }
          }
        },
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/ale061191/agenteScrapling')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// App lifecycle
app.whenReady().then(async () => {
  logStartup('App ready, starting...')
  logStartup(`Platform: ${process.platform}`)
  logStartup(`App path: ${app.getAppPath()}`)
  logStartup(`User data: ${app.getPath('userData')}`)

  try {
    // Start Python backend
    logStartup('Starting Python backend server...')
    await startPythonServer()
    logStartup('Python backend started successfully')

    // Setup IPC
    setupIPC()

    // Create menu
    createMenu()

    // Create tray
    createTray()

    // Create window
    createWindow()

    logStartup('Application started successfully')
  } catch (error) {
    log.error('Failed to start application:', error)
    if (mainWindow) {
      mainWindow.show()
      mainWindow.loadURL(`data:text/html,
        <html>
          <body style="font-family: Arial; padding: 40px; background: #F9FAFB;">
            <h1 style="color: #EF4444;">Error Starting Application</h1>
            <p>${error.message}</p>
            <p>Please check the logs for more details.</p>
            <button onclick="window.close()">Close</button>
          </body>
        </html>
      `)
    }
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  } else {
    mainWindow.show()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  logStartup('App quitting...')
  
  if (pythonServer) {
    logPython('Killing Python server...')
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${pythonServer.pid}`, { stdio: 'ignore' })
      } else {
        pythonServer.kill('SIGTERM')
      }
    } catch (e) {
      logPython('Error killing Python server:', e)
    }
  }
})

log.info('Main process module loaded')