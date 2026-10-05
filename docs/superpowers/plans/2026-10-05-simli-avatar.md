# Simli Avatar Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task in this session.

**Goal:** Animate a preset using NEB speech in Console and Live on Windows.
**Architecture:** Main issues temporary Simli tokens. One renderer session owns video and received audio; an AudioEngine adapter handles Gemini PCM, replay and cancellation. Existing local audio remains the disabled-avatar path.
**Tech Stack:** Electron, React, TypeScript, simli-client 3.0.2, Vitest, Windows Edge/Playwright.
**Spec:** docs/superpowers/specs/2026-10-05-simli-avatar-design.md

## Global Constraints

- Free preset only; no upgrade or face generation.
- One session; initial avatar disabled; 120-second sessions for testing.
- API key stays in main and ignored local environment; tokens never logged.
- Voice PCM16 mono 24 kHz converts to PCM16 mono 16 kHz continuously.
- Windows-only Electron; WSL master build/test/typecheck then rsync both Windows destinations and commit main.

## Review Focus

- Stop while token/device/client initialization is pending cannot restart playback.
- Silent event inside an utterance cannot finish the turn before queued audio drains.
- Connection loss after playback starts must reject, never hang or silently repeat speech.
- Replay and WAV must not produce two audio outputs.
- Navigation between Console and Live must preserve one mounted video/session.

## Task 1: Main API and PCM conversion

Files: src/shared/avatar.ts, src/main/avatar/provider.ts, src/main/avatar/provider.test.ts, src/renderer/src/avatar/pcm.ts, src/renderer/src/avatar/pcm.test.ts, src/main/ipc/registerIpc.ts, src/shared/contracts.ts, src/preload/index.ts.
Interfaces: getAvatarStatus(): Promise<{configured:boolean}>; createAvatarSession(faceId:string): Promise<{sessionToken:string;iceServers:RTCIceServer[]}>; PcmResampler.push(Uint8Array): Uint8Array; reset(): void.
- [x] Write provider credential/HTTP/validation tests and conversion duration/chunk continuity tests.
- [x] Run targeted tests and confirm missing implementation fails.
- [x] Implement fixed endpoint token/ICE requests with timeouts, allowlisted input and sanitized errors; expose trusted IPC.
- [x] Install pinned official SDK and inspect source for actual endpoints/events.
- [x] Run targeted tests.

## Task 2: Session and audio adapter

Files: src/renderer/src/avatar/session.ts, session.test.ts, AvatarAudioEngine.ts, AvatarAudioEngine.test.ts, src/renderer/src/s2s/speechPlayer.ts.
Interfaces: AvatarSession.connect(video,audio,faceId,deviceId,volume), begin(onStarted,onEnded,onError), append(pcm), finish(), disconnect(); AvatarAudioEngine implements AudioEngine with onStarted and onError callbacks.
- [x] Test cancellation during connect, stale events, silence/final drain, runtime errors and exclusive ownership.
- [x] Implement injectable SDK client creation; connected video and received audio use selected sink.
- [x] Implement bounded resampling, retained Console replay, explicit local-WAV limitation and aborted Live playback.
- [x] Run session/adapter/speechPlayer tests and typecheck.

## Task 3: Shared UI and integration

Files: src/renderer/src/avatar/AvatarPanel.tsx, avatar.css, src/renderer/src/App.tsx, src/renderer/src/live/useLiveConversation.ts, src/renderer/index.html.
- [x] Add shared persistent panel with preset/Face ID, enable toggle, status, local connected timer, disconnect and short speech test.
- [x] Route manual speech and Live through optional avatar AudioEngine. Treat actual received speaking as start; Stop closes session.
- [x] Configure CSP only for verified SDK endpoints. Keep keys outside renderer.
- [x] Run full tests/build/typecheck.

## Task 4: Windows verification and delivery

Files: scripts/avatar/smoke-renderer.mjs (synthetic and --cloud modes), docs/simli-avatar.md.
- [x] Run synthetic browser checks for controls, layout, no local duplicate playback, Stop, replay and Live integration.
- [x] Run a short real preset/audio connection and measure received frames/audio and nonblank video.
- [x] Run existing Live/S2S smoke tests to check regressions.
- [x] Review diff and fix significant findings. Record hardware/cloud limitations truthfully.
- [x] Build/test/typecheck WSL; rsync sources/out and ignored local config to both Windows locations; commit scoped changes on main.

## Execution Record

User approved specification and explicitly requested implementation on 5 October 2026. Inline execution on WSL main follows AGENTS.md. Implementation runs inline; the requesting-code-review skill authorizes a read-only reviewer subagent.

- WSL final verification: build/typecheck succeed; 51 test files, 341 passed and 4 existing Windows-pipe tests skipped.
- Windows Edge synthetic avatar test passes: exclusive audio, generated replay/restart, WebSocket loss/reconnect, Live opening/listening/Stop and compact layout.
- Real Free preset Fred receives 512x512 video (180 decoded frames) and 51,409 incoming audio bytes in the latest short cloud probe. No duplicate local source playback.
- Existing Live and S2S renderer smoke tests pass. S2S smoke exposed a Console replay regression, fixed before delivery.
- Windows staging dependencies installed from lock and native production build passes. Initial Windows file locks resolved after user closed NEB.
- Reviewer findings fixed: transport closure detection, enabled state on remount, active-owner cancellation, and explicit/automatic Live shutdown.
- Physical CABLE routing, perceived lip synchronization and external virtual webcam remain outside headless verification; documented in docs/simli-avatar.md. No paid upgrade or personal face generation.
