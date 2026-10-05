# Fish OpenRouter TTS

Fish Free e Pro sono selezionabili in Impostazioni per Console e NEB Live. Gemini rimane il default e le automazioni S2S continuano a usare Gemini. Nessun passaggio automatico dal Free al Pro.

## Probe Del Trasporto

Il 2026-10-05 una richiesta reale `fish-audio/s2.1-pro-free:free`, senza riferimento personale e senza Simli, ha restituito HTTP 200, `audio/pcm;rate=44100;channels=1`, 487424 byte in 115 chunk. Primo byte: 946 ms; completamento: 3589 ms. Una singola richiesta senza clone non e un benchmark comparativo e non misura l'inizio udibile del parlato.

La [documentazione Fish](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech) dichiara PCM/WAV 16-bit mono e rate predefinito 44.1 kHz. Inizialmente il probe riportava `formatVerified: false`, perche il sorgente open source da solo non garantiva l'endian del servizio ospitato. La [reference ufficiale OpenRouter, sezione Response](https://openrouter.ai/docs/api/api-reference/tts/create-speech) specifica invece PCM 16-bit little-endian. Il probe ora verifica il formato quando i metadati indicano un rate supportato, mono e un numero pari di byte; parametri mancanti, duplicati o inattesi restano non verificati.

Una successiva richiesta Free con campione e trascrizione autorizzati ha restituito HTTP 200, `audio/pcm;rate=44100;channels=1`, 499712 byte in 127 chunk, primo byte 3427 ms e completamento 6072 ms. Il riferimento ha superato la validazione WAV. Questo dimostra l'accettazione tecnica del riferimento e il trasporto incrementale, non la somiglianza della voce o un vantaggio rispetto a Gemini. Il probe eseguito prima dell'aggiornamento riportava ancora false; fonte ufficiale e metadati permettono ora di chiudere il gate del formato senza dedurlo dalla durata.

Il programma non salva campioni o audio generato, non stampa chiavi, non avvia OBS e non passa automaticamente al modello a pagamento. I timeout sono 15 secondi al primo byte e 120 secondi totali, con massimo 32 MiB di risposta.

```powershell
node --env-file=.env.local scripts/voice/probe-fish.mjs --preset-only --consent
node --env-file=.env.local scripts/voice/probe-fish.mjs --reference C:\percorso\voce.wav --transcript-file C:\percorso\trascrizione.txt --consent
```

`--paid` richiede una scelta esplicita e usa Fish Pro. Il consenso implica invio della richiesta a OpenRouter/Fish; con riferimento implica anche invio di campione e trascrizione. Non usare il campione Gemini senza una scelta esplicita.

Il riferimento Fish e separato dai profili Gemini: campione e trascrizione vengono salvati con Electron safeStorage fuori dal repository. Importazione e anteprima sono locali; la generazione invia entrambi a OpenRouter/Fish. Rimozione locale non cancella eventuali dati conservati dal provider. Il PCM remoto viene normalizzato incrementalmente a PCM16 LE mono 24 kHz con filtro anti-alias e carry dei byte frammentati. Stop cancella la richiesta senza retry o fallback.

## Verifiche Locali

La suite applicativa comprende 400 test passati, 4 saltati; build e typecheck superati. I 16 test Node comprendono probe, riepilogo benchmark e le cinque regressioni OBS. Il renderer Windows verifica importazione/rimozione Fish, Console, replay, Stop, due turni Live con Gemini indisponibile, avatar sintetico continuo, blocchi sessione e layout a 1260/980 px.

## Misure Windows Free

Sette richieste reali il 2026-10-05 con il riferimento autorizzato, senza riproduzione su dispositivi audio e senza avviare Simli/OBS:

| Richiesta | Primo PCM ms | Generazione ms | Audio s |
| --- | ---: | ---: | ---: |
| 1 | 3364 | 4214 | 2.46 |
| 2 | 2088 | 3623 | 3.67 |
| 3 | 2182 | 3706 | 3.99 |
| 4 | 1247 | 3264 | 4.23 |
| 5 | 1230 | 2508 | 2.65 |
| 6 | 2353 | 9938 | 17.93 |
| 7 | 2053 | 10281 | 17.04 |

Prima richiesta separata; mediana delle sei successive 2070.5 ms, massimo 2353 ms. Stop reale verificato. Il profilo cifrato dell'istanza di test viene rimosso alla chiusura, senza cambiare il profilo abituale. Nessuna chiamata Pro effettuata e nessun output personale salvato.

Questi tempi misurano il primo PCM nel renderer, non l'inizio udibile/avatar. Non sono un confronto Gemini/Pro e non provano la somiglianza della voce. Restano da valutare all'ascolto timbro, pronuncia, velocita e lipsync reale. La stima TTS e separata dai costi Qwen: Free zero, Pro sconosciuto (`null`), non addebito totale. Il catalogo pubblico `/api/v1/models` interrogato non espone Fish; non viene inventato un prezzo statico. Simli e il modello che genera la risposta possono avere costi separati.

## Test Manuale Ordinato

1. Chiudi NEB e riaprilo da Windows PowerShell:
   ```powershell
   cd C:\Users\r.nebili\.codex\worktrees\outlier-s2s\NebVoiceGenerator
   .\scripts\run-windows.ps1
   ```
2. Impostazioni: seleziona provider Fish - OpenRouter e Fish S2.1 Pro Free - gratuito. Nel pannello Voce personale Fish scegli il WAV autorizzato, dai un nome, inserisci la trascrizione esatta, spunta il consenso e premi Salva riferimento Fish. Il campione deve essere WAV PCM16 mono, 5-60 s, 16/24/44.1/48 kHz, massimo 6 MiB. Il consenso si seleziona nell'interfaccia: non va aggiunto al testo parlato.

   Trascrizione del campione confermata dall'utente:
   > Ciao, sono qui per provare la mia voce digitale. Vorrei che mantenesse il mio timbro, il mio ritmo e il mio modo naturale di parlare. Durante una conversazione posso parlare con calma, fare una pausa e poi riprendere. Questa registrazione servirà a confrontare la qualità della voce e la velocità delle risposte.

3. In Console disattiva inizialmente Simli; seleziona come uscita le cuffie invece di CABLE Input per ascoltare direttamente. Scrivi `Ciao, questa e una prova della mia voce. Vorrei capire se il timbro e naturale.` e premi Pronuncia. Apri Dettagli generazione e annota modello, primo audio e durata; valuta timbro e ritmo. Ripeti due volte.
4. Prova Riascolta, che usa l'audio gia generato; genera poi un testo piu lungo e premi Stop durante la riproduzione. L'audio deve fermarsi senza ripartire.
5. Abilita Simli e ripeti: verifica sincronizzazione bocca/audio. Ripristina CABLE Input prima della prova sul sito, con CABLE Output come microfono del sito e OBS Virtual Camera come webcam, usando la configurazione OBS gia funzionante.
6. In NEB Live avvia la normale acquisizione, fai due domande e verifica voce Fish e avatar visibile anche durante l'ascolto. Controlla Stop e Pausa/Riprendi. Non cambiare provider/profilo durante una sessione; premi Stop prima.
7. Per confrontare Gemini: Stop, Impostazioni, provider Gemini, stesso testo e stessa uscita audio. Confronta tempi e somiglianza. Non selezionare Pro durante la prova gratuita: richiede conferma esplicita e puo addebitare costi.
