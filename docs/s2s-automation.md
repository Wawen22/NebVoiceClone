# Conversazione automatica S2S — prova Windows

La modalità Automatico delle Battute Pronte usa `qwen/qwen3.8-omni-flash`
su OpenRouter per ascoltare le risposte e adattare il testo. La voce resta quella
Gemini selezionata. Le battute originali non vengono sovrascritte.

## Prima prova dentro NEB: Simulazione MODEL A

Puoi provare il ciclo dalla **Console → Battute Pronte**, senza aprire una task
Outlier né collegare Edge. Servono Gemini e `OPENROUTER_API_KEY` configurati.

Uno script pronto da incollare in **Importa script** è [s2s-demo.txt](s2s-demo.txt).
Contiene cinque battute sul ciclo dell’acqua. La riga `SCENARIO:` non viene
importata come battuta: copia quel contesto nel campo **Scenario e tempi**.

1. Prepara due o tre battute ancora pendenti, per esempio quelle della prova sotto.
2. Premi **Automatico**: l’editor si chiude e apre il modale **Conversazione
   automatica**. Scegli **Simulazione**. In **Scenario e tempi** inserisci il
   contesto della conversazione e lascia inizialmente 2,5 secondi di silenzio.
3. In **Uscita simulazione** scegli cuffie o altoparlanti reali. Il pannello esclude
   CABLE e le uscite predefinite, per scegliere esplicitamente il dispositivo locale.
   La configurazione d'uscita della Console per Outlier non viene modificata.
4. Premi **Simulazione MODEL A**. NEB pronuncia la prima battuta; MODEL A simulato
   genera una risposta con Qwen e la pronuncia con Gemini, usando Puck (Kore se la
   voce NEB è già Puck). L'audio PCM di MODEL A, sincronizzato con la riproduzione,
   passa al controller e all'ascolto Qwen usati dalla conversazione automatica.
5. Osserva **Trascrizione della conversazione** e **Script della sessione**:
   la prima battuta parte originale, le successive mostrano il confronto
   **Originale → Adattata da Qwen**. Il transcript NEB contiene le battute la cui
   riproduzione è iniziata, con indicazione delle eventuali interruzioni.
   Le onde NEB e MODEL A usano l’ampiezza del PCM sincronizzato alla riproduzione.
   Il testo simulato è distinto dalla trascrizione Qwen dell’audio: quest’ultima
   arriva dopo la verifica della risposta, non parola per parola in tempo reale.
   **Tempi, costi e decisioni** riporta tempi e costi OpenRouter.
   **Esporta cronologia** identifica la sessione come `simulation`.
6. Prova **Pausa** mentre MODEL A prepara/parla e **Riprendi simulazione**:
   la risposta ancora in preparazione viene rigenerata. Dopo una risposta già
   terminata, viene riascoltato l'audio memorizzato per riprendere la verifica Qwen,
   senza rigenerare MODEL A/Gemini. Se metti in pausa mentre parla NEB,
   scegli **Ripeti battuta pendente** per ripartire dalla battuta interrotta.
7. Prova **Stop automatico** durante l'elaborazione: nessuna risposta tardiva deve
   riavviare la voce. Ripeti la simulazione per confrontare i tempi.

Le righe originali non sono segnate completate dalla simulazione: restano pronte
per Outlier. Il conteggio nel player riguarda la singola prova. **Torna alle battute** riapre
l’editor al termine o dopo Stop. **Riduci** lascia la sessione attiva e mostra
il pulsante **Apri player**. **Esc** ferma la sessione e chiude il player.
Il limite OpenRouter include sia MODEL A simulato sia il regista Qwen; Gemini
resta escluso, come nella modalità Outlier. Questa prova usa API reali ed è fatturata
dai provider. Non misura la velocità o la qualità del vero modello Outlier, né
verifica la cattura audio Edge e il percorso VB-CABLE. Questi ultimi richiedono
la prova Windows seguente.

## Configurazione

1. Chiudi la versione NEB attualmente aperta e riavviala da Windows PowerShell:

   ```powershell
   cd C:\Users\r.nebili\.codex\worktrees\outlier-s2s\NebVoiceGenerator
   .\scripts\run-windows.ps1
   ```

2. Nel file `.env.local` del repository Windows deve essere presente
   `OPENROUTER_API_KEY=...`. Riavvia NEB dopo una modifica della chiave.
   Non inserire la chiave nell'estensione. Servono anche Gemini configurato
   e la voce selezionata nella Console.
3. In NEB seleziona **CABLE Input** come uscita. In Outlier/Edge seleziona
   **CABLE Output** come microfono, mantenendo cuffie/altoparlanti reali come
   uscita Edge. Il percorso è descritto in [audio-routing.md](audio-routing.md).
4. Apri `edge://extensions`, ricarica **NEB Outlier Connector** (versione 1.1.0)
   e accetta gli eventuali nuovi permessi per catturare l'audio della scheda.
   Verifica che la cartella dell'estensione sia quella dello staging Windows
   indicata da **Apri cartella estensione** in NEB.
