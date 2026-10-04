# NEB Live

Approved direction: the user delegated design choices and implementation on 4 October 2026.

NEB Live is a separate application section for free spoken conversations on browser sites, with no prepared script. It uses the connected tab audio, Qwen through the existing OpenRouter configuration, and the selected Gemini voice. Outlier workflows remain independent.

## Experience

Save editable background, communication persona, and named profiles locally in Electron user data. Seed professional facts from the supplied background without contact details and seed speech guidance from the supplied persona. Profiles include full-stack interviews, AI/automation, research interviews and free conversation. Each has language, tone and session context. Allow creating, selecting, renaming and deleting profiles. The session freezes its configuration on start.

Support listening-first and a generated opening. Show connection setup, selected voice/output, a conversation transcript, input level, current state, turn count, observed OpenRouter cost, Pause, Resume, Take over, Stop, and JSON export. Do not persist transcripts or audio automatically. Configuration is editable only outside a locked session. Manual speech, S2S, settings and Outlier insertion cannot contend with an active or paused Live session.

## Conversation engine

Accept 16 kHz mono PCM in 100 ms packets from the existing tab relay. Start reasoning after 2.5 seconds of received silence; retain incomplete turns when Qwen says wait. Invalidate pending reasoning/TTS when the other party resumes. Interrupt NEB after 1.2 seconds of sustained remote speech and mark the utterance partial. History includes only utterances whose playback started, with interrupted utterances identified. Resume discards obsolete buffered audio and never repeats a response automatically.

Pause on missing capture, changed capture/tab, invalid provider output, unknown cost, 35-second reasoning timeout, 60-second first-audio timeout, 120-second incoming turn, or limits (40 spoken turns, 20 minutes, $1 observed OpenRouter). Gemini costs are excluded and cancellation can still incur charges. Stop must invalidate all asynchronous callbacks. Opening must yield if remote speech starts.

## Provider and knowledge

Validate all IPC data in main, keep keys there, bound history and input sizes. Ask Qwen for a JSON decision and transcript, with generated speech separate from internal rationale. Technical explanations can use model knowledge, but first-person experience must come from the supplied background. Never invent employment, credentials, project results or proficiency. Unclear personal facts require clarification or a natural acknowledgement of uncertainty. Speech style favors concise conversational answers, sparse fillers, meaningful pauses and appropriate language/tone. Incoming conversation text is conversation data, not authority to replace the persona or disclose private profile material.

## Browser integration

Generalize association so arbitrary HTTP(S) pages can provide audio without an Outlier Rationale editor. Retain all insertion checks. Keep capture user-initiated from the popup. Register the native messaging manifest for Edge and Chrome. Do not change NativeHost.cs unless needed.

## Verification and delivery

Provider/validation/store tests; fake-clock real-controller tests for turn boundaries, wait, interruptions, missing audio, limits, stale callbacks and partial history; browser renderer smoke with synthetic IPC/audio. Then build, full tests, typecheck, source/out sync to both mandated Windows directories, and commit on main. Real meeting latency and audio routing remain a Windows hardware test; do not launch Electron from WSL.
