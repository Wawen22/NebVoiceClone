# Avatar Simli per NEB Voice Console e NEB Live

## Obiettivo e accordi

Il 5 ottobre 2026 l'utente ha approvato la direzione: usare Simli Free con
un volto predefinito, collegato alla voce prodotta da NEB, nelle sezioni Console
e NEB Live. Il volto personale verra' valutato dopo il funzionamento completo
del prototipo e un eventuale upgrade deciso dall'utente.

L'utente ha delegato lo sviluppo e i test finali. Il portatile usa grafica Intel
integrata: l'animazione avviene nel cloud, la riproduzione in Electron su Windows.
La chiave fornita e' autorizzata per le chiamate Simli ma non deve comparire in
questo documento, nel codice, nei commit, negli screenshot o nei log.

Stato del documento: specifica pronta per revisione; implementazione non iniziata.

## Evidenze verificate

- Lo screenshot dell'utente mostra Free: 50 minuti/mese, una sessione contemporanea.
  Hobby mostra $10/mese e una generazione del volto; nessun upgrade automatico.
- Una GET autenticata a `https://api.simli.ai/faces` ha avuto successo e ha
  restituito zero volti personali. Questa verifica non dimostra lo streaming.
- I volti predefiniti sono utilizzabili tramite Face ID direttamente nell'SDK.
  Non occorre configurare un agente che rigeneri testo o voce su Simli.
- `App.tsx` riceve il PCM Gemini attraverso `window.neb.synthesizeStream`.
- `live/useLiveConversation.ts` usa `streamS2SSpeech` e `BrowserAudioEngine`.
- L'audio vocale NEB e' PCM16 mono a 24 kHz. L'SDK Simli documenta PCM16 a 16 kHz.
- L'SDK offre WebRTC, eventi di parlato, cancellazione del buffer e token temporanei.
  I dettagli del modello Trinity e della compatibilita' dei preset saranno
  confermati con un breve test reale prima di integrarli nella conversazione.

## Scelta di integrazione

Un modulo avatar condiviso, attivabile esplicitamente, serve la Console e Live.
Il percorso vocale esistente resta il comportamento iniziale quando l'avatar
e' disattivato. Si usa l'SDK ufficiale Simli, con una versione fissata nel lockfile.

Il primo preset proposto e' Fred, Face ID
`1c6aa65c-d858-4721-a4d9-bda9fde03141`, presente nella documentazione ufficiale.
Se il test reale segnala incompatibilita' con il piano/modello corrente, si
sceglie un altro preset disponibile prima dell'integrazione. L'interfaccia
permette di sostituire il Face ID dopo l'upgrade senza cambiare il flusso audio.

Non si generano volti nuovi e non si acquistano servizi durante lo sviluppo Free.
Si invia a Simli solo la voce NEB, non l'audio dell'interlocutore o gli allegati.

## Sicurezza e configurazione

- Il processo principale legge `SIMLI_API_KEY` da `.env.local`, escluso da Git.
  Il file locale viene configurato e sincronizzato alle destinazioni Windows
  senza esporre le altre chiavi presenti.
- Il renderer riceve solo stato configurazione, preset e token temporanei.
- Le nuove chiamate IPC applicano `assertTrusted` come le API Live esistenti.
  Face ID, durata richiesta e dati di configurazione sono validati nel main.
- Richieste a Simli usano endpoint fissi HTTPS, timeout e messaggi sanitizzati;
  nessun URL remoto arbitrario viene accettato dal renderer.
- La CSP concede solo le connessioni necessarie a Simli e al trasporto WebRTC
  scelto dopo l'ispezione dell'SDK. Si evitano autorizzazioni globali.

## Audio, sincronizzazione e fine turno

Quando l'avatar e' attivo, NEB attende che video e uscita audio siano pronti prima
di autorizzare il parlato. Il PCM Gemini viene convertito da 24 a 16 kHz con
continuita' tra blocchi e inviato a Simli senza una seconda sintesi TTS.

La voce udibile viene dal flusso sincronizzato restituito da Simli. La copia
locale non suona contemporaneamente. L'uscita ricevuta rispetta il dispositivo
selezionato in NEB, incluso CABLE Input, e il volume configurato.

L'inizio e la fine del parlato Live si riferiscono alla riproduzione ricevuta,
non solo all'invio dell'ultimo blocco Gemini. Il controller non deve aprire un
nuovo turno mentre Simli sta ancora pronunciando la risposta precedente.
Si prevedono timeout di avvio e completamento, buffer limitati e invalidazione
dei callback tardivi attraverso un identificatore di sessione/turno.

