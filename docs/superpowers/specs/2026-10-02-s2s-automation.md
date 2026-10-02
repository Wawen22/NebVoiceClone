# Conversazione automatica S2S

Proposta approvata in chat il 2 ottobre 2026. La prima versione usa
`qwen/qwen3.8-omni-flash` su OpenRouter e la voce Gemini già selezionata.
Qwen adatta le battute mantenendo obiettivo e ordine; NEB controlla la riproduzione.

## Comportamento

- Avvio esplicito su MODEL A o MODEL B e sul progetto S2S selezionato.
- Acquisizione della sola scheda Edge associata, iniziata dal popup dell'estensione.
  Audio PCM mono 16 kHz, ascolto locale conservato, nessuna chiave nell'estensione.
- Prima battuta originale, poi audio della risposta e contesto testuale a Qwen.
- Silenzio predefinito 2500 ms (configurabile 1500–5000 ms) seguito da valutazione
  semantica. Esitazioni/frasi incomplete aspettano; sì/capito sono contestuali.
- Una risposta nuova invalida una proposta precedente, anche durante la preparazione
  TTS. Durante la voce NEB, segnali brevi sono conservati; parlato continuativo
  sostanziale interrompe la battuta senza marcarla completata.
- Dopo una risposta conclusa a un'interruzione, Qwen può proseguire contestualmente
  lo stesso obiettivo pendente; la ripetizione integrale dell'originale è esplicita.
- Nessun avanzamento senza risposta. Ultima risposta ascoltata prima di completare.
- Pause, Stop, cambio destinazione, disconnessione, errori e timeout impediscono
  audio futuro; abort e identificatori delle operazioni scartano risposte obsolete.
- Contesti A/B separati per sessione. Originali non sovrascritti; cronologia
  dell'adattamento, testo pronunciato, interruzioni, decisioni e tempi esportabile.
- Limiti configurabili di turni, durata e costo OpenRouter riportato dalle API.
  Una richiesta già partita può superare il limite di costo; nessuna successiva.
- Se la risposta richiede informazioni personali mancanti, Qwen chiede pausa.
- Nessuna interazione automatica con Submit o valutazioni Rationale.

## Limiti da comunicare

La fine turno viene stimata da audio e Qwen: non c'è un segnale affidabile della
pagina live nel connettore attuale. Il riconoscimento delle interruzioni durante
TTS nella prima versione è acustico/conservativo, non una trascrizione realtime.
OpenRouter elabora clip per richiesta; 2500 ms non sono la latenza totale.
Audio e contesto inviati a OpenRouter/Alibaba, voce inviata a Gemini. Nessuna
registrazione permanente automatica; esportazione della cronologia su richiesta.

## Verifica

Test di turni, risposte obsolete, pause, Stop, completamento, timeout, limiti,
integrità dei pacchetti e contratto audio/JSON Qwen. Test del worker estensione
con API browser simulate e del processore PCM su campioni controllati.
Build, suite completa e typecheck; sincronizzazione WSL verso le due cartelle
Windows, compilazione host e commit main. Prova reale guidata su Windows/Edge
necessaria per confermare cattura audio e latenza end-to-end.
