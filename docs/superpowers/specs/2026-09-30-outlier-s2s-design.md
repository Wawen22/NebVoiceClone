# Outlier / S2S e inserimento assistito del Rationale

Data: 30 settembre 2026. Stato: design in chat approvato; specifica scritta pronta per revisione.

## Obiettivo e contesto

NEB Voice Console deve ospitare una sezione Outlier con progetti modificabili e archiviabili. Il primo progetto è S2S. L'utente svolge personalmente le conversazioni con Model A e Model B e le valutazioni; prepara il proprio Rationale in NEB e avvia esplicitamente il trasferimento nel campo della task aperta in Edge.

L'inserimento utilizza eventi di tastiera Windows, senza copia-incolla nella destinazione. La velocità è regolabile per controllare il flusso. Non viene dichiarata alcuna garanzia di autorizzazione, invisibilità dell'automazione o protezione da sanzioni. Sono esclusi tecniche per occultare l'origine degli eventi, errori artificiali e profili anti-ban.

Il design in chat è stato approvato con «Ok va bene, approvo. procedi». Questa specifica rende espliciti installazione, persistenza, ripresa, controlli ed evidenze richieste prima di dichiarare il servizio pronto.

## Compatibilità e confini

- Piattaforma di inserimento: Windows 10/11, Microsoft Edge nello stesso account e sessione desktop di NEB. La gestione progetti e l'editor funzionano anche sotto Linux; lì l'inserimento Windows è indisponibile e il motivo è visibile.
- Si conserva l'architettura Electron main / preload / React renderer e il controllo dei mittenti IPC esistente.
- Si preservano le modifiche già presenti a `App.tsx` e `styles.css`, compresa la barra laterale comprimibile. La demo fornita dall'utente non viene alterata.
- Conversazione, Battute, Gemini, voce, routing e scorciatoie esistenti sono riutilizzati. Il Rationale non entra nel buffer vocale e non viene inviato a Gemini.
- Non si implementano conversazioni autonome, valutazioni automatiche, generazione del Rationale o invio della task.
- Non si modificano le protezioni di Edge o Windows, né si richiedono privilegi amministrativi. Se l'ambiente blocca l'integrazione, l'inserimento resta disabilitato con un errore leggibile.

## Esperienza Outlier

La navigazione principale aggiunge Outlier. La pagina presenta progetti attivi, accesso agli archiviati e creazione progetto. S2S è inizialmente presente. Ogni progetto contiene un ID immutabile, nome, note personali, stato archiviato e tipo di integrazione (`s2s` oppure `none`). Un nuovo progetto generico può ospitare note ed editor; l'integrazione automatica S2S non viene applicata arbitrariamente ad altre pagine.

Modifica consente di cambiare nome e note. Archivia nasconde il progetto dagli attivi; Ripristina lo rende nuovamente disponibile. La prima versione non offre cancellazione definitiva. Un progetto impegnato in un inserimento non può essere archiviato o sostituito finché il servizio non è fermo.

S2S presenta due pannelli: Conversazione e Rationale. Conversazione apre la vista compatta e le Battute esistenti; un indicatore manuale Model A / Model B serve solo a orientare la sessione e non azzera script o battute. L'elenco Battute rimane quello condiviso dalla Console nella prima versione.

Rationale include editor multilinea, conteggio caratteri, promemoria del minimo di 100 caratteri osservato nella demo e richiesta di motivare ogni dimensione con evidenze personali. Non si inventano punteggi o evidenze. L'editor resta separato dagli shortcut di sintesi: Ctrl+Enter dentro Rationale non pronuncia il testo e non avvia il trasferimento.

Sono mostrati stato del collegamento, titolo e URL della destinazione, disponibilità del campo, velocità, avanzamento, Avvia inserimento, Pausa, Riprendi e Stop. Avvia richiede testo di almeno 100 caratteri per S2S, collegamento valido e destinazione verificata. Un errore non cancella il testo preparato.

## Dati locali

Metadati dei progetti e preferenza di velocità sono persistiti nel percorso dati Electron con un file versionato separato dalle impostazioni Gemini. Scrittura atomica, validazione dei dati letti e salvati, nomi non vuoti e ID univoci impediscono corruzioni o record ambigui. Un file corrotto viene segnalato e conservato, non sovrascritto silenziosamente.

Rationale, buffer vocale, Model A/B e stato di trasferimento restano in memoria. Tornare alla Console, cambiare progetto o archiviare non perde il Rationale finché NEB è aperto; chiudere NEB elimina questi buffer. La pagina comunica chiaramente questa durata. Non si aggiungono cronologia persistente, log del contenuto o salvataggio cloud.

