# Conversazione automatica S2S — prova Windows

La modalità Automatico delle Battute Pronte usa `qwen/qwen3.8-omni-flash`
su OpenRouter per ascoltare le risposte e adattare il testo. La voce resta quella
Gemini selezionata. Le battute originali non vengono sovrascritte.

## Configurazione

1. Chiudi la versione NEB attualmente aperta e riavviala da Windows PowerShell:

   ```powershell
   cd C:\Users\r.nebili\.codex\worktrees\outlier-s2s\NebVoiceGenerator
   .\scripts\run-windows.ps1
   ```

2. Nel file `.env.local` del repository Windows deve essere presente
   `OPENROUTER_API_KEY=...`. Riavvia NEB dopo una modifica della chiave.
   Non inserire la chiave nell'estensione. Servono anche Gemini configurato
   e la voce selezionata nella Console.
3. In NEB seleziona **CABLE Input** come uscita. In Outlier/Edge seleziona
   **CABLE Output** come microfono, mantenendo cuffie/altoparlanti reali come
   uscita Edge. Il percorso è descritto in [audio-routing.md](audio-routing.md).
4. Apri `edge://extensions`, ricarica **NEB Outlier Connector** (versione 1.1.0)
   e accetta gli eventuali nuovi permessi per catturare l'audio della scheda.
   Verifica che la cartella dell'estensione sia quella dello staging Windows
   indicata da **Apri cartella estensione** in NEB.
5. Se necessario configura l'host da Outlier → Configura il collegamento Edge.
   L'host aggiornato inoltra ora anche l'audio; un vecchio host non lo inoltra.
6. Porta in primo piano la scheda S2S. Nel popup NEB premi **Collega questa
   scheda**, poi **Ascolta questa scheda**. Il secondo pulsante richiede un clic
   nell'estensione; NEB non può avviare questa acquisizione senza quel gesto.
7. Torna a NEB → Outlier, seleziona il progetto S2S attivo e apri **Battute Pronte**.
   Prepara MODEL A o MODEL B e abilita **Automatico**. La cattura deve risultare
   collegata e il misuratore deve muoversi quando Outlier parla.
8. Scegli **Scenario e tempi** per definire ruolo e fatti da mantenere. Il Rationale
   e le note del progetto non vengono aggiunti automaticamente al contesto Qwen.
   Impostazione iniziale consigliata: silenzio 2,5 s, attesa 30 s.
9. Avvia/attiva la conversazione con il modello desiderato nella task Outlier,
   lasciando pronto il microfono virtuale. In NEB premi **Avvia MODEL A/B**.
   La prima battuta ancora pendente parte originale; le successive vengono adattate.
   Il sistema si ferma dopo aver ascoltato anche la risposta all'ultima battuta.

Il collegamento non seleziona o avvia automaticamente il modello nella pagina
Outlier: la scelta A/B in NEB identifica lo script. Verifica che corrisponda al
modello con cui hai aperto la conversazione. Non premere Submit per queste prove.

## Prima prova: tre battute

Usa un breve scenario, per esempio confrontare due strumenti di apprendimento:

1. «Vorrei capire come usare questo strumento per preparare una lezione. Da dove parto?»
2. «Quali limiti dovrei considerare?»
3. «Come potrei fare una piccola prova prima di usarlo con tutta la classe?»

Atteso: prima battuta → risposta → verifica Qwen → seconda battuta adattata →
risposta → terza adattata → risposta finale → Conversazione completata.
Le righe sono segnate completate solo a riproduzione interamente terminata.
Originale e testo adattato sono visibili nella cronologia.

## Casi da verificare