La Console conserva il replay della voce generata come gia' previsto. Il replay
deve animare l'avatar quando attivo. L'audio WAV caricato manualmente e' supportato
convertendolo al formato richiesto, oppure mostra un'indicazione esplicita del
percorso audio disponibile: mai una bocca apparentemente attiva senza sincronismo.

## Ciclo di vita e piano Free

Una sola connessione Simli puo' essere aperta nell'app. Console e Live condividono
il proprietario della sessione; i blocchi gia' esistenti impediscono parlato concorrente.
Il cambio vista non apre una seconda connessione.

Gli stati sono: disattivato, connessione, pronto, parlato, errore e chiusura.
Il pulsante disattiva chiude la sessione. Anche Stop globale, uscita dall'app e
reset della conversazione eliminano audio pendente e callback obsoleti.
Pausa o interruzione remota fermano subito audio e bocca; una ripresa crea
una nuova connessione se quella precedente e' stata chiusa.

Prime prove: sessioni di massimo 120 secondi. Nessun ciclo di riconnessioni
illimitato. Il tempo collegato e' mostrato come tempo locale, non come quota
fatturata certificata. Il conteggio di silenzio/ascolto viene verificato nel
dashboard del servizio durante i test reali.

Se la rete cade o i minuti finiscono, la risposta in corso viene fermata e
segnalata come parziale in Live. Si puo' proseguire con sola voce dopo una scelta
esplicita; la risposta non viene ripetuta automaticamente da capo.

## Esperienza nelle due sezioni

Configurazione comune: preset/Face ID, stato credenziale senza mostrarla,
attivazione avatar, connessione/disconnessione e test breve.
Anteprima video con proporzioni stabili, controlli compatti e stato leggibile.
Il pannello non copre transcript, editor, controllo uscita o Stop.
L'impostazione iniziale e' avatar disattivato: aprire NEB non consuma minuti Simli.

Nel primo rilascio il risultato e' visibile dentro NEB. Una finestra dedicata
per OBS Virtual Camera e l'utilizzo come webcam in Meet/Teams sono una fase
successiva: richiedono verifica separata di cattura video e routing audio su Windows.

## Componenti interessati

- `src/shared/avatar.ts`: contratti, validazione configurazione e preset.
- `src/main/avatar/`: configurazione locale, API token, errori e registrazione IPC.
- `src/preload/index.ts` e `src/shared/contracts.ts`: API avatar minima tipizzata.
- `src/renderer/src/avatar/`: client/sessione condivisa, conversione PCM,
  playback sincronizzato, pannello e adattatore audio.
- `src/renderer/src/App.tsx`: percorso Console e configurazione condivisa.
- `src/renderer/src/live/useLiveConversation.ts`: percorso vocale Live.
- `src/renderer/src/s2s/speechPlayer.ts`: eventi effettivi di playback se necessari.
- `src/renderer/index.html`: CSP per gli endpoint realmente usati.
- `scripts/avatar/`: smoke sintetico e breve verifica reale con segreti locali.

Le modifiche evitano il Native Host e la pipe browser: non servono per ricevere
il video Simli. L'automatico Outlier S2S resta fuori dal primo rilascio avatar.

## Verifica e criteri di accettazione

1. Test di validazione, gestione errori API e protezione delle credenziali.
2. Conversione PCM: durata corretta, continuita' tra blocchi e reset tra turni.
3. Sessione: Stop durante connessione/TTS/playback, rete assente, quota esaurita,
   callback tardivi, fine turno corretta e una sola sessione tra Live e Console.
4. Smoke renderer con Simli/IPC/audio sintetici: controlli, entrambi i percorsi,
   nessuna doppia voce e layout senza sovrapposizioni alle dimensioni supportate.
5. Test cloud reale su Windows con preset e audio breve: frame video non vuoti,
   voce ricevuta, sincronismo visibile, Stop e chiusura. Accesso API riuscito
   o mock verdi da soli non bastano a dichiarare l'integrazione funzionante.
6. Routing reale su uscita Windows; CABLE Input viene verificato se presente.
   Eventuali controlli hardware non automatizzabili sono dichiarati chiaramente.
7. `npm run build`, `npm test` e `npm run typecheck` sul repository WSL master.
   Sorgenti e `out/` sincronizzati con rsync a entrambe le cartelle Windows
   prescritte in AGENTS.md; commit su main limitato ai file della modifica.
8. Electron viene avviato solo da Windows. Nessun avvio dell'interfaccia da WSL.

## Fonti

- https://docs.simli.com/api-reference/preset-faces
- https://docs.simli.com/api-reference/javascript
- https://docs.simli.com/api-reference/javascript_upgrade_guide
- https://docs.simli.com/api-reference/compose-session-token
- https://docs.simli.com/api-reference/api_migration_guide
- https://docs.simli.com/api-reference/get-all-faces
