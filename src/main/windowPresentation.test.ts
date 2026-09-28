import { describe, expect, it, vi } from 'vitest'
import {
  CONVERSATION_WINDOW_SIZE,
  FOCUS_WINDOW_SHORTCUT,
  WindowPresentationController,
  type PresentationWindow,
  type ShortcutRegistry
} from './windowPresentation'

function createWindow(overrides: Partial<PresentationWindow> = {}): PresentationWindow {
  return {
    getBounds: vi.fn(() => ({ x: 80, y: 120, width: 1260, height: 850 })),
    setBounds: vi.fn(),
    getMinimumSize: vi.fn(() => [980, 680]),
    setMinimumSize: vi.fn(),
    isAlwaysOnTop: vi.fn(() => false),
    setAlwaysOnTop: vi.fn(),
    isMinimized: vi.fn(() => false),
    restore: vi.fn(),
    isVisible: vi.fn(() => true),
    show: vi.fn(),
    focus: vi.fn(),
    ...overrides
  }
}

function createShortcutRegistry(registerResult = true): ShortcutRegistry {
  return {
    register: vi.fn(() => registerResult),
    unregister: vi.fn()
  }
}

describe('WindowPresentationController', () => {
  it('shrinks the window, keeps it on top, then restores the prior presentation', () => {
    const window = createWindow({ isAlwaysOnTop: vi.fn(() => true) })
    const controller = new WindowPresentationController(() => window, createShortcutRegistry())

    expect(controller.setConversationMode(true)).toEqual({ enabled: true, globalShortcutAvailable: false })
    expect(window.setMinimumSize).toHaveBeenCalledWith(CONVERSATION_WINDOW_SIZE.width, CONVERSATION_WINDOW_SIZE.height)
    expect(window.setBounds).toHaveBeenCalledWith({ x: 80, y: 120, ...CONVERSATION_WINDOW_SIZE })
    expect(window.setAlwaysOnTop).toHaveBeenCalledWith(true)

    expect(controller.setConversationMode(false)).toEqual({ enabled: false, globalShortcutAvailable: false })
    expect(window.setBounds).toHaveBeenLastCalledWith({ x: 80, y: 120, width: 1260, height: 850 })
    expect(window.setMinimumSize).toHaveBeenLastCalledWith(980, 680)
    expect(window.setAlwaysOnTop).toHaveBeenLastCalledWith(true)
  })

  it('reports an unavailable global shortcut without blocking conversation mode', () => {
    const window = createWindow()
    const shortcuts = createShortcutRegistry(false)
    const controller = new WindowPresentationController(() => window, shortcuts)

    expect(controller.registerFocusShortcut()).toBe(false)
    expect(shortcuts.register).toHaveBeenCalledWith(FOCUS_WINDOW_SHORTCUT, expect.any(Function))
    expect(controller.setConversationMode(true)).toEqual({ enabled: true, globalShortcutAvailable: false })
  })

  it('restores, shows, and focuses a hidden minimized window', () => {
    const window = createWindow({ isMinimized: vi.fn(() => true), isVisible: vi.fn(() => false) })
    const controller = new WindowPresentationController(() => window, createShortcutRegistry())

    controller.focusWindow()

    expect(window.restore).toHaveBeenCalledOnce()
    expect(window.show).toHaveBeenCalledOnce()
    expect(window.focus).toHaveBeenCalledOnce()
  })

  it('unregisters only the focus shortcut on disposal', () => {
    const shortcuts = createShortcutRegistry()
    const controller = new WindowPresentationController(() => createWindow(), shortcuts)

    controller.registerFocusShortcut()
    controller.dispose()

    expect(shortcuts.unregister).toHaveBeenCalledTimes(1)
    expect(shortcuts.unregister).toHaveBeenCalledWith(FOCUS_WINDOW_SHORTCUT)
  })
})
