import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Pause, Play, Square, FlaskConical, ArrowLeft, Minimize2 } from 'lucide-react'
import type { ReadyLine, ReadyLinesTab } from '../readyLines'
import { DEFAULT_S2S_OPTIONS, type S2SOptions } from './controller'
import type { S2SAutomation } from './useS2SAutomation'
import type { AudioOutput } from '../audio/AudioEngine'
import { conversationMessages, sessionLines } from './conversationView'
import { VoiceWave } from './VoiceWave'
import { DEFAULT_S2S_TASK_CONTEXT, isS2SAdaptiveInstruction, type S2STaskContext } from '../../../shared/s2s'

export function AutomationLauncher({ editorReady, onOpen }: { editorReady: boolean; onOpen: () => void }): React.JSX.Element {
  return <section className="s2s-launcher" aria-label="Conversazione S2S">
    <div><strong>Conversazione S2S</strong><p>Player automatico con trascrizione e battute adattate.</p></div>
    <button className="secondary-button" disabled={!editorReady} onClick={onOpen}><Play size={14} /> Automatico</button>
    {!editorReady && <p>Salva o chiudi la modifica prima di aprire il player.</p>}
  </section>
}

export function AutomationPanel({ open, onClose, onScript, automation: a, lines, tab, available, unavailableReason, simulationAvailable, localOutputs }: {
  open: boolean; onClose: () => void; onScript: () => void
  automation: S2SAutomation; lines: ReadyLine[]; tab: ReadyLinesTab
  available: boolean; unavailableReason: string
  simulationAvailable: boolean; localOutputs: AudioOutput[]
}): React.JSX.Element | null {
  const dialog = useRef<HTMLDialogElement>(null)
  const transcript = useRef<HTMLDivElement>(null)
  const followTranscript = useRef(true)
  const [source, setSource] = useState<'simulation' | 'outlier'>('simulation')
  const [scenario, setScenario] = useState('')
  const [taskContext, setTaskContext] = useState<S2STaskContext>(DEFAULT_S2S_TASK_CONTEXT)
  const [options, setOptions] = useState<S2SOptions>(DEFAULT_S2S_OPTIONS)
  const [simulationOutput, setSimulationOutput] = useState('')
  const localDevice = localOutputs.some((output) => output.deviceId === simulationOutput) ? simulationOutput : localOutputs[0]?.deviceId ?? ''
  const canResume = a.isSimulation ? simulationAvailable && localOutputs.length > 0 : available && a.receiving
  const pending = lines.filter((line) => !line.done).length
  const model = (a.snapshot.total ? a.sessionTab : tab) === 'modelB' ? 'MODEL B' : 'MODEL A'
  const messages = conversationMessages(a.snapshot)
  const turns = sessionLines(a.snapshot)
  const current = turns[a.snapshot.lineIndex]
  const lastDecision = [...a.snapshot.log].reverse().find((item) => item.qwenMs !== undefined && item.accepted)
  const lastVoice = [...a.snapshot.log].reverse().find((item) => item.firstAudioMs !== undefined)
  useEffect(() => {
    const element = dialog.current
    if (!element || !open) return
    element.showModal()
    return () => element.close()
  }, [open])
  useEffect(() => {
    const element = transcript.current
    if (open && element && followTranscript.current) element.scrollTop = element.scrollHeight
  }, [open, a.snapshot.log, a.snapshot.phase])
  if (!open) return null
  return createPortal(<dialog ref={dialog} className="s2s-dialog" aria-labelledby="s2s-heading" data-no-speech-shortcuts onKeyDown={(event) => { if (event.key === 'Escape') event.stopPropagation() }} onCancel={(event) => { event.preventDefault(); a.stop(); onClose() }}>
    <section className="s2s-player" aria-label="Conversazione automatica S2S">
      <header className="s2s-player-header">
        <div><span className="eyebrow">{a.locked ? a.isSimulation ? 'SIMULAZIONE IN CONSOLE' : 'CONVERSAZIONE OUTLIER' : 'NEB VOICE / S2S'}</span><h2 id="s2s-heading">Conversazione automatica</h2><p>{model} · obiettivo e ordine dello script conservati</p></div>
        {a.locked ? <button className="secondary-button" onClick={onClose}><Minimize2 size={15} /> Riduci</button> : <button className="secondary-button" onClick={onScript}><ArrowLeft size={15} /> Torna alle battute</button>}
      </header>
      <div className="s2s-player-status"><span className={`status-dot ${a.active ? 'green' : 'amber'}`} /><p role="status">{a.starting ? 'Verifica configurazione…' : a.active && a.isSimulation && a.snapshot.simulationStage !== 'idle' ? a.simulationMessage : a.snapshot.message}</p><strong>{a.snapshot.lineIndex}/{a.snapshot.total || pending} battute completate</strong></div>
      {a.error && <p className="notice error" role="alert">{a.error}</p>}
      <div className="s2s-speakers">
        <article className={a.snapshot.phase === 'speaking' ? 's2s-speaker neb speaking' : 's2s-speaker neb'}><div><strong>NEB · la tua voce</strong><span>{a.snapshot.phase === 'speaking' ? 'Parla' : a.snapshot.phase === 'preparing-voice' ? 'Prepara la voce' : 'In attesa'}</span></div><VoiceWave speaker="neb" enabled={a.active} getActivity={a.getVoiceActivity} /></article>
        <article className="s2s-speaker model"><div><strong>{a.isSimulation && a.locked ? 'MODEL A · simulato' : a.locked ? model : 'MODEL A'}</strong><span>{a.isSimulation && a.locked ? a.simulationMessage : a.snapshot.phase === 'adapting' ? 'Qwen trascrive e adatta' : ['listening', 'waiting'].includes(a.snapshot.phase) ? 'Ascolto della risposta' : 'In attesa'}</span></div><VoiceWave speaker="model" enabled={a.active} getActivity={a.getVoiceActivity} /></article>
      </div>
      <div className="s2s-player-body">
        <div className="s2s-conversation"><div className="s2s-section-title"><h3>Trascrizione della conversazione</h3><span>NEB + {model}</span></div>
          <div ref={transcript} className="s2s-transcript" role="log" aria-label="Trascrizione della conversazione" aria-live="polite" onScroll={(event) => { const e = event.currentTarget; followTranscript.current = e.scrollHeight - e.scrollTop - e.clientHeight < 80 }}>
            {!messages.length && <div className="s2s-empty"><h3>Pronto per una prova?</h3><p>Avvia la simulazione per vedere qui le battute pronunciate, le risposte di MODEL A e le riscritture di Qwen.</p></div>}
            {messages.map((item) => <article key={item.id} className={`s2s-message ${item.role}`}>
              <div><strong>{item.role === 'neb' ? 'NEB' : model}</strong><span>{(item.atMs / 1000).toFixed(1)}s · {item.state === 'partial' ? 'Interrotta · solo una parte pronunciata' : item.state === 'simulated' ? 'Testo generato · MODEL A' : item.state === 'text' ? 'Testo MODEL A · usato da Qwen' : item.state === 'transcribed' ? 'Trascritto da Qwen' : item.state === 'speaking' ? 'In riproduzione' : 'Pronunciata'}</span></div>
              <p>{item.text}</p>
              {item.original && item.original !== item.text && <details><summary>Confronta con la battuta originale</summary><p>{item.original}</p></details>}
            </article>)}
            {a.active && ['listening', 'waiting', 'adapting'].includes(a.snapshot.phase) && <p className="s2s-transcribing">{a.isSimulation && ['text', 'voice'].includes(a.snapshot.simulationStage) ? a.simulationMessage : a.snapshot.preparation === 'rewriting' ? 'Qwen riscrive in parallelo al parlato MODEL A…' : ['ready', 'voice-ready'].includes(a.snapshot.preparation) ? 'Battuta preparata · NEB attende la fine della risposta MODEL A.' : a.snapshot.phase === 'adapting' ? 'Qwen verifica la risposta e riscrive la prossima battuta…' : 'Ascolto MODEL A. La trascrizione audio arriva dopo la verifica di Qwen.'}</p>}
          </div>
        </div>
        <aside className="s2s-session-script">
          {!a.locked && <div className="s2s-setup">
            <h3>Avvio</h3><div className="s2s-source" role="group" aria-label="Sorgente della conversazione"><button aria-pressed={source === 'simulation'} onClick={() => setSource('simulation')}>Simulazione</button><button aria-pressed={source === 'outlier'} onClick={() => setSource('outlier')}>Outlier / Edge</button></div>
            {source === 'simulation' ? <div className="s2s-simulation-config"><label>Uscita simulazione · cuffie / altoparlanti<select aria-label="Uscita simulazione" value={localDevice} onChange={(event) => setSimulationOutput(event.target.value)}>{!localOutputs.length && <option value="">Collega cuffie o altoparlanti reali</option>}{localOutputs.map((output) => <option key={output.deviceId} value={output.deviceId}>{output.label}</option>)}</select></label><p className="s2s-note">MODEL A usa un’AI e una voce distinta. Non serve Edge. Gli originali restano disponibili per Outlier. Usa OpenRouter e Gemini.</p></div> : <p className="s2s-note">{available ? a.receiving ? 'Audio della scheda collegato. Pronto per Outlier.' : a.audioStatus.message : unavailableReason}</p>}
            {!pending && <p className="s2s-note">Importa o aggiungi battute dallo script per avviare.</p>}
            {!a.providerReady && <p className="s2s-note">Configura OPENROUTER_API_KEY in .env.local e riavvia NEB.</p>}
            {source === 'simulation' && <label className="s2s-anticipate"><input type="checkbox" checked={options.anticipateText} onChange={(event) => setOptions({ ...options, anticipateText: event.target.checked })} /> Prepara battuta e voce mentre MODEL A parla</label>}
            {source === 'outlier' && <p className="s2s-note">Su Outlier Qwen ascolta l’audio: il connettore attuale non riceve una trascrizione mentre il modello parla.</p>}
            <button className="primary-button s2s-start" disabled={a.starting || !pending || (source === 'simulation' ? !simulationAvailable || !localDevice : !available || !a.receiving)} onClick={() => void (source === 'simulation' ? a.startSimulation(lines, scenario, options, localDevice, taskContext) : a.start(lines, scenario, options, taskContext))}>{source === 'simulation' ? <FlaskConical size={15} /> : <Play size={15} />}{source === 'simulation' ? 'Simulazione MODEL A' : `Avvia ${model} · ${pending} battute`}</button>
          </div>}
          {!a.locked && <details className="s2s-configuration s2s-task-context" open><summary>Contesto della task</summary>
            <label>What to do / Scenario<textarea maxLength={4000} value={scenario} onChange={(event) => setScenario(event.target.value)} placeholder="Incolla le istruzioni della task e il ruolo da interpretare." /></label>
            <label>Tipo di scenario<input maxLength={300} value={taskContext.scenarioType} onChange={(event) => setTaskContext({ ...taskContext, scenarioType: event.target.value })} placeholder="Es. Knowledge & Learning · IQ-focused" /></label>
            <label>Skills tested<textarea maxLength={4000} value={taskContext.skillsTested} onChange={(event) => setTaskContext({ ...taskContext, skillsTested: event.target.value })} placeholder="Es. guida pedagogica, metodo socratico, analisi letteraria" /></label>
            <label>Adattamento<select value={taskContext.adaptationLevel} onChange={(event) => setTaskContext({ ...taskContext, adaptationLevel: event.target.value as S2STaskContext['adaptationLevel'] })}><option value="L1">L1 · Adatta alla risposta (conversazioni)</option><option value="L2">L2 · Segui lo stato (improv / roleplay)</option><option value="L0">L0 · Testo fisso richiesto dalla task</option></select></label>
            <label>Minimo turni utente richiesti (facoltativo)<input type="number" min={1} max={100} value={taskContext.minimumUserTurns ?? ''} onChange={(event) => setTaskContext({ ...taskContext, minimumUserTurns: event.target.value ? Number(event.target.value) : null })} /></label>
            <details><summary>Materiale preparato / brano (facoltativo)</summary><label>Materiale preparato<textarea maxLength={12000} value={taskContext.material} onChange={(event) => setTaskContext({ ...taskContext, material: event.target.value })} placeholder="Il brano scelto o i fatti necessari: Qwen deve usare questo materiale senza inventarlo." /></label></details>
            <p>Qwen segue le istruzioni e le skills della task. In L2 i turni sono intenti da realizzare nella scena attuale; le istruzioni ADAPT LIVE non vengono pronunciate.</p>
          </details>}
      {!a.locked && <details className="s2s-configuration">
        <summary>Tempi e limiti · silenzio {options.silenceMs / 1000}s</summary>
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
          {a.locked && a.snapshot.preparation !== 'idle' && <p className="s2s-preparation" role="status">{a.snapshot.preparation === 'rewriting' ? 'Qwen riscrive mentre MODEL A parla…' : a.snapshot.preparation === 'voice-ready' ? 'Battuta e audio pronti · attendo la fine MODEL A' : 'Battuta riscritta · preparo la voce in silenzio'}</p>}
          {current && <div className="s2s-current-turn"><h3>{['speaking', 'preparing-voice'].includes(a.snapshot.phase) ? 'Battuta in corso' : 'Prossima battuta'} · {a.snapshot.lineIndex + 1}</h3><small>{isS2SAdaptiveInstruction(current.original) ? 'INTENTO / ISTRUZIONE DEL TURNO' : 'ORIGINALE'}</small><p>{current.original}</p>{current.adapted ? <><small className="s2s-adapted-label">ADATTATA DA QWEN</small><p className="s2s-adapted-text">{current.text}</p></> : <p className="s2s-note">{a.snapshot.lineIndex === 0 ? 'La battuta di apertura usa il testo originale.' : 'In attesa della risposta e della riscrittura di Qwen.'}</p>}</div>}
          {a.snapshot.liveState && <details className="s2s-live-state"><summary>Stato attuale rilevato da Qwen</summary><p>{a.snapshot.liveState}</p></details>}
          {a.locked && <details className="s2s-live-state"><summary>Contesto usato · {a.snapshot.taskContext.adaptationLevel}</summary><p>{a.snapshot.taskContext.scenarioType}</p><p>{a.snapshot.scenario}</p><p>Skills tested: {a.snapshot.taskContext.skillsTested || 'Non specificate'}</p></details>}
          {turns.length > 0 && <details className="s2s-turns" open={a.snapshot.phase === 'completed'}><summary>Script della sessione · {a.snapshot.lineIndex}/{turns.length}</summary><ol>{turns.map((turn, index) => <li key={turn.id}><strong>{index + 1}. {turn.state === 'spoken' ? 'Pronunciata' : turn.state === 'partial' ? 'Interrotta' : 'Da pronunciare'} · {turn.adapted ? 'Adattata' : 'Originale'}</strong><p>{turn.text}</p>{turn.adapted && <details><summary>Originale</summary><p>{turn.original}</p></details>}</li>)}</ol></details>}
          {a.snapshot.phase === 'completed' && a.isSimulation && <p className="s2s-note">Prova completata. Le battute originali restano pronte per Outlier.</p>}
          {a.snapshot.log.length > 0 && <details className="s2s-history"><summary>Tempi, costi e decisioni</summary><p>OpenRouter ${a.snapshot.costUsd.toFixed(4)}{a.snapshot.costKnown ? '' : ' + costo non disponibile'} · Gemini escluso</p>{lastDecision && <p>Qwen: {lastDecision.qwenMs} ms</p>}{lastVoice && <p>Primo audio NEB: {lastVoice.firstAudioMs} ms</p>}<ol>{a.snapshot.log.slice(-30).map((entry, index) => <li key={index}><strong>{(entry.atMs / 1000).toFixed(1)}s · {entry.text}</strong>{entry.accepted === false && <span> · Scartata</span>}</li>)}</ol></details>}
        </aside>
      </div>
      <footer className="s2s-player-footer"><div className="s2s-controls">
        {a.active && <button className="secondary-button" onClick={a.pause}><Pause size={15} /> Pausa</button>}
        {a.snapshot.phase === 'paused' && <><button className="secondary-button" disabled={!canResume} onClick={() => a.resume()}><Play size={15} />{a.isSimulation ? 'Riprendi simulazione' : 'Riprendi ascolto'}</button>{a.snapshot.lineIndex < a.snapshot.total && <button className="text-button" disabled={!canResume} onClick={() => a.resume(true)}>Ripeti battuta pendente</button>}</>}
        {a.locked && <button className="secondary-button s2s-stop" onClick={a.stop}><Square size={15} /> Stop automatico</button>}
        {a.snapshot.log.length > 0 && <button className="text-button" onClick={a.exportLog}><Download size={15} /> Esporta cronologia</button>}
      </div><span>{a.locked ? 'Esc ferma la sessione · Riduci la lascia attiva' : 'Onde basate sull’audio · preparazione anticipata nella simulazione'}</span></footer>
    </section>
  </dialog>, document.body)
}
