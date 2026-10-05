# Fish OpenRouter TTS

Implementazione in corso. Gemini e il runtime audio esistente non sono stati modificati nella fase del probe.

## Probe Del Trasporto

Il 2026-10-05 una richiesta reale `fish-audio/s2.1-pro-free:free`, senza riferimento personale e senza Simli, ha restituito HTTP 200, `audio/pcm;rate=44100;channels=1`, 487424 byte in 115 chunk. Primo byte: 946 ms; completamento: 3589 ms. Una singola richiesta senza clone non e un benchmark comparativo e non misura l'inizio udibile del parlato.

La [documentazione Fish](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech) dichiara PCM/WAV 16-bit mono e rate predefinito 44.1 kHz. Il [server open source ufficiale](https://github.com/fishaudio/fish-speech/blob/main/tools/server/inference.py) emette PCM `np.int16` nativo: questo non costituisce da solo una garanzia esplicita di endian del servizio OpenRouter. Per questo il probe riporta ancora `formatVerified: false`. Non collegare l'output al motore NEB finche non viene verificato il contratto completo.

Il programma non salva campioni o audio generato, non stampa chiavi, non avvia OBS e non passa automaticamente al modello a pagamento. I timeout sono 15 secondi al primo byte e 120 secondi totali, con massimo 32 MiB di risposta.

```powershell
node --env-file=.env.local scripts/voice/probe-fish.mjs --preset-only --consent
node --env-file=.env.local scripts/voice/probe-fish.mjs --reference C:\percorso\voce.wav --transcript-file C:\percorso\trascrizione.txt --consent
```

`--paid` richiede una scelta esplicita e usa Fish Pro. Il consenso implica invio della richiesta a OpenRouter/Fish; con riferimento implica anche invio di campione e trascrizione. Non usare il campione Gemini senza una scelta esplicita.

Il gate del Task 1 resta aperto per formato completo e prova del clone personale. Il probe non rende Fish selezionabile nell'app.

## Verifiche Locali

Il probe ha 9 test Node per consenso, selezione Free/Pro, letture limitate, validazione WAV, streaming, errori sanitizzati, timeout e limite della risposta. La suite applicativa resta verde: 371 test Vitest passati e 4 saltati; build e typecheck superati. Non sono ancora stati eseguiti test di playback Fish in Console/Live o confronti con Gemini.
