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

1. Apri **NEB Live → Configura → Audio → Configura Edge o Chrome**.
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
6. Scegli un profilo dalla barra sopra la chat. Modifica il contesto da
   **Configura → Profilo** e avvia. Puoi ascoltare
   prima l'interlocutore oppure far generare una breve apertura.

La connessione della scheda e il flusso audio devono risultare disponibili.
**Collega questa scheda** attende la conferma di NEB; non avvia l'audio.
Il popup mostra lo stato anche quando lo riapri. Se **Avvia conversazione**
rimane disattivato e NEB mostra **Nessuna scheda in ascolto**, premi anche
**Ascolta questa scheda** e attendi **Ascolto attivo**. Se il popup segnala un
collegamento interrotto, riapri NEB e ricollega la scheda prima di attivare l'ascolto.
Se navighi su un'altra pagina, ricollega la scheda e avvia una nuova sessione.
Non avviare Electron direttamente da WSL.

## Background, profili e stile

I profili iniziali sono colloquio full-stack, AI e automazione, intervista di ricerca
e conversazione libera. Puoi aggiungerli, rinominarli e scegliere lingua e tono.
**Configura → Profilo → Background e stile personale** contiene una sintesi professionale del documento
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

- **Configura → Dettagli → Limiti della conversazione** permette di impostare
  durata (1–180 minuti), risposte NEB (1–500) e budget OpenRouter ($0,10–$20).
  Per un'intervista di circa 30 minuti, 45 minuti e 100 risposte lasciano margine.
  Premi **Salva limiti** oppure avvia la sessione per salvare automaticamente.
  I valori valgono per tutti i profili e rimangono disponibili dopo il riavvio;
  i vecchi file senza questa sezione caricano i valori iniziali 20 minuti/40 turni/$1.
  La durata comprende anche il tempo in pausa. Un turno è una risposta iniziata
  da NEB, incluse quelle poi interrotte; non è una domanda ricevuta.
  Al raggiungimento di un limite NEB va in pausa e conserva la cronologia.
  Puoi aumentare i limiti dalla pausa, salvarli e premere **Riprendi ascolto**
  senza azzerare la sessione. Per modificarli durante il parlato, premi prima
  **Pausa**. Il nuovo limite di durata si conta dall'avvio originale, senza
  riavviare il cronometro. L'esportazione JSON include i limiti effettivi.
- **Nuova conversazione** ferma elaborazione e voce, annulla un eventuale avvio
  ancora in salvataggio e pulisce trascrizione, eventi, turni e costo della sessione.
  Profilo, voce, ritmo e ascolto della scheda restano disponibili. Premi poi
  **Avvia conversazione** per iniziare da zero. Le risposte tardive della sessione
  precedente non possono entrare in quella nuova. Esporta prima se vuoi conservare
  la trascrizione; l'azzeramento non elimina eventuali costi già fatturati.
- **Configura** apre un pannello richiudibile con tre sezioni: **Profilo**,
  **Audio** e **Dettagli**. I controlli principali rimangono sotto la chat; eventi,
  tempi e limiti sono in **Dettagli**. Nelle finestre strette il pannello copre
  temporaneamente la chat e si chiude con la X.
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

Per impostazione iniziale NEB attende 2,5 secondi di silenzio ricevuto, poi Qwen
elabora e Gemini prepara la voce. Da **Configura → Profilo → Pausa prima di
rispondere** puoi scegliere 1,5, 2,5 o 3,5 secondi. Questa preferenza e chi inizia
valgono per la finestra corrente e restano disponibili tra nuove conversazioni;
non sono salvati nei profili. Il ritardo totale comprende tutte queste fasi. Una pausa
lunga può essere scambiata per fine turno; brevi intercalari mantengono l'ascolto
quando Qwen li riconosce come intervento incompleto. Durante NEB, 1,2 secondi di
parlato remoto continuativo interrompono la risposta; brevi cenni vengono ignorati.
Non è una trascrizione o interpretazione streaming durante il parlato.

Il silenzio finale viene ridotto a 300 ms nell'audio inviato a Qwen, mantenendo
il parlato e la pausa locale scelta. Il transcript si aggiorna separatamente dal
livello audio. La riproduzione Live evita la copia WAV per replay usata dalla
console manuale: non conserva una registrazione della voce a fine turno.
Queste ottimizzazioni riducono dati e lavoro locale; non garantiscono tempi
inferiori del provider. I tempi Qwen osservati restano consultabili in Dettagli.

Limiti iniziali modificabili: 20 minuti, 40 interventi NEB, $1 di costo OpenRouter
osservato. Limiti tecnici: 120 secondi per intervento remoto, 35 secondi per Qwen
e 60 secondi al primo audio Gemini. L'ultimo intervento permesso può finire prima
della pausa per limite turni; il limite di durata può interrompere il parlato.
Un flusso mancante, un errore del provider o una risposta non valida mettono in pausa.
Il motivo originale resta visibile e **Riprendi ascolto** permette di riprovare
con un nuovo intervento, anche se la richiesta fallita non ha riportato il costo.
Le risposte valide senza costo rimangono utilizzabili: NEB tenta un recupero
tramite i metadati della generazione OpenRouter, con attesa massima di 1,5 secondi.
Se l'importo non è disponibile, il totale mostra **+ ?** e un avviso di costo
parziale. Il budget controlla soltanto gli importi ricevuti e non garantisce
il tetto di spesa effettivo quando alcuni costi mancano; verifica il totale
su OpenRouter. Il costo sconosciuto non viene trattato come zero né stimato.
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
Verificano profili, ritmo configurabile, avvio libero, transcript, controlli,
blocchi, azzeramento durante salvataggio o elaborazione e risposte tardive.
Lo smoke Live verifica anche i pannelli da tastiera, lo scorrimento della chat
e la visibilità dei comandi nelle finestre compatte, risposte con costo mancante,
avviso di totale parziale e ripresa dopo un errore Qwen senza costo riportato.
La prova hardware su cuffie, VB-CABLE e sito reale è separata: iniziare con una
breve conversazione di prova prima di usare una sessione lunga.

Verifica API del 4 ottobre 2026: una domanda tecnica testuale con un profilo
sintetico ha prodotto una decisione `speak` valida in 2537 ms, costo OpenRouter
riportato $0,00014499. Questa prova verifica il provider testuale; non misura
trascrizione audio, Gemini, routing o ritardo completo di una chiamata.

Verifica API successiva del 4 ottobre 2026: un secondo di silenzio WAV sintetico
mono a 16 kHz ha prodotto `wait` in 2536 ms, con costo riportato $0,00001697.
Una richiesta testuale minima è riuscita in 1217 ms. Sono controlli di disponibilità
del provider e formato audio, senza voce umana o collegamento VB-CABLE.

Verifiche finali: build e typecheck WSL passati, 255 test passati e 4 specifici
Windows saltati in WSL; 16 test bridge/audio/connettore passati su Windows. Smoke NEB Live
e smoke completo S2S/Console passati in Edge con audio e IPC sintetici. Host C#
aggiornato compilato per l'istanza Windows esistente. La finestra NEB mantiene
attivi i timer anche quando minimizzata.
