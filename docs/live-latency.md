# NEB Live: Riduzione Delle Attese

## Pannello Tempi della conversazione

In NEB Live, espandi **Tempi della conversazione** sopra la trascrizione.
Il riepilogo mostra ultima risposta, mediana, numero di turni misurati e risposta
più lenta. La tabella mostra gli ultimi dieci turni disponibili e la voce usata.
Le misure non avviano nuove richieste ai provider e non modificano la pausa o i modelli.

Il totale va dall'ultimo pacchetto di parlato rilevato all'avvio della riproduzione
locale. Non misura l'arrivo al sito remoto, la catena VB-CABLE o ciò che sente
l'interlocutore. Sono incluse risposte interrotte dopo l'avvio, ma sono escluse
aperture, risposte ai soli allegati e tentativi annullati prima della riproduzione.

Quattro intervalli consecutivi compongono il totale:

1. **Prima di Qwen**: fine del parlato → avvio dell'ultima richiesta Qwen accettata.
   Include la pausa osservata, eventuali gap di consegna e precedenti tentativi
   di elaborazione/recupero sulla stessa domanda.
2. **Qwen · ultima richiesta**: avvio → risultato accettato nel renderer.
   Include IPC, elaborazione remota, correzioni interne e recupero del costo.
   È il tempo locale osservato, distinto dal `qwenMs` dichiarato dal provider nei log.
3. **Attesa prima della voce**: risultato Qwen → ultimo tentativo vocale avviato.
   Include la guardia finale e precedenti tentativi vocali falliti/attese di recupero.
4. **Preparazione audio/avatar**: ultimo tentativo vocale → avvio riproduzione.

In **Dettagli** sono disponibili modello, primo blocco audio e durata della
generazione vocale. Queste misure si sovrappongono alla riproduzione: non vengono
sommate al totale. Il primo blocco è osservato nel percorso di elaborazione PCM;
non è una misura acustica. Una misura assente è **Non disponibile**, non zero.

Le righe sono collegate al tentativo vocale tramite `responseId`. Callback di
tentativi annullati o sessioni precedenti non alimentano le misure della sessione
corrente. Il JSON esportato include `turnNumber` e `breakdown` negli eventi
`turn-response`; gli eventi vocali correlati portano lo stesso `responseId`.
I dettagli aggiuntivi non cambiano i campi esistenti dell'esportazione.

Il riepilogo usa i log ancora disponibili (ultimi 500 eventi). La tabella mostra
gli ultimi dieci turni, mentre mediana e massimo usano tutti i turni misurati
ancora conservati. Nelle sessioni lunghe i turni iniziali possono non esserci più.
Esporta JSON prima di iniziare una nuova conversazione per conservarli.

Prova renderer con IPC e PCM sintetici, senza richieste ai provider, da Windows
nel worktree sincronizzato (usa il Playwright delle altre prove renderer in
`.superpowers/outlier-smoke`):

```powershell
$env:NEB_TIMING_SMOKE = '1'
node .\scripts\live\smoke-renderer.mjs
$env:NEB_FISH_SMOKE = '1'
node .\scripts\live\smoke-renderer.mjs
Remove-Item Env:NEB_TIMING_SMOKE, Env:NEB_FISH_SMOKE
```

## Analizzare e confrontare gli export

Da Windows PowerShell, nella cartella del progetto, con Node 22.18+ o 24+:

```powershell
npm run live:timings -- "C:\percorso\rapida.json" "C:\percorso\naturale.json"
```

I percorsi dell'esempio sono segnaposto: prima usa **Esporta JSON** in NEB Live,
poi passa il percorso del file effettivamente salvato. Basta anche un solo file.
`ENOENT` significa che il file indicato non esiste, non che una sessione è fallita.

Il comando legge solo i file locali e non invia richieste ai provider. Ogni
export resta una sessione separata, nell'ordine dei file passati. All'interno di
ogni sessione i turni sono raggruppati per provider e modello, usando gli stessi
`responseId` del pannello. I file duplicati e gli export non validi vengono
rifiutati prima di stampare un report parziale. Il limite per file è 16 MiB.

Per ogni gruppo sono mostrati numero di turni, mediana, P95 e massimo del totale,
mediane delle quattro fasi e fase con mediana maggiore. Primo blocco e generazione
riportano anche il numero di misure disponibili. Dati mancanti, vecchi o incompleti
restano sconosciuti. Il report non contiene trascrizioni, allegati o chiavi API.

