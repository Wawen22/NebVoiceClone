# Avatar OBS Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver only NEB's existing avatar video to OBS Virtual Camera, including when NEB is covered or minimized.

**Architecture:** A timed renderer publisher encodes the existing avatar video and sends bounded JPEG frames over trusted IPC. A loopback HTTP relay serves a self-contained OBS page with MJPEG and SSE state. Existing speech routing and Simli session ownership remain unchanged.

**Tech Stack:** Existing Electron, React, TypeScript, Node HTTP/crypto, Vitest, Windows Playwright and authenticated obs-websocket; no new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-05-avatar-obs-output-design.md`, approved by the user on 2026-10-05.

## Global Constraints

- Bind only `127.0.0.1:17890`; persistent per-userData token from at least 32 random bytes; no secret logging, LAN listening or port fallback.
- Output defaults off and is persisted independently of Simli. Enabling it never connects Simli.
- Maximum 15 fps, JPEG quality 0.85, longest side 640 pixels without upsampling, maximum JPEG 256 KiB, one pending encode/IPC.
- Latest-frame-only delivery, maximum four viewers; suspend encoding without viewers; stale after more than three seconds.
- Stop, error, disconnect and disable clear output and invalidate pending frames. No screenshot capture, audio export or duplicate avatar session.
- Keep current Free session/idle limits, audio devices, original OBS scenes and streaming configuration unchanged.
- Never launch Electron from WSL. Run Windows integration checks from Windows; no external calls, recordings or physical-camera fallback.
- Every product-code change batch gets WSL build/test/typecheck, source/out rsync to BOTH Windows directories, then a scoped commit on main. Preserve existing user changes.

## Review Focus

1. Encoding completes after Stop: old generation must not revive a face (Tasks 1 and 3).
2. Forged HTTP Host/token or untrusted IPC sender: reject without leaking configuration (Tasks 1 and 2).
3. A slow OBS viewer: memory stays bounded and other viewers continue (Task 1).
4. Another instance owns the port: explicit export error without breaking speech (Tasks 1 and 2).
5. Windows minimizes NEB: real frames continue for at least 20 seconds, not merely timer callbacks (Task 4).

## File Map And Contracts

- Create `src/shared/avatarOutput.ts`: `AvatarOutputStatus = { enabled: boolean; available: boolean; viewers: number; error?: string }`, `AvatarOutputFrame = { generation: string; jpeg: Uint8Array }`, and `AvatarOutputApi` below.
- API methods: `getAvatarOutputStatus(): Promise<AvatarOutputStatus>`, `setAvatarOutputEnabled(enabled: boolean): Promise<AvatarOutputStatus>`, `getAvatarOutputUrl(): Promise<string>`, `beginAvatarOutput(): Promise<string>`, `publishAvatarOutputFrame(frame: AvatarOutputFrame): Promise<boolean>`, `clearAvatarOutput(generation: string): Promise<void>`.
- Create `src/main/avatar/outputRelay.ts`: configuration persistence, server lifecycle, bounded frame/viewer state. Constructor takes `{ userData: string; port?: number; now?: () => number }`; `port: 0` is test-only. Methods: `start(): Promise<void>`, `close(): Promise<void>`, `getStatus(): AvatarOutputStatus`, `setEnabled(enabled: boolean): AvatarOutputStatus`, `getUrl(): string`, `beginGeneration(): string`, `publish(frame: AvatarOutputFrame): boolean`, `clear(generation: string): void`.
- Create `src/main/avatar/outputPage.ts`: `createAvatarOutputPage(): string`, static same-origin viewer HTML, no configuration or Simli secrets embedded.
- Modify `src/main/index.ts`, `src/main/ipc/registerIpc.ts`, `src/preload/index.ts`, `src/shared/contracts.ts`: relay ownership and trusted API plumbing.
- Create `src/renderer/src/avatar/outputPublisher.ts`: `AvatarOutputPublisher(api: AvatarOutputApi, video: HTMLVideoElement)` with `start(): void`, `setActive(active: boolean): void`, `dispose(): void`. Poll status every 500 ms; use timed capture and local epoch cancellation.
- Modify `src/renderer/src/avatar/AvatarPanel.tsx` and `avatar.css`: checkbox, status and Lucide copy button; stable publisher attached to existing video and existing session snapshot. Existing App Stop already disconnects the avatar; preserve that path.
- Add colocated `outputRelay.test.ts`, `outputIpc.test.ts`, `outputPublisher.test.ts`; extend `scripts/avatar/smoke-renderer.mjs`; create `scripts/avatar/smoke-output.mjs`, `scripts/avatar/configure-obs.mjs` and `docs/avatar-obs.md`.

### Task 1: Bounded Loopback Relay And Viewer

**Files:** shared contract, outputRelay/outputPage and `src/main/avatar/outputRelay.test.ts`.
**Interfaces:** Produces all relay methods and shared types from File Map; no Electron dependency in relay tests.

- [ ] Write red tests using a temporary userData directory, port 0 and fake clock. Pin `enabled === false`, stable token/URL after restart, token entropy source of 32 bytes, loopback address, fixed-port conflict and no port fallback.
- [ ] Add route tests: GET token-authenticated `/`, `/video`, `/events`; reject wrong Host/token, non-GET and unknown paths. Assert CSP has no remote origins and Permissions-Policy denies microphone/camera.
- [ ] Add generation/cap tests: `publish(oldGeneration) === false`, `publish(256 * 1024 + 1 bytes) === false`, reject malformed/non-JPEG input, reject rates above 15 fps, clear after fake-clock advance of 3001 ms. Assert disabled output rejects frames.
- [ ] Add slow-consumer test: accept at most four viewer identities, retain only latest frame and disconnect a socket exceeding 256 KiB writable backlog; other viewers receive the next frame. Pair MJPEG/SSE with a page-generated viewer ID, cap four identities and eight streaming responses, expire orphan identity after three seconds. No socket write queue of pending frames.
- [ ] Run `npm test -- src/main/avatar/outputRelay.test.ts`; verify expected missing-module/implementation failures.
- [ ] Implement relay/config persistence and page. Use randomBytes(32), bounded JSON configuration in userData, GET-only exact routes and no CORS. Clear closes old MJPEG responses so the page replaces its image; SSE and a three-second watchdog hide stale imagery on stream loss. Retry same-origin streams with bounded delay. Use object-fit contain and neutral background only.
- [ ] Run relay tests; expect all passing. Run full verification/sync from Global Constraints, then commit only Task 1 files as `feat: add bounded local avatar video relay`.

### Task 2: Trusted IPC And App Lifecycle

**Files:** main index/registerIpc, preload, contracts and `src/main/avatar/outputIpc.test.ts`.
**Interfaces:** Consumes Task 1 relay; produces all six AvatarOutputApi methods, IPC channels `avatarOutput:status`, `:enabled`, `:url`, `:begin`, `:frame`, `:clear`.

- [ ] Write red tests: foreign sender and non-mainFrame calls throw `Untrusted window.`; nonboolean enable, malformed frames/generation and oversized data are rejected. Assert status never exposes token, key or URL.
- [ ] Add lifecycle tests: failed bind reports `available === false` plus an error; unrelated speech handlers still work; disable revokes generations; shutdown closes all relay sockets. Reading URL requires trusted IPC and does not print it.
- [ ] Run `npm test -- src/main/avatar/outputIpc.test.ts`; verify red.
- [ ] Instantiate relay with app userData after instance-path setup, start before exposing output, inject it into registerIpc and extend DesktopApi/preload. Reuse existing sender/mainFrame checks. Validate boundary data before relay calls. Close relay on app shutdown; publish/dispose operations must tolerate already-closed server.
- [ ] Run IPC tests and existing provider tests; full verification/sync, scoped commit `feat: wire trusted avatar output IPC lifecycle`.

### Task 3: Existing-Video Publisher And Controls

**Files:** outputPublisher/tests, AvatarPanel/avatar.css, renderer smoke fixture.
**Interfaces:** Consumes Task 2 API and the existing HTMLVideoElement; produces publisher lifecycle and Uscita OBS controls, no new Simli client.

- [ ] Write red fake-timer tests: inactive or zero viewers means zero encodes; 1920x1080 becomes 640x360; 512x512 stays 512x512; encode gets JPEG quality 0.85. Assert at most one pending encode/IPC and at most 15 attempts per second.
- [ ] Add race tests: hold encoding pending, set inactive/dispose, resolve encoding and assert zero late publish calls. Existing generation is cleared; reconnect receives a new generation. IPC error only updates export status, never disconnects Simli or invokes speech Stop.
- [ ] Run `npm test -- src/renderer/src/avatar/outputPublisher.test.ts`; verify red.
- [ ] Implement timed canvas capture using the existing video's actual dimensions and readiness; serialize encoding and IPC, drop missed intervals. Refresh viewer/enabled status without overlapping polls. StrictMode cleanup clears its generation, timers and canvas references; no requestAnimationFrame or audio graph changes.
- [ ] Integrate publisher into the stable panel video lifecycle; activate only ready/speaking session phases. Checkbox persists through API, copy button requests URL only on click and writes clipboard without logging. Add tooltip/accessibility labels; disabled relay shows compact error while speech controls remain usable.
- [ ] Extend renderer smoke to assert video element identity and one Simli session across modal open/close and Console/Live navigation; output disable and Stop give neutral output, no extra local audio playback. Keep existing smoke mocks compatible with new optional fixture APIs.
- [ ] Run unit and renderer smoke checks; full verification/sync, scoped commit `feat: publish avatar video to OBS without a modal`.

### Task 4: Windows Background Acceptance And Measurements

**Files:** `scripts/avatar/smoke-output.mjs` and test-result notes in `docs/avatar-obs.md`.
**Interfaces:** Consumes output API/page; harness launches an isolated Windows Electron test instance, not WSL GUI, and controls its window through Electron Playwright.

- [ ] Add a failing integration assertion: `framesDuringMinimized20Seconds >= 200`, changing pixel hashes and monotonic source timestamps, with window actually minimized. Repeat covered and modal closed. Use a deterministic synthetic video first, then real existing Simli session with a long test phrase; synthetic alone is not cloud acceptance.
- [ ] Implement harness assertions for clear on Stop/disconnect/disable within three seconds, reconnection after renderer/relay restart, stable URL and no Console text in output. Use ignored local test screenshots only, never runtime frame persistence.
- [ ] Measure FPS and local added delay with timestamped deterministic frames; assert `fps >= 10` and `p95LocalDelayMs < 250`. Report real Simli observations separately and collect process CPU usage during the same test.
- [ ] Run from Windows Node with Playwright already available in the Windows smoke workspace; record actual versions/results. If minimization or latency fails, stop delivery claims and investigate before extending the architecture; do not silently weaken these assertions.
- [ ] Run regressions and full verification/sync; scoped commit `test: verify Windows avatar output in background` once successful, or document the precise blocking result without marking feature complete.

### Task 5: OBS Setup, Webcam Test And User Handoff

**Files:** configure-obs script, docs/avatar-obs.md, local ignored camera-test fixtures already available.
**Interfaces:** Consumes relay URL via trusted local application access, obs-websocket authenticated local config and existing scene names from spec.

- [ ] Add setup dry-run assertions against a mock OBS requester: preserves Scene/VivoX300, never changes streaming/audio/profile/base resolution, never logs credentials/URL, only removes the task-owned empty window capture after verifying its identity/settings. Refuse destructive replacement of an unexpected existing source.
- [ ] Implement idempotent setup with backup of the original scene configuration without overwriting the existing pre-task backup. Create/update `NEB Avatar - video locale` browser_source in `NEB Avatar`, width 1280, height 720, shutdown false, restart_when_active false; fit and lock its transform. Read websocket password locally only. Never auto-start streaming/recording.
- [ ] Inspect source via authenticated API screenshot: valid changing avatar pixels, neutral letterbox, no app chrome; check Stop gives neutral output. Request the single manual OBS Virtual Camera gear selection of Scene -> NEB Avatar if needed; no unsupported target-changing API workaround.
- [ ] Test local Edge page selecting exact `OBS Virtual Camera` with `audio: false`, no physical fallback. Verify dimensions/changing frames and change OBS Program scene to confirm virtual camera stays pinned, then restore original Program selection. Stop camera after test unless user requests it remain running.
- [ ] Write exact Italian user steps: Windows PowerShell launcher, enable Simli/Uscita OBS, copy local URL into dedicated Browser Source, pin virtual-camera scene, start virtual camera, select website OBS camera and CABLE Output microphone, long phrase/Stop and cleanup. Note free idle disconnect yields neutral output and sites may reject virtual cameras.
- [ ] Execute final WSL build/test/typecheck and relevant smokes, rsync source/out to both Windows destinations and scoped commit `feat: finish OBS avatar webcam setup and guide`. Request final read-only review under the chosen execution method; fix actionable findings and repeat verification before reporting completion.

## Plan Self-Review

Spec coverage checked: limits/security/lifecycle in Tasks 1-3, minimized behavior and metrics in Task 4, OBS preservation/webcam/user instructions in Task 5. Shared method/type names are consistent. Each Review Focus condition has a named owner and explicit assertions. No product code has been changed at this planning stage.