## Collegamento con Edge

Si utilizza un'estensione Manifest V3 locale e un host Native Messaging Windows. L'estensione viene caricata dalla cartella distribuita con NEB; la configurazione guidata nella pagina Outlier spiega l'installazione e verifica il collegamento. La registrazione dell'host avviene per il solo utente corrente, solo per l'ID dell'estensione indicato. La stessa guida fornisce la rimozione della registrazione.

L'estensione usa `activeTab`, `scripting` e `nativeMessaging`. L'utente associa una scheda tramite l'azione dell'estensione; non si richiede accesso permanente a tutti i siti. L'associazione è specifica a scheda, finestra, documento e URL, ed è invalidata da navigazione o riavvio. Per la demo locale serve anche l'abilitazione Edge dell'accesso ai file; questo requisito è visibile.

Il content script cerca esattamente un `textarea[data-track="comment:notes"]`. Il campo deve essere visibile, abilitato e modificabile nel documento principale. Zero o più di un candidato, iframe, campo rimosso o URL cambiato bloccano l'operazione con spiegazione. Il selettore osservato nella demo è la prima integrazione S2S e non è presentato come contratto stabile del sito.

L'estensione legge soltanto titolo, URL, disponibilità, focus, selezione e contenuto del Rationale necessario al confronto. Non legge conversazioni, microfono, credenziali o altre parti della task. Non assegna `textarea.value`, non produce il testo via JavaScript e non invoca Submit. È autorizzata a portare in primo piano la scheda associata, scorrere il campo e impostarne il focus su richiesta esplicita di NEB.

## Servizio Windows e trasporto

Il servizio di inserimento appartiene al main Electron e usa un host Windows dedicato. L'host viene compilato e installato dal setup usando gli strumenti .NET Framework disponibili con Windows PowerShell; non si installano un SDK .NET o un runtime Python. L'host espone solo il protocollo previsto, non un esecutore generico di comandi.

Native Messaging collega l'estensione all'host con messaggi JSON UTF-8 incorniciati dalla lunghezza prevista dal browser. L'host comunica con NEB attraverso una named pipe locale autenticata con segreto di sessione conservato in un file accessibile al solo utente corrente. Il main accetta solo una connessione associata valida per sessione. Il protocollo è versionato, con identificatori di richiesta e sessione, limiti di dimensione e timeout; frame malformati, credenziali errate e risposte obsolete sono rifiutati. Le informazioni di associazione non contengono chiavi Gemini o testo del Rationale.

Il componente nativo usa `SendInput` per i caratteri Unicode e verifica il risultato di ogni chiamata. Gestisce accenti, apostrofi, punteggiatura, caratteri fuori dal BMP e ritorni a capo senza conversioni involontarie. I confronti utilizzano la convenzione LF della textarea; nessuna normalizzazione Unicode o modifica del testo dell'utente è applicata. Il limite del Rationale è 50.000 unità UTF-16 e si impedisce il taglio di una coppia surrogate.

Velocità iniziale: 180 caratteri Unicode al minuto, intervallo configurabile 60–600. È un ritmo fisso, non un modello di comportamento umano. L'intervallo può essere sospeso immediatamente; non si accodano interi paragrafi al sistema operativo.

## Avvio, verifica e interruzione

Stati del servizio: scollegato, pronto, preparazione, inserimento, pausa, completato, interrotto, errore. Una sola operazione alla volta è permessa. L'editor e il progetto associato sono bloccati mentre un'operazione è attiva o in pausa; Stop termina l'operazione e li sblocca.

1. L'utente collega la scheda dall'estensione, torna a NEB e prepara il testo.
2. Avvia fotografa testo, destinazione e velocità. S2S rifiuta un campo non vuoto; non si usa Select All e non si sostituisce contenuto esistente.
3. L'estensione attiva la scheda, porta il campo in vista e gli dà focus. Prima di inviare caratteri, host e browser verificano che la finestra Windows appartenga a Edge e che il controllo modificabile attivo corrisponda alla destinazione verificata. Se non si riesce a stabilire il collegamento, non si scrive.
4. Il componente Windows memorizza handle della finestra e identità UI Automation del controllo attivo. Prima di ogni carattere controlla questa identità, la finestra in primo piano e l'assenza di modificatori premuti. Il browser conferma focus, documento, campo e prefisso atteso con risposte legate alla sessione; non si prosegue senza conferma aggiornata.
5. Dopo ogni carattere si verifica il prefisso effettivo nella textarea. Avanzamento significa caratteri confermati nel campo, non tentativi di invio. Mancata conferma, scarto, disconnessione o cambiamento di destinazione fermano il servizio. Non ci sono tentativi automatici di riscrivere testo dall'esito ambiguo.
6. Al termine si confronta l'intero contenuto. Soltanto una corrispondenza esatta porta a Completato; il submit resta manuale.

