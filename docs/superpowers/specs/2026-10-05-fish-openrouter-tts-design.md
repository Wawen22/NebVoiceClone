# Fish OpenRouter TTS - Specifica

## Stato E Obiettivo

Proposta tecnica per revisione dell'utente, non implementata. Prima fase del confronto multi-provider: Gemini esistente contro Fish S2.1 Pro Free e Pro via OpenRouter. Cartesia e Smallest sono fasi successive, non dipendenze di questa consegna.

Obiettivo: ridurre il tempo prima del parlato in Console e NEB Live mantenendo somiglianza con la voce dell'utente, italiano/inglese, interruzione immediata e sincronizzazione Simli. Il miglioramento va misurato; non si promette una latenza assoluta. Qwen, acquisizione della scheda, avatar e configurazione OBS non cambiano.

## Decisioni

- Conservare Gemini come default e tutti i suoi profili/clone esistenti.
- Aggiungere provider OpenRouter Fish con due modelli consentiti: `fish-audio/s2.1-pro-free:free` e `fish-audio/s2.1-pro`.
- Iniziare i test remoti con Free. Nessun fallback automatico verso Pro, Gemini o un'altra voce.
- Usare la chiave `OPENROUTER_API_KEY` gia risolta dal backend, senza esporla al renderer e senza nuove credenziali Fish nella prima fase.
- Il clone Fish e un riferimento audio stateless: il campione viene inviato a OpenRouter/Fish per ogni richiesta. Non e il clone Gemini e non viene creato un voice ID remoto persistente.
- Riusare il flusso PCM e i motori audio esistenti. Nessuna nuova pipeline OBS o Simli.

Alternative considerate: API Fish diretta offre un ulteriore percorso real-time ma introduce account/credenziali e un confronto diverso; integrare subito tre servizi moltiplica le variabili. Entrambe sono rimandate finche non abbiamo misurato Fish tramite OpenRouter.

## Evidenze Verificate

Il 2026-10-05 le API pubbliche endpoints per entrambi i modelli restituiscono `supports_voice_cloning: true`, un singolo riferimento audio supportato, prezzo prompt zero per Free e `0.000015` per Pro. Sono metadati, non una prova di generazione, qualita o latenza. Nessuna richiesta TTS remota eseguita in questa fase.

