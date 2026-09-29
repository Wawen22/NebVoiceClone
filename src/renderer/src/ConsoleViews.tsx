import type { RefObject } from 'react'
import { Icon } from './Icons'
import { ListMusic } from 'lucide-react'
import type { AudioOutput } from './audio/AudioEngine'
import type { AppSettings, ConversationModeStatus, ProviderStatus } from '../../shared/contracts'
import { GEMINI_MODELS, GEMINI_PREBUILT_VOICES } from '../../shared/contracts'
import { conversationShortcutLabel, type RoutingStatus } from './conversationMode'

export type Metrics = { firstChunkMs: number; generationMs: number; durationSeconds: number; playbackMs?: number }

interface ConsoleProps {
  settings: AppSettings
  activeKeyName: string
  gemini: ProviderStatus
  script: string
  readyLinesCount: number
  onOpenReadyLines: () => void
  onScriptChange: (value: string) => void
  scriptInput: RefObject<HTMLTextAreaElement | null>
  outputs: AudioOutput[]
  routing: RoutingStatus
  isLinux: boolean
  virtualOutput: AudioOutput | undefined
  busy: boolean
  playing: boolean
  hasAudio: boolean
  status: string
  error: string
  metrics: Metrics | null
  fileName: string
  duration: number | null
  onSpeak: (text?: string) => void
  onStop: () => void
  onReplay: () => void
  onUpdate: (patch: Partial<AppSettings>) => void
  onPreviewVolume: (volume: number) => void
  onRefreshOutputs: () => void
  onLoadFile: (file: File | undefined) => void
  onPlayFile: () => void
  onOpenConversation: () => void
}

const testPhrase = 'Questa è una prova audio di NEB Voice Console.'

