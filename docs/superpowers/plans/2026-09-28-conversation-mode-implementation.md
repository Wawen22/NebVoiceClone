# Conversation Mode and Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make NEB a compact, always-accessible typed voice console for browser-based AI conversations, while refreshing the existing interface into a denser professional design.

**Architecture:** Keep one Electron window and one renderer script buffer. Add a narrow main/preload IPC boundary that controls presentation state and the global focus shortcut. Render regular Console and Conversation Mode from the existing `App` state so speech generation, playback, errors, and manual text editing remain identical in both views.

**Tech Stack:** Electron 44, electron-vite, React 19, TypeScript, Vitest, CSS.

**Spec:** `docs/superpowers/specs/2026-09-28-conversation-mode-design.md`

## Global Constraints

- Use one existing Electron window and do not automate Edge, browser controls, turn detection, or audio-device changes.
- Retain script text only in renderer memory; do not add script history, preset storage, or file import.
- Use `Ctrl+Enter` for Speak, `Escape` for Stop, and attempt global `Ctrl+Alt+V` to focus NEB.
- Conversation mode must expose voice, CABLE Input routing, generation/playback status, Speak, Stop, Replay, and readable errors.
- Keep standard Console, Settings, Diagnostics, Gemini voice replication, and existing audio routing functional.

## Review Focus

- A conflicting global shortcut must leave NEB usable and report that the shortcut is unavailable.
- Switching between normal and conversation views must never clear or submit the current script.
- Conversation Mode with a real speaker selected must warn but still allow speaker-only playback.
- `Escape` during generation must cancel the request in both views; during playback it must stop audio.
- The virtual cable disappearing after startup must update routing status when media devices emit `devicechange`.

---

### Task 1: Window presentation controller and trusted IPC bridge

**Files:**
- Create: `src/main/windowPresentation.ts`
- Create: `src/main/windowPresentation.test.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/ipc/registerIpc.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/shared/contracts.ts`

**Interfaces:**
- Produces `WindowPresentationController` with `setConversationMode(enabled: boolean): ConversationModeStatus`, `focusWindow(): void`, `registerFocusShortcut(): boolean`, and `dispose(): void`.
- Adds `DesktopApi.setConversationMode(enabled: boolean): Promise<ConversationModeStatus>`.
- `ConversationModeStatus` is `{ enabled: boolean; globalShortcutAvailable: boolean }`.

- [ ] **Step 1: Write failing tests for `WindowPresentationController`**

Cover entering mode (save bounds, resize, always-on-top), leaving mode (restore bounds and prior topmost value), unavailable shortcut, focusing a hidden/minimized window, and cleanup unregistering only NEB's accelerator.

- [ ] **Step 2: Run the controller test to verify it fails**

Run: `npm test -- src/main/windowPresentation.test.ts`

Expected: FAIL because `windowPresentation.ts` does not exist.

- [ ] **Step 3: Implement `WindowPresentationController` in `src/main/windowPresentation.ts`**

Inject the minimal BrowserWindow/globalShortcut-shaped interfaces for Vitest. Use `Ctrl+Alt+V`, compact bounds of 560×520, and restore only bounds captured immediately before entering conversation mode.

- [ ] **Step 4: Add the trusted IPC/preload/contracts boundary**

Pass the presentation controller from `src/main/index.ts` to `registerIpc`. Handle `window:setConversationMode` only after `assertTrusted`; expose only the typed boolean argument in the preload bridge. Register the shortcut at app startup and dispose it on quit.

- [ ] **Step 5: Run boundary and controller checks**

Run: `npm run typecheck && npm test -- src/main/windowPresentation.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/windowPresentation.ts src/main/windowPresentation.test.ts src/main/index.ts src/main/ipc/registerIpc.ts src/preload/index.ts src/shared/contracts.ts
git commit -m "feat: add conversation window presentation controls"
```

### Task 2: Conversation state and routing-status selectors

