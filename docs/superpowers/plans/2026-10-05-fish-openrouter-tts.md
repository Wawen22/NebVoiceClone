# Fish OpenRouter TTS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Confrontare Gemini con Fish Free/Pro in Console e Live usando la voce dell'utente, audio incrementale compatibile con Simli e tempi misurabili.

**Architecture:** Adapter Fish nel main, dispatch speech condiviso, riferimento audio cifrato in userData e selezione distinta dai profili Gemini. Il contratto verso renderer e motori rimane PCM16 LE mono 24 kHz. La prova del formato remoto precede l'integrazione; il Free non passa automaticamente al Pro.

**Tech Stack:** Electron, TypeScript, React, fetch/Web ReadableStream, safeStorage, Vitest, Playwright Windows/Edge; toolchain esistente senza nuovo SDK TTS.

**Spec:** `docs/superpowers/specs/2026-10-05-fish-openrouter-tts-design.md` (approvata dall'utente).

## Global Constraints

- Gemini default, clone e profili Gemini intatti; Qwen, acquisizione scheda, OBS e sessione Simli continua non cambiano.
- Modelli Fish consentiti: `fish-audio/s2.1-pro-free:free` e `fish-audio/s2.1-pro`; chiave solo `OPENROUTER_API_KEY` nel main.
- Riferimento: WAV PCM16 mono, 16/24/44.1/48 kHz, 5-60 secondi, massimo 6 MiB; consenso esplicito e trascrizione.
- Campione/trascrizione cifrati fuori dal repo; no plaintext fallback, no upload automatico di vecchi campioni Gemini, no audio/base64/chiavi/percorsi nei log.
- Nessun pagamento, abbonamento, retry a pagamento o fallback automatico; prova Pro solo con approvazione del costo.
- Tutti i checkpoint di codice: `npm run build`, `npm test`, `npm run typecheck`, rsync src/out/scripts/docs verso entrambi i mirror Windows, commit scoped su main WSL.
- Mirror: `/mnt/c/Users/r.nebili/.codex/worktrees/outlier-s2s/NebVoiceGenerator/` e `/mnt/c/Users/r.nebili/AppData/Local/NEBVoiceConsole/dev/`.
- Non avviare Electron da WSL; Windows PowerShell e Playwright Windows per prove runtime.

## Review Focus

- Stop mentre un chunk e ancora in transito: non riparte audio e non rilascia lo slot di una nuova generazione (Task 3/4).
- Settings legacy o profilo Fish cancellato: Gemini rimane invariato, Fish segnala riferimento mancante senza scegliere un'altra voce (Task 2/4).
- Audio network frammentato su un byte o formato ambiguo: campioni corretti o errore esplicito, mai velocita sbagliata (Task 1/3).
- Fish pronto con Gemini non configurato: Live Fish deve poter partire, automazione S2S Gemini mantiene i suoi prerequisiti (Task 4).
- Errori remoti contenenti input sensibile e cifratura non disponibile: nessuna fuga nei log e nessun file in chiaro (Task 2/3).

## File Map

- Shared: `fishVoice.ts` valida WAV/riferimenti; `speechRequest.ts` dispatch validazione/build; contracts/settings estesi senza spostare profili Gemini.
- Main: `config/fishVoiceStore.ts` gestione cifrata; `providers/fish.ts` HTTP streaming; `providers/pcmStream.ts` adattamento incrementale; `providers/speech.ts` dispatch; registrazione IPC esistente resta titolare di trusted sender, slot e AbortController.
- Renderer: `FishVoicePanel.tsx` profilo e consenso; `SecondaryViews.tsx` selettori; `App.tsx` stato e routing; builder Live riusa il builder speech condiviso.
- Probe: `scripts/voice/probe-fish.mjs`; accettazione renderer/Windows: `scripts/voice/smoke-fish.mjs`, piu regressioni `scripts/live/smoke-renderer.mjs`.

### Task 1: Verificare Il Trasporto Prima Di Collegarlo

**Files:** Create `scripts/voice/probe-fish.mjs`, `scripts/voice/probe-fish.test.mjs`, `docs/fish-tts.md`.
**Interfaces:** CLI `node scripts/voice/probe-fish.mjs --reference <wav> --transcript-file <txt> --consent`; default Free, `--paid` seleziona Pro solo esplicitamente. Output metadata sanitizzati: modello, HTTP status, content type, primo byte, completamento, byte count, chunk count, formato verificato. Nessuna chiave o riferimento in output.

- [x] Scrivere test Node per mancanza consenso, input invalido, default Free, opt-in Pro e redazione di errori; assert nessun fetch per gli input rifiutati e modello Free esatto senza `--paid`.
- [x] Eseguire `node --test scripts/voice/probe-fish.test.mjs`: devono fallire prima dell'implementazione.
- [x] Implementare il probe con fetch AbortSignal, primi byte preservati, limite download 32 MiB, primo byte entro 15 secondi e durata totale massima 120 secondi. Non leggere campioni personali automaticamente. Il probe non avvia Simli/OBS e non salva audio generato su disco.
- [x] Eseguire test Node: PASS. Con campione esplicitamente selezionato e consenso, eseguire una richiesta Free breve. Documentare sample rate/channels/endian con fonte del provider o metadati effettivi; conteggio byte/durata da solo non basta a dedurli.
- [x] Gate: senza prova del formato PCM e lettura incrementale fermarsi e riportare l'impedimento; non collegare dati ambigui ai motori. Annotare in `docs/fish-tts.md` l'esito, senza dati personali, prima di Task 3.
- [x] Eseguire checkpoint globale e commit `test: add bounded Fish streaming capability probe`.

### Task 2: Profili Fish Separati E Persistenza Sicura

**Files:** Modify `src/shared/contracts.ts`, `src/shared/settings.ts`, `src/main/config/settingsStore.ts`; create `src/shared/fishVoice.ts`, `src/shared/fishVoice.test.ts`, `src/main/config/fishVoiceStore.ts`, `src/main/config/fishVoiceStore.test.ts`; extend existing settings tests.
**Interfaces:** `FishModel` whitelist; `FishVoiceRecord = { id: string; displayName: string; createdAt: string }`; settings `fishModel: FishModel`, `fishVoice: FishVoiceRecord | null`, `providerId` adds `'fish-openrouter'`. `parseFishVoiceImport(value: unknown)` returns validated `{ displayName, sourceAudio: Uint8Array, transcript, consentConfirmed: true }`. `saveFishVoice(value: unknown): Promise<FishVoiceRecord>`, `readFishVoice(id: string): Promise<{ sourceAudio: Uint8Array; transcript: string }>`, `removeFishVoice(): Promise<void>`; store outside settings contains encrypted payload only.

- [x] Scrivere test legacy settings: `providerId` Gemini e tutti i `voiceProfiles` identici dopo round-trip; default Fish Free; invalid model rejected in patches; selezione Fish non cambia `geminiVoiceId`.
- [x] Scrivere test WAV: tutti i quattro rate consentiti; durata 4.99/60.01 secondi, stereo, PCM float, RIFF troncato, dimensioni chunk incoerenti e oltre 6 MiB rifiutati; chunk RIFF extra validi accettati. Consenso false, nome vuoto e trascrizione vuota rifiutati; nome max 100 e trascrizione max 10.000 caratteri.
- [x] Scrivere test store: cifratura indisponibile non scrive file; payload sul disco non contiene trascrizione/base64; lettura ID diverso rifiutata; eliminazione idempotente; errore decifratura senza dettagli sensibili.
- [x] Eseguire `npx vitest run src/shared/settings.test.ts src/shared/fishVoice.test.ts src/main/config/settingsStore.test.ts src/main/config/fishVoiceStore.test.ts`: RED.
- [x] Implementare validazione RIFF con DataView e offset delimitati; UUID locale, singolo riferimento Fish sostituibile, scrittura temporanea/rename e safeStorage come nel key store esistente. Serializzare modifiche del riferimento; chiamante aggiorna metadati settings tramite funzione dedicata, non patch arbitraria del renderer.
- [x] Eseguire suite mirata: GREEN; checkpoint globale, sync e commit `feat: store isolated encrypted Fish voice reference`.

### Task 3: Adapter PCM Fish Con Abort

**Files:** Create `src/main/providers/fish.ts`, `fish.test.ts`, `pcmStream.ts`, `pcmStream.test.ts`, `speech.ts`, `speech.test.ts`, `src/shared/speechRequest.ts`, `speechRequest.test.ts`; extend contracts. Preserve `src/shared/geminiRequest.ts`.
**Interfaces:** `parseSpeechRequest(value: unknown): SynthesisRequest` dispatches Gemini/Fish; add voice mode `{ mode: 'reference'; voiceId: string }` for Fish. `FishTtsProvider.synthesizeStream(request, signal, onChunk): Promise<StreamedAudioResult>` and buffered `synthesize` wrap same stream. `Pcm24kStream(sourceRate: number).push(bytes): Uint8Array`, `.finish(): Uint8Array`; `SpeechProviderRouter` delegates validate/synthesize/stream by exact provider. Provider validation Fish checks key and local profile, without paid remote generation.

- [x] Scrivere test che Fish accetti solo whitelist modello, reference voice e input 1-10.000 caratteri; Gemini mantenga validator originale; Azure non implementato venga rifiutato esplicitamente.
- [x] Scrivere test PCM con rate verificato Task 1: output mono PCM16 LE 24 kHz, stesso risultato frammentando input un byte alla volta o intero, numero campioni coerente, trailing byte rifiutato, nessun WAV header/JSON trattato come audio.
- [x] Scrivere test fetch controllato: prima chiamata onChunk prima della risoluzione stream; Abort prima headers, durante read e dopo chunk; reader cancellato e nessun onChunk tardivo; stream vuoto, 401/403/402/429, formato errato, oltre 120 secondi di PCM normalizzato e body oltre 32 MiB rifiutati; errori server con chiave/base64 non riportati al renderer.
- [x] Eseguire `npx vitest run src/main/providers/fish.test.ts src/main/providers/pcmStream.test.ts src/main/providers/speech.test.ts src/shared/speechRequest.test.ts`: RED.
- [x] Implementare adapter `/api/v1/audio/speech`, readFishVoice, riferimento inline, request senza retry/fallback e lettura incrementale. Usare solo formato verificato Task 1; converter a fase continua con carry di un byte e filtro anti-alias se riduce sample rate. Non riusare converter Simli 24->16 kHz per questa conversione inversa.
- [x] Fissare timeout: primo PCM valido entro 15 s, massimo 120 s di richiesta e massimo 120 s di audio; errore/timeout cancella reader e fetch. Sanitizzare errori con messaggi applicativi, non testo provider; usage sconosciuto resta sconosciuto.
- [x] Eseguire suite: GREEN; checkpoint globale, sync e commit `feat: stream Fish audio through normalized PCM adapter`.

### Task 4: IPC E Selezione Console/Live

**Files:** Modify `src/main/ipc/registerIpc.ts`, `src/preload/index.ts`, `src/shared/contracts.ts`, `src/renderer/src/App.tsx`, `src/renderer/src/SecondaryViews.tsx`, `src/renderer/src/live/speechRequest.ts`; create `src/main/providers/speechIpc.test.ts`, `src/renderer/src/FishVoicePanel.tsx`; extend shared and Live speech request tests.
**Interfaces:** DesktopApi `getSpeechProviderStatus(providerId): Promise<ProviderStatus>`, `importFishVoice(request): Promise<AppSettings>`, `removeFishVoice(): Promise<AppSettings>`; existing speech channels retain names and stream IDs. Shared `buildSpeechRequest(settings: AppSettings, text: string, language?: 'en' | 'it' | 'ar'): SynthesisRequest` selects provider/profile; Live builder retains language-auto behavior. No bytes sent to renderer by profile read/status APIs.

- [x] Scrivere IPC tests per trusted sender, whitelist request, riferimento locale valido, slot occupato e Stop followed by new start: finally vecchio non cancella nuovo slot, niente chunk tardivi. Mutazioni profilo/provider rifiutate durante generazione; UI blocca anche durante Live attivo.
- [x] Scrivere builder tests: vecchi settings generano request Gemini identica; Fish Free/Pro selezionati producono ID/modello corretti; riferimento mancante e errore esplicito, mai Kore come fallback.
- [x] Eseguire `npx vitest run src/main/providers/speechIpc.test.ts src/shared/speechRequest.test.ts src/renderer/src/live/speechRequest.test.ts`: RED.
- [x] Implementare dispatch e API trusted. UI in Impostazioni: select provider/modello, nome, WAV, trascrizione, checkbox consenso, anteprima locale, importazione/rimozione, stato. Nessuna conversione WAV nascosta; profile import non esegue TTS. Revocare URL anteprima su sostituzione/unmount.
- [x] Collegare Console e Live al builder condiviso; readiness Live basata sul provider selezionato, non `gemini.ready`; mantenere readiness e builder Gemini delle automazioni S2S fuori scope. Stato/etichette voce coerenti e nessun cambio durante turni.
- [x] Eseguire suite: GREEN; checkpoint globale, sync e commit `feat: select Fish voice in Console and NEB Live`.

### Task 5: Misure E Accettazione Windows

**Files:** Modify `src/shared/contracts.ts`, `src/renderer/src/live/controller.ts`, `src/renderer/src/live/useLiveConversation.ts` per diagnostica senza PII; create `scripts/voice/smoke-fish.mjs`, `scripts/voice/smoke-fish.test.mjs`; extend `scripts/live/smoke-renderer.mjs`, `docs/fish-tts.md`.
**Interfaces:** log timing esteso con provider/model e generationMs; costi Fish come stima separata da `costUsd` Qwen. Prezzo UTF-8 da metadati modello, Free zero, dato non disponibile null; nessun totale di addebito inventato.

- [x] Scrivere tests per stima byte UTF-8 (accenti e arabo non contati come singoli byte), dato prezzo mancante null, provider/model nel timing senza campione/trascrizione, e benchmark con mediana/massimo corretti.
- [x] Eseguire Vitest mirati e `node --test scripts/voice/smoke-fish.test.mjs`: RED; implementare diagnostica e harness; rieseguire: GREEN.
- [x] Prova renderer Windows con Fish mock: Gemini indisponibile/Fish pronto, due turni Live e Simli sintetico continuo, importazione/rimozione, errori e Stop, replay Console, layout desktop/compatto e cambi selezione bloccati. Nessuna chiave/costo remoto.
- [ ] Prova cloud Free dopo consenso sul campione; cinque frasi brevi e due lunghe in italiano/inglese. Prima senza avatar, poi una prova breve Simli con OBS senza camera/stream/registrazione gia attivi. Testare Stop reale e controllare playback a velocita corretta.
- [ ] Solo dopo conferma costo, ripetere Pro con stessi testi/campione. Confrontare Gemini/Free/Pro: primo PCM, inizio audio/avatar, durata, mediana/massimo, prima richiesta separata; somiglianza valutata dall'utente. Non dichiarare Fish migliore se non misurato; se cloud bloccato riferire test pendente.
- [x] Revisione finale indipendente del diff e correzioni con regressioni; checkpoint globale, cinque test Node OBS esistenti, sync e verifica contenuti con `rsync -rnc`, commit `test: verify Fish voice latency and Windows integration`.

## Handoff

### Execution Result 2026-10-05

Tasks 1-4 implemented and checkpointed on main. Task 5 implemented: isolated Windows Free benchmark (five short/two long requests, real Stop), Fish/Gemini renderer regression runs, diagnostics, final independent review with both Important findings fixed using failing regressions, 400 Vitest + 16 Node tests and build/typecheck.

Manual acceptance remains: audible voice similarity and speed, real Fish+Simli lipsync/OBS and equal-text Gemini comparison. No paid Pro call was authorized or made. Pro cost metadata is unavailable from the public models catalog, so its estimate stays null; Free zero remains separate from Qwen/Simli costs. The Windows benchmark does not play audio or start Simli/OBS, to avoid sending speech into an existing call. These are explicit validation limits, not claims of completed real-world comparison.

Piano da rivedere prima dell'implementazione. Raccomandazione: esecuzione Native nella stessa chat, con revisione indipendente finale, perche profilo, adapter e routing dipendono strettamente dagli stessi contratti. Alternativa: subagent-driven con implementazione e revisione separate per ogni task. Non aprire nuove chat o avviare cloud test prima della selezione del metodo e del consenso al campione.