export function ConsoleView(props: ConsoleProps): React.JSX.Element {
  const { settings, activeKeyName, gemini, script, readyLinesCount, onOpenReadyLines, onScriptChange, scriptInput, outputs, routing, isLinux, virtualOutput, busy, playing, hasAudio, status, error, metrics, fileName, duration, onSpeak, onStop, onReplay, onUpdate, onPreviewVolume, onRefreshOutputs, onLoadFile, onPlayFile, onOpenConversation } = props
  const selectedVoice = settings.replicatedVoice?.id === settings.geminiVoiceId ? settings.replicatedVoice.displayName : settings.geminiVoiceId
  const estimatedSeconds = script.trim() ? Math.max(1, Math.ceil(script.trim().split(/\s+/).length / 2.5)) : 0
  const virtualName = isLinux ? 'NEB Voice' : 'CABLE Input'

  return <div className="console-page">
    <div className="console-heading">
      <div><span className="eyebrow">CONSOLE / GENERAZIONE</span><h2>Dai voce alle tue parole.</h2><p>Scrivi esattamente ciò che vuoi dire. La voce parte sul dispositivo selezionato.</p></div>
      <div className="console-heading-actions"><button className="secondary-button" onClick={onOpenReadyLines}><ListMusic size={16} /> Battute pronte <span className="ready-count">{readyLinesCount}</span></button><button className="conversation-trigger" aria-keyshortcuts="Control+Alt+V" onClick={onOpenConversation}><Icon name="external" /> Modalità conversazione <kbd>Ctrl+Alt+V</kbd></button></div>
    </div>

    <div className="console-grid">
      <section className="editor-card" aria-labelledby="script-heading">
        <div className="card-heading"><div><span className="eyebrow">01 / TESTO</span><h3 id="script-heading">Il tuo messaggio</h3></div><span className={playing ? 'subtle-badge playing' : 'subtle-badge'}>{playing ? <><VoiceWave /> In riproduzione</> : 'Testo esatto'}</span></div>
        <textarea ref={scriptInput} aria-label="Testo da pronunciare" value={script} onChange={(event) => onScriptChange(event.target.value)} placeholder="Scrivi o incolla qui le parole da pronunciare…" />
        <div className="editor-meta"><span>{script.length} caratteri</span><span>{estimatedSeconds ? `~${estimatedSeconds} s stimati` : 'Pronto per scrivere'}</span></div>
        <ActionButtons busy={busy} ready={gemini.ready} hasAudio={hasAudio} hasScript={Boolean(script.trim())} onSpeak={() => onSpeak()} onStop={onStop} onReplay={onReplay} />
        <StatusNotice error={error} status={status} playing={playing} />
        <MetricDetails metrics={metrics} />
      </section>

      <aside className="console-side" aria-label="Controlli voce e audio">
        <section className="control-card">
          <span className="eyebrow">02 / VOCE</span><h3>Come suona</h3>
          <label className="field">Voce<select value={settings.geminiVoiceId} onChange={(event) => onUpdate({ geminiVoiceId: event.target.value })}>{GEMINI_PREBUILT_VOICES.map((voice) => <option key={voice} value={voice}>{voice} · predefinita</option>)}{settings.replicatedVoice && <option value={settings.replicatedVoice.id}>{settings.replicatedVoice.displayName} · personale</option>}</select></label>
          <p className="field-note">Solo {activeKeyName}: <strong>{selectedVoice}</strong></p>
          <label className="field">Modello<select value={settings.geminiModel} onChange={(event) => onUpdate({ geminiModel: event.target.value as AppSettings['geminiModel'] })}>{GEMINI_MODELS.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>
          <p className="field-note">Modello condiviso tra le chiavi.</p>
        </section>

        <section className="control-card routing-card">
          <div className="card-heading"><div><span className="eyebrow">03 / USCITA</span><h3>Dove si sente</h3></div><button className="icon-button" aria-label="Aggiorna dispositivi audio" title="Aggiorna dispositivi audio" onClick={onRefreshOutputs}><Icon name="refresh" /></button></div>
          <div className={routing.routed ? 'route-status ready' : 'route-status'}><span className="status-dot" /><div><strong>{routing.routed ? `${virtualName} selezionato` : 'Routing da verificare'}</strong><p>{routing.message}</p></div></div>
          <label className="field">Dispositivo di uscita<select value={settings.outputDeviceId} onChange={(event) => onUpdate({ outputDeviceId: event.target.value })}>{!outputs.some((output) => output.deviceId === settings.outputDeviceId) && <option value={settings.outputDeviceId}>{outputLabel(outputs, settings.outputDeviceId)}</option>}{outputs.map((output) => <option key={output.deviceId} value={output.deviceId}>{output.label}</option>)}</select></label>
          <label className="field volume-field"><span><Icon name={settings.outputVolume === 0 ? 'mute' : 'speaker'} /> Volume di uscita <strong>{Math.round(settings.outputVolume * 100)}%</strong></span><input aria-label="Volume di uscita" type="range" min="0" max="1" step="0.05" value={settings.outputVolume} onChange={(event) => onPreviewVolume(Number(event.target.value))} onPointerUp={(event) => onUpdate({ outputVolume: Number(event.currentTarget.value) })} onKeyUp={(event) => onUpdate({ outputVolume: Number(event.currentTarget.value) })} onBlur={(event) => onUpdate({ outputVolume: Number(event.currentTarget.value) })} /></label>
          <p className="field-note">Uscita e volume condivisi tra le chiavi.</p>
          {!outputs.some((output) => output.deviceId === settings.outputDeviceId) && settings.outputDeviceId !== 'default' && virtualOutput && <button className="secondary-button" onClick={() => onUpdate({ outputDeviceId: virtualOutput.deviceId })}>Usa {virtualName}</button>}
          <details className="support-details"><summary>Test e istruzioni di routing</summary>
            <p>NEB può verificare il dispositivo selezionato. Controlla il microfono di Edge con una registrazione di prova.</p>
            <button className="secondary-button" disabled={!gemini.ready || busy || !routing.routed} onClick={() => onSpeak(testPhrase)}><Icon name="play" /> Pronuncia frase di prova</button>
            <ol><li>Seleziona {virtualName} come uscita in NEB.</li><li>In Edge scegli {isLinux ? 'Monitor of NEB Voice' : 'CABLE Output'} come microfono.</li><li>Registra la frase e riascoltala in Edge.</li></ol>
            {isLinux ? <p>Per ascoltare NEB, instrada il monitor di NEB Voice verso le cuffie. Le istruzioni complete sono nella Guida.</p> : <p>Per ascoltare NEB nelle cuffie, apri <code>mmsys.cpl</code> → Registrazione → CABLE Output → Ascolta e scegli le cuffie.</p>}
            <div className="local-test"><strong>Test WAV locale</strong><div className="file-row"><label className="file-button"><Icon name="upload" /> Scegli WAV<input type="file" accept=".wav,audio/wav" disabled={busy} onChange={(event) => { onLoadFile(event.target.files?.[0]); event.target.value = '' }} /></label><button className="secondary-button" onClick={onPlayFile} disabled={!fileName || busy}><Icon name="play" /> Riproduci</button></div><span className="file-name">{fileName || 'Nessun file selezionato'}{duration !== null ? ` · ${duration.toFixed(1)} s` : ''}</span></div>
          </details>
        </section>
      </aside>
    </div>
    <div className="shortcut-strip"><span>Scorciatoie</span><kbd>Ctrl + Invio</kbd> pronuncia <kbd>Esc</kbd> interrompi <kbd>Ctrl + R</kbd> riascolta <kbd>Ctrl + Alt + V</kbd> conversazione <kbd>Ctrl + Alt + S</kbd> stop globale</div>
  </div>
}

interface ConversationProps extends Pick<ConsoleProps, 'settings' | 'activeKeyName' | 'gemini' | 'script' | 'readyLinesCount' | 'onOpenReadyLines' | 'onScriptChange' | 'scriptInput' | 'routing' | 'isLinux' | 'busy' | 'playing' | 'hasAudio' | 'status' | 'error' | 'metrics' | 'onSpeak' | 'onStop' | 'onReplay'> {
  conversationStatus: ConversationModeStatus | null
  onClose: () => void
}

export function ConversationView(props: ConversationProps): React.JSX.Element {
  const { settings, gemini, script, readyLinesCount, onOpenReadyLines, onScriptChange, scriptInput, routing, isLinux, busy, playing, hasAudio, status, error, metrics, onSpeak, onStop, onReplay, conversationStatus, onClose } = props
  const voice = settings.replicatedVoice?.id === settings.geminiVoiceId ? settings.replicatedVoice.displayName : settings.geminiVoiceId
  return <main className="conversation-shell">
    <header className="conversation-header"><div><span className="eyebrow">NEB VOICE / CONVERSAZIONE</span><h1>Scrivi. Pronuncia.</h1></div><div className="conversation-header-actions"><button className="secondary-button" onClick={onOpenReadyLines}><ListMusic size={15} /> Battute <span className="ready-count">{readyLinesCount}</span></button><button className="conversation-exit" aria-label="Esci dalla modalità conversazione, Ctrl+Alt+V" aria-keyshortcuts="Control+Alt+V" onClick={onClose}><Icon name="close" /> Esci <kbd>Ctrl+Alt+V</kbd></button></div></header>
    <div className="conversation-statuses"><div><span>VOCE</span><strong>{voice}</strong></div><div><span>USCITA</span><strong><i className={routing.routed ? 'status-dot green' : 'status-dot amber'} />{routing.routed ? isLinux ? 'NEB Voice' : 'CABLE Input' : routing.label}</strong></div></div>
    <label className="conversation-label" htmlFor="conversation-script">Messaggio</label>
    <textarea id="conversation-script" ref={scriptInput} value={script} onChange={(event) => onScriptChange(event.target.value)} placeholder="Scrivi o incolla la tua risposta…" />
    <div className="conversation-meta"><span>{script.length} caratteri</span><span>Il testo resta in memoria</span></div>
    <ActionButtons compact busy={busy} ready={gemini.ready} hasAudio={hasAudio} hasScript={Boolean(script.trim())} onSpeak={() => onSpeak()} onStop={onStop} onReplay={onReplay} />
    <StatusNotice error={error} status={status} playing={playing} />
    <details className="conversation-detail"><summary>Routing e scorciatoie</summary><p>{routing.message}</p><p>{conversationShortcutLabel(conversationStatus)}</p><MetricDetails metrics={metrics} /></details>
  </main>
}

function ActionButtons({ busy, ready, hasAudio, hasScript, onSpeak, onStop, onReplay, compact = false }: { busy: boolean; ready: boolean; hasAudio: boolean; hasScript: boolean; onSpeak: () => void; onStop: () => void; onReplay: () => void; compact?: boolean }): React.JSX.Element {
  return <div className={compact ? 'action-row compact-actions' : 'action-row'}><button className="primary" aria-keyshortcuts="Control+Enter" disabled={!ready || !hasScript || busy} onClick={onSpeak}>{busy ? <span className="spinner" /> : <Icon name="play" />} {busy ? 'Genero…' : 'Pronuncia'} <kbd>Ctrl+Invio</kbd></button><button aria-keyshortcuts="Escape" onClick={onStop}><Icon name="stop" /> Stop <kbd>Esc</kbd></button><button aria-keyshortcuts="Control+R" onClick={onReplay} disabled={!hasAudio || busy}><Icon name="replay" /> Riascolta <kbd>Ctrl+R</kbd></button></div>
}

function StatusNotice({ error, status, playing }: { error: string; status: string; playing: boolean }): React.JSX.Element {
  return <div className={error ? 'notice error' : playing ? 'notice speaking' : 'notice'} role={error ? 'alert' : 'status'}>
    <span className="notice-indicator" aria-hidden="true">{playing && !error ? <VoiceWave /> : <span className="status-dot" />}</span>
    <span>{error || status}</span>
  </div>
}

function VoiceWave(): React.JSX.Element {
  return <span className="voice-wave" aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <span key={index} />)}</span>
}

function MetricDetails({ metrics }: { metrics: Metrics | null }): React.JSX.Element | null {
  if (!metrics) return null
  return <details className="metric-details"><summary>Dettagli generazione</summary><div className="metrics"><span>Primo audio <strong>{metrics.firstChunkMs} ms</strong></span><span>Generazione <strong>{metrics.generationMs} ms</strong></span><span>Durata <strong>{metrics.durationSeconds.toFixed(1)} s</strong></span>{metrics.playbackMs !== undefined && <span>Riproduzione <strong>{metrics.playbackMs} ms</strong></span>}</div></details>
}

function outputLabel(outputs: AudioOutput[], deviceId: string): string {
  return outputs.find((output) => output.deviceId === deviceId)?.label ?? (deviceId === 'default' ? 'Predefinito di sistema' : 'Dispositivo salvato non disponibile')
}
