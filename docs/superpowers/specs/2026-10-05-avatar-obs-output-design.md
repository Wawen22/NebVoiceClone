# NEB Avatar: uscita video locale per OBS

## Stato e Obiettivo

Il 5 ottobre 2026 l'utente ha approvato il passaggio dalla cattura della finestra a una sorgente Browser locale dedicata. Questa specifica richiede revisione dell'utente prima del piano di implementazione.

Obiettivo: selezionare OBS Virtual Camera come webcam in Edge/Chrome e mostrare esclusivamente l'avatar Simli di NEB. Console e NEB Live devono continuare a funzionare senza un modale aperto. NEB deve poter rimanere dietro altre finestre; il funzionamento minimizzato deve essere verificato sulla macchina Windows prima di dichiarare completata l'integrazione.

L'audio rimane sul percorso attuale: NEB -> CABLE Input -> CABLE Output selezionato come microfono del sito. OBS riceve solo video. Nessuna registrazione, trasmissione streaming, chiamata esterna, seconda sessione Simli, webcam fisica o upgrade a pagamento viene avviato automaticamente.

## Contesto Verificato

- AvatarSession possiede gia un unico elemento video WebRTC e un elemento audio separato. AvatarPanel rimane montato durante il passaggio Console/Live.
- Il modale ingrandisce lo stesso video senza creare sessioni. L'elemento video e presente anche con modale chiuso.
- BrowserWindow ha gia backgroundThrottling=false. Questo non prova che la decodifica video continui con finestra minimizzata: occorre testarla.
- OBS Studio 32.0.4 e installato. obs-websocket 5.6.3 e disponibile con autenticazione attiva; l'utente ha abilitato il server locale.
- Esistono la scena originale Scene e la sorgente VivoX300. Il precedente tentativo ha aggiunto NEB Avatar e una sorgente vuota NEB Avatar - finestra. Nessuna webcam virtuale e stata avviata da quel tentativo.
- La cattura finestra non e un percorso affidabile per l'uso richiesto e potrebbe esporre parti della Console dopo la chiusura del modale.

## Approcci

1. Cattura della finestra con ritaglio: semplice, ma dipende da layout, visibilita e modale. Non selezionato.
2. Relay video locale con fotogrammi JPEG: circoscritto al video gia ricevuto, nessun driver o nuovo servizio cloud. Selezionato per la prima versione; richiede misure di carico e latenza.
3. Relay WebRTC locale: possibile evoluzione per ridurre copie/latenza, ma richiede signaling e gestione di altri peer. Non incluso nella prima versione.

## Percorso Video

Simli -> video ricevuto nel renderer NEB -> canvas del solo video -> IPC fidato -> relay HTTP nel processo principale -> sorgente Browser OBS -> OBS Virtual Camera -> sito.

Il publisher legge esclusivamente l'HTMLVideoElement dell'avatar. Non usa screenshot, desktopCapturer, capturePage, cattura di finestre, testo della Console o audio. Esporta al massimo 15 fps, JPEG qualita 0.85, con lato maggiore limitato a 640 pixel e senza ingrandire la risoluzione originale. La risoluzione Simli non aumenta grazie al relay.

Un solo encoding e un solo invio IPC possono essere pendenti. Un consumatore lento perde i fotogrammi vecchi, non accumula una coda. Il lavoro di encoding viene sospeso quando l'uscita e disattivata o non ci sono spettatori. Il publisher usa una pianificazione temporizzata, non dipende da requestAnimationFrame o dalla visibilita del modale.

## Relay Locale e Sicurezza

- Server HTTP legato esclusivamente a 127.0.0.1. Porta proposta 17890, configurazione per istanza in userData; nessuna apertura firewall o ascolto in LAN.
- URL protetto da un token casuale locale persistente di almeno 32 byte. La pagina contiene solo avatar e sfondo neutro. Il token non e la chiave Simli e non deve essere stampato nei log o nella documentazione.
- L'URL rimane stabile dopo il riavvio, per evitare di riconfigurare OBS ogni volta. Se la porta e occupata, errore esplicito: nessun processo viene terminato e nessuna nuova porta viene scelta di nascosto.
- Route limitate alla pagina di output, al video multipart MJPEG e a uno stato SSE. Metodi, Host e token vengono validati; nessun filesystem viene esposto e nessun CORS aperto.
- La pagina ha CSP restrittiva e non richiede microfono, camera o accesso a controlli OBS. Nessuna risorsa remota e nessuna chiave/token Simli passa a OBS.
- Tutti gli IPC usano i controlli sender/mainFrame gia presenti. Fotogrammi JPEG con dimensione massima 256 KiB, rate limit e identificativo di generazione attiva; dati invalidi o tardivi vengono rifiutati.
- Memoria limitata a ultimo fotogramma, al massimo quattro spettatori e buffer di rete bounded. Nessun fotogramma viene salvato su disco dall'app.

