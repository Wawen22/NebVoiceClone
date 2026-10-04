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

## Screenshot e snippet durante la conversazione

La barra **Contesto** sopra la chat permette di aggiungere materiale anche mentre
NEB ascolta o parla:

- **Cattura finestra**: scegli la finestra dell'interview o uno schermo. La prima
  scelta acquisisce uno screenshot; i clic successivi catturano di nuovo la stessa
  sorgente. Il pulsante accanto permette di cambiarla. Mantieni il codice visibile
  e leggibile; se la cattura di una finestra non riesce, usa gli appunti.
- **Incolla screenshot**: prima ritaglia con **Win+Shift+S**, poi premi il pulsante.
  Puoi anche incollare direttamente con **Ctrl+V** nella pagina NEB Live.
- **Carica immagine**: seleziona un file PNG o JPEG fino a 10 MB.
- **Snippet**: incolla direttamente codice o testo, fino a 20.000 caratteri.

Sono disponibili al massimo tre allegati contemporaneamente. La barra mostra
anteprima o nome e una X per rimuoverli. Rimangono nel contesto dei turni successivi
finché non li rimuovi o premi **Nuova conversazione**. Una cattura è un'immagine
di quel momento: per mostrare modifiche al codice, acquisiscine una nuova.

Con immagini e nuovo audio, Qwen trascrive prima l'audio senza screenshot o profilo;
poi analizza le immagini insieme alla domanda riconosciuta e alla cronologia.
Questo evita che l'analisi visiva ometta la trascrizione. Gli snippet senza immagini
possono essere elaborati direttamente insieme all'audio. Se aggiungi
o rimuovi materiale mentre prepara una risposta non ancora pronunciata, NEB
annulla la proposta precedente e rielabora la stessa domanda con il nuovo contesto.
L'ascolto della scheda continua; le richieste annullate possono avere un costo.
Se la voce è già partita, finisce senza essere interrotta dall'allegato.
Il materiale sarà usato al prossimo turno. Durante l'ascolto puoi premere
**Rispondi ora** per analizzare gli allegati in relazione all'ultima domanda,
anche senza farla ripetere all'interlocutore.

Gli screenshot sono ridimensionati fino a 2200 × 1600 pixel e 4 MB per immagine.
Immagini e snippet vengono inviati a Qwen tramite OpenRouter per l'elaborazione.
Restano in memoria nella sessione e non sono salvati nei profili. L'esportazione
JSON include il testo degli snippet e i metadati delle immagini, senza i loro byte.

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
  ancora in salvataggio e pulisce trascrizione, allegati, eventi, turni e costo della sessione.
  Profilo, voce, ritmo e ascolto della scheda restano disponibili. Premi poi
  **Avvia conversazione** per iniziare da zero. Le risposte tardive della sessione
  precedente non possono entrare in quella nuova. Esporta prima se vuoi conservare
  la trascrizione; l'azzeramento non elimina eventuali costi già fatturati.
- **Configura** apre un pannello richiudibile con tre sezioni: **Profilo**,
  **Audio** e **Dettagli**. I controlli principali rimangono sotto la chat; eventi,
  tempi e limiti sono in **Dettagli**. Nelle finestre strette il pannello copre
  temporaneamente la chat e si chiude con la X.
- **Pausa** interrompe elaborazione e voce; **Riprendi ascolto** attende un nuovo
  intervento senza ripetere automaticamente la risposta precedente. Se la pausa
  nasce da un errore Qwen o della voce prima della riproduzione, conserva l'audio
  della domanda non ancora risposta: dopo la ripresa puoi premere **Rispondi ora**.
- **Rispondi ora**, disponibile durante l'ascolto dopo una domanda acquisita o con allegati presenti,
  indica al modello che il turno è finito e rielabora quell'audio. Non legge una
  risposta preimpostata e non forza il parlato mentre l'interlocutore continua.
  Se la richiesta è ambigua, Qwen riceve istruzioni di chiedere un chiarimento.
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

