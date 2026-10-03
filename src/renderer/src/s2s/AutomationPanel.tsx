import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Pause, Play, Square, FlaskConical, ArrowLeft, Minimize2, ArrowDown } from 'lucide-react'
import type { ReadyLine, ReadyLinesTab } from '../readyLines'
import { DEFAULT_S2S_OPTIONS, type S2SOptions } from './controller'
import type { S2SAutomation } from './useS2SAutomation'
import type { AudioOutput } from '../audio/AudioEngine'
import { conversationMessages, sessionLines } from './conversationView'
import { VoiceWave } from './VoiceWave'
import { DEFAULT_S2S_TASK_CONTEXT, isS2SAdaptiveInstruction, type S2STaskContext } from '../../../shared/s2s'

export function AutomationLauncher({ editorReady, onOpen }: { editorReady: boolean; onOpen: () => void }): React.JSX.Element {
  return <section className="s2s-launcher" aria-label="Conversazione S2S">
    <button className="secondary-button ready-save" disabled={!editorReady} title={editorReady ? 'Apri il player automatico con trascrizione e battute adattate' : 'Attendi la fine della preparazione prima di aprire il player'} onClick={onOpen}><Play size={14} /> Automatico</button>
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
  const transcriptPosition = useRef(0)
  const previousStarting = useRef(false)
  const [view, setView] = useState<'conversation' | 'script' | 'details' | 'configuration'>('configuration')
  const [following, setFollowing] = useState(true)
  const [source, setSource] = useState<'simulation' | 'outlier'>('simulation')
  const [scenario, setScenario] = useState('')
  const [taskContext, setTaskContext] = useState<S2STaskContext>(DEFAULT_S2S_TASK_CONTEXT)
  const [options, setOptions] = useState<S2SOptions>(DEFAULT_S2S_OPTIONS)
  const [simulationOutput, setSimulationOutput] = useState('')
  const localDevice = localOutputs.some((output) => output.deviceId === simulationOutput) ? simulationOutput : localOutputs[0]?.deviceId ?? ''
  const canResume = a.isSimulation ? simulationAvailable && localOutputs.length > 0 : available && a.receiving
  const pending = lines.filter((line) => !line.done).length
  const model = (view === 'configuration' || !a.snapshot.total ? tab : a.sessionTab) === 'modelB' ? 'MODEL B' : 'MODEL A'
  const messages = conversationMessages(a.snapshot)
  const turns = sessionLines(a.snapshot)
  const current = turns[a.snapshot.lineIndex]
  const views = [
    { id: 'conversation', label: 'Conversazione' }, { id: 'script', label: 'Script' },
    { id: 'details', label: 'Dettagli' }, { id: 'configuration', label: 'Configurazione' }
  ] as const
  const visibleViews = views.filter((item) => item.id !== 'configuration' || !a.locked)
  const status = a.starting ? 'Verifica configurazione…'
    : a.active && a.isSimulation && a.snapshot.simulationStage === 'text' ? 'MODEL A prepara la risposta…'
    : a.active && a.isSimulation && a.snapshot.simulationStage === 'voice' ? 'Preparo la voce di MODEL A…'
    : a.active && a.isSimulation && a.snapshot.simulationStage === 'playing' ? 'MODEL A sta parlando'
    : a.snapshot.phase === 'adapting' || a.snapshot.preparation === 'rewriting' ? 'Adatto la prossima battuta alla risposta…'
    : a.snapshot.phase === 'preparing-voice' ? 'Preparo la tua voce…'
    : a.snapshot.message
  const lastDecision = [...a.snapshot.log].reverse().find((item) => item.qwenMs !== undefined && item.accepted)
  const lastVoice = [...a.snapshot.log].reverse().find((item) => item.firstAudioMs !== undefined)
  useEffect(() => { if (a.locked) setView('conversation') }, [a.locked])
  useEffect(() => {
    if (previousStarting.current && !a.starting && !a.locked) setView('configuration')
    previousStarting.current = a.starting
  }, [a.starting, a.locked])
  useEffect(() => {
    followTranscript.current = true; transcriptPosition.current = 0; setFollowing(true)
  }, [a.snapshot.script])
  useEffect(() => {
    if (open) setView(a.snapshot.total ? 'conversation' : 'configuration')
    // Opening the player restores the conversation; switching tabs stays local.
  }, [open, a.snapshot.total])
  useEffect(() => {
    const element = dialog.current
    if (!element || !open) return
    element.showModal()
    return () => element.close()
  }, [open])
  useEffect(() => {
    const element = transcript.current
    if (open && element) element.scrollTop = followTranscript.current ? element.scrollHeight : transcriptPosition.current
  }, [open, view, a.snapshot.log, a.snapshot.phase])
  if (!open) return null
  return createPortal(<dialog ref={dialog} className="s2s-dialog" aria-labelledby="s2s-heading" data-no-speech-shortcuts onKeyDown={(event) => { if (event.key === 'Escape') event.stopPropagation() }} onCancel={(event) => { event.preventDefault(); a.stop(); onClose() }}>
    <section className="s2s-player" aria-label="Conversazione automatica S2S">
      <header className="s2s-player-header">
        <div><span className="eyebrow">NEB VOICE / S2S</span><h2 id="s2s-heading">Conversazione automatica</h2><p>{view === 'configuration' ? 'Prepara la sessione' : a.snapshot.total ? a.isSimulation ? 'Simulazione' : 'Outlier / Edge' : 'Prepara la sessione'} · {model}</p></div>
        {a.locked ? <button className="secondary-button" onClick={onClose}><Minimize2 size={15} /> Riduci</button> : <button className="secondary-button" onClick={onScript}><ArrowLeft size={15} /> Torna alle battute</button>}
      </header>
      <div className="s2s-player-tabs" role="tablist" aria-label="Viste della sessione" onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const index = visibleViews.findIndex((item) => item.id === view)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? visibleViews.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + visibleViews.length) % visibleViews.length
        setView(visibleViews[next].id)
        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
      }}>
        {visibleViews.map((item) => <button key={item.id} role="tab" id={`s2s-tab-${item.id}`} aria-controls={`s2s-view-${item.id}`} aria-selected={view === item.id} tabIndex={view === item.id ? 0 : -1} onClick={() => setView(item.id)}>{item.label}</button>)}
      </div>
      {(a.locked || (a.snapshot.total > 0 && view !== 'configuration')) && <div className={`s2s-player-status ${a.snapshot.phase === 'paused' ? 'paused' : ''}`}>
        <span className={`status-dot ${a.active || a.snapshot.phase === 'completed' ? 'green' : 'amber'}`} /><p role="status">{status}</p>
        <div className="s2s-progress"><strong>{a.snapshot.lineIndex}/{a.snapshot.total} battute completate</strong><progress aria-label="Battute completate" value={a.snapshot.lineIndex} max={a.snapshot.total || 1} /></div>
      </div>}
      {a.error && <p className="notice error" role="alert">{a.error}</p>}
      {view === 'conversation' && a.snapshot.total > 0 && <div className="s2s-speakers" aria-label="Attività audio">
        <article className={`s2s-speaker neb ${a.snapshot.phase === 'speaking' ? 'speaking' : ''}`}><strong>Tu · NEB</strong><VoiceWave speaker="neb" enabled={a.active} getActivity={a.getVoiceActivity} /></article>
        <article className="s2s-speaker model"><strong>{a.isSimulation ? 'MODEL A · simulato' : model}</strong><VoiceWave speaker="model" enabled={a.active} getActivity={a.getVoiceActivity} /></article>
      </div>}
      <div className="s2s-player-body">
        <section className={`s2s-view s2s-view-${view}`} id={`s2s-view-${view}`} role="tabpanel" aria-labelledby={`s2s-tab-${view}`} tabIndex={0}>
        {view === 'conversation' && <div className="s2s-conversation">
          <div ref={transcript} className="s2s-transcript" role="log" aria-label="Trascrizione della conversazione" aria-live="polite" onScroll={(event) => {
            const e = event.currentTarget, follows = e.scrollHeight - e.scrollTop - e.clientHeight < 80
            transcriptPosition.current = e.scrollTop; followTranscript.current = follows; setFollowing(follows)
          }}>
            {!messages.length && <div className="s2s-empty"><h3>La conversazione apparirà qui</h3><p>Configura la sessione, poi avvia la simulazione o collega Outlier.</p></div>}
            {messages.map((item) => <article key={item.id} className={`s2s-message ${item.role}`}>
              <div><strong>{item.role === 'neb' ? 'Tu · NEB' : model}</strong><span>{item.state === 'partial' ? 'Interrotta' : item.state === 'simulated' ? 'Testo simulato · audio da verificare' : item.state === 'text' ? 'Testo simulato' : item.state === 'transcribed' ? 'Trascrizione audio' : item.state === 'speaking' ? 'In riproduzione' : item.role === 'neb' && item.original && item.original !== item.text ? 'Adattata' : ''}</span></div>
              <p>{item.text}</p>
              {item.original && item.original !== item.text && <details><summary>Vedi battuta originale</summary><p>{item.original}</p></details>}
            </article>)}
          </div>
          {!following && <button className="secondary-button s2s-follow" onClick={() => {
            followTranscript.current = true; setFollowing(true)
            if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight
          }}><ArrowDown size={14} /> Vai all’ultimo messaggio</button>}
          {a.locked && current && ['ready', 'voice-ready'].includes(a.snapshot.preparation) && <div className="s2s-next-preview"><div><strong>Prossima battuta pronta</strong><p>{current.text}</p></div><button className="text-button" onClick={() => setView('script')}>Vedi script</button></div>}
        </div>}
        {view === 'configuration' && !a.locked && <div className="s2s-configuration-page"><div className="s2s-view-heading"><h3>Prepara la conversazione</h3><p>Scegli dove provarla e aggiungi le istruzioni che Qwen userà per adattare le battute.</p></div><div className="s2s-setup-grid">
          <div className="s2s-setup">
            <h3>Avvio</h3><div className="s2s-source" role="group" aria-label="Sorgente della conversazione"><button aria-pressed={source === 'simulation'} onClick={() => setSource('simulation')}>Simulazione</button><button aria-pressed={source === 'outlier'} onClick={() => setSource('outlier')}>Outlier / Edge</button></div>
            {source === 'simulation' ? <div className="s2s-simulation-config"><label>Uscita simulazione · cuffie / altoparlanti<select aria-label="Uscita simulazione" value={localDevice} onChange={(event) => setSimulationOutput(event.target.value)}>{!localOutputs.length && <option value="">Collega cuffie o altoparlanti reali</option>}{localOutputs.map((output) => <option key={output.deviceId} value={output.deviceId}>{output.label}</option>)}</select></label><p className="s2s-note">Prova locale con un MODEL A simulato e una voce distinta. Le battute originali restano disponibili per Outlier.</p></div> : <p className="s2s-note">{available ? a.receiving ? 'Audio della scheda collegato. Pronto per Outlier.' : a.audioStatus.message : unavailableReason}</p>}
            {!pending && <p className="s2s-note">Importa o aggiungi battute dallo script per avviare.</p>}
            {!a.providerReady && <p className="s2s-note">Configura OPENROUTER_API_KEY in .env.local e riavvia NEB.</p>}
            {source === 'simulation' && <label className="s2s-anticipate"><input type="checkbox" checked={options.anticipateText} onChange={(event) => setOptions({ ...options, anticipateText: event.target.checked })} /> Prepara battuta e voce mentre MODEL A parla</label>}
            {source === 'outlier' && <p className="s2s-note">La prossima battuta viene adattata dopo la fine della risposta e il silenzio configurato.</p>}

          </div>
          <details className="s2s-configuration s2s-task-context" open><summary>Contesto della task</summary>
            <div className="s2s-field"><label htmlFor="s2s-scenario">What to do / Scenario</label><textarea id="s2s-scenario" maxLength={4000} value={scenario} onChange={(event) => setScenario(event.target.value)} placeholder="Incolla le istruzioni della task e il ruolo da interpretare." /></div>
            <label>Tipo di scenario<input maxLength={300} value={taskContext.scenarioType} onChange={(event) => setTaskContext({ ...taskContext, scenarioType: event.target.value })} placeholder="Es. Knowledge & Learning · IQ-focused" /></label>
            <div className="s2s-field"><label htmlFor="s2s-skills">Skills tested</label><textarea id="s2s-skills" maxLength={4000} value={taskContext.skillsTested} onChange={(event) => setTaskContext({ ...taskContext, skillsTested: event.target.value })} placeholder="Es. guida pedagogica, metodo socratico, analisi letteraria" /></div>
            <details className="s2s-advanced-context"><summary>Adattamento e materiale · {taskContext.adaptationLevel}</summary>
            <label>Adattamento<select value={taskContext.adaptationLevel} onChange={(event) => setTaskContext({ ...taskContext, adaptationLevel: event.target.value as S2STaskContext['adaptationLevel'] })}><option value="L1">L1 · Adatta alla risposta (conversazioni)</option><option value="L2">L2 · Segui lo stato (improv / roleplay)</option><option value="L0">L0 · Testo fisso richiesto dalla task</option></select></label>
            <label>Minimo turni utente richiesti (facoltativo)<input type="number" min={1} max={100} value={taskContext.minimumUserTurns ?? ''} onChange={(event) => setTaskContext({ ...taskContext, minimumUserTurns: event.target.value ? Number(event.target.value) : null })} /></label>
            <details><summary>Materiale preparato / brano (facoltativo)</summary><div className="s2s-field"><label htmlFor="s2s-material">Materiale preparato</label><textarea id="s2s-material" maxLength={12000} value={taskContext.material} onChange={(event) => setTaskContext({ ...taskContext, material: event.target.value })} placeholder="Il brano scelto o i fatti necessari: Qwen deve usare questo materiale senza inventarlo." /></div></details>
            </details>
            <p>Qwen segue le istruzioni e le skills della task. In L2 i turni sono intenti da realizzare nella scena attuale; le istruzioni ADAPT LIVE non vengono pronunciate.</p>
          </details>
      <details className="s2s-configuration s2s-limits">
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
      </details>

        </div></div>}
        {view === 'script' && <div className="s2s-script-page"><div className="s2s-view-heading"><h3>Le tue battute</h3><p>Obiettivo e ordine conservati. Puoi confrontare le riscritture con il testo originale.</p></div>
          {current && <div className="s2s-current-turn"><h3>{['speaking', 'preparing-voice'].includes(a.snapshot.phase) ? 'Battuta in corso' : 'Prossima battuta'} · {a.snapshot.lineIndex + 1}</h3><small>{isS2SAdaptiveInstruction(current.original) ? 'INTENTO / ISTRUZIONE DEL TURNO' : 'ORIGINALE'}</small><p>{current.original}</p>{current.adapted ? <><small className="s2s-adapted-label">ADATTATA DA QWEN</small><p className="s2s-adapted-text">{current.text}</p></> : <p className="s2s-note">{a.snapshot.lineIndex === 0 ? 'La battuta di apertura usa il testo originale.' : 'In attesa della risposta e della riscrittura di Qwen.'}</p>}</div>}
          {turns.length > 0 && <details className="s2s-turns" open><summary>Script della sessione · {a.snapshot.lineIndex}/{turns.length}</summary><ol>{turns.map((turn, index) => <li key={turn.id}><strong>{index + 1}. {turn.state === 'spoken' ? 'Pronunciata' : turn.state === 'partial' ? 'Interrotta' : 'Da pronunciare'} · {turn.adapted ? 'Adattata' : 'Originale'}</strong><p>{turn.text}</p>{turn.adapted && <details><summary>Originale</summary><p>{turn.original}</p></details>}</li>)}</ol></details>}

          {!turns.length && <ol className="s2s-draft-lines">{lines.filter((line) => !line.done).map((line, index) => <li key={line.id}><strong>Battuta {index + 1}</strong><p>{line.text}</p></li>)}</ol>}
          {!turns.length && !pending && <p className="s2s-note">Aggiungi le battute prima di avviare la sessione.</p>}
        </div>}
        {view === 'details' && <div className="s2s-details-page"><div className="s2s-view-heading"><h3>Dettagli della sessione</h3><p>Contesto, tempi e motivi delle decisioni.</p>{a.snapshot.log.length > 0 && <button className="secondary-button" onClick={a.exportLog}><Download size={15} /> Esporta cronologia</button>}</div>
          {a.snapshot.total > 0 && <details className="s2s-live-state"><summary>Contesto usato · {a.snapshot.taskContext.adaptationLevel}</summary><p>{a.snapshot.taskContext.scenarioType}</p><p>{a.snapshot.scenario}</p><p>Skills tested: {a.snapshot.taskContext.skillsTested || 'Non specificate'}</p>{a.snapshot.taskContext.material && <p>{a.snapshot.taskContext.material}</p>}</details>}
          {a.snapshot.liveState && <details className="s2s-live-state"><summary>Stato attuale rilevato da Qwen</summary><p>{a.snapshot.liveState}</p></details>}
          {a.snapshot.total > 0 && <p className="s2s-note">Stato: {a.snapshot.message}{a.isSimulation && a.simulationMessage ? ` · ${a.simulationMessage}` : ''}</p>}
          {a.snapshot.log.length > 0 && <details className="s2s-history" open><summary>Tempi, costi e decisioni</summary><p>OpenRouter ${a.snapshot.costUsd.toFixed(4)}{a.snapshot.costKnown ? '' : ' + costo non disponibile'} · Gemini escluso</p>{lastDecision && <p>Qwen: {lastDecision.qwenMs} ms</p>}{lastVoice && <p>Primo audio NEB: {lastVoice.firstAudioMs} ms</p>}<ol>{a.snapshot.log.slice(-30).map((entry, index) => <li key={index}><strong>{(entry.atMs / 1000).toFixed(1)}s · {entry.text}</strong>{entry.accepted === false && <span> · Scartata</span>}{entry.validationIssue && <p>Controllo Qwen: {entry.validationIssue}{entry.repairAttempted ? ' · Correzione testuale tentata una volta.' : ' · Nessuna correzione automatica avviata.'}</p>}</li>)}</ol></details>}
          {!a.snapshot.log.length && <p className="s2s-note">Tempi e decisioni saranno disponibili dopo l’avvio.</p>}
        </div>}
        </section>
      </div>
      <footer className="s2s-player-footer"><div className="s2s-controls">
        {!a.locked && view !== 'configuration' && <button className="secondary-button" onClick={() => setView('configuration')}>{a.snapshot.total ? 'Nuova sessione' : 'Configura sessione'}</button>}
        {a.active && <button className="secondary-button" onClick={a.pause}><Pause size={15} /> Pausa</button>}
        {a.snapshot.phase === 'paused' && <><button className="secondary-button" disabled={!canResume} onClick={() => a.resume()}><Play size={15} />{a.isSimulation ? 'Riprendi simulazione' : 'Riprendi ascolto'}</button>{a.snapshot.lineIndex < a.snapshot.total && <button className="text-button" disabled={!canResume} onClick={() => a.resume(true)}>Ripeti battuta pendente</button>}</>}
        {a.locked && <button className="secondary-button s2s-stop" onClick={a.stop}><Square size={15} /> Stop automatico</button>}
        {view === 'configuration' && !a.locked && <button className="primary-button s2s-start" disabled={a.starting || !pending || (source === 'simulation' ? !simulationAvailable || !localDevice : !available || !a.receiving)} onClick={() => void (source === 'simulation' ? a.startSimulation(lines, scenario, options, localDevice, taskContext) : a.start(lines, scenario, options, taskContext))}>{source === 'simulation' ? <FlaskConical size={15} /> : <Play size={15} />}{source === 'simulation' ? 'Simulazione MODEL A' : `Avvia ${model} · ${pending} battute`}</button>}
      </div><span>{a.locked ? 'Esc ferma la sessione · Riduci la lascia attiva' : view === 'configuration' ? `${pending} battute pronte · ${model}` : 'Le riscritture sono visibili nella conversazione'}</span></footer>
    </section>
  </dialog>, document.body)
}
