# Avatar NEB come webcam

## Avvio Windows

Chiudi la vecchia NEB Voice Console e riaprila da Windows PowerShell:

```powershell
cd C:\Users\r.nebili\.codex\worktrees\outlier-s2s\NebVoiceGenerator
.\scripts\run-windows.ps1
```

Apri OBS Studio. Non servono registrazione, streaming o un nuovo avatar nel pannello Simli.

## Configurazione Una Tantum

1. In NEB attiva Simli, scegli Fred e attiva **Uscita OBS**. Il solo interruttore OBS non collega Simli e non consuma una nuova sessione.
2. La scena OBS **NEB Avatar** contiene la sorgente Browser **NEB Avatar - video locale**. Se devi configurarla manualmente, usa il pulsante **Copia URL OBS** di NEB e incolla l'URL nella sorgente Browser. Non condividere l'URL: contiene un token locale, non la chiave Simli.
3. Sorgente Browser: larghezza 1280, altezza 720; disattiva **Chiudi sorgente quando non visibile** e **Aggiorna browser quando la scena diventa attiva**. Non aggiungere acquisizione schermo/finestra o microfoni alla scena.
4. Accanto a **Avvia webcam virtuale**, apri l'ingranaggio: uscita **Scena**, scena **NEB Avatar**. Conferma. Non scegliere Programma/Anteprima: cambiare scena OBS non deve cambiare cio che vede il sito.
5. Premi **Avvia webcam virtuale**. Nel sito scegli **OBS Virtual Camera** come webcam e **CABLE Output** come microfono. L'uscita audio di NEB resta **CABLE Input**: OBS trasporta soltanto il video.

L'URL resta stabile dopo i riavvii. Il relay ascolta solo su 127.0.0.1:17890. In caso di porta occupata NEB mostra un errore senza interrompere la voce e senza terminare altri programmi.

Se OBS era gia aperto quando NEB era chiuso e l'anteprima resta nera, nelle proprieta della sola sorgente Browser usa **Aggiorna cache della pagina corrente** dopo aver avviato NEB.

Per ripetere la configurazione automatica della sola scena, con NEB gia avviato almeno una volta e WebSocket OBS autenticato:

```powershell
node .\scripts\avatar\configure-obs.mjs
```

Lo script legge la password OBS localmente, non la stampa e non avvia webcam, streaming o registrazioni. Rifiuta di sostituire sorgenti non riconosciute.

## Prova Ordinata

1. In Console premi **Test voce avatar**: Fred deve muovere la bocca in NEB e nella scena OBS.
2. Per una prova prolungata, genera una frase di almeno 25 secondi. Chiudi il modale ingrandito, poi minimizza NEB: la scena OBS deve continuare a mostrare il volto in movimento.
3. Apri la selezione/anteprima della webcam del sito; verifica che sia **OBS Virtual Camera**, non la webcam fisica. Prova prima senza entrare in una chiamata.
4. Cambia la scena Programma di OBS: la webcam deve restare sulla scena NEB Avatar.
5. Ripeti una risposta in NEB Live e verifica anche l'audio tramite CABLE Output. Evita monitoraggi audio aggiuntivi che causino eco.
6. Premi **Stop** in NEB: voce interrotta e uscita video neutra. Disattivando Uscita OBS ottieni lo stesso sfondo neutro senza dover fermare la voce.
7. Alla fine ferma la webcam virtuale in OBS. Chiudendo NEB il relay si arresta; la pagina deve tornare neutra entro tre secondi.

Una sessione Free disconnessa/inattiva mostra lo sfondo neutro; non resta aperta artificialmente e non vengono modificati i limiti Simli. Alcuni siti possono rifiutare webcam virtuali. La risoluzione e il realismo originali di Fred non aumentano.

## Verifiche Di Sviluppo

Il publisher esporta solo l'elemento video esistente: massimo 25 fps, JPEG 0.85, lato massimo 720 pixel senza upsampling. Il timer di cattura e di 42 ms (circa 23.8 fps nominali); il relay accetta al massimo 25 frame per secondo mobile, tollerando il jitter. Il canvas viene riallocato solo quando cambiano le dimensioni. La pagina usa eventi SSE con JPEG base64 limitati; il tentativo MJPEG nativo non ha dato immagini utilizzabili nella prova Edge locale. Restano buffer limitati e un solo encoding/invio pendente. La pagina termina una decodifica prima di sostituire l'immagine e conserva soltanto l'ultimo JPEG in attesa; Stop/disconnessione eliminano l'attesa. Nessun frame viene salvato dall'app.