**Files:**
- Create: `src/renderer/src/conversationMode.ts`
- Create: `src/renderer/src/conversationMode.test.ts`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Produces `routingStatus(outputs: AudioOutput[], selectedDeviceId: string): { routed: boolean; label: string; message: string }`.
- Produces `conversationShortcutLabel(status: ConversationModeStatus | null): string`.
- Consumes `ConversationModeStatus` from Task 1 and existing `AudioOutput`.

- [ ] **Step 1: Write failing selector tests**

Assert CABLE Input is routed, a real output emits a non-blocking warning naming that output, an unavailable saved device is warned, and the shortcut label differs for available versus unavailable registration.

- [ ] **Step 2: Run the selector test to verify it fails**

Run: `npm test -- src/renderer/src/conversationMode.test.ts`

Expected: FAIL because `conversationMode.ts` does not exist.

- [ ] **Step 3: Implement the pure selectors**

Keep them free of React and Electron so the routing rules remain directly testable.

- [ ] **Step 4: Integrate view state into `App.tsx`**

Add `conversationMode` and `conversationStatus` state. Toggle through `window.neb.setConversationMode`; retain the existing `script`, `speak`, `stop`, `replay`, status, error, and device-change behavior. Focus the textarea whenever mode is entered. Do not persist the new state.

- [ ] **Step 5: Run selector and type checks**

Run: `npm run typecheck && npm test -- src/renderer/src/conversationMode.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/conversationMode.ts src/renderer/src/conversationMode.test.ts src/renderer/src/App.tsx
git commit -m "feat: add conversation mode state and routing warning"
```

### Task 3: Compact conversation interface and visual-system refresh

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles.css`

**Interfaces:**
- Consumes Task 2 selectors and existing speech/audio callbacks.
- Produces a normal Console view and a conversation-mode layout from the same `App` component.

- [ ] **Step 1: Add the Conversation Mode render path in `App.tsx`**

Render voice/routing state, editable textarea, Speak/Stop/Replay, status/error, and an exit-to-full-console control. Keep `Ctrl+Enter`, `Escape`, and `Ctrl+R` behavior unchanged. Never render provider/audio configuration controls in compact mode.

- [ ] **Step 2: Refresh `styles.css`**

Replace the current broad, heavily outlined style with compact system typography, reduced spacing, restrained navy/slate surfaces, cyan action emphasis, consistent controls, textual status labels, and dedicated compact-mode layout rules. Preserve keyboard focus visibility and existing responsive behavior.

- [ ] **Step 3: Run all automated checks**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

Expected: all commands PASS.

- [ ] **Step 4: Run native Windows acceptance**

Launch `scripts/run-windows.ps1`; select CABLE Input in NEB, monitor CABLE Output through the Jabra headset, select CABLE Output as an Edge site's microphone, then verify paste/edit → Speak, Stop, Replay, normal/compact switching, and `Ctrl+Alt+V` while Edge has focus.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/App.tsx src/renderer/src/styles.css
git commit -m "feat: add compact conversation console"
```

### Task 4: Update operational documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/audio-routing.md`
- Modify: `docs/architecture.md`

**Interfaces:**
- Documents Task 1 accelerator and Task 3 UI without exposing internal IPC details to end users.

- [ ] **Step 1: Document the manual Edge conversation workflow**

Describe choosing CABLE Input in NEB, CABLE Output as the Edge site microphone, monitoring through the physical headset, Conversation Mode, all three keyboard shortcuts, and the fact that script text remains only in memory.

- [ ] **Step 2: Update architecture and known limitations**

Describe the single-window presentation controller and mark browser automation, turn detection, history, and provider expansion as excluded from this release.

- [ ] **Step 3: Verify documentation references and final repository state**

Run: `rg -n 'Phase 3|later routing|history storage is not implemented' README.md docs && git status --short`

Expected: no stale status claims and only intentional changes.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/audio-routing.md docs/architecture.md
git commit -m "docs: describe conversation mode workflow"
```
