# Diagnostica e preparazione della sessione

Apri **Diagnostica** dal menu oppure **NEB Live → Verifica sessione**.
La pagina mostra provider, modello e voce realmente selezionati, anche con Fish.

- **Console** verifica applicazione Windows, provider, uscita, volume e operazioni concorrenti. Non richiede una scheda browser o Qwen.
- **NEB Live** aggiunge scheda collegata, flusso audio recente della stessa scheda, CABLE Input, Stop globale e configurazione Qwen/OpenRouter.
- Simli è richiesto solo quando l'avatar è attivato. Lo stato configurato non dimostra che la connessione cloud riuscirà: viene aperta quando si usa la voce.
- L'uscita video è facoltativa. I visualizzatori locali non dimostrano che OBS Virtual Camera sia attiva o che il sito la abbia selezionata.

**Ricontrolla** aggiorna il provider selezionato, le uscite audio, le informazioni
dell'app e la configurazione dei servizi. Non genera voce, non avvia Live,
non collega la scheda e non apre una sessione Simli. La verifica Gemini legge
i metadati del modello; Fish controlla chiave e riferimento cifrato locale.
Il controllo Qwen verifica la presenza della chiave: la disponibilità remota
si determina durante la richiesta del turno.

Il collegamento e l'arrivo dei pacchetti audio si aggiornano in tempo reale.
Un flusso attivo può contenere silenzio; non prova che l'interlocutore sia udibile.
Il microfono del sito resta un controllo manuale: seleziona **CABLE Output** e
fai una registrazione. Mantieni l'uscita del sito sulle cuffie reali.

Le azioni aprono le impostazioni pertinenti: **Voce e audio** espande i controlli
in Console, **Configura browser** apre Configura → Audio in Live, **Apri avatar**
torna alla Console. Una sessione in corso rimane sotto il controllo dell'utente.

## Verifica senza servizi a pagamento

Da Windows, nel worktree sincronizzato:

```powershell
node .\scripts\diagnostics\smoke-renderer.mjs
```

La prova usa Edge headless con IPC e audio sintetici. Verifica provider Fish,
preparazione Live, scollegamento e ritorno dell'audio, dispositivi assenti,
azioni di navigazione, errori dei servizi e layout. Non usa chiavi o servizi cloud.

Serve Microsoft Edge installato e Playwright nella cartella di test ignorata
`.superpowers/outlier-smoke`, condivisa con le altre prove renderer. Se manca:

```powershell
npm.cmd install --prefix .superpowers/outlier-smoke --no-save playwright
```
