# S2S Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eseguire le Battute Pronte con adattamento audio Qwen e controllo dei turni.

**Architecture:** L'estensione cattura PCM dalla scheda associata, l'host lo
inoltra nella pipe autenticata e il main valida il flusso prima di inviarlo al
renderer. Un controller testabile gestisce turni e cancellazione; un hook integra
OpenRouter e l'audio Gemini; un pannello mantiene visibili controlli e cronologia.

**Tech Stack:** Electron, React, TypeScript, Native Messaging, AudioWorklet, OpenRouter, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-02-s2s-automation.md`

## Global Constraints

- Riusare OpenRouter; modello `qwen/qwen3.8-omni-flash`.
- Obiettivo e ordine dello script conservati; originali non sovrascritti.
- Nessuna UI Electron da WSL; lavorare su main come richiesto da AGENTS.md.
- Build/test/typecheck, rsync sorgenti/out verso worktree e staging Windows,
  compile-only del NativeHost modificato, commit main.

## Review Focus

- Risposta tardiva Qwen dopo Stop o ripresa del parlato: nessuna riproduzione.
- Disconnessione/gap PCM: pausa, mai inferire silenzio da audio mancante.
- Ultima battuta: ascoltare risposta finale, nessuna chiamata TTS aggiuntiva.
- Interruzione durante TTS: linea non completata, ripetizione solo esplicita.
- Cambio A/B, progetto o scheda: niente mescolamento di contesti o destinazioni.

### Task 1: Contratti e provider Qwen

Files: `src/shared/s2s.ts`, `src/main/providers/qwen.ts`, relativi test,
`src/main/ipc/registerIpc.ts`, `src/shared/contracts.ts`, `src/preload/index.ts`.

Interfaces: `S2SAdaptRequest`, `S2SDecision`, `adaptS2STurn(request, options)`;
API `adaptS2STurn`, `cancelS2SAdaptation`, `getS2SProviderStatus`.

- [x] Test RED di WAV/base64, contesto, decisioni speak/wait/pause/complete,
  output malformato, costo, abort e audio eccessivo.
- [x] Implementare validazione, WAV 16 kHz, JSON schema, limite output, timeout.
- [x] Verificare test GREEN e integrare IPC fidato/cancellazione.

### Task 2: Audio Edge e relay autenticato

Files: `browser-extension/{background,popup,offscreen,audio-processor}.js`,
HTML/manifest, `scripts/outlier/NativeHost.cs`, `src/main/outlier/{bridge,audioCapture,registerOutlierIpc}.ts`.

Interfaces: `S2SAudioEvent`, `AudioCaptureRelay.receive(packet, target)`;
API `getS2SAudioStatus`, `onS2SAudio`, `stopS2SAudioCapture`.

- [x] Test RED su destinazione, capture ID, sequenza, campioni malformati,
  navigazione, avvio audio/stop e resampling su dati controllati.
- [x] Implementare offscreen/AudioWorklet mono PCM 16 kHz con ascolto locale,
  start da popup e stop su invalidazione/disconnessione.
- [x] Inoltrare eventi nell'host e validare nel main; verificare GREEN.

### Task 3: Controller e integrazione Battute Pronte

Files: `src/renderer/src/s2s/{controller,useS2SAutomation,AutomationPanel}.*`,
`App.tsx`, `ReadyLinesPanel.tsx`, CSS e test controller.

Interfaces: controller con `start`, `feed`, `tick`, `pause`, `resume`, `stop`;
dipendenze `adapt(request, signal)` e `speak(text, signal, onStarted)`.

- [x] Test RED fine-turno 2500 ms, wait filler, invalidazione proposta, Stop,
  backchannel vs interruzione, ripresa, risposta finale e limiti.
- [x] Implementare controller indipendente da React e hook cancellabile.
- [x] Integrare avvio/manuale/pausa/stop, impostazioni e cronologia esportabile;
  bloccare modifiche alle battute e voce manuale durante sessione.
- [x] Verificare GREEN e controllo finale del diff con focus sopra.

### Task 4: Consegna Windows

Files: `docs/s2s-automation.md`, stato completamento del presente piano.

- [x] Documentare configurazione, limiti e prove Windows/Edge.
- [x] Eseguire `npm run build`, `npm test`, `npm run typecheck`.
- [x] Rsync dei sorgenti/out verso entrambe le destinazioni Windows.
- [x] Compilare host con `setup-host.ps1 -CompileOnly`, verificare sincronizzazione.
- [x] Commit su main e riportare prove eseguite e quelle interattive rimaste.

## Evidenze di consegna — 2026-10-03

- Build e typecheck completati; Vitest WSL: 135 pass, 3 test Windows saltati.
- Vitest Windows sul bridge: 5/5, inclusi i tre saltati in WSL.
- Host C# compilato con CompileOnly e installato nella directory già registrata,
  preservando manifest e credenziali. Smoke Windows: handshake autenticato,
  inoltro PCM, rifiuto delle operazioni native senza associazione; nessun input
  da tastiera inviato.
- Edge headless sul renderer compilato, con IPC/audio sintetici: sequenza di
  adattamento, risposta finale, blocco script, risposta tardiva dopo Stop e
  ripresa rifiutata su altra destinazione. Nessuna chiamata AI.
- Modello e capacità audio/structured output verificati nel catalogo OpenRouter.
- Chiamata reale Qwen con audio sintetico: trascrizione corretta e decisione speak,
  3709 ms, costo USD 0.00013719. Un tentativo precedente rifiutato dal validatore
  per incoerenza semantica: pausa prevista; nessun indebolimento dei controlli.
- Revisione indipendente s2s_review: nessun Critical, tre Important corretti
  con regressioni RED/GREEN: destinazione vincolata durante resume, invalidazione
  SPA anche senza typing armato, cancellazione dello startup della cattura.
- Audio reale Edge/Outlier, latenza su conversazioni reali, voce Gemini e routing VB-CABLE
  richiedono la prova interattiva descritta in docs/s2s-automation.md.
- Sorgenti e out sincronizzati a worktree e staging Windows; commit su main
  previsto come ultimo passo della consegna.