5. Se necessario configura l'host da Outlier → Configura il collegamento Edge.
   L'host aggiornato inoltra ora anche l'audio; un vecchio host non lo inoltra.
6. Porta in primo piano la scheda S2S. Nel popup NEB premi **Collega questa
   scheda**, poi **Ascolta questa scheda**. Il secondo pulsante richiede un clic
   nell'estensione; NEB non può avviare questa acquisizione senza quel gesto.
7. Torna a NEB → Outlier, seleziona il progetto S2S attivo e apri **Battute Pronte**.
   Prepara MODEL A o MODEL B e premi **Automatico**. Nel player scegli
   **Outlier / Edge**. La cattura deve risultare
   collegata e il misuratore deve muoversi quando Outlier parla.
8. Scegli **Scenario e tempi** per definire ruolo e fatti da mantenere. Il Rationale
   e le note del progetto non vengono aggiunti automaticamente al contesto Qwen.
   Impostazione iniziale consigliata: silenzio 2,5 s, attesa 30 s.
9. Avvia/attiva la conversazione con il modello desiderato nella task Outlier,
   lasciando pronto il microfono virtuale. In NEB premi **Avvia MODEL A/B**.
   La prima battuta ancora pendente parte originale; le successive vengono adattate.
   Il sistema si ferma dopo aver ascoltato anche la risposta all'ultima battuta.

Il collegamento non seleziona o avvia automaticamente il modello nella pagina
Outlier: la scelta A/B in NEB identifica lo script. Verifica che corrisponda al
modello con cui hai aperto la conversazione. Non premere Submit per queste prove.

## Prima prova: tre battute

Usa un breve scenario, per esempio confrontare due strumenti di apprendimento:

1. «Vorrei capire come usare questo strumento per preparare una lezione. Da dove parto?»
2. «Quali limiti dovrei considerare?»
3. «Come potrei fare una piccola prova prima di usarlo con tutta la classe?»

Atteso: prima battuta → risposta → verifica Qwen → seconda battuta adattata →
risposta → terza adattata → risposta finale → Conversazione completata.
Le righe sono segnate completate solo a riproduzione interamente terminata.
Originale e testo adattato sono visibili nel player e nel JSON esportato.
Qwen deve riscrivere la battuta collegandola alla risposta, mantenendo obiettivo
e ordine. Se restituisce il testo originale (anche con maiuscole o punteggiatura
diverse), viene tentata una sola verifica testuale con la trascrizione già ottenuta,
senza caricare nuovamente l’audio. Se la riscrittura resta identica, NEB va in pausa
con una spiegazione. La verifica aggiuntiva è conteggiata nei tempi e costi Qwen.

## Casi da verificare

| Prova | Risultato atteso |
|---|---|
| Pausa breve nel mezzo di una risposta | NEB continua ad ascoltare. |
| Solo «ehm…» o frase incompleta | Qwen aspetta; nessun consumo della prossima battuta. |
| Risposta breve «sì/no/capito» a domanda adatta | Può essere riconosciuta come turno completo. |
| Outlier riprende mentre Qwen sta elaborando | La proposta precedente viene scartata; la risposta viene riascoltata completa. |
| Breve cenno durante la voce NEB | NEB normalmente continua. |
| Outlier parla continuativamente durante NEB | La voce si interrompe dopo circa 1,2 s; la battuta rimane pendente. Qwen può proseguirne contestualmente l'obiettivo dopo la risposta. |
| Pausa manuale durante la voce | Riga non completata. Riprendi ascolto non ripete la frase; Ripeti battuta pendente è una scelta esplicita. |
| Stop durante Qwen o durante Gemini | Nessuna voce tardiva; Ctrl+Alt+S ferma l'automatico e la voce. |
| Nessuna risposta | Dopo l'attesa configurata la sessione va in pausa. |
| Cattura fermata, scheda chiusa o flusso sospeso | Pausa; audio mancante non è considerato silenzio. |
| Navigazione, nuova task, Rationale sostituito | Cattura fermata. Collega di nuovo e avvia una nuova sessione. |
| Ripresa su altra scheda/documento | Rifiutata; Stop e nuova sessione necessari. |
| Limite di turni, durata o costo | Sessione sospesa senza ulteriore battuta automatica. |

Il pulsante **Riduci** lascia la sessione attiva: riapri il player dal pulsante
fisso oppure da Battute Pronte. **Esc** ferma la sessione; lo Stop globale resta
disponibile. Mentre la sessione è attiva o in pausa,
script, voce manuale e impostazioni voce sono bloccati. Premi Stop per modificarli.

La prima versione distingue le interruzioni durante TTS in modo acustico: 1,2 s di
parlato continuativo, con tolleranza a brevi pause. Non trascrive quei segmenti in
tempo reale; un intercalare lungo può interrompere NEB. La fine del turno è stimata
da silenzio ricevuto e interpretazione Qwen: una lunga pausa a frase completa può
essere scambiata per fine risposta. Non c'è ancora un segnale di fine generazione
dalla pagina Outlier. Verifica questi casi prima di affidarti a sessioni lunghe.

