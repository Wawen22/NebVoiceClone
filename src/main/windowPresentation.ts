import type { ConversationModeStatus } from '../shared/contracts'

export const FOCUS_WINDOW_SHORTCUT = 'Ctrl+Alt+V'
export const STOP_SPEECH_SHORTCUT = 'Ctrl+Alt+S'
export const CONVERSATION_WINDOW_SIZE = { width: 560, height: 520 } as const

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface PresentationWindow {
  getBounds(): WindowBounds
  getNormalBounds(): WindowBounds
  setBounds(bounds: WindowBounds): void
  getMinimumSize(): number[]
  setMinimumSize(width: number, height: number): void
  isAlwaysOnTop(): boolean
  setAlwaysOnTop(flag: boolean): void
  isMinimized(): boolean
  isMaximized(): boolean
  unmaximize(): void
  maximize(): void
  restore(): void
  isVisible(): boolean
  show(): void
  focus(): void
}

export interface ShortcutRegistry {
  register(accelerator: string, callback: () => void): boolean
  unregister(accelerator: string): void
}

interface PreviousPresentation {
  bounds: WindowBounds
  minimumSize: number[]
  alwaysOnTop: boolean
  maximized: boolean
}

export class WindowPresentationController {
  private conversationModeEnabled = false
  private globalShortcutAvailable = false
  private previousPresentation: PreviousPresentation | null = null

  constructor(
    private readonly getWindow: () => PresentationWindow | undefined,
    private readonly shortcuts: ShortcutRegistry,
    private readonly onConversationRequested: () => void = () => undefined,
    private readonly onStopRequested: () => void = () => undefined
  ) {}

  setConversationMode(enabled: boolean): ConversationModeStatus {
    const window = this.getWindow()
    if (!window) return this.status(false)

    if (enabled && !this.conversationModeEnabled) {
      const maximized = window.isMaximized()
      this.previousPresentation = {
        bounds: maximized ? window.getNormalBounds() : window.getBounds(),
        minimumSize: window.getMinimumSize(),
        alwaysOnTop: window.isAlwaysOnTop(),
        maximized
      }
      if (maximized) window.unmaximize()
      window.setMinimumSize(CONVERSATION_WINDOW_SIZE.width, CONVERSATION_WINDOW_SIZE.height)
      window.setBounds({
        x: this.previousPresentation.bounds.x,
        y: this.previousPresentation.bounds.y,
        ...CONVERSATION_WINDOW_SIZE
      })
      window.setAlwaysOnTop(true)
      this.conversationModeEnabled = true
    }

    if (!enabled && this.conversationModeEnabled) {
      if (this.previousPresentation) {
        window.setBounds(this.previousPresentation.bounds)
        window.setMinimumSize(this.previousPresentation.minimumSize[0] ?? 0, this.previousPresentation.minimumSize[1] ?? 0)
        window.setAlwaysOnTop(this.previousPresentation.alwaysOnTop)
        if (this.previousPresentation.maximized) window.maximize()
      }
      this.previousPresentation = null
      this.conversationModeEnabled = false
    }

    return this.status(this.conversationModeEnabled)
  }

  focusWindow(): void {
    const window = this.getWindow()
    if (!window) return
    if (window.isMinimized()) window.restore()
    if (!window.isVisible()) window.show()
    window.focus()
  }

  registerFocusShortcut(): boolean {
    this.globalShortcutAvailable = this.shortcuts.register(FOCUS_WINDOW_SHORTCUT, () => {
      this.focusWindow()
      this.onConversationRequested()
    })
    this.shortcuts.register(STOP_SPEECH_SHORTCUT, this.onStopRequested)
    return this.globalShortcutAvailable
  }

  dispose(): void {
    this.shortcuts.unregister(FOCUS_WINDOW_SHORTCUT)
    this.shortcuts.unregister(STOP_SPEECH_SHORTCUT)
  }

  private status(enabled: boolean): ConversationModeStatus {
    return { enabled, globalShortcutAvailable: this.globalShortcutAvailable }
  }
}
