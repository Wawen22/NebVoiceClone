import { useState } from 'react'
import { Download, Pause, Play, Square } from 'lucide-react'
import type { ReadyLine, ReadyLinesTab } from '../readyLines'
import { DEFAULT_S2S_OPTIONS, type S2SOptions } from './controller'
import type { S2SAutomation } from './useS2SAutomation'
import type { AudioOutput } from '../audio/AudioEngine'
import { FlaskConical } from 'lucide-react'

export function AutomationPanel({ automation: a, lines, tab, available, unavailableReason, simulationAvailable, localOutputs, editorReady }: {
  automation: S2SAutomation; lines: ReadyLine[]; tab: ReadyLinesTab
  available: boolean; unavailableReason: string; editorReady: boolean
  simulationAvailable: boolean; localOutputs: AudioOutput[]
}): React.JSX.Element {
  const [enabled, setEnabled] = useState(false)
  const [scenario, setScenario] = useState('')
  const [options, setOptions] = useState<S2SOptions>(DEFAULT_S2S_OPTIONS)
  const [simulationOutput, setSimulationOutput] = useState('')
  const localDevice = localOutputs.some((output) => output.deviceId === simulationOutput) ? simulationOutput : localOutputs[0]?.deviceId ?? ''
  const canResume = a.isSimulation ? simulationAvailable && localOutputs.length > 0 : available && a.receiving
  const shown = enabled || a.locked
  const pending = lines.filter((line) => !line.done).length
  const model = (a.locked ? a.sessionTab : tab) === 'modelB' ? 'MODEL B' : 'MODEL A'
  const lastDecision = [...a.snapshot.log].reverse().find((item) => item.qwenMs !== undefined)
  const lastVoice = [...a.snapshot.log].reverse().find((item) => item.firstAudioMs !== undefined)
  return <section className="s2s-automation" aria-label="Conversazione automatica S2S">
    <div className="s2s-mode">
      <strong>Conversazione S2S</strong>
      <label><input type="checkbox" checked={shown} disabled={a.locked} onChange={(event) => setEnabled(event.target.checked)} /> Automatico</label>
    </div>
    {shown && <>
      <div className="s2s-connection"><span className={`status-dot ${a.receiving ? 'green' : 'amber'}`} />
        <span>{a.isSimulation ? a.simulationMessage : a.receiving ? `Audio scheda collegato · ${a.audioStatus.target?.title || 'Outlier'}` : a.audioStatus.message}</span>
        <meter min="0" max="0.15" value={Math.min(0.15, a.audioLevel)} aria-label="Livello audio ricevuto da Outlier" />
      </div>
      {!a.locked && <details className="s2s-configuration">
        <summary>Scenario e tempi · silenzio {options.silenceMs / 1000}s</summary>
        <label>Scenario e ruolo da mantenere<textarea maxLength={4000} value={scenario} onChange={(event) => setScenario(event.target.value)} placeholder="Es. Sono un insegnante, voglio confrontare due modi per spiegare questo argomento…" /></label>
        <div className="s2s-settings-grid">
          <label>Silenzio prima della verifica<select value={options.silenceMs} onChange={(event) => setOptions({ ...options, silenceMs: Number(event.target.value) })}>
            {[1500, 2000, 2500, 3000, 4000, 5000].map((value) => <option key={value} value={value}>{value / 1000} secondi</option>)}
          </select></label>
          <label>Attesa senza risposta<select value={options.responseTimeoutMs} onChange={(event) => setOptions({ ...options, responseTimeoutMs: Number(event.target.value) })}>
            {[15000, 30000, 60000].map((value) => <option key={value} value={value}>{value / 1000} secondi</option>)}
          </select></label>
          <label>Massimo turni NEB<input type="number" min={1} max={100} value={options.maxTurns} onChange={(event) => setOptions({ ...options, maxTurns: Number(event.target.value) })} /></label>
          <label>Massimo minuti<input type="number" min={1} max={120} value={options.maxDurationMs / 60000} onChange={(event) => setOptions({ ...options, maxDurationMs: Number(event.target.value) * 60000 })} /></label>
          <label>Limite OpenRouter (USD)<input type="number" min={0.01} max={20} step={0.01} value={options.maxCostUsd} onChange={(event) => setOptions({ ...options, maxCostUsd: Number(event.target.value) })} /></label>
        </div>
        <p>Qwen adatta il testo mantenendo obiettivo e ordine. L’audio della risposta e il contesto vengono inviati a OpenRouter/Alibaba; Gemini genera la tua voce. Il limite usa i costi riportati da OpenRouter e non include Gemini; una richiesta già partita può superarlo.</p>
      </details>}
      {!a.locked && <div className="s2s-simulation-config">
        <label>Uscita simulazione · cuffie / altoparlanti<select aria-label="Uscita simulazione" value={localDevice} onChange={(event) => setSimulationOutput(event.target.value)}>
          {!localOutputs.length && <option value="">Collega cuffie o altoparlanti reali</option>}
          {localOutputs.map((output) => <option key={output.deviceId} value={output.deviceId}>{output.label}</option>)}
        </select></label>
        <p className="s2s-note">Prova nella Console: MODEL A risponde con un’AI e una voce distinta, Qwen ascolta e adatta le battute. Non serve Edge. Le battute restano disponibili per Outlier. Usa le API OpenRouter e Gemini.</p>
      </div>}
      <div className="s2s-controls">
        {!a.locked && <button className="secondary-button" disabled={!simulationAvailable || !localDevice || !pending || !editorReady} onClick={() => void a.startSimulation(lines, scenario, options, localDevice)}><FlaskConical size={14} /> Simulazione MODEL A</button>}
        {!a.locked && <button className="secondary-button ready-save" disabled={!available || !a.receiving || !pending || !editorReady} onClick={() => void a.start(lines, scenario, options)}><Play size={14} /> Avvia {model} · {pending} battute</button>}
        {a.active && <button className="secondary-button" onClick={a.pause}><Pause size={14} /> Pausa</button>}
        {a.snapshot.phase === 'paused' && <>
          <button className="secondary-button" disabled={!canResume} onClick={() => a.resume()}><Play size={14} /> {a.isSimulation ? 'Riprendi simulazione' : 'Riprendi ascolto'}</button>
          {a.snapshot.lineIndex < a.snapshot.total && <button className="text-button" disabled={!canResume} onClick={() => a.resume(true)}>Ripeti battuta pendente</button>}
        </>}
        {a.locked && <button className="secondary-button" onClick={a.stop}><Square size={14} /> Stop automatico</button>}
        {a.snapshot.log.length > 0 && <button className="text-button" onClick={a.exportLog}><Download size={14} /> Esporta cronologia</button>}
      </div>
      {!available && !a.locked && <p className="s2s-note">Per la conversazione su Outlier: {unavailableReason}</p>}
      {!editorReady && !a.locked && <p className="s2s-note">Salva o chiudi la modifica della battuta prima di avviare l’automatico.</p>}
      {!a.providerReady && <p className="s2s-note">Serve OPENROUTER_API_KEY nel file .env.local. Riavvia NEB dopo averla configurata.</p>}
      <p className="s2s-state" role="status">{a.starting ? 'Verifica configurazione…' : a.snapshot.message} · {a.isSimulation ? `SIMULAZIONE · script ${model}` : model}</p>
      {a.error && <p className="notice error" role="alert">{a.error}</p>}
      {a.locked && a.snapshot.nextText && <div className="s2s-preview"><strong>{a.snapshot.phase === 'speaking' ? 'Battuta in corso' : 'Battuta proposta'}</strong><p>{a.snapshot.nextText}</p></div>}
      {a.snapshot.log.length > 0 && <div className="s2s-metrics">
        <span>{a.snapshot.lineIndex}/{a.snapshot.total} completate</span>
        <span>OpenRouter ${a.snapshot.costUsd.toFixed(4)}{a.snapshot.costKnown ? '' : ' + costo non disponibile'}</span>
        {lastDecision && <span>Qwen {lastDecision.qwenMs} ms</span>}
        {lastVoice && <span>Primo audio Gemini {lastVoice.firstAudioMs} ms</span>}
      </div>}
      {a.snapshot.log.length > 0 && <details className="s2s-history"><summary>Cronologia e decisioni</summary>
        <ol>{a.snapshot.log.slice(-30).map((entry, index) => <li key={`${entry.atMs}-${index}`}>
          <strong>{(entry.atMs / 1000).toFixed(1)}s · {entry.text}</strong>
          {entry.transcript && <p>Outlier: {entry.transcript}</p>}
          {entry.original && <p>Originale: {entry.original}</p>}
          {entry.adapted && <p>Testo NEB: {entry.adapted}</p>}
        </li>)}</ol>
      </details>}
    </>}
  </section>
}
