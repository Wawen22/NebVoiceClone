# Outlier e S2S

Outlier raccoglie progetti con nome, note e strumenti. S2S è preconfigurato; puoi aggiungere progetti, modificarli, archiviarli e ripristinarli. Conversazione e Battute riusano la stessa voce e lo stesso elenco della Console.

Per la conversazione automatica con Qwen, configurazione e prove sono in
[s2s-automation.md](s2s-automation.md).

## Rationale

Scrivi o incolla il tuo testo nell'editor dedicato. È separato dal testo vocale e non viene inviato a Gemini o a un altro servizio AI. Ctrl+Enter qui non pronuncia il testo.

I progetti e la velocità sono salvati localmente. Rationale e indicatore Model A/B rimangono in memoria: resistono al cambio pagina e alla modalità compatta, ma si perdono chiudendo NEB.

## Collegamento Windows / Edge

1. Avvia la versione nativa Windows. Se un'altra istanza NEB usa Ctrl+Alt+S, chiudila e riavvia questa versione.
2. In Outlier → S2S apri Configura il collegamento Edge e premi Apri cartella estensione.
3. Apri edge://extensions, attiva modalità sviluppatore, scegli Carica decompressa e seleziona quella cartella.
4. Copia l'ID dell'estensione nella configurazione NEB e premi Configura host Windows. L'host è compilato con Windows PowerShell e registrato per l'utente corrente, senza amministratore.
5. Per una demo aperta come file locale abilita Consenti accesso agli URL dei file nei dettagli dell'estensione.
6. Con NEB aperto, vai alla scheda S2S, premi l'icona NEB Outlier e Collega questa scheda. Rimani in Edge fino alla conferma dell'associazione in NEB: la finestra Windows visibile viene verificata e memorizzata.
7. In NEB controlla titolo e URL, prepara almeno 100 caratteri e premi Avvia inserimento. Il campo iniziale deve essere vuoto.
8. Verifica il testo nella task e inviala personalmente.

L'estensione usa activeTab, scripting e Native Messaging; per l'ascolto automatico usa anche tabCapture e offscreen. L'accesso alla scheda e l'avvio dell'ascolto partono dai tuoi clic. Riconosce il campo textarea[data-track="comment:notes"] nel documento principale: nessun campo o più candidati impediscono l'operazione. Non modifica il valore della textarea via JavaScript e non preme Submit.

## Controlli e interruzioni

- Ctrl+Alt+S: stop globale sia voce sia inserimento.
- Ctrl+Alt+P: pausa dell'inserimento. Se la scorciatoia non è disponibile, tornando a NEB il cambio di focus può interrompere l'operazione prima del clic su Pausa.
- Pausa e Riprendi richiedono un prefisso già confermato e identico. Se la pausa arriva mentre un carattere è ancora da confermare, si interrompe definitivamente per evitare duplicazioni.
- Dopo una pausa confermata puoi tornare a NEB e premere Riprendi. La destinazione e il prefisso sono verificati nuovamente.
- Stop conserva il testo già scritto. Non lo cancella, non ricomincia automaticamente e non continua su un campo non vuoto.
- Cambio scheda, navigazione, sostituzione del campo, perdita di focus durante la scrittura, disconnessione e timeout impediscono ulteriori caratteri.
- Se una pagina sostituisce il campo o cambia URL senza ricaricarsi, Collega questa scheda crea una nuova associazione.

Il servizio verifica finestra Edge associata, controllo Windows attivo, valore atteso e riscontro nel browser. Una chiamata Windows può coincidere con un cambiamento di focus: al massimo un carattere Unicode può essere già in corso. Controlla sempre il testo parziale dopo un'interruzione.

Windows può impedire l'attivazione della finestra da un processo in background. NEB tenta di autorizzare soltanto il proprio host alla riattivazione della finestra associata; se non riesce, si ferma. Non si disattivano le protezioni di Windows o Edge.

## Rimozione

Rimuovi l'estensione da Edge. Per togliere la registrazione dell'host esegui scripts/outlier/remove-host.ps1 con il parametro -DataDirectory impostato sulla cartella userData di questa istanza NEB. Lo script verifica che la registrazione appartenga all'istanza e conserva progetti e impostazioni. Installare il connettore da un'altra istanza NEB sostituisce la registrazione per questo utente; si usa una sola istanza configurata per volta.

## Verifica di sviluppo

I test automatici sono inclusi in npm test. Su Windows, dalla radice del repository:

1. npm.cmd install --prefix .superpowers/outlier-smoke --no-audit --no-fund playwright
2. powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/outlier/setup-host.ps1 -ExtensionId aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa -DataDirectory .superpowers/outlier-test -CompileOnly
3. node.exe node_modules/esbuild/bin/esbuild scripts/outlier/smoke-protocol.ts --bundle --platform=node --format=cjs --outfile=.superpowers/outlier-smoke/smoke-protocol.cjs
4. node.exe .superpowers/outlier-smoke/smoke-protocol.cjs
5. npm.cmd run build
6. node.exe scripts/outlier/smoke-ui.mjs

La prova UI usa un'istanza outlier-review senza chiavi API. Il test nativo di protocollo non produce tasti: verifica trasporto e rifiuto delle operazioni senza una finestra associata.

scripts/outlier/smoke-native.ts è una prova interattiva su fixture locale mediante un adattatore lato browser. Richiede una sessione Windows capace di dare focus alla finestra di test; non è una prova dell'installazione reale dell'estensione. Il blocco di focus nel processo di test in background lascia non verificata la digitazione completa nell'ambiente corrente.

La prova finale con estensione realmente caricata in Edge, host configurato e demo locale deve essere completata prima di considerare pronto il trasferimento quotidiano. La demo statica non prova la registrazione del valore nel backend della pagina live. Nessuna prova è effettuata su task Outlier reali; nessuna promessa di non rilevabilità o assenza di sanzioni viene associata al servizio.

Per eseguire la prova interattiva della digitazione sulla fixture sintetica:

1. node.exe node_modules/esbuild/bin/esbuild scripts/outlier/smoke-native.ts --bundle --platform=node --format=cjs --outfile=.superpowers/outlier-smoke/smoke-native.cjs
2. node.exe .superpowers/outlier-smoke/smoke-native.cjs
3. Durante il conto alla rovescia di 8 secondi porta manualmente in primo piano la finestra Edge della demo e lasciala attiva fino al risultato. Il test scrive soltanto sulla propria fixture locale; chiude browser e collegamento alla fine.

La verifica sull'HTML Live S2S Arena 2.html fornito dall'utente riconosce un solo campo Rationale modificabile. È stata eseguita offline, senza input o invio: conferma il selettore, non il backend live.
