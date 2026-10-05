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

Il publisher esporta solo l'elemento video esistente: massimo 15 fps, JPEG 0.85, lato massimo 640 pixel senza upsampling. La pagina usa eventi SSE con JPEG base64 limitati; il tentativo MJPEG nativo non ha dato immagini utilizzabili nella prova Edge locale. Restano buffer limitati e un solo encoding/invio pendente; nessun frame viene salvato dall'app.

Prove Windows sintetiche: 20.5 secondi realmente minimizzati, 513-514 frame decodificati, circa 12.9-14.1 fps di output, ritardo locale p95 89-92 ms; ultima misura CPU media dell'app circa 3.9% su tutti i core. Finestra coperta: altri 57 frame decodificati in circa due secondi. Prova Simli reale: 509 frame decodificati in 20.5 secondi minimizzati, 52 immagini distinte campionate, Stop neutro. Questi numeri descrivono le prove locali, non garantiscono latenza o qualita del servizio cloud.

Verifica OBS/Virtual Camera completata su Windows: Fred visibile nella sorgente Browser, immagini in movimento, 513 frame decodificati in 20.5 secondi con NEB minimizzato e altri 77 con finestra coperta. OBS Virtual Camera ricevuta a 1280x720, 61 frame in circa due secondi, zero tracce audio; cambiando Programma a una scena vuota il video resta su NEB Avatar. Stop torna neutro. Il test ripristina la configurazione di produzione e lascia la webcam ferma. Resta da provare la selezione webcam/microfono nel sito scelto dall'utente, senza entrare automaticamente in chiamate.

Revisione indipendente: corretti con regressioni RED->GREEN gli URL HTTP malformati e la rimozione globale di sorgenti OBS omonime. Miglioramento di test rimandato: dimostrare esplicitamente la disconnessione di un consumatore lento, oltre ai limiti di buffer e alla risposta del consumatore sano gia coperti.

Decisioni di implementazione: lavoro su main e sincronizzazione dei due mirror come richiesto (senza isolamento di branch); registrazione IPC in modulo dedicato per test focalizzati; SSE al posto del viewer MJPEG non funzionante in Edge, con circa 33% di traffico locale aggiuntivo. La revisione del codice non sostituisce la prova Windows: quest'ultima e stata completata separatamente, inclusa la conferma visiva del target OBS non ancora salvato su disco. Verifiche finali: build/typecheck passati, 358 test Vitest passati e quattro saltati su WSL, cinque test Node passati.

Comandi di prova (Windows, workspace con Playwright gia disponibile):

```powershell
node .\scripts\avatar\smoke-output.mjs
node .\scripts\avatar\smoke-output.mjs --cloud --obs
node .\scripts\avatar\smoke-output.mjs --cloud --obs --camera
```

La prova cloud richiede il WAV locale di test in `.superpowers/avatar/probe.wav`, usa minuti Simli e non usa una webcam fisica. La prova OBS rifiuta registrazioni, streaming o una webcam virtuale gia attivi e ripristina scena Programma e URL di produzione.
La prova camera verifica prima il target salvato Scena -> NEB Avatar, concede camera solo alla pagina locale di test e richiede esattamente OBS Virtual Camera con audio:false. Usa una scena Programma vuota temporanea per verificare l'isolamento, poi la elimina, ripristina la scena e ferma la webcam avviata dal test. OBS puo mantenere la selezione corretta in memoria prima di salvarla nel file: solo dopo conferma esplicita dell'utente o screenshot del dialogo e possibile aggiungere `--camera-target-confirmed`. Questo salta solo il controllo del file, non la verifica effettiva dell'isolamento del video.