## Misurare la velocità

**Esporta cronologia** salva un JSON con testo originale/adattato, decisioni,
trascrizioni Qwen, interruzioni, tempo Qwen, tempo fino al primo audio Gemini e
costo OpenRouter riportato. Non esporta le registrazioni audio.

- Prova dapprima con 2,5 s di silenzio e risposte brevi.
- Annota tempo Qwen e primo audio Gemini su almeno cinque turni.
- Il ritardo totale comprende silenzio, invio/elaborazione Qwen, 300 ms di verifica
  finale e preparazione Gemini. I 2,5 s non sono il ritardo totale.
- Solo dopo una prova senza sovrapposizioni valuta 2 s o 1,5 s di silenzio.

I costi visualizzati sono quelli restituiti da OpenRouter e non includono Gemini.
Una richiesta già partita può superare il limite; richieste annullate possono
essere fatturate dal provider senza restituire un costo a NEB. Se il costo di una
risposta non è disponibile, NEB sospende l'automatico. Il limite è operativo sui
costi osservati, non sostituisce il limite di spesa del proprio account.

## Verifiche di sviluppo

```text
npm run build
npm test
npm run typecheck
```

`scripts/s2s/smoke-renderer.mjs` usa Edge headless con API e audio sintetici:
verifica l'interfaccia e il percorso automatico senza task reali, chiavi o chiamate
AI. Include la simulazione senza Edge, conservazione delle battute originali,
Pausa/Ripresa durante Qwen e Stop durante una risposta MODEL A tardiva,
modale separato dall’editor, transcript delle battute riprodotte, confronto
originale/adattata, onde da PCM, riduzione/riapertura e uscita con Esc.
Non sostituisce la prova con estensione caricata, audio Outlier e VB-CABLE.

Per ripeterlo da PowerShell nel repository Windows, dopo la build:

```powershell
npm install --prefix .superpowers/outlier-smoke playwright
node scripts/s2s/smoke-renderer.mjs
node node_modules/vitest/vitest.mjs run src/main/outlier/bridge.test.ts
```

Verifiche completate il 3 ottobre 2026: build e typecheck, 135 test WSL,
5 test bridge Windows, smoke del renderer e smoke del connettore C# con inoltro
PCM. Una chiamata reale Qwen su una risposta sintetica in inglese ha trascritto
l'audio e restituito una decisione `speak` valida: 3709 ms, costo riportato
$0,00013719. Una chiamata precedente era stata rifiutata dal validatore per una
decisione incoerente; il flusso si è fermato. Questo è un controllo di compatibilità,
non una misura di affidabilità o latenza su Outlier. Gemini e il routing audio reale
restano da provare con la procedura sopra.

Verifica successiva della simulazione: 149 test WSL e 5 test bridge Windows;
build, typecheck e smoke dell'interfaccia passati. Catena API reale su un esempio
didattico: risposta MODEL A generata in 2205 ms; Gemini ha prodotto 18,04 s di
audio (generazione complessiva 10558 ms); Qwen ha trascritto la risposta e
restituito la battuta successiva in 3753 ms. OpenRouter ha riportato $0,00005652
per MODEL A e $0,00016889 per il regista, escluso Gemini. Il tempo di generazione
Gemini non è il tempo al primo audio né la durata totale della conversazione.

La revisione indipendente ha portato a tre regressioni aggiuntive: riascolto della
risposta completata dopo Pausa, conservazione di tutti i campioni PCM durante
brevi ritardi del timer, conteggio dei costi conosciuti di risposte annullate
arrivate durante la stessa sessione. I relativi test sono passati dopo le correzioni.

Aggiornamento del player automatico: 162 test WSL, build e typecheck passati;
5 test bridge Windows passati. I test coprono riscrittura testuale limitata a un
tentativo, blocco delle battute identiche, scarto dei risultati obsoleti dal
transcript e conservazione del costo noto se la verifica viene annullata.
Una nuova catena API reale su audio sintetico italiano ha riscritto
«Quali limiti devo considerare?» in «Ok, ho capito i passaggi pratici. Ma quali
limiti devo considerare?». MODEL A: 3239 ms; Gemini: 20,16 s di audio generati
in 12571 ms complessivi; Qwen: 8880 ms, costo $0,00020379. Costo MODEL A:
$0,00006028. Sono singole osservazioni, non valori garantiti o misure su Outlier.

Lo smoke dell’interfaccia Windows aggiornato è passato: player dedicato,
trascrizione delle battute effettivamente avviate, confronto originale/adattata,
onde che rispondono al PCM NEB e MODEL A, Riduci/riapri, Pausa/Ripresa,
Stop e uscita con Esc. La prova è isolata e usa audio/IPC sintetici;
resta da verificare l’ascolto nelle cuffie e il routing hardware sul PC dell’utente.
