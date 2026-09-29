# Architecture and implementation plan

## Current structure

```text
src/
  main/       Electron lifecycle, guarded IPC, settings, Gemini adapter
  preload/    Small typed desktop API
  renderer/   React console, diagnostics, WAV AudioEngine
  shared/     Provider/audio/settings contracts and runtime validation
```

The layout follows the requested separation. `preload` has its own directory so the Electron security boundary stays visible. `electron-vite` builds main, preload, and renderer from one configuration.

## Decisions

- Renderer: sandboxed, context isolation enabled, Node integration disabled.
- Main: settings, Gemini SDK calls, two optional environment keys, and encrypted storage for one additional key entered through the app. Environment keys stay outside the renderer. The user-entered key passes through the renderer only when entered; settings JSON stores only the active key source.
- IPC: individual named operations, sender/frame check, runtime settings and speech request validation. No generic invoke bridge.
- AudioEngine: browser media playback using `HTMLAudioElement.setSinkId` for local WAV output selection, including the Windows VB-CABLE route.
- Provider: `TtsProvider` contract and Gemini adapter using the official `@google/genai` SDK. Azure remains a later adapter.
- Exact script: the validated request preserves raw text and passes it unchanged to Gemini's transcript field. No autonomous line selection.
- Cancellation: Escape/STOP pauses playback at once, invalidates the current renderer request, and aborts a pending SDK request when possible.
- Conversation Mode: one renderer script buffer is presented in either the full Console or compact window view. A narrowly scoped main-process presentation controller resizes the existing window, keeps it on top, restores its prior geometry, and registers `Ctrl+Alt+V` to open it from Edge plus `Ctrl+Alt+S` to stop speech globally while the app runs.
- Output volume: a locally persisted scalar is applied by the renderer AudioEngine before local playback to the selected output. It does not alter Windows or browser device settings.
- Manual control: the application does not automate Edge, detect turns, save script history, change Windows audio devices, or control a browser microphone.

## Sequence

1. Foundation and local audio path (complete in WSL2 and Windows).
2. Gemini key checkpoint, real key validation, standard voice synthesis (implemented and smoke tested).
3. Consent checkpoint, Gemini voice replication, direct listening test.
4. Windows VB-CABLE end-to-end routing test (complete with manual headset monitoring).
5. Compact Conversation Mode for manual Edge conversations (complete).
6. Azure standard MAI voice, then gated Personal Voice if eligible.
7. Queue, history, Voice Lab and diagnostics expansion.

## Documentation checked on 2026-09-28

- [Gemini 3.8 TTS](https://ai.google.dev/gemini-api/docs/speech-generation): transcript is separate from `speech_metadata`; supported IDs include `gemini-3.8-flash-tts` and `gemini-3.8-flash-lite-tts`.
- [Gemini voice replication](https://ai.google.dev/gemini-api/docs/voice-replication): `@google/genai` creates a stateful voice after the user records reference and consent audio and explicitly starts enrollment.
- [MAI voices](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/mai-voices): MAI-Voice-2-Flash is documented for Azure Speech/SSML and Voice Live. No Azure SDK is installed yet.
- [Electron IPC and context isolation](https://www.electronjs.org/docs/latest/tutorial/ipc): small preload functions wrap `ipcRenderer.invoke`.
