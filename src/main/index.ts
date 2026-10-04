import { app, BrowserWindow, globalShortcut, shell } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { registerIpc } from './ipc/registerIpc'
import { WindowPresentationController } from './windowPresentation'
import { registerOutlierIpc } from './outlier/registerOutlierIpc'

const localEnv = join(process.cwd(), '.env.local')
if (existsSync(localEnv)) loadEnvFile(localEnv)

const instance = process.env.NEB_INSTANCE
if (instance && instance !== 'dev' && /^[A-Za-z0-9_-]+$/.test(instance)) {
  const dataDirectory = join(app.getPath('appData'), `neb-voice-console-${instance}`)
  const sessionDirectory = join(dataDirectory, 'session')
  mkdirSync(sessionDirectory, { recursive: true })
  app.setPath('userData', dataDirectory)
  app.setPath('sessionData', sessionDirectory)
}

let mainWindow: BrowserWindow | null = null
let outlier: ReturnType<typeof registerOutlierIpc> | null = null
const windowPresentation = new WindowPresentationController(
  () => mainWindow ?? undefined,
  globalShortcut,
  () => mainWindow?.webContents.send('window:openConversationMode'),
  () => { outlier?.controller.stop(); mainWindow?.webContents.send('window:stopSpeech') }
)

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1260,
    height: 850,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#0b1020',
    title: 'NEB Voice Console',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      nodeIntegration: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://ai.google.dev/') || url.startsWith('https://aistudio.google.com/')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(async () => {
  outlier = registerOutlierIpc(() => mainWindow?.webContents)
  registerIpc(() => mainWindow?.webContents, windowPresentation)
  createWindow()
  windowPresentation.registerFocusShortcut()
  outlier.controller.setStopAvailable(windowPresentation.isStopShortcutAvailable())
  globalShortcut.register('Ctrl+Alt+P', () => outlier?.controller.pause())
  try { await outlier.initialize() } catch { outlier.controller.disconnect() }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('will-quit', () => { outlier?.close(); globalShortcut.unregister('Ctrl+Alt+P'); windowPresentation.dispose() })
