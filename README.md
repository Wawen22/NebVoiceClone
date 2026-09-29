# NEB Voice Console

Local, manually controlled desktop console for synthetic speech. Gemini 3.8 Flash TTS generates a manually entered script with a prebuilt or user-created replicated voice.

## Architecture

Electron's main process owns settings, the Gemini key, and provider API calls. A sandboxed renderer owns the interface and local audio playback. A narrow, typed preload bridge carries validated operations. See [architecture](docs/architecture.md).

## Requirements

- Target: Windows 10/11 desktop. Development also works on Linux/WSL2 for checks and UI launch.
- Node.js 22.12+ and npm.
- For browser voice routing: VB-Audio VB-CABLE installed on Windows.

## Development

```bash
npm install
npm run dev
```

For audible playback on Windows while editing this WSL checkout, launch the native Windows build from this directory:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w "$PWD/scripts/run-windows.ps1")"
```

The script copies source to `%LOCALAPPDATA%\NEBVoiceConsole\dev`, installs Windows dependencies, and opens Windows Electron. It reads the ignored `.env.local` into the launch process without copying the key into that build directory. Run it again after source changes.

## Build and checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

This builds an unpackaged Electron application. A Windows installer is later work.

## Gemini setup

Get a key in [Google AI Studio](https://aistudio.google.com/api-keys). Set `GEMINI_API_KEY` in your Windows user environment or put it in an ignored project `.env.local` for local development, then restart the app. The renderer never receives it. Run `npm run gemini:check` for a read-only model access check. **Pronuncia** streams PCM audio from Gemini and starts playback when the first chunk arrives; the completed audio remains available for **Riascolta**. If the next generation fails or is stopped, Riascolta still plays the last completed clip; a new completed clip replaces it. Ctrl+Enter speaks, Escape stops, and Ctrl+R replays. Generation metrics are available under **Dettagli generazione**. See [Gemini setup](docs/gemini-setup.md).

## Gemini voice replication

Open **Impostazioni → Crea la tua voce**. Record or select a 10–30 second natural speech sample (MP3 or WAV), then provide a separate recording of yourself reading the exact Italian consent phrase shown in the app. Microphone recording waits for speech and stops after a pause, so you can select a wireless headset and move to a quiet room before talking. Preview each clip and discard any attempt with unwanted sound. The app converts clips locally to 24 kHz mono 16-bit PCM WAV, checks them, and uploads both only after you check the consent box and press **CREA VOCE**. The resulting Google-managed voice ID is saved locally and selected in Console. See [voice replication guide](docs/voice-replication.md).

## Azure setup, MAI-Voice and Personal Voice

Planned as an optional second provider. No Azure credentials or services are used by this version.

## Conversation Mode and browser audio routing

Use **Modalità conversazione** from the Console when an AI conversation is open in Edge. It reduces NEB to the editable script, voice and routing state, Pronuncia, Stop, Riascolta, and its current status. The script remains in memory only and is never saved by this mode.

1. In NEB, select **CABLE Input** as the output device.
2. In Edge, choose **CABLE Output** as the microphone for the AI site.
3. Keep Windows' normal output on the physical headset. To hear NEB while it sends speech into the cable, monitor CABLE Output through that headset as described in [audio routing](docs/audio-routing.md).
4. Open Modalità conversazione, paste or edit the exact reply, then press **Pronuncia**.

Shortcuts: `Ctrl+Enter` speaks, `Escape` stops, `Ctrl+R` replays, and `Ctrl+Alt+V` toggles Conversation Mode from NEB or Edge. `Ctrl+Alt+S` is the global emergency stop for generation or playback while Edge is active. If another app owns a global shortcut, NEB continues normally and the window controls still work.

Use **Volume di uscita** under **Dove si sente** to set the level NEB sends to CABLE Input. It is saved locally and affects Pronuncia and Riascolta only; it never changes the Windows volume, headset volume, or Edge microphone level. Open **Test e istruzioni di routing** for a spoken test phrase, local WAV test, and Edge setup steps.

## Troubleshooting

- Missing output devices: refresh the device list after connecting/installing the device, then restart the app if needed.
- Playback failure: check that the device remains connected and the WAV is readable.
- A Linux Electron window under WSLg may generate audio but remain silent because Chromium opens ALSA and this WSL distro has no ALSA output. Use the native Windows launcher above to play through Windows speakers/headphones.
- No Gemini key shown: set the Windows user environment variable or ignored `.env.local`, then restart the app. Windows and WSL environments are separate.
- In this WSL2 development session, `ELECTRON_RUN_AS_NODE` may be set by the host. Launch with `env -u ELECTRON_RUN_AS_NODE npm run dev`. If Electron reports a missing desktop binary after installation, run `node node_modules/electron/install.js` once.

## Security and privacy

Settings live in Electron's user data directory and contain no secrets. Scripts are kept only in memory; pressing Pronuncia sends the current script to Google Gemini. Generated and imported audio is played locally and is not retained by the app. The renderer has no Node.js access. Voice clips are uploaded to Google only when the user explicitly creates a voice; this app saves only the returned voice ID and metadata.

## Known limitations

Gemini voice replication is verified on the user's project: the stateful clone **Voce di Neb** was created and generated speech was successfully played through VB-CABLE and monitored on the Jabra headset. The project is on Gemini API Tier 1 with prepaid billing. Conversation Mode does not automate Edge, detect turns, save text history, switch Windows devices, or add other TTS providers. The manual desktop smoke script (`node scripts/smoke-desktop.mjs`) makes one real Gemini TTS request and is not part of automated tests.