Fonti:
- [OpenRouter TTS e input_references](https://openrouter.ai/docs/guides/overview/multimodal/tts).
- [Fish Free](https://openrouter.ai/fish-audio/s2.1-pro-free:free): gratuito, con limiti e senza garanzie di disponibilita/latenza produzione.
- [Fish Pro](https://openrouter.ai/fish-audio/s2.1-pro): prezzo indicato per byte UTF-8, non per token Qwen.
- API metadati: `GET /api/v1/models/fish-audio/{model}/endpoints`.

## Confini Del Codice

Oggi il backend speech IPC e il builder Live sono legati direttamente a Gemini; il campo provider esistente da solo non basta. Introdurre un dispatch esplicito dei due provider, mantenendo la validazione Gemini invariata e aggiungendo validazione Fish separata. La stessa selezione deve governare Console e Live; non estendere implicitamente automazioni S2S non richieste.

Estendere settings con configurazione Fish e selezione del provider mantenendo schema compatibile: vecchi settings senza campi Fish devono caricare Gemini identico a prima. I profili Gemini per chiave restano separati. Provider/modello/riferimento del turno sono acquisiti all'avvio e non cambiano durante riproduzione o Live attivo.

Il backend Fish usa `POST /api/v1/audio/speech` con modello consentito, testo, `response_format: pcm` e un riferimento audio inline con trascrizione. Il renderer invia un ID locale del riferimento, non un percorso arbitrario o audio base64 in ogni richiesta. Il backend legge e valida il riferimento associato.

## Campione E Privacy

In Impostazioni aggiungere profilo Fish con nome, importazione WAV, trascrizione, anteprima locale, consenso e rimozione. Consiglio utente: 15-30 secondi di voce pulita senza musica o altre persone. Limite applicativo iniziale: WAV PCM16 mono, 16/24/44.1/48 kHz, durata 5-60 secondi, massimo 6 MiB; parsing RIFF strutturato e validazione anche nel main. I file non conformi sono rifiutati con messaggio preciso, senza conversioni implicite distruttive.

Il campione e la trascrizione sono memorizzati nell'userData, fuori dal repository e dai mirror del codice, con cifratura safeStorage e senza fallback a testo in chiaro se la cifratura non e disponibile. Settings conserva solo metadati/ID. Nessuna registrazione automatica del microfono. Prima del test cloud l'utente deve confermare l'invio del campione a OpenRouter e Fish. Non promettere zero retention senza conferma delle condizioni dei provider.

Non riutilizzare automaticamente audio di consenso Gemini o campioni preesistenti. Un eventuale campione personale viene scelto esplicitamente dall'utente. JSON di diagnostica, log ed errori non includono audio, trascrizione del riferimento, chiavi, base64 o percorsi personali. Rimozione elimina il record locale e spiega che non e una richiesta di cancellazione dei dati del provider remoto.

## Streaming E Interruzioni

Contratto interno invariato: PCM16 little-endian mono 24 kHz. Prima del collegamento ai motori verificare il formato Fish effettivo, frequenza/channels/endian e streaming incrementale con una prova breve. La documentazione generica `audio/pcm` non basta per indovinare il sample rate. Se il formato non e determinabile da contratto verificato/metadati, bloccare il test con errore esplicito: non riprodurre a velocita sbagliata e non dichiarare pronta l'integrazione.

L'adattatore preserva byte incompleti tra chunk, valida durata/byte totali e ricampiona in modo incrementale quando serve, senza aspettare il file completo. Nessuna conversione MP3 che richieda buffering completo nel percorso a bassa latenza. AbortSignal interrompe fetch e lettura, rilascia il reader e ignora chunk tardivi. Conservare le protezioni di speechPlayer e la sessione Simli continua gia implementata.

Timeout al primo audio e limite totale sono espliciti e finiti; la scelta concreta viene fissata nel piano dopo il probe del trasporto, senza aumentare i timeout Qwen. Gli errori 401/403, quota/rate limit 402/429, formato inatteso, stream vuoto e rete non attivano retry a pagamento o cambio voce. In Live usare il recupero/pausa esistente e mantenere la domanda.

## UI E Diagnostica

Usare controlli esistenti in Impostazioni per provider, modello e profilo. Mostrare stato chiave configurata/non configurata, Free/Pro distinguibili e profilo mancante. In Console e Live la voce selezionata deve corrispondere al provider effettivo. Bloccare cambi durante operazioni attive.

Non costruire subito una nuova pagina benchmark. Riusare Console per frasi uguali ed esportazione Live per provider/modello, tempo al primo PCM, tempo all'inizio parlato e durata generazione. Separare tempi TTS da Qwen e Simli. Le stime Fish sono separate dal costo OpenRouter Qwen gia esistente e non sono spacciate per addebiti effettivi; se un dato non e disponibile e indicato come tale. Non salvare nuove copie del testo per il confronto.

## Verifica E Accettazione

1. Test di migrazione settings: configurazione Gemini e clone esistente identici; passaggio Fish/Gemini non sovrascrive voci.
2. Test provider/IPC: whitelist modelli, chiave mai esposta, ID riferimento valido, consenso, limiti WAV, cifratura, rimozione e redazione errori.
3. Test streaming: chunk dispari, ricampionamento, vuoto/formato errato, limiti, Abort durante fetch/lettura, Stop e chunk tardivi. Dimostrare primo chunk prima del completamento con fixture controllata.
4. Prova renderer Windows con provider sintetico: Console, Live, selezione, profilo mancante, cambio bloccato, replay e Simli continuo senza richieste cloud.
5. Prova cloud Free con campione esplicitamente scelto: italiano e inglese, ascolto della fedelta e verifica formato reale. Poi confronto Pro solo con consenso al costo.
6. Confronto ripetuto: almeno cinque frasi brevi e due lunghe, stesse condizioni per Gemini/Free/Pro, distinguendo prima richiesta e richieste successive; riportare mediana e massimo, non un percentile affidabile da pochi dati.
7. Prima audio senza Simli, poi con Simli/OBS. Test OBS solo senza chiamate, streaming o registrazione attivi. Non consumare trenta minuti di avatar per questo benchmark.
8. Build, tutti i test e typecheck; sincronizzare sorgenti/out sui due mirror Windows e commit scoped su main. Nessun avvio Electron da WSL.

Se Fish non migliora la latenza o perde troppo in somiglianza, mantenerlo opzionale e documentare l'esito, senza sostituire Gemini. Un risultato negativo del probe sul formato/streaming ferma questa fase e viene riportato prima di scegliere API diretta o altro provider.

## Passaggio Successivo

L'utente rivede questa specifica. Dopo l'approvazione preparare il piano implementativo con probe iniziale del trasporto, test di regressione e prove Windows, quindi far scegliere il metodo di esecuzione prima di implementare. Questa specifica non autorizza automaticamente Cartesia/Smallest, pagamenti, abbonamenti o upload di audio personale non selezionato.