Il P95 usa il rango più vicino: elemento `ceil(0,95 × n)` dei tempi ordinati.
Con pochi turni coincide spesso con il massimo; non dimostra da solo la stabilità
di un provider. Le mediane delle fasi non sono additive. Il report riassume solo
gli eventi ancora conservati nell'export, inclusi i turni interrotti dopo l'avvio.

Per ottenere un JSON del report, senza i messaggi di npm nell'output:

```powershell
node .\scripts\live\timing-report.mjs --json "C:\percorso\rapida.json" "C:\percorso\naturale.json"
```

Confronta sessioni con le stesse domande, voce, avatar e uscita audio. Cambia una
sola impostazione alla volta, ad esempio Rapida/Naturale, e ripeti più turni.
Le misure reali richiedono gli export delle conversazioni: le prove sintetiche
verificano il calcolo e il flusso, non le prestazioni del cloud.

Regressioni del comando: `npm run test:live-timings` (Node nativo, WSL o Windows).

## Ottimizzazione precedente

Modifica approvata il 2026-10-05. Gemini, Fish, il modello Qwen, Simli e OBS non cambiano.

- Pausa iniziale Rapida: 1500 ms di silenzio audio osservato invece di 2500 ms. Configura > Audio > Pausa prima di rispondere mantiene Naturale (2500 ms) e Riflessiva (3500 ms). La ripresa del parlato annulla ancora una risposta non iniziata.
- Recupero costo OpenRouter: timeout separato di 250 ms invece di 1500 ms, compresa la lettura del corpo della risposta. Non modifica il timeout della decisione Qwen. I costi ricevuti restano conteggiati; quelli mancanti restano sconosciuti, non zero. Il limite di costo controlla soltanto gli importi ricevuti: verificare il totale su OpenRouter.
- Nel JSON esportato, `snapshot.log` contiene `kind: "turn-response"`, `durationMs`: tempo dall'ultimo pacchetto di parlato rilevato al primo avvio della riproduzione. Comprende attesa di fine turno, decisione Qwen, guardia finale e preparazione audio/avatar; usa il tempo reale, non la durata del PCM. Non e una misura acustica esterna o dell'arrivo al sito remoto. Aperture senza domanda e playback annullati non producono questa misura. Retry e attese sulla stessa domanda restano inclusi.

Le attese locali configurate si riducono di 1 secondo piu un massimo condizionale di 1.25 secondi per ciascun recupero costo lento. Non e una promessa sul tempo totale: i servizi remoti e i tentativi di recupero possono dominare la latenza. Un recupero costi rapido o non necessario non produce quel risparmio.

## Prova Manuale

1. Chiudi e riapri NEB da Windows PowerShell:
   ```powershell
   cd C:\Users\r.nebili\.codex\worktrees\outlier-s2s\NebVoiceGenerator
   .\scripts\run-windows.ps1
   ```
2. Impostazioni > Provider vocale: Gemini. In NEB Live > Configura > Audio verifica Rapida, 1.5 secondi. Lascia invariati voce, uscita audio e impostazioni OBS.
3. Avvia Live e fai tre domande brevi, lasciando silenzio dopo ciascuna. Controlla tempi percepiti, naturalezza della voce e avatar continuo.
4. Fai una pausa di circa un secondo a meta domanda e poi riprendi: NEB deve continuare ad ascoltare. Prova anche a riprendere dopo che appare Elaborazione: la risposta precedente deve essere scartata. Stop deve fermare la riproduzione e impedire risposte tardive.
5. Esporta JSON. Le righe `turn-response` forniscono i tempi per i turni effettivamente avviati; `voice-start` misura invece solo la preparazione fino al playback. Ripeti con Naturale, 2.5 secondi, mantenendo domande e configurazione uguali. Le fluttuazioni cloud richiedono piu prove; un solo turno non dimostra un miglioramento.

Le verifiche automatiche non inviano nuove registrazioni o richieste a pagamento. Il confronto sul tuo audio e nella tua intervista resta una prova manuale.

## Verifiche Eseguite

405 test Vitest passati, 4 saltati; build e typecheck superati. Cinque regressioni Node OBS passate. Prova renderer Windows Gemini superata: pausa Rapida iniziale, Naturale ancora selezionabile, due turni, recuperi, Stop, avatar sintetico continuo e layout compatto. Revisione indipendente senza rilievi. Nuovi test riproducevano le vecchie attese prima della modifica; includono metadati bloccati durante headers o lettura corpo e misura reale con un gap di consegna PCM.
