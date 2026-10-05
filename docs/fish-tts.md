# Fish OpenRouter TTS

Implementazione in corso. Gemini e il runtime audio esistente non sono stati modificati nella fase del probe.

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

Il gate del Task 1 e risolto per formato completo e richiesta con riferimento personale. Il probe non rende Fish selezionabile nell'app: profilo cifrato, adapter PCM 24 kHz, UI e prove di playback restano da implementare.

## Verifiche Locali

Il probe ha 10 test Node per consenso, selezione Free/Pro, letture limitate, validazione WAV, streaming, metadati PCM, errori sanitizzati, timeout e limite della risposta. La suite applicativa resta verde: 371 test Vitest passati e 4 saltati; build e typecheck superati. Non sono ancora stati eseguiti test di playback Fish in Console/Live o confronti con Gemini.
