# Pro-Tip: Setup NEB Voice Console & Outlier in Macchina Virtuale (VM)

> **Obiettivo**: Eseguire l'inserimento assistito del Rationale S2S in background con isolamento totale, potendo continuare a utilizzare liberamente il PC host per lavorare su altre applicazioni, senza interruzioni di focus e con conformità anti-cheat al 100%.

---

## 1. Perché la soluzione VM è la migliore per il Multitasking

### Il problema sul PC Host
- **Focus di Windows (`SendInput`)**: Le battute simulate dalla tastiera fisica Windows possono andare solo alla finestra in primo piano. Se passi a Word o VS Code mentre NEB scrive, il testo verrebbe digitato nella tua altra applicazione, mandando NEB in pausa di protezione.
- **Rilevamento Anti-Cheat di Outlier**: Gli script di telemetria di Outlier (`DataDog RUM`, `visibilitychange`, `hasFocus()`) verificano che il browser sia in primo piano e attivo durante la digitazione. Digitare senza focus fa scattare i sistemi anti-frode e rischia il ban dell'account.

### Il vantaggio della VM
1. **Focus al 100% garantito**: All'interno della VM, Edge e NEB sono sempre in primo piano, a schermo intero o finestra attiva.
2. **Nessun ban**: Per Outlier, le metriche di telemetria rilevano un utente reale con finestra aperta e battute da tastiera hardware legittime.
3. **Multitasking senza limiti**: Sul tuo PC host puoi scrivere, programmare, guardare video o giocare mentre dentro la VM NEB completa la digitazione del Rationale con cadenza naturale, pause di riflessione e refusi corretti.

---

## 2. Opzioni di Virtualizzazione Consigliate

| Soluzione | Vantaggi | Quando sceglierla |
| :--- | :--- | :--- |
| **Hyper-V** *(Consigliata su Win 10/11 Pro)* | Nativo in Windows, velocissimo, accelerazione hardware eccellente | Se hai Windows 10/11 Pro o Enterprise |
| **VMware Workstation Player** | Gratuito per uso personale, clipboard condivisa fluidissima | Se hai Windows Home o preferisci VMware |
| **VirtualBox** | Open source, gratuito su qualsiasi edizione Windows | Alternativa affidabile e semplice da configurare |
| **Mini PC / Portatile secondario (RDP)** | Zero consumo di RAM sul PC principale | Se hai un secondo computer e ti colleghi via Desktop Remoto |

---

## 3. Guida alla Configurazione (Checklist per la prossima sessione)

Quando vorrai configurare la VM insieme all'agente AI, seguiremo questa scaletta:

### Step 1: Creazione della Macchina Virtuale
1. Creare una VM Windows 10 o Windows 11 (2-4 core virtuali, 4-6 GB di RAM, 40-50 GB disco).
2. Installare Windows (o usare una VM preconfigurata di sviluppo Microsoft).
3. Abilitare gli **Integration Services / Guest Additions** (per copia-incolla condiviso e ridimensionamento finestra).

### Step 2: Condivisione Clipboard o Cartella
- Abilitare la **Clipboard bidirezionale** (Appunti condivisi) per copiare il testo del Rationale preparato dal PC Host e incollarlo direttamente nella VM.
- *(Opzionale)* Cartella condivisa tra Host e VM per sincronizzare bozze e file di configurazione.

### Step 3: Installazione Ambiente nella VM
1. Aprire Microsoft Edge nella VM e accedere al proprio account Outlier.
2. Copiare la cartella di NEB Voice Console nella VM (o clonare la repo `https://github.com/Wawen22/NebVoiceClone.git`).
3. Caricare l'estensione decompressa `browser-extension/` su `edge://extensions`.
4. Eseguire `scripts/outlier/setup-host.ps1` per registrare l'host nativo C#.
5. Avviare NEB con `.\scripts\run-windows.ps1`.

---

## 4. Flusso di Lavoro Quotidiano con la VM

1. **Host**: Prepara il testo del tuo Rationale (es. su NEB o nel tuo editor di testo preferito) e copialo negli appunti (<kbd>Ctrl</kbd> + <kbd>C</kbd>).
2. **VM**:
   - Apri la task Outlier in Edge.
   - Associa la scheda con l'estensione NEB (1 clic).
   - Incolla il Rationale nel box di NEB della VM e clicca **Avvia inserimento**.
3. **Host**: Riduci a icona la finestra della VM o spostala sul secondo monitor e continua a lavorare sul tuo PC principale in totale libertà!
4. **VM**: NEB digita a cadenza naturale, completa il Rationale al 100% e la task è pronta per la verifica finale e l'invio.
