# Preparazione anticipata e contesto della task S2S

Obiettivo: sovrapporre la riscrittura Qwen e la preparazione della voce NEB al
parlato MODEL A, senza anticipare la riproduzione o usare una proposta obsoleta.
Il riferimento è il playbook v8 fornito dall'utente, in particolare §§0.3C–D e 34.

## Contesto

Campi espliciti: What to do/scenario, tipo, Skills tested, livello L0/L1/L2,
minimo turni utente e materiale preparato facoltativo. Lo scenario e il contesto
sono congelati per sessione e inclusi nelle richieste Qwen e nel JSON esportato.
Le istruzioni della task prevalgono sulle frasi di esempio. L1 usa un aggancio
concreto alla risposta; L2 conserva funzioni e difficoltà ma aggiorna la scena
dal parlato reale. Gli ADAPT LIVE sono istruzioni, mai testo da pronunciare.
L0 permette il testo originale quando la task richiede formulazioni fisse.
Nessuna generazione di voti, rationale o prove Timeline è aggiunta.

## Preparazione

La simulazione dispone del testo MODEL A completo prima del TTS: una richiesta
Qwen testuale compatta prepara la decisione durante la generazione/riproduzione
MODEL A. La voce NEB viene generata senza riproduzione appena Gemini termina la
generazione MODEL A, così le due generazioni restano seriali e il parlato può
continuare in parallelo alla preparazione NEB. L'audio preparato è limitato e
usato esclusivamente per il testo, la voce e la sessione che l'hanno generato.

La riproduzione richiede fine effettiva del playback MODEL A e una breve guardia
audio. La fine della risposta finale è verificata anche quando tutte le battute
NEB risultano già pronunciate. Stop/Pausa, nuova sessione, risposta sostituita
o ripresa del parlato prima del TTS annullano lavoro e audio pendenti.
Costi conosciuti di risultati obsoleti restano conteggiati.

Su Outlier il percorso audio rimane disponibile. L'attuale connettore non espone
testo streaming dalla pagina; il DOM dello screenshot non è sufficiente per
definire un selettore verificato. La UI distingue l'anticipazione della simulazione
dal percorso audio reale. Non legge testo generico della pagina come transcript.
L'utente è stato interpellato sulla disponibilità del transcript durante il parlato.

## Verifica

Test su input audio/testo e contesto, L0/L1/L2, istruzioni ADAPT LIVE, preparazione
durante il parlato, nessuna voce prima della fine, annullamento/ripresa/costi,
generazione silenziosa in coda a Gemini, riuso dell'audio e conservazione originali.
Smoke Windows del modale: campi contesto inviati, proposta prima della fine,
audio pronto riutilizzato, finale e Stop. Build, test e typecheck, sincronizzazione
dei sorgenti e out nelle due cartelle Windows e commit main.