| Prova | Risultato atteso |
|---|---|
| Pausa breve nel mezzo di una risposta | NEB continua ad ascoltare. |
| Solo «ehm…» o frase incompleta | Qwen aspetta; nessun consumo della prossima battuta. |
| Risposta breve «sì/no/capito» a domanda adatta | Può essere riconosciuta come turno completo. |
| Outlier riprende mentre Qwen sta elaborando | La proposta precedente viene scartata; la risposta viene riascoltata completa. |
| Breve cenno durante la voce NEB | NEB normalmente continua. |
| Outlier parla continuativamente durante NEB | La voce si interrompe dopo circa 1,2 s; la battuta rimane pendente. Qwen può proseguirne contestualmente l'obiettivo dopo la risposta. |
| Pausa manuale durante la voce | Riga non completata. Riprendi ascolto non ripete la frase; Ripeti battuta pendente è una scelta esplicita. |
| Stop durante Qwen o durante Gemini | Nessuna voce tardiva; Ctrl+Alt+S ferma l'automatico e la voce. |
| Nessuna risposta | Dopo l'attesa configurata la sessione va in pausa. |
| Cattura fermata, scheda chiusa o flusso sospeso | Pausa; audio mancante non è considerato silenzio. |
| Navigazione, nuova task, Rationale sostituito | Cattura fermata. Collega di nuovo e avvia una nuova sessione. |
| Ripresa su altra scheda/documento | Rifiutata; Stop e nuova sessione necessari. |
| Limite di turni, durata o costo | Sessione sospesa senza ulteriore battuta automatica. |

Chiudere il pannello Battute Pronte non ferma la sessione. Riaprilo per i controlli;
lo Stop globale resta disponibile. Mentre la sessione è attiva o in pausa,
script, voce manuale e impostazioni voce sono bloccati. Premi Stop per modificarli.

La prima versione distingue le interruzioni durante TTS in modo acustico: 1,2 s di
parlato continuativo, con tolleranza a brevi pause. Non trascrive quei segmenti in
tempo reale; un intercalare lungo può interrompere NEB. La fine del turno è stimata
da silenzio ricevuto e interpretazione Qwen: una lunga pausa a frase completa può
essere scambiata per fine risposta. Non c'è ancora un segnale di fine generazione
dalla pagina Outlier. Verifica questi casi prima di affidarti a sessioni lunghe.

## Misurare la velocità

**Esporta cronologia** salva un JSON con testo originale/adattato, decisioni,
trascrizioni Qwen, interruzioni, tempo Qwen, tempo fino al primo audio Gemini e
costo OpenRouter riportato. Non esporta le registrazioni audio.

- Prova dapprima con 2,5 s di silenzio e risposte brevi.
- Annota tempo Qwen e primo audio Gemini su almeno cinque turni.
- Il ritardo totale comprende silenzio, invio/elaborazione Qwen, 300 ms di verifica
  finale e preparazione Gemini. I 2,5 s non sono il ritardo totale.
- Solo dopo una prova senza sovrapposizioni valuta 2 s o 1,5 s di silenzio.

I costi visualizzati sono quelli restituiti da OpenRouter e non includono Gemini.
Una richiesta già partita può superare il limite; richieste annullate possono
essere fatturate dal provider senza restituire un costo a NEB. Se il costo di una
risposta non è disponibile, NEB sospende l'automatico. Il limite è operativo sui
costi osservati, non sostituisce il limite di spesa del proprio account.

## Verifiche di sviluppo

```text
npm run build
npm test
npm run typecheck
```

`scripts/s2s/smoke-renderer.mjs` usa Edge headless con API e audio sintetici:
verifica l'interfaccia e il percorso automatico senza task reali, chiavi o chiamate
AI. Non sostituisce la prova con estensione caricata, audio Outlier e VB-CABLE.

Per ripeterlo da PowerShell nel repository Windows, dopo la build:

```powershell
npm install --prefix .superpowers/outlier-smoke playwright
node scripts/s2s/smoke-renderer.mjs
node node_modules/vitest/vitest.mjs run src/main/outlier/bridge.test.ts
```

Verifiche completate il 3 ottobre 2026: build e typecheck, 135 test WSL,
5 test bridge Windows, smoke del renderer e smoke del connettore C# con inoltro
PCM. Una chiamata reale Qwen su una risposta sintetica in inglese ha trascritto
l'audio e restituito una decisione `speak` valida: 3709 ms, costo riportato
$0,00013719. Una chiamata precedente era stata rifiutata dal validatore per una
decisione incoerente; il flusso si è fermato. Questo è un controllo di compatibilità,
non una misura di affidabilità o latenza su Outlier. Gemini e il routing audio reale
restano da provare con la procedura sopra.
