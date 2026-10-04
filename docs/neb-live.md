# NEB Live — conversazione libera

NEB Live è una sezione autonoma accanto a Outlier. Ascolta la scheda collegata,
genera risposte nuove con Qwen e parla usando la voce Gemini selezionata, compresa
la voce personale già creata. Non richiede battute pronte né un progetto Outlier.

## Avvio su Windows

Chiudi e riavvia NEB da Windows PowerShell:

```powershell
cd C:\Users\r.nebili\.codex\worktrees\outlier-s2s\NebVoiceGenerator
.\scripts\run-windows.ps1
```

Servono Gemini configurato e `OPENROUTER_API_KEY` nel file locale `.env.local`.
Le chiavi rimangono nel processo principale. Usa la stessa chiave Gemini alla
quale appartiene la tua voce personale.

1. Apri **NEB Live → Browser e voce → Configura Edge o Chrome**.
2. Ricarica l'estensione esistente in `edge://extensions` oppure carica la cartella
   indicata da **Apri cartella estensione** in Chrome, con modalità sviluppatore.
   L'estensione ora si chiama **NEB Browser Connector**.
3. Se usi Chrome per la prima volta, copia l'ID dell'estensione e premi
   **Salva host per Edge e Chrome**. La configurazione registra il connettore nei
   due browser. Una sola istanza/ID è configurata alla volta: se gli ID differiscono
   tra browser, salva quello del browser che stai usando.
4. Sul sito della conversazione, apri il popup NEB e premi **Collega questa scheda**,
   poi **Ascolta questa scheda**. L'ascolto richiede quel clic; non viene avviato
   automaticamente da NEB.
5. In NEB scegli **CABLE Input** come uscita; nel sito scegli **CABLE Output** come
   microfono. Mantieni l'audio del sito sulle cuffie reali. NEB ascolta la scheda,
   non tutta l'uscita audio del PC. Le applicazioni desktop richiedono un futuro
   percorso di cattura separato.
6. Scegli un profilo, modifica il contesto della sessione e avvia. Puoi ascoltare
   prima l'interlocutore oppure far generare una breve apertura.

La connessione della scheda e il flusso audio devono risultare disponibili.
Se navighi su un'altra pagina, ricollega la scheda e avvia una nuova sessione.
Non avviare Electron direttamente da WSL.

## Background, profili e stile

I profili iniziali sono colloquio full-stack, AI e automazione, intervista di ricerca
e conversazione libera. Puoi aggiungerli, rinominarli e scegliere lingua e tono.
**Background e stile personale** contiene una sintesi professionale del documento
fornito e indicazioni tratte dalla persona comunicativa. Contatti e dettagli
economici non sono inclusi nei dati iniziali.

Le modifiche si salvano con **Salva profili** o all'avvio di una sessione. Sono
conservate in `neb-live-config.json` nella cartella dati dell'app Windows. La
sessione usa una copia fissa della configurazione e della voce selezionata.
Aggiorna il background con episodi reali e risultati documentati per migliorare
le risposte personali; il modello riceve istruzioni di non inventare esperienze,
certificazioni, metriche o livelli di competenza. Queste istruzioni non garantiscono
l'accuratezza di ogni risposta: controlla il transcript nelle prime prove.

## Controlli e limiti

- **Pausa** interrompe elaborazione e voce; **Riprendi ascolto** attende un nuovo
  intervento senza ripetere automaticamente la risposta precedente.
- **Prendi controllo** mette in pausa. Per parlare direttamente scegli il tuo
  microfono nel sito; prima di riprendere NEB ripristina CABLE Output.
- **Stop**, **Esc** o **Ctrl+Alt+S** fermano la sessione. Le risposte tardive non
  riavviano la voce, anche se lo Stop arriva durante il salvataggio iniziale.
- La sessione prosegue quando cambi sezione; il pulsante flottante riapre NEB Live.
  Voce manuale, Automatico S2S, inserimento Outlier e impostazioni voce sono bloccati
  durante una sessione attiva o in pausa.
- **Esporta JSON** salva transcript, eventi e tempi osservati. Audio e transcript
  non vengono salvati automaticamente. Il testo NEB appare quando la riproduzione
  comincia; se interrotto, il testo completo è etichettato **parziale** e può includere
  parole che non sono state effettivamente pronunciate.

La prima versione attende 2,5 secondi di silenzio ricevuto, poi Qwen elabora e
Gemini prepara la voce. Il ritardo totale comprende tutte queste fasi. Una pausa
lunga può essere scambiata per fine turno; brevi intercalari mantengono l'ascolto
quando Qwen li riconosce come intervento incompleto. Durante NEB, 1,2 secondi di
parlato remoto continuativo interrompono la risposta; brevi cenni vengono ignorati.
Non è una trascrizione o interpretazione streaming durante il parlato.

Limiti iniziali: 20 minuti, 40 interventi NEB, $1 di costo OpenRouter osservato,
120 secondi per intervento remoto, 35 secondi per Qwen e 60 secondi al primo audio
Gemini. L'ultimo intervento permesso può finire prima della pausa per limite turni.
Un flusso mancante, un costo sconosciuto o una risposta non valida mettono in pausa.
Il costo mostrato esclude Gemini; richieste annullate possono essere comunque
fatturate e una richiesta già iniziata può superare il limite osservato.

## Verifiche

```text
npm run build
npm test
npm run typecheck
```

Da PowerShell nella cartella repository Windows:

```powershell
node scripts/live/smoke-renderer.mjs
node scripts/s2s/smoke-renderer.mjs
```

Gli smoke usano Edge headless, Playwright installato nell'ambiente di test
`.superpowers/outlier-smoke`, IPC e audio sintetici, senza chiamate AI.
Verificano profili, avvio libero, transcript, controlli, blocchi e annullamento.
La prova hardware su cuffie, VB-CABLE e sito reale è separata: iniziare con una
breve conversazione di prova prima di usare una sessione lunga.

Verifica API del 4 ottobre 2026: una domanda tecnica testuale con un profilo
sintetico ha prodotto una decisione `speak` valida in 2537 ms, costo OpenRouter
riportato $0,00014499. Questa prova verifica il provider testuale; non misura
trascrizione audio, Gemini, routing o ritardo completo di una chiamata.

Verifiche finali: build e typecheck WSL passati, 232 test passati e 3 specifici
Windows saltati in WSL; 7 test bridge/connettore passati su Windows. Smoke NEB Live
e smoke completo S2S/Console passati in Edge con audio e IPC sintetici. Host C#
aggiornato compilato per l'istanza Windows esistente. La finestra NEB mantiene
attivi i timer anche quando minimizzata.