## Stato e Ciclo di Vita

L'uscita OBS ha una propria abilitazione, inizialmente disattivata e poi salvata localmente. Abilitare l'uscita non apre una sessione Simli. Quando un avatar collegato produce fotogrammi, OBS lo mostra anche se il modale e chiuso. Le regole attuali di sessione Free, inattivita e Stop non cambiano.

Stop, errore, disconnessione Simli, disabilitazione dell'uscita o oltre tre secondi senza fotogrammi validi svuotano l'ultimo frame e mostrano lo sfondo neutro. Un frame asincrono appartenente alla generazione precedente non puo ripristinare il volto dopo Stop. La pagina gestisce perdita del relay e riconnessione senza lasciare indefinitamente l'ultima immagine.

Chiudere una pagina di output o OBS non interrompe la voce. Chiudere NEB arresta publisher, socket e server. Minimizare o coprire NEB non deve fermare la produzione: questa condizione e un criterio di accettazione, non una supposizione derivata dalla configurazione Electron.

## UI e OBS

La barra Avatar aggiunge una checkbox Uscita OBS, stato sintetico e pulsante icona Copia URL OBS con tooltip. Nessun modale e necessario per trasmettere. Gli errori del relay non devono interrompere il percorso voce.

La scena dedicata NEB Avatar usa una sola sorgente Browser NEB Avatar - video locale, con output 1280x720, proporzioni preservate e sfondo neutro. Shutdown source when not visible e Refresh browser when scene becomes active rimangono disattivati. La sorgente non contiene audio. La vecchia cattura finestra vuota viene rimossa solo dopo aver verificato che appartiene al tentativo di questa chat.

La webcam OBS deve essere vincolata alla scena NEB Avatar, non all'uscita Program o Preview. obs-websocket non espone un comando standard per cambiare questo target: se necessario l'utente effettuera una sola selezione nelle impostazioni della webcam virtuale. Non si modificano globalmente profilo, risoluzione, microfoni, scene precedenti o impostazioni streaming. La configurazione originale viene conservata prima degli aggiornamenti.

## Verifica e Consegna

1. Test unitari: binding/token/route, IPC non fidati, limiti di frame/client, drop del consumatore lento, porta occupata, scadenza e frame obsoleti dopo Stop.
2. Test renderer: export senza modale, identita del video/sessione preservata, disabilitazione, navigation Console/Live, encoding pendente cancellato e nessun audio locale duplicato.
3. Test Windows con OBS: Browser Source caricata dal relay, fotogrammi visibili e variabili; nessun testo o comando NEB nell'immagine; Stop rende neutra l'uscita.
4. Prova realmente minimizzata con una frase lunga: timestamp e fotogrammi devono avanzare per almeno 20 secondi. Ripetere con modale chiuso e NEB coperto. Se il publisher JPEG non supera questa prova, non dichiarare la funzione pronta; documentare il risultato e rivalutare il percorso di produzione video prima di estendere il codice.
5. Test locale Edge: enumerare e selezionare esattamente OBS Virtual Camera, audio:false, verificare risoluzione e fotogrammi; non usare una webcam fisica come fallback. Verificare che cambiare scena OBS non cambi il video virtuale.
6. Misurare frame rate e ritardo aggiuntivo: obiettivo almeno 10 fps durante il parlato e ritardo locale inferiore a 250 ms. Riportare i risultati osservati, non promettere lip-sync migliore del servizio originale.
7. Eseguire build/test/typecheck in WSL e verifiche di regressione pertinenti, sincronizzare sorgenti/out verso entrambe le cartelle Windows e commit scoped su main, secondo AGENTS.md. Non avviare Electron da WSL.
8. Consegnare istruzioni esatte: avvio NEB/OBS, attivazione uscita, selezione webcam e microfono, frase di prova, Stop e chiusura. Nessun test su chiamate esterne senza un'ulteriore richiesta dell'utente.

## Fuori Ambito e Riferimenti

Non inclusi: driver webcam proprietario NEB, nuova sessione avatar dentro OBS, clone del volto, upgrade Simli, modifica della voce, registrazioni automatiche e garantire compatibilita con siti che rifiutano webcam virtuali.

- OBS Browser Source: https://obsproject.com/kb/browser-source
- OBS Virtual Camera: https://obsproject.com/kb/virtual-camera-guide
- Protocollo obs-websocket: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