Misure storiche prima dell'ottimizzazione: prove Windows sintetiche di 20.5 secondi realmente minimizzati, 513-514 frame decodificati, circa 12.9-14.1 fps di output, ritardo locale p95 89-92 ms; ultima misura CPU media dell'app circa 3.9% su tutti i core. Finestra coperta: altri 57 frame decodificati in circa due secondi. Prova Simli reale: 509 frame decodificati in 20.5 secondi minimizzati, 52 immagini distinte campionate, uscita neutra alla disconnessione. Questi numeri descrivono le prove locali, non garantiscono latenza o qualita del servizio cloud.

Ottimizzazione del 2026-10-05: il test sintetico 512x512 ha misurato 21.1-23.9 fps, p95 locale 72-83 ms e CPU dell'app 5.1-6.1% su tutti i core. Due prove 1024x1024 ridotte a 720x720, dopo la correzione della decodifica, hanno misurato 18.6-21.9 fps, p95 92-100 ms e CPU 8.0-8.8%. Prima della correzione, ripetizioni a 720 pixel erano scese fino a 3-9 fps e circa un secondo di ritardo: quei risultati non sono considerati accettabili. I frame grandi hanno un costo maggiore; 25 fps e un tetto, non una garanzia. La soglia sintetica e 20 fps a 512 pixel e 16 fps a 720 pixel, con p95 inferiore a 250 ms in entrambi i casi. I fps attuali contano i caricamenti dell'immagine, mentre le vecchie misure campionavano i timestamp: il confronto storico non e un benchmark A/B identico. Il ritardo sintetico misura solo il percorso locale, non la risposta NEB o il rendering Simli. Fred resta 512x512: non viene ingrandito artificialmente.

Questa fase non modifica la durata delle sessioni Simli: il codice richiede ancora 120 secondi e 30 secondi di inattivita. Sono impostazioni dell'app, non limiti Free dimostrati. Prima di dichiarare pronte interviste da 10-30 minuti o suggerire l'upgrade, verificare condizioni del piano e fare una prova continuativa reale della durata richiesta.

Verifica OBS/Virtual Camera completata su Windows: Fred visibile nella sorgente Browser e immagini in movimento. Nell'ultima prova con l'ottimizzazione: 511 frame decodificati in 20.5 secondi con NEB minimizzato, circa 18.8 fps di output, CPU app 7.0% su tutti i core, altri 60 frame con finestra coperta. OBS Virtual Camera ricevuta a 1280x720, 61 frame in circa due secondi, zero tracce audio; cambiando Programma a una scena vuota il video resta su NEB Avatar. La disconnessione torna neutra. Il test ripristina la configurazione di produzione e lascia la webcam ferma. L'utente ha gia confermato il funzionamento webcam/microfono nel proprio sito prima di questa ottimizzazione; le prove automatiche non entrano in chiamate.

Revisione indipendente: corretti con regressioni RED->GREEN gli URL HTTP malformati e la rimozione globale di sorgenti OBS omonime. Miglioramento di test rimandato: dimostrare esplicitamente la disconnessione di un consumatore lento, oltre ai limiti di buffer e alla risposta del consumatore sano gia coperti.

Decisioni di implementazione: lavoro su main e sincronizzazione dei due mirror come richiesto (senza isolamento di branch); registrazione IPC in modulo dedicato per test focalizzati; SSE al posto del viewer MJPEG non funzionante in Edge, con circa 33% di traffico locale aggiuntivo. La revisione del codice non sostituisce la prova Windows: quest'ultima e stata completata separatamente, inclusa la conferma visiva del target OBS non ancora salvato su disco. Verifiche dell'ottimizzazione: build/typecheck passati, 363 test Vitest passati e quattro saltati su WSL, cinque test Node passati. Revisione indipendente del publisher, relay e viewer: nessun problema azionabile rilevato.

Comandi di prova (Windows, workspace con Playwright gia disponibile):

```powershell
node .\scripts\avatar\smoke-output.mjs
node .\scripts\avatar\smoke-output.mjs --large-fixture
node .\scripts\avatar\smoke-output.mjs --cloud --obs
node .\scripts\avatar\smoke-output.mjs --cloud --obs --camera
```

La prova cloud richiede il WAV locale di test in `.superpowers/avatar/probe.wav`, usa minuti Simli e non usa una webcam fisica. La prova OBS rifiuta registrazioni, streaming o una webcam virtuale gia attivi e ripristina scena Programma e URL di produzione.
La prova camera verifica prima il target salvato Scena -> NEB Avatar, concede camera solo alla pagina locale di test e richiede esattamente OBS Virtual Camera con audio:false. Usa una scena Programma vuota temporanea per verificare l'isolamento, poi la elimina, ripristina la scena e ferma la webcam avviata dal test. OBS puo mantenere la selezione corretta in memoria prima di salvarla nel file: solo dopo conferma esplicita dell'utente o screenshot del dialogo e possibile aggiungere `--camera-target-confirmed`. Questo salta solo il controllo del file, non la verifica effettiva dell'isolamento del video.
