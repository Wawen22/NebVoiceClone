# NEB Voice Console conversation mode and visual refresh

## Purpose

NEB Voice Console is used as a private typed voice interface during open, browser-based conversations with AI models in Microsoft Edge. The user pastes and edits each response manually, then sends it through the selected virtual audio cable as their replicated voice. The model normally waits for that response.

The work must make this interaction fast, calm, and unambiguous. It must not attempt to detect turns, automate browser controls, retain scripts, or introduce a browser extension.

## Scope

### Conversation mode

Conversation mode is a compact state of the existing Electron window, reached from the Console. It does not create a second process or another renderer.

It contains only:

- replicated/prebuilt voice and routing status;
- a large editable script field, initially focused;
- Speak, Stop, and Replay controls;
- the existing generation/playback status and readable error state.

The current text remains after Speak, Stop, Replay, and switching between standard Console and Conversation mode. It is never written to disk or restored after an app restart.

`Ctrl+Enter` sends speech, `Escape` stops, and `Ctrl+Alt+V` shows and focuses the Electron window when it is behind Edge. The global shortcut must be registered only while the app is running and cleanly unregistered when it exits. If another application already owns it, NEB continues normally and shows the in-app shortcut without claiming that it is global.

Conversation mode keeps the window always on top and uses a compact practical size suitable beside an Edge call. Leaving it restores the previous window size and always-on-top state. The app must never change a Windows output device or a browser microphone choice itself.

When the selected output is not a VB-CABLE playback endpoint, conversation mode displays a compact routing warning. It does not prevent standard speaker-only use.

### Visual refresh

The standard Console, Settings, Diagnostics, and replication wizard retain their functions and existing controls. The visual system is refreshed with these rules:

- compact system-font typography with a clear three-level hierarchy;
- smaller spacing, control heights, and sidebar width;
- restrained navy/slate surfaces with a single cyan action color;
- fewer shadows and visible borders; panels group information without looking boxed-in;
- consistent button, input, select, chip, notice, and status styles;
- status is conveyed with text as well as color;
- no decorative animations that delay interaction.

Conversation mode has its own reduced layout, but shares the same controls, colors, states, and keyboard behavior as the regular composer.

## Architecture

The renderer owns the conversation-mode view state and all existing speech/audio behavior. A small typed preload operation is added for window presentation and application shortcut state:

- `setConversationMode(enabled)` resizes the current window and applies/removes always-on-top;
- `focusConversationWindow()` brings the existing window to front;
- startup registration asks Electron to register `Ctrl+Alt+V`, which calls `focusConversationWindow`;
- a status result tells the renderer whether the shortcut is globally available.

Window geometry is presentation state only. It is not a user script, voice, or audio artifact and will not be persisted in the first implementation.

The existing `script`, audio engine, cancellation request ID, and status/error state remain the single source of truth. Conversation mode composes them into a smaller view; it must not duplicate synthesis requests or maintain a second script buffer.

## Interaction flow

1. The user opens Conversation mode, then returns to Edge.
2. `Ctrl+Alt+V` focuses NEB when a response is needed.
3. The script field has focus. The user pastes or edits text.
4. `Ctrl+Enter` sends the exact visible text to Gemini and routes playback to the selected output, normally CABLE Input.
5. `Escape` cancels in-flight generation or stops playback.
6. The user edits the unchanged text to send a revision, or uses Replay for the loaded audio.

## Error handling

- Empty text and unavailable Gemini keep Speak disabled.
- Routing warnings name the currently selected output and say that the browser must still be configured with CABLE Output as its microphone.
- API, rate-limit, playback, and cancellation errors reuse the existing user-readable error presentation.
- Shortcut registration failure is non-fatal and disclosed in Conversation mode. The app remains usable through its window and standard shortcuts.

## Verification

Automated checks cover:

- window bridge payload validation and mode state;
- normal and compact composer action eligibility;
- shortcut registration cleanup;
- no change to script text when toggling mode, stopping, or replaying;
- routing warning selection logic.

Manual Windows acceptance covers:

1. selecting CABLE Input in NEB and CABLE Output as the browser microphone;
2. monitoring CABLE Output through the Jabra headset;
3. pasting/editing a phrase, speaking it, and hearing it in the headset and browser test call;
4. focusing NEB with `Ctrl+Alt+V` while Edge is active;
5. Stop and Replay behavior during a live browser conversation.

## Explicit exclusions

- browser extension or browser automation;
- turn detection or automatic speech dispatch;
- text/script history, saved presets, and local file import for scripts;
- automatic audio-device switching;
- additional TTS providers.
