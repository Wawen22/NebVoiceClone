import { memo, useMemo } from 'react'
import type { LiveLog } from './controller'
import { liveTimestamp } from './LiveTranscript'
import { summarizeLiveTimings, type TimingBreakdown } from './timingMetrics'
import './timings.css'

const stages: { key: keyof TimingBreakdown; label: string }[] = [
  { key: 'beforeQwenMs', label: 'Prima di Qwen' }, { key: 'qwenMs', label: 'Qwen · ultima richiesta' },
  { key: 'beforeVoiceMs', label: 'Attesa prima della voce' }, { key: 'voiceStartMs', label: 'Preparazione audio/avatar' }
]
const duration = (ms: number | null): string => ms === null ? 'Non disponibile' : `${(ms / 1000).toFixed(2).replace('.', ',')} s`
const provider = (id: string | null): string => id === 'gemini' ? 'Gemini' : id === 'fish-openrouter' ? 'Fish' : 'Non disponibile'

export const LiveTimingPanel = memo(function LiveTimingPanel({ log }: { log: LiveLog[] }): React.JSX.Element {
  const metrics = useMemo(() => summarizeLiveTimings(log), [log])
  const latest = metrics.rows.at(-1)
  const longestStage = latest?.breakdown ? stages.reduce((previous, stage) => latest.breakdown![stage.key] > latest.breakdown![previous.key] ? stage : previous) : null
  return <details className="neb-live-timings">
    <summary><strong>Tempi della conversazione</strong><span>{latest ? `Ultima risposta ${duration(latest.totalMs)} · mediana ${duration(metrics.medianMs)}` : 'Nessun turno misurato'}</span></summary>
    <div className="neb-live-timings-content">
      <p className="neb-live-timings-note">Dalla fine del parlato rilevato all’avvio della riproduzione in NEB. Il tempo di arrivo al sito e quello percepito dall’interlocutore non sono misurati.</p>
      {!latest ? <p className="neb-live-timings-empty">I tempi compaiono quando NEB avvia una risposta a una domanda ascoltata. Aperture, risposte ai soli allegati e tentativi annullati prima della voce sono esclusi.</p> : <>
        <dl className="neb-live-timing-stats"><div><dt>Turni misurati</dt><dd>{metrics.count}</dd></div><div><dt>Mediana</dt><dd>{duration(metrics.medianMs)}</dd></div><div><dt>Risposta più lenta</dt><dd>{duration(metrics.maxMs)}<small>{metrics.worst?.turnNumber != null ? `Turno ${metrics.worst.turnNumber}` : 'Turno senza numero'}</small></dd></div></dl>
        {longestStage && <p className="neb-live-timings-note">Passaggio più lungo nell’ultima risposta: <strong>{longestStage.label}</strong> · {duration(latest!.breakdown![longestStage.key])}.</p>}
        <div className="neb-live-timing-table-wrap" tabIndex={0} role="region" aria-label="Tempi degli ultimi dieci turni">
          <table className="neb-live-timing-table"><caption>Ultimi dieci turni misurati · secondi</caption><thead><tr><th scope="col">Turno</th><th scope="col">Totale</th>{stages.map(stage => <th key={stage.key} scope="col">{stage.label}</th>)}<th scope="col">Voce</th></tr></thead><tbody>{metrics.rows.slice(-10).reverse().map(row => <tr key={row.id}>
            <th scope="row">{row.turnNumber ?? '—'}<small>{liveTimestamp(row.atMs)}</small></th><td><strong>{duration(row.totalMs)}</strong></td>{stages.map(stage => <td key={stage.key}>{duration(row.breakdown?.[stage.key] ?? null)}</td>)}<td>{provider(row.providerId)}<details><summary>Dettagli</summary><dl><div><dt>Modello</dt><dd>{row.modelId ?? 'Non disponibile'}</dd></div><div><dt>Primo blocco audio</dt><dd>{duration(row.firstChunkMs)}</dd></div><div><dt>Generazione vocale</dt><dd>{duration(row.generationMs)}</dd></div></dl></details></td>
          </tr>)}</tbody></table>
        </div>
        <p className="neb-live-timings-note">Qwen misura l’ultima richiesta, inclusa la comunicazione con il processo principale. Prima di Qwen e prima della voce possono esserci attese e tentativi di recupero. Primo blocco e generazione vocale si sovrappongono alla riproduzione e non si sommano al totale.</p>
        <p className="neb-live-timings-note">Riepilogo sui dati disponibili: nelle sessioni lunghe possono mancare i turni iniziali. Sono incluse anche risposte interrotte dopo l’avvio. Esporta JSON per conservare le misure.</p>
      </>}
    </div>
  </details>
})
