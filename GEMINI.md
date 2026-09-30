# NEB Voice Generator — Istruzioni di Sviluppo & Memoria Operativa

Questo file contiene le regole operative critiche, l'architettura dell'ambiente e le procedure per gli agenti AI (Gemini / Antigravity).

---

## 1. Architettura Multiverso & Sincronizzazione Obbligatoria (MANDATORIA)

Questo progetto vive a cavallo tra **WSL (Linux)** e **Windows**:
1. **Workspace WSL (Principale)**:
   `/home/rnebili/Progetti/NEB/Projects/NebVoiceGenerator`
2. **Worktree Windows (Dove l'utente lavora con VS Code e PowerShell)**:
   `C:\Users\r.nebili\.codex\worktrees\outlier-s2s\NebVoiceGenerator`
   (Percorso WSL: `/mnt/c/Users/r.nebili/.codex/worktrees/outlier-s2s/NebVoiceGenerator/`)
3. **Cartella Staging Runtime di Windows (Dove `run-windows.ps1` avvia Electron)**:
   `C:\Users\r.nebili\AppData\Local\NEBVoiceConsole\dev`
   (Percorso WSL: `/mnt/c/Users/r.nebili/AppData/Local/NEBVoiceConsole/dev/`)

### ⚠️ REGOLA AUREA: Sincronizzazione Automatica
**L'utente non deve MAI dover chiedere di sincronizzare i file.**
Ogni singola volta che viene modificato o ricompilato del codice in WSL:
1. Eseguire sempre `npm run build` e verificare `npm test` e `npm run typecheck`.
2. Eseguire SEMPRE la sincronizzazione verso **ENTRAMBE** le cartelle Windows:
   ```bash
   rsync -av --delete src/ /mnt/c/Users/r.nebili/.codex/worktrees/outlier-s2s/NebVoiceGenerator/src/ && \
   rsync -av --delete browser-extension/ /mnt/c/Users/r.nebili/.codex/worktrees/outlier-s2s/NebVoiceGenerator/browser-extension/ && \
   rsync -av --delete scripts/ /mnt/c/Users/r.nebili/.codex/worktrees/outlier-s2s/NebVoiceGenerator/scripts/ && \
   rsync -av --delete out/ /mnt/c/Users/r.nebili/.codex/worktrees/outlier-s2s/NebVoiceGenerator/out/ && \
   cp package.json package-lock.json /mnt/c/Users/r.nebili/.codex/worktrees/outlier-s2s/NebVoiceGenerator/ && \
   rsync -av --delete src/ /mnt/c/Users/r.nebili/AppData/Local/NEBVoiceConsole/dev/src/ && \
   rsync -av --delete browser-extension/ /mnt/c/Users/r.nebili/AppData/Local/NEBVoiceConsole/dev/browser-extension/ && \
   rsync -av --delete scripts/ /mnt/c/Users/r.nebili/AppData/Local/NEBVoiceConsole/dev/scripts/ && \
   rsync -av --delete out/ /mnt/c/Users/r.nebili/AppData/Local/NEBVoiceConsole/dev/out/ && \
   cp package.json package-lock.json /mnt/c/Users/r.nebili/AppData/Local/NEBVoiceConsole/dev/
   ```
3. Se `NativeHost.cs` è stato modificato, ricompilare l'host nativo con:
   ```bash
   powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& 'C:\Users\r.nebili\.codex\worktrees\outlier-s2s\NebVoiceGenerator\scripts\outlier\setup-host.ps1' -ExtensionId 'aaaaabbbbbcccccdddddeeeeefffffgg' -DataDirectory 'C:\Users\r.nebili\AppData\Roaming\neb-voice-console' -CompileOnly" < /dev/null
   ```
4. Committare sempre le modifiche in git su `main` in WSL per evitare collisioni con l'auto-save di VS Code.

---

## 2. Come Avviare l'Applicazione

- **NON avviare MAI l'app Electron / GUI direttamente da WSL**.
- L'utente avvia l'app da **PowerShell di Windows** con questo comando:
  ```powershell
  cd C:\Users\r.nebili\.codex\worktrees\outlier-s2s\NebVoiceGenerator
  .\scripts\run-windows.ps1
  ```
- Lo script `run-windows.ps1`:
  - Copia i sorgenti dalla cartella del repo a `%LOCALAPPDATA%\NEBVoiceConsole\dev`.
  - Verifica/installa le dipendenze `npm.cmd ci`.
  - Esegue `npm.cmd run build`.
  - Lancia Electron nativo su Windows (`npm.cmd start`).

---

## 3. Gestione VS Code Buffer Collision & Salvaguardia Sync

Se l'utente o l'ambiente ha file aperti in VS Code su WSL o Windows, il salvataggio automatico (`files.autoSave`) al cambio finestra o a intervalli può riscrivere su disco i vecchi buffer in memoria, cancellando le modifiche appena generate dall'agente.
- **Prevenzione in .vscode/settings.json**: `"files.autoSave": "off"` configurato per evitare scritture silenti da buffer obsoleti.
- **Salvaguardia Automatica in `run-windows.ps1`**: Lo script esegue automaticamente `git checkout -- .` sul repository prima di qualsiasi copia, scartando all'istante eventuali buffer obsoleti flushati da VS Code e garantendo che venga avviata SEMPRE la versione committata pulita.
- **Cartella `out/` inclusa nel sync**: `run-windows.ps1` copia sempre anche `out/` precompilato.
- **Mantenere il branch `main` sempre committato**: Ogni modifica completata deve essere committata e pushato su `main`.

---

## 4. Test e Qualità del Codice

Prima di concludere qualsiasi attività:
- `npm test` : Esegue tutti i test Vitest (19 suite, 81+ test). Devono passare tutti al 100%.
- `npm run typecheck` : Verifica i tipi TypeScript sia per `tsconfig.node.json` che per `tsconfig.web.json`.
- `npm run build` : Compila con electron-vite main, preload e renderer.

---

## 5. Modulo Outlier & Bridge Nativo Edge

- **Estensione Edge (Manifest V3)**:
  - Posizione: `browser-extension/` (con `background.js`, `content.js`, `manifest.json`, `popup.html`, `popup.js`).
  - Se modificata, l'utente deve ricaricare l'estensione su `edge://extensions` cliccando l'icona 🔄.
  - Heartbeat attivo a 10s tra `content.js` e `background.js` con messaggi `ping` / `pong` per impedire a Edge di sospendere il service worker.
- **Host Nativo C# (`NEBOutlierHost.exe`)**:
  - Sorgente: `scripts/outlier/NativeHost.cs`.
  - Destinazione: `%APPDATA%\neb-voice-console\outlier-host\NEBOutlierHost.exe`.
  - Registrazione registro: `HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.nebvoice.outlier`.
  - Non distruggere mai violentemente la Named Pipe (`socket.destroy()`) durante le pause di digitazione o abort transitori in `bridge.ts`.
- **UI Outlier**:
  - Layout Dashboard a 2 colonne: Editor a sinistra, Box Inserimento con pulsanti e badge a destra.
  - Barra progetti collassabile con switch rapido a tendina.
  - Zoom nativo ad alta densità con tasti <kbd>Ctrl</kbd> + <kbd>-</kbd> / <kbd>+</kbd> / <kbd>0</kbd>.

---

## 6. Pro-Tip: Setup Macchina Virtuale (VM) per Multitasking
Documentazione completa e checklist operativa: [`docs/outlier-vm-setup.md`](file:///home/rnebili/Progetti/NEB/Projects/NebVoiceGenerator/docs/outlier-vm-setup.md).
- Permette a NEB ed Edge di girare con focus nativo al 100% all'interno di una VM (Hyper-V / VMware / VirtualBox), consentendo all'utente di lavorare, programmare o navigare sul PC host senza interruzioni di focus su `SendInput` e azzerando i rischi di rilevamento anti-cheat da parte di Outlier.
- Supportare l'utente nell'installazione e setup dell'ambiente isolato VM quando richiesto.
