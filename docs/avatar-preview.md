# Anteprima avatar flottante

La barra Avatar resta compatta in Console e NEB Live. Il video appare in un
popup interno, senza sottrarre una fascia alla conversazione.

## Prova Windows

1. Riavvia NEB da Windows PowerShell con `scripts/run-windows.ps1`.
2. Attiva Simli e avvia Test voce avatar oppure una conversazione NEB Live.
3. Trascina la testata Avatar in un punto libero. La posizione viene ricordata.
4. Ridimensiona la finestra: l'anteprima deve rimanere raggiungibile.
5. Premi Espandi avatar nella barra; Escape torna all'anteprima compatta.
6. Premi la X dell'anteprima oppure Nascondi anteprima avatar nella barra.
   Mostra anteprima avatar la ripristina nella posizione precedente.
7. Con Uscita OBS attiva, verifica che il video in OBS continui mentre
   l'anteprima viene spostata, ingrandita o nascosta.

Nascondere l'anteprima non scollega Simli e non interrompe voce o uscita OBS.
I minuti della sessione continuano a essere consumati. Per scollegarla usa
Scollega avatar; Stop in NEB Live conserva il comportamento di fine sessione.

La maniglia Sposta anteprima avatar accetta anche le frecce da tastiera;
Shift aumenta lo spostamento. Escape nel modale non arresta la conversazione.

## Verifica automatica

Da Windows, dopo la build sincronizzata:

```powershell
node scripts/avatar/smoke-renderer.mjs
node scripts/avatar/smoke-output.mjs
node scripts/live/smoke-renderer.mjs
```

I test predefiniti usano video sintetico e non consumano minuti Simli.
Verificano posizione persistente, trascinamento, ridimensionamento, focus,
identita del video, continuita Live e aggiornamenti dell'uscita locale con
anteprima nascosta o finestra minimizzata. Non modificano la scena OBS.