Se Qwen risponde `wait` dopo aver trascritto parlato, NEB rivaluta una volta la
stessa domanda dopo almeno 8 secondi di silenzio ricevuto e 5 secondi dalla
decisione. Non richiede altre parole all'interlocutore. Ogni nuovo intervento
può avere una sola rivalutazione automatica; ulteriori richieste sono manuali
con **Rispondi ora**. Se Qwen non ha riconosciuto parole, non rivaluta rumori
o risate. L'ulteriore richiesta può avere un costo OpenRouter.

Le decisioni Qwen usano uno schema JSON obbligatorio. Quando la trascrizione è già
nota, il modello genera solo azione, testo e motivazione: il sistema conserva le
parole riconosciute senza richiedere al modello di ripeterle. Lo stesso vale per
apertura e analisi senza nuovo audio, dove la trascrizione è vuota per definizione.
Un singolo oggetto racchiuso in un array e un blocco JSON completo sono normalizzati
prima della verifica; più risultati o testo ambiguo restano invalidi. Una motivazione
interna mancante non impedisce una risposta altrimenti valida; le azioni che non
autorizzano il parlato ignorano qualsiasi testo da pronunciare.

Se mancano campi essenziali, NEB tenta una correzione. Riutilizza la trascrizione
riconosciuta oppure, se manca, trascrive separatamente lo stesso audio prima di
formulare una risposta testuale. Non usa gli screenshot per inventare la domanda.
Quando la trascrizione separata è vuota, riprende l'ascolto senza rispondere
automaticamente a materiale già presente. Tutte le fasi restano entro il timeout
originale; costo e tempo comprendono le richieste effettuate. Gli importi conosciuti
restano conteggiati anche quando il costo di uno dei tentativi non è disponibile.

Se anche la correzione produce una decisione non valida, NEB continua ad ascoltare
e conserva la domanda, mostrando **Qwen non ha completato la risposta**.
Quando la domanda audio è conservata e non è già stata rivalutata a fine turno,
NEB riprova una volta automaticamente dopo almeno 8 secondi di silenzio ricevuto
e 5 secondi dalla decisione. Questo equivale a **Rispondi ora**, che resta
disponibile anche prima del tentativo automatico. Non avvia ulteriori richieste
in ciclo sulla stessa domanda; nuovo parlato permette una nuova rivalutazione.
La verifica e il motivo originale restano consultabili negli
eventi della sessione. Errori di connessione, provider, durata, audio assente e
limiti continuano a mettere in pausa secondo le regole precedenti.

Il silenzio finale viene ridotto a 300 ms nell'audio inviato a Qwen, mantenendo
il parlato e la pausa locale scelta. Il buffer non cresce con il silenzio mentre
Qwen elabora o Gemini prepara la voce. Il transcript si aggiorna separatamente dal
livello audio. La riproduzione Live evita la copia WAV per replay usata dalla
console manuale: non conserva una registrazione della voce a fine turno.
Queste ottimizzazioni riducono dati e lavoro locale; non garantiscono tempi
inferiori del provider. I tempi Qwen osservati restano consultabili in Dettagli.

Limiti iniziali modificabili: 20 minuti, 40 interventi NEB, $1 di costo OpenRouter
osservato. Limiti tecnici: 180 secondi di audio conservato per intervento remoto;
timeout Qwen da 35 a 90 secondi, calcolato dalla durata dell'audio
(almeno 60 secondi quando sono presenti immagini),
e 60 secondi al primo audio Gemini. L'ultimo intervento permesso può finire prima
della pausa per limite turni; il limite di durata può interrompere il parlato.
Un flusso mancante, un errore del provider o una risposta non valida mettono in pausa.
Il motivo originale resta visibile e **Riprendi ascolto** permette di riprovare
con un nuovo intervento o **Rispondi ora** sulla domanda conservata, anche se
la richiesta fallita non ha riportato il costo.
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
Verifica anche rivalutazione automatica di `wait`, **Rispondi ora** e recupero
della domanda conservata dopo un errore del provider.
Verifica anche la permanenza in ascolto dopo una correzione incompleta, il
recupero manuale e automatico della stessa domanda senza perdita dell'audio
e l'assenza di cicli di rivalutazione.
Verifica inoltre cattura della finestra, immagini dagli appunti, file e incolla,
snippet, aggiornamento degli allegati durante l'elaborazione, continuità della
voce già iniziata, analisi senza nuovo audio e acquisizioni tardive dopo l'azzeramento.
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

