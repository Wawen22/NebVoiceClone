# AGENTS.md — Regole Operative per Agenti di Sviluppo

File di istruzioni operative e memoria permanente per agenti AI che lavorano su **NEB Voice Generator**.

---

## 1. Regola di Sincronizzazione Cross-Environment (CRITICA)

Questo progetto ha 3 percorsi fondamentali:
- **WSL Repository (Master)**: `/home/rnebili/Progetti/NEB/Projects/NebVoiceGenerator`
- **Windows User Worktree**: `C:\Users\r.nebili\.codex\worktrees\outlier-s2s\NebVoiceGenerator` (`/mnt/c/Users/r.nebili/.codex/worktrees/outlier-s2s/NebVoiceGenerator/`)
- **Windows Runtime Staging**: `C:\Users\r.nebili\AppData\Local\NEBVoiceConsole\dev` (`/mnt/c/Users/r.nebili/AppData/Local/NEBVoiceConsole/dev/`)

**MANDATORIO**: Dopo OGNI modifica al codice in WSL:
1. Esegui `npm run build`, `npm test` e `npm run typecheck`.
2. Sincronizza SEMPRE (con `rsync`) i sorgenti e la cartella `out/` verso ENTRAMBE le cartelle Windows sopra indicate.
3. Se `NativeHost.cs` cambia, compila `NEBOutlierHost.exe` con `setup-host.ps1 -CompileOnly`.
4. Esegui il commit git su `main` in WSL.
5. Non aspettare che l'utente chieda di sincronizzare: deve essere fatto **automaticamente e proattivamente**.

---

## 2. Avvio dell'Applicazione

- **MAI avviare l'interfaccia Electron direttamente da WSL**.
- Istruire sempre l'utente ad avviare l'app da **Windows PowerShell**:
  ```powershell
  cd C:\Users\r.nebili\.codex\worktrees\outlier-s2s\NebVoiceGenerator
  .\scripts\run-windows.ps1
  ```

---

## 3. Comandi di Verifica

- **Test**: `npm test` (tutti i test Vitest devono essere verdi).
- **TypeScript**: `npm run typecheck` (zero errori).
- **Build**: `npm run build` (genera `out/main`, `out/preload`, `out/renderer`).

---

## 4. Particolarità del Modulo Outlier

- **Estensione Edge**: In `browser-extension/`. Dopo modifiche, l'utente ricarica l'estensione su `edge://extensions`.
- **Heartbeat a 10s**: Mantiene vivo il service worker Manifest V3 e il canale Native Messaging.
- **Named Pipe**: Non chiamare `socket.destroy()` su abort/timeout in `bridge.ts`; la pipe deve restare aperta per la ripresa.
- **UI UX**: Layout a 2 colonne (Editor Rationale a sinistra, Controller Browser a destra). Barra progetti collassabile. Zoom nativo con <kbd>Ctrl</kbd> + <kbd>-</kbd>/<kbd>+</kbd>/<kbd>0</kbd>.
