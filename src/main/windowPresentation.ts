import type { ConversationModeStatus } from '../shared/contracts'

export const FOCUS_WINDOW_SHORTCUT = 'Ctrl+Alt+V'
export const CONVERSATION_WINDOW_SIZE = { width: 560, height: 520 } as const

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface PresentationWindow {
  getBounds(): WindowBounds
  setBounds(bounds: WindowBounds): void
  isAlwaysOnTop(): boolean
  setAlwaysOnTop(flag: boolean): void
  isMinimized(): boolean
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
  alwaysOnTop: boolean
}

export class WindowPresentationController {
  private conversationModeEnabled = false
  private globalShortcutAvailable = false
  private previousPresentation: PreviousPresentation | null = null

  constructor(
    private readonly getWindow: () => PresentationWindow | undefined,
    private readonly shortcuts: ShortcutRegistry
  ) {}

  setConversationMode(enabled: boolean): ConversationModeStatus {
    const window = this.getWindow()
    if (!window) return this.status(false)

    if (enabled && !this.conversationModeEnabled) {
      this.previousPresentation = {
        bounds: window.getBounds(),
        alwaysOnTop: window.isAlwaysOnTop()
      }
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
        window.setAlwaysOnTop(this.previousPresentation.alwaysOnTop)
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
    this.globalShortcutAvailable = this.shortcuts.register(FOCUS_WINDOW_SHORTCUT, () => this.focusWindow())
    return this.globalShortcutAvailable
  }

  dispose(): void {
    this.shortcuts.unregister(FOCUS_WINDOW_SHORTCUT)
  }

  private status(enabled: boolean): ConversationModeStatus {
    return { enabled, globalShortcutAvailable: this.globalShortcutAvailable }
  }
}