Verifica input lungo: 180 secondi di silenzio WAV sintetico sono stati accettati
da Qwen in 6844 ms, costo $0,00020763. Un payload di 300 secondi è stato rifiutato
dal provider; NEB Live limita gli input a 180 secondi. Questo controllo verifica
il formato e la dimensione, non l'accuratezza della trascrizione di parlato lungo.

Verifica multimodale del 4 ottobre 2026: uno screenshot sintetico con un ciclo
JavaScript e un secondo di silenzio WAV nella stessa richiesta sono stati accettati
da Qwen in 2579 ms, costo $0,00010132. Il modello ha individuato correttamente
l'accesso fuori indice causato da `i <= items.length`. Questa prova verifica
immagine e audio insieme; non misura una cattura desktop o una chiamata completa.

Prova nativa Windows del 4 ottobre 2026, senza aprire l'interfaccia NEB:
enumerazione delle sorgenti, acquisizione dello schermo a 2200 × 1238 pixel,
importazione dello screenshot sintetico a 1040 × 440 e lettura degli appunti
riuscite. Gli appunti non contenevano immagini in quella prova; il percorso
di incolla immagine è coperto dai test con dati sintetici.

Verifica schema e parlato del 4 ottobre 2026: tre domande sintetizzate localmente
su saluto, presentazione professionale e array rispetto a liste concatenate sono
state inviate all'API reale con un profilo fittizio. Tutte hanno prodotto `speak`
con trascrizione e testo non vuoti al primo tentativo, rispettivamente in
3937, 3060 e 5549 ms. Costi $0,00019737, $0,00020041 e $0,00026892.
La prova verifica input vocale e schema; non misura l'intera catena di una chiamata.

Prova di recupero con API reale: sulla domanda vocale sintetica «Hi, how are you
today?» senza `endOfTurn` è stata svuotata deliberatamente la trascrizione della
prima risposta, mantenendo gli altri campi e il costo. NEB ha effettuato una sola
correzione con lo stesso audio e restituito `speak` con trascrizione e testo validi
in 6727 ms complessivi, costo $0,00041195. È un errore iniettato per verificare
il recupero, non una registrazione dell'intervista dell'utente.

Verifica multimodale successiva del 4 ottobre 2026: con una domanda vocale sintetica
su un hook React e due screenshot sintetici, la versione precedente ha emesso
una risposta con trascrizione vuota in una delle due prove. È stato riprodotto
anche l'output `[{"transcript":"…"}]` nonostante lo schema a oggetto.
Con trascrizione separata e normalizzazione del singolo oggetto, le tre prove
finali sono riuscite: due richieste ciascuna, trascrizione e risposta valide,
13136, 6907 e 6832 ms complessivi. Una delle sei risposte del provider conteneva
il contenitore a un solo elemento ed è stata gestita senza ulteriore richiesta.
Costi totali $0,00066053, $0,000326872 e $0,000325312. Sono prove di provider e
formato con materiale sintetico; i tempi non includono Gemini o il routing audio.

Verifiche finali: build e typecheck WSL passati, 298 test passati e 4 specifici
Windows saltati in WSL; 16 test bridge/audio/connettore passati su Windows. Smoke NEB Live
e smoke completo S2S/Console passati in Edge con audio e IPC sintetici. Host C#
aggiornato compilato per l'istanza Windows esistente. La finestra NEB mantiene
attivi i timer anche quando minimizzata.