Pausa conserva la fotografia e il prefisso confermato. Riprendi è esplicito: riporta la destinazione in primo piano e richiede che il contenuto sia esattamente il prefisso atteso. Una differenza, anche causata da editing dell'utente, impedisce la ripresa. Stop non cancella quanto già scritto e non offre riavvio automatico su un campo parzialmente compilato.

Perdita di focus, cambio scheda, navigazione, sostituzione del campo o chiusura dell'estensione interrompono l'operazione. Dopo un'interruzione si mostra quanto è stato confermato e si lascia all'utente la verifica della destinazione. Si evita di promettere atomicità tra controlli browser e chiamata Windows: una variazione simultanea può coincidere con un singolo carattere già in corso. Il limite e la necessità di verificare il testo parziale sono riportati nelle istruzioni di uso.

Ctrl+Alt+S arresta sia l'inserimento sia il flusso voce esistente. Ctrl+Alt+P mette in pausa l'inserimento. Le scorciatoie sono registrate dal main, non dal renderer o dalla pagina web, e rilasciate alla chiusura. Se lo stop globale non è disponibile, l'inserimento resta disabilitato. L'host ha un watchdog: perdita della connessione main o timeout di una conferma impedisce ulteriori tasti. NEB non ruba il focus per segnalare il completamento.

## Organizzazione del codice

- `src/shared/outlier.ts`: contratti di progetto, validazione e protocollo del servizio; separato dai contratti voce.
- `src/main/outlier/`: archivio metadati, trasporto locale autenticato, stato del servizio e installazione per utente.
- `src/preload/index.ts`: operazioni Outlier e sottoscrizione allo stato, con il medesimo controllo dei mittenti del main esistente.
- `src/renderer/src/outlier/`: pagina, elenco progetti, editor e stato di inserimento. `App.tsx` aggiunge navigazione e connessioni con i controlli vocali condivisi.
- `browser-extension/`: manifest, azione di associazione, service worker e osservazione del campo S2S.
- `scripts/outlier/`: sorgente dell'host Windows, setup, rimozione e test della demo; distribuiti anche dal launcher Windows esistente.
- `docs/outlier-s2s.md`: installazione, limiti, ripresa e uso manuale. Si aggiornano README e architettura, le cui precedenti esclusioni di automazione descrivono la versione attuale.

## Verifica e criteri di accettazione

I test automatizzati del modello e del servizio devono coprire almeno: archivio/ripristino, file corrotto, singola operazione, destinazione errata o ambigua, campo non vuoto, stop durante una pausa temporizzata, cambio documento, disconnessione, risposte obsolete, modifica del prefisso e confronto finale. I test del trasporto coprono autenticazione, frame spezzati, dimensioni eccedenti e chiusura. I casi Unicode includono testo italiano, apostrofi tipografici, emoji e più paragrafi.

Si eseguono `npm run typecheck`, `npm run lint`, `npm test` e `npm run build`, riportando separatamente eventuali limiti dell'ambiente WSL/Windows. Le modifiche non devono rompere Modalità conversazione, Battute, stop voce o la barra laterale comprimibile.

La prova integrata iniziale avviene sulla demo fornita, servita localmente oppure aperta come file locale, senza task reali. Deve verificare installazione dell'estensione e host, collegamento con NEB, avvio dal pulsante, testo identico nel campo, nessun evento paste, pause/stop, perdita di focus, cambio scheda, arresto dopo chiusura di NEB e nessun submit.

Un secondo fixture locale può imitare un campo React controllato per verificare che l'app della pagina registri effettivamente le modifiche. Il passaggio della demo statica non prova da solo la registrazione del Rationale nel backend della pagina live.

Si dichiara il servizio Windows verificato soltanto dopo una prova effettiva con host, estensione ed eventi di tastiera sul browser locale. Se non è possibile completarla, si documenta la limitazione e non si presenta il collegamento live come pronto. Non si effettuano test di rilevabilità o esperimenti su task Outlier reali.

## Fonti tecniche

- [Native Messaging in Microsoft Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/native-messaging).
- [SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput).
- [Eventi di tastiera iniettati](https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-kbdllhookstruct).
- Demo locale: `DEMO STATICA S2S E STRUTTURA/Live S2S Arena 2.html`; Rationale minimo 100 caratteri, selettore `textarea[data-track="comment:notes"]`.
