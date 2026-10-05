# Avatar Simli in NEB

## Avvio Windows

```powershell
cd C:\Users\r.nebili\.codex\worktrees\outlier-s2s\NebVoiceGenerator
.\scripts\run-windows.ps1
```

La chiave `SIMLI_API_KEY` viene letta dal processo principale da `.env.local`, ignorato da Git. Non viene inviata al renderer: il browser riceve solo credenziali temporanee. Non inserire chiavi in Face ID.

## Prova con il piano Free

1. In Console seleziona l'uscita audio desiderata. Per inviare la voce a un sito usa CABLE Input, come per la voce normale di NEB.
2. Attiva Simli nella barra Avatar, lasciando il preset Fred. Avatar parte disattivato a ogni avvio dell'app.
3. Premi il pulsante con triangolo nella barra Avatar per una breve frase di prova. La connessione viene aperta solo quando richiesta.
4. Scrivi e pronuncia normalmente, oppure passa a NEB Live e avvia una conversazione. Le due viste condividono la sessione. Non si riproduce contemporaneamente la voce locale: l'audio arriva dal flusso Simli insieme al video.
5. Stop, Pausa Live e Scollega interrompono la sessione. L'abilitazione rimane selezionata: una nuova frase puo aprire una nuova connessione.

Il timer mostra i secondi della connessione corrente, non il credito residuo. Il saldo effettivo va controllato nel dashboard Simli. Le sessioni di prova hanno un massimo richiesto di 120 secondi e 30 secondi inattivi; una singola risposta e limitata a 110 secondi. Non lasciare l'anteprima collegata inutilmente. Nessun upgrade viene effettuato dall'app.

Le frasi generate supportano Riascolta con avatar. Per ascoltare un WAV importato, disattiva Avatar: la conversione di file arbitrari non e inclusa in questa prima versione.

Il pulsante Espandi avatar nella barra apre una vista grande del volto, sia in Console sia in NEB Live. X oppure Esc richiudono soltanto la vista, senza fermare la voce. Il video e la sessione rimangono gli stessi: non viene aperta una seconda connessione. Il modale si adatta alle dimensioni della finestra.

## Volto personale

Dopo aver creato il volto nel proprio account Simli, scegli Face ID personale e inserisci il relativo UUID. Il Face ID viene salvato localmente; non occorre cambiare il percorso voce o OpenRouter. La disponibilita della creazione del volto dipende dal piano Simli e non viene verificata dalla UI NEB.

## Ambito e verifiche

Questa versione mostra il video dentro NEB. Non installa una webcam virtuale e non invia il video come camera a Meet, Teams o altri siti: quella e un'integrazione separata. L'elaborazione del volto e remota, il portatile riceve il video via WebRTC.

Verificati su Windows Edge con Playwright: connessione reale al preset Fred, video 512x512 con frame decodificati e pacchetti audio ricevuti, test di Console, replay, stop, caduta del WebSocket e riconnessione, apertura NEB Live, ritorno all'ascolto, nessuna riproduzione locale duplicata e layout 1260x850/980x680. Il test cloud usa una frase TTS generata localmente, non una registrazione personale.

Il test automatico cloud usa l'uscita Windows predefinita. La sincronizzazione percepita e il percorso fisico CABLE verso il sito non sono certificati dal test headless e vanno controllati nell'app Windows. I test Live/S2S simulano i rispettivi servizi: non dimostrano una conversazione remota completa con Gemini/OpenRouter.

Il pacchetto ufficiale `simli-client` e fissato a 3.0.2. Una trasformazione di build circoscritta al pacchetto corregge il casing degli import, chiude timer/AudioContext durante Stop, disabilita i retry automatici e segnala le disconnessioni WebSocket/WebRTC. Rivalutare questi adattamenti quando si aggiorna l'SDK.
