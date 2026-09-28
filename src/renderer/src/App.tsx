import { useEffect, useRef, useState } from 'react'
import { BrowserAudioEngine, type AudioOutput } from './audio/AudioEngine'
import { VoiceReplicationWizard } from './VoiceReplicationWizard'
import { Icon } from './Icons'
import { SetupGuide } from './SetupGuide'
import { DEFAULT_SETTINGS, GEMINI_MODELS, GEMINI_PREBUILT_VOICES, type AppInfo, type AppSettings, type ConversationModeStatus, type ProviderStatus } from '../../shared/contracts'
import { conversationShortcutLabel, routingStatus } from './conversationMode'

type Page = 'console' | 'settings' | 'guide' | 'diagnostics'
type Metrics = { firstAudioMs: number; generationMs: number; durationSeconds: number; playbackMs?: number }

export function App(): React.JSX.Element {
  const [page, setPage] = useState<Page>('console')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [gemini, setGemini] = useState<ProviderStatus>({ ready: false, message: 'Checking Gemini…' })
  const [script, setScript] = useState('')
  const [outputs, setOutputs] = useState<AudioOutput[]>([])
  const [fileName, setFileName] = useState('')
  const [duration, setDuration] = useState<number | null>(null)
  const [status, setStatus] = useState('Ready for local audio test')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasAudio, setHasAudio] = useState(false)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [conversationMode, setConversationMode] = useState(false)
  const [conversationStatus, setConversationStatus] = useState<ConversationModeStatus | null>(null)
  const [voiceProfileMessage, setVoiceProfileMessage] = useState('')
  const [voiceProfileBusy, setVoiceProfileBusy] = useState(false)
  const audio = useRef(new BrowserAudioEngine())
  const requestId = useRef(0)
  const playbackStartedAt = useRef<number | null>(null)
  const scriptInput = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    void Promise.all([window.neb.getAppInfo(), window.neb.getSettings()])
      .then(([nextInfo, nextSettings]) => { setInfo(nextInfo); audio.current.setVolume(nextSettings.outputVolume); setSettings(nextSettings) })
      .catch((reason: unknown) => setError(message(reason)))
    void refreshOutputs()
    void checkGemini()
    audio.current.onEnded(() => {
      setStatus('Playback finished')
      if (playbackStartedAt.current !== null) {
        const playbackMs = Math.round(performance.now() - playbackStartedAt.current)
        setMetrics((previous) => previous ? { ...previous, playbackMs } : null)
      }
    })
    const onDeviceChange = (): void => { void refreshOutputs() }
    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange)
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange)
      audio.current.dispose()
    }
  }, [])

  useEffect(() => {
    if (conversationMode) scriptInput.current?.focus()
  }, [conversationMode])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') stop()
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault()
        void speak()
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'r') {
        event.preventDefault()
        void replay()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [settings, script, busy, gemini.ready, hasAudio])

  useEffect(() => window.neb.onConversationRequested(() => { void enterConversationMode() }), [])
  useEffect(() => window.neb.onStopRequested(stop), [])

  async function checkGemini(): Promise<void> {
    try { setGemini(await window.neb.checkGemini()) }
    catch (reason) { setGemini({ ready: false, message: message(reason) }) }
  }

  async function refreshOutputs(): Promise<void> {
    try {
      const found = await audio.current.listOutputs()
      setOutputs(found)
      if (found.length === 0) setError('No audio output device is available here. Open the native Windows app to hear playback.')
    } catch (reason) {
      setError(`Audio devices could not be listed: ${message(reason)}`)
    }
  }

  async function update(patch: Partial<AppSettings>): Promise<void> {
    try {
      const next = await window.neb.updateSettings(patch)
      audio.current.setVolume(next.outputVolume)
      setSettings(next)
      setError('')
    } catch (reason) { setError(message(reason)) }
  }

  function previewOutputVolume(volume: number): void {
    audio.current.setVolume(volume)
    setSettings((current) => ({ ...current, outputVolume: volume }))
  }

  async function loadFile(file: File | undefined): Promise<void> {
    if (!file) return
    try {
      const seconds = await audio.current.load(file)
      setDuration(seconds)
      setFileName(file.name)
      setHasAudio(true)
      setMetrics(null)
      setStatus('Local WAV ready')
      setError('')
    } catch (reason) { setError(message(reason)) }
  }

  async function play(): Promise<void> {
    try {
      await audio.current.play(settings.outputDeviceId)
      playbackStartedAt.current = performance.now()
      setStatus(`Playing on ${selectedOutputLabel(outputs, settings.outputDeviceId)}`)
      setError('')
    } catch (reason) { setError(`Playback failed: ${message(reason)}`) }
  }

  async function replay(): Promise<void> {
    if (!hasAudio) return
    try {
      await audio.current.replay(settings.outputDeviceId)
      playbackStartedAt.current = performance.now()
      setStatus('Replaying local WAV')
      setError('')
    } catch (reason) { setError(`Replay failed: ${message(reason)}`) }
  }

  async function speak(): Promise<void> {
    if (busy || !gemini.ready || !script.trim()) return
    if (outputs.length === 0) {
      setError('No audio output device is available here. Open the native Windows app before generating speech.')
      return
    }
    const current = ++requestId.current
    const started = performance.now()
    setBusy(true)
    setStatus('Generating with Gemini…')
    setError('')
    audio.current.stop()
    try {
      const result = await window.neb.synthesize({
        providerId: 'gemini', modelId: settings.geminiModel, text: script,
        voice: settings.replicatedVoice?.id === settings.geminiVoiceId ? { mode: 'stateful', voiceId: settings.geminiVoiceId } : { mode: 'prebuilt', voiceId: settings.geminiVoiceId }
      })
      if (current !== requestId.current) return
      const firstAudioMs = Math.round(performance.now() - started)
      const durationSeconds = await audio.current.loadBytes(result.data, result.mimeType)
      if (current !== requestId.current) return
      setHasAudio(true)
      setMetrics({ firstAudioMs, generationMs: result.generationMs, durationSeconds })
      setStatus('Starting playback…')
      await audio.current.play(settings.outputDeviceId)
      playbackStartedAt.current = performance.now()
      setStatus(`Playing on ${selectedOutputLabel(outputs, settings.outputDeviceId)}`)
    } catch (reason) {
      if (current === requestId.current) { setError(message(reason)); setStatus('Generation failed') }
    } finally { if (current === requestId.current) setBusy(false) }
  }

  function stop(): void {
    requestId.current++
    audio.current.stop()
    playbackStartedAt.current = null
    setBusy(false)
    setStatus('Stopped')
    void window.neb.stopGeneration().catch((reason: unknown) => setError(message(reason)))
  }

  async function toggleConversationMode(): Promise<void> {
    try {
      const next = await window.neb.setConversationMode(!conversationMode)
      setConversationMode(next.enabled)
      setConversationStatus(next)
      setError('')
    } catch (reason) {
      setError(`Conversation mode could not be changed: ${message(reason)}`)
    }
  }

  async function enterConversationMode(): Promise<void> {
    try {
      const next = await window.neb.setConversationMode(true)
      setConversationMode(next.enabled)
      setConversationStatus(next)
      setError('')
    } catch (reason) {
      setError(`Conversation mode could not be opened: ${message(reason)}`)
    }
  }

  async function exportVoiceProfile(): Promise<void> {
    setVoiceProfileBusy(true)
    try {
      const result = await window.neb.exportVoiceProfile()
      if (result) setVoiceProfileMessage(`Voice profile exported: ${result.fileName}`)
      setError('')
    } catch (reason) { setError(`Voice profile export failed: ${message(reason)}`) }
    finally { setVoiceProfileBusy(false) }
  }

  async function importVoiceProfile(): Promise<void> {
    setVoiceProfileBusy(true)
    try {
      const next = await window.neb.importVoiceProfile()
      if (next) {
        setSettings(next)
        setVoiceProfileMessage(`${next.replicatedVoice?.displayName || 'Voice'} imported and selected.`)
      }
      setError('')
    } catch (reason) { setError(`Voice profile import failed: ${message(reason)}`) }
    finally { setVoiceProfileBusy(false) }
  }

  const isLinux = info?.platform === 'linux'
  const virtualCable = outputs.some((output) => isLinux ? /NEB[ _]Voice/i.test(output.label) : /CABLE Input/i.test(output.label))
  const routing = routingStatus(outputs, settings.outputDeviceId, info?.platform)
  const routeGuide = isLinux ? 'NEB_Voice → Edge microphone: Monitor of NEB Voice.' : 'CABLE Input → Edge microphone: CABLE Output.'
  const estimatedSeconds = script.trim() ? Math.max(1, Math.ceil(script.trim().split(/\s+/).length / 2.5)) : 0

  if (conversationMode) {
    return <main className="conversation-shell">
      <header className="conversation-header">
        <div><span className="eyebrow">NEB · CONVERSATION</span><h1>Voice Console</h1></div>
        <button className="icon-button" aria-label="Exit conversation mode" title="Exit conversation mode" onClick={() => void toggleConversationMode()}><Icon name="close" /></button>
      </header>
      <section className="conversation-composer" aria-label="Conversation controls">
        <div className="conversation-statuses">
          <StatusCard title="VOICE" value={settings.replicatedVoice?.id === settings.geminiVoiceId ? settings.replicatedVoice.displayName : `${settings.geminiVoiceId} · prebuilt`} tone="green" />
          <StatusCard title="ROUTING" value={routing.routed ? isLinux ? 'NEB Voice ready' : 'CABLE Input ready' : routing.label} tone={routing.routed ? 'green' : 'amber'} />
        </div>
        <textarea ref={scriptInput} aria-label="Script" value={script} onChange={(event) => setScript(event.target.value)} placeholder="Paste or type the exact words you want to say…" />
        <div className="conversation-script-meta"><span>{script.length} characters · ~{estimatedSeconds}s audio stimato</span><span>Exact script · never saved</span></div>
        <div className="action-row compact-actions"><button className="primary" disabled={!gemini.ready || !script.trim() || busy} onClick={() => void speak()}>{busy ? <span className="spinner" /> : <Icon name="play" />} {busy ? 'Generating…' : 'Speak'} <kbd>Ctrl+Enter</kbd></button><button className="stop-action" onClick={stop}><Icon name="stop" /> Stop <kbd>Esc</kbd></button><button onClick={() => void replay()} disabled={!hasAudio}><Icon name="replay" /> Replay <kbd>Ctrl+R</kbd></button></div>
        <div className="conversation-hints"><p className={routing.routed ? 'routing-message ready' : 'routing-message'}>{routing.message}</p><p className="shortcut-message">{conversationShortcutLabel(conversationStatus)}</p></div>
        {metrics && <div className="metrics compact-metrics"><span>Generation <strong>{metrics.generationMs} ms</strong></span><span>Audio <strong>{metrics.durationSeconds.toFixed(1)} s</strong></span>{metrics.playbackMs !== undefined && <span>Playback <strong>{metrics.playbackMs} ms</strong></span>}</div>}
        <div className={error ? 'notice error' : 'notice'} role={error ? 'alert' : 'status'}><span className="status-dot" /> {error || status}</div>
      </section>
    </main>
  }

  return <div className="app-frame">
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon">N</span><div><strong>NEB</strong><small>VOICE CONSOLE</small></div></div>
      <nav aria-label="Main navigation">
        <button className={page === 'console' ? 'nav active' : 'nav'} onClick={() => setPage('console')}><Icon name="console" /> Console</button>
        <button className={page === 'settings' ? 'nav active' : 'nav'} onClick={() => setPage('settings')}><Icon name="settings" /> Settings</button>
        <button className={page === 'guide' ? 'nav active' : 'nav'} onClick={() => setPage('guide')}><Icon name="book" /> Setup guide</button>
        <button className={page === 'diagnostics' ? 'nav active' : 'nav'} onClick={() => setPage('diagnostics')}><Icon name="diagnostics" /> Diagnostics</button>
      </nav>
      <div className="sidebar-bottom"><span className={gemini.ready ? 'status-dot green' : 'status-dot amber'} /> {gemini.ready ? 'Voice ready' : 'Voice unavailable'}</div>
    </aside>

    <main className="main">
      <header className="topbar"><div><span className="eyebrow">NEB / {page.toUpperCase()}</span><h1>{page === 'console' ? 'Write, then speak.' : page === 'settings' ? 'Settings' : page === 'guide' ? 'Setup guide' : 'Diagnostics'}</h1></div><div className="topbar-actions">{page === 'console' && <button className="conversation-trigger" onClick={() => void toggleConversationMode()}>Open conversation <Icon name="external" /></button>}<div className={gemini.ready ? 'connection ready' : 'connection'}><span className="status-dot" /> {gemini.ready ? 'Gemini online' : 'Gemini unavailable'}</div></div></header>
      {page === 'console' && <div className="content console-content">
        <section className="workflow-guide" aria-label="How to use NEB Voice Console">
          <div className="guide-title"><span className="eyebrow">QUICK FLOW</span><strong>Edge conversation controls</strong></div>
          <div className="guide-steps"><span><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>V</kbd> open</span><span><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> stop</span><span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> speak</span><span><kbd>Esc</kbd> stop</span><span><kbd>Ctrl</kbd>+<kbd>R</kbd> replay</span></div>
          <p><strong>Route:</strong> {routeGuide}</p>
        </section>
        <div className="workbench">
          <section className="composer editor-surface">
            <div className="section-heading"><div><span className="eyebrow">MESSAGE</span><h2>What do you want to say?</h2></div><span className="chip">Exact words</span></div>
            <textarea ref={scriptInput} aria-label="Script" value={script} onChange={(event) => setScript(event.target.value)} placeholder="Paste or write your response…" />
            <div className="composer-footer"><span>{script.length} characters</span><span>~{estimatedSeconds}s audio stimato</span></div>
            <div className="action-row"><button className="primary" disabled={!gemini.ready || !script.trim() || busy} onClick={() => void speak()}>{busy ? <span className="spinner" /> : <Icon name="play" />} {busy ? 'Generating…' : 'Speak'} <kbd>Ctrl+Enter</kbd></button><button className="stop-action" onClick={stop}><Icon name="stop" /> Stop <kbd>Esc</kbd></button><button onClick={() => void replay()} disabled={!hasAudio}><Icon name="replay" /> Replay <kbd>Ctrl+R</kbd></button></div>
            {metrics && <div className="metrics"><span>First audio <strong>{metrics.firstAudioMs} ms</strong></span><span>Generation <strong>{metrics.generationMs} ms</strong></span><span>Duration <strong>{metrics.durationSeconds.toFixed(1)} s</strong></span><span>Playback <strong>{metrics.playbackMs !== undefined ? `${metrics.playbackMs} ms` : '—'}</strong></span></div>}
            <div className={error ? 'notice error' : 'notice'} role={error ? 'alert' : 'status'}><span className="status-dot" /> {error || status}</div>
          </section>
          <aside className="control-rail">
            <section><span className="eyebrow">VOICE</span><label>Generation voice<select value={settings.geminiVoiceId} onChange={(event) => void update({ geminiVoiceId: event.target.value })}>{GEMINI_PREBUILT_VOICES.map((voice) => <option key={voice} value={voice}>{voice} · prebuilt</option>)}{settings.replicatedVoice && <option value={settings.replicatedVoice.id}>{settings.replicatedVoice.displayName} · replicated</option>}</select></label><span className="voice-type">{settings.replicatedVoice?.id === settings.geminiVoiceId ? 'Replicated voice' : 'Prebuilt voice'}</span><label>Model<select value={settings.geminiModel} onChange={(event) => void update({ geminiModel: event.target.value as AppSettings['geminiModel'] })}>{GEMINI_MODELS.map((model) => <option key={model} value={model}>{model}</option>)}</select></label></section>
            <section><div className="rail-heading"><span className="eyebrow">AUDIO ROUTING</span><button className="text-button" onClick={() => void refreshOutputs()}><Icon name="refresh" /> Refresh</button></div><label>Output device<select value={settings.outputDeviceId} onChange={(event) => void update({ outputDeviceId: event.target.value })}>{!outputs.some((output) => output.deviceId === settings.outputDeviceId) && <option value={settings.outputDeviceId}>{selectedOutputLabel(outputs, settings.outputDeviceId)}</option>}{outputs.map((output) => <option key={output.deviceId} value={output.deviceId}>{output.label}</option>)}</select></label><label className="volume-control"><span className="volume-label">{settings.outputVolume === 0 ? <Icon name="mute" /> : <Icon name="speaker" />} Output volume</span><span>{Math.round(settings.outputVolume * 100)}%</span><input aria-label="Output volume" type="range" min="0" max="1" step="0.05" value={settings.outputVolume} style={{ '--volume-fill': `${settings.outputVolume * 100}%` } as React.CSSProperties} onChange={(event) => previewOutputVolume(Number(event.target.value))} onPointerUp={(event) => void update({ outputVolume: Number(event.currentTarget.value) })} onBlur={(event) => void update({ outputVolume: Number(event.currentTarget.value) })} /></label><p className={routing.routed ? 'routing-message ready' : 'routing-message'}><span className="status-dot" />{routing.message}</p><details className="routing-help"><summary>Changed headphones, speakers, or microphone?</summary>{isLinux ? <><p>Keep Ubuntu’s normal output on your headphones or speakers. The NEB Voice monitor is routed there automatically for this session.</p><p>For Edge, set its <strong>System default</strong> microphone to NEB Voice, then restart Edge:</p><code>pactl set-default-source neb_voice.monitor</code><p>To return to your physical microphone, first note its ID with <code>pactl get-default-source</code>, then run <code>pactl set-default-source &lt;microphone-id&gt;</code>.</p></> : <p>Press <kbd>Win</kbd> + <kbd>R</kbd>, enter <code>mmsys.cpl</code>, then open <strong>Recording → CABLE Output → Listen</strong>. Keep “Listen to this device” enabled and choose the new headphones or speakers under “Playback through this device”.</p>}</details></section>
            <section className="route-test"><span className="eyebrow">TEST OUTPUT</span><div className="file-row"><label className="file-button"><Icon name="upload" /> Choose WAV<input type="file" accept=".wav,audio/wav" onChange={(event) => void loadFile(event.target.files?.[0])} /></label><button onClick={() => void play()} disabled={!hasAudio}><Icon name="play" /> Play</button></div><span className="file-name">{fileName || 'No local test clip'}{duration !== null ? ` · ${duration.toFixed(1)} s` : ''}</span></section>
          </aside>
        </div>
      </div>}
      {page === 'settings' && <div className="content narrow settings-page"><div className="intro"><div><h2>Gemini setup</h2><p>The API key stays in Electron's main process.</p></div></div><section className="panel"><span className="eyebrow">GEMINI API</span><h3>Connection</h3><p>Status: <strong>{gemini.message}</strong></p><p>Key available to this process: <strong>{info?.geminiConfigured ? 'Yes' : 'No'}</strong>. For local development, store it in ignored <code>.env.local</code> as <code>GEMINI_API_KEY</code>. Restart after changing it.</p><button className="text-button" onClick={() => void checkGemini()}>Check connection again</button><p><a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer">Google AI Studio API keys <Icon name="external" size={13} /></a></p></section><section className="panel voice-profile"><span className="eyebrow">VOICE PROFILE</span><h3>Use your replicated voice on another computer</h3><p>Export contains only the Gemini voice ID, its name, and the selected model. It never includes your API key, recordings, scripts, or audio routing.</p>{settings.replicatedVoice ? <p>Current voice: <strong>{settings.replicatedVoice.displayName}</strong></p> : <p>No replicated voice is saved on this computer yet.</p>}<div className="action-row"><button disabled={!settings.replicatedVoice || voiceProfileBusy} onClick={() => void exportVoiceProfile()}><Icon name="upload" /> Export profile</button><button disabled={voiceProfileBusy} onClick={() => void importVoiceProfile()}><Icon name="copy" /> Import profile</button></div>{voiceProfileMessage && <p className="voice-profile-message"><span className="status-dot green" /> {voiceProfileMessage}</p>}</section><VoiceReplicationWizard gemini={gemini} settings={settings} onCreated={setSettings} /><section className="panel"><span className="eyebrow">PRIVACY</span><h3>Local history</h3><label className="checkbox"><input type="checkbox" checked={settings.saveScriptHistory} disabled /> Save script history (later phase)</label><p className="hint">Scripts are kept only in memory. SPEAK sends the selected script to Google; voice audio is sent only when you press CREATE VOICE.</p></section></div>}
      {page === 'settings' && <div className="content narrow settings-page"><div className="intro"><div><h2>Gemini setup</h2><p>The API key stays in Electron's main process.</p></div></div><section className="panel"><span className="eyebrow">GEMINI API</span><h3>Connection</h3><p>Status: <strong>{gemini.message}</strong></p><p>Key available to this process: <strong>{info?.geminiConfigured ? 'Yes' : 'No'}</strong>. For local development, store it in ignored <code>.env.local</code> as <code>GEMINI_API_KEY</code>. Restart after changing it.</p><button className="text-button" onClick={() => void checkGemini()}>Check connection again</button><p><a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer">Google AI Studio API keys <Icon name="external" size={13} /></a></p></section><section className="panel voice-profile"><span className="eyebrow">VOICE PROFILE</span><h3>Use your replicated voice on another computer</h3><p>Export contains only the Gemini voice ID, its name, and the selected model. It never includes your API key, recordings, scripts, or audio routing.</p>{settings.replicatedVoice ? <p>Current voice: <strong>{settings.replicatedVoice.displayName}</strong></p> : <p>No replicated voice is saved on this computer yet.</p>}<div className="action-row"><button disabled={!settings.replicatedVoice || voiceProfileBusy} onClick={() => void exportVoiceProfile()}><Icon name="upload" /> Export profile</button><button disabled={voiceProfileBusy} onClick={() => void importVoiceProfile()}><Icon name="copy" /> Import profile</button></div>{voiceProfileMessage && <p className="voice-profile-message"><span className="status-dot green" /> {voiceProfileMessage}</p>}</section><VoiceReplicationWizard gemini={gemini} settings={settings} onCreated={setSettings} /><section className="panel"><span className="eyebrow">PRIVACY</span><h3>Local history</h3><label className="checkbox"><input type="checkbox" checked={settings.saveScriptHistory} disabled /> Save script history (later phase)</label><p className="hint">Scripts are kept only in memory. SPEAK sends the selected script to Google; voice audio is sent only when you press CREATE VOICE.</p></section></div>}
      {page === 'guide' && <SetupGuide />}
      {page === 'diagnostics' && <div className="content narrow settings-page"><div className="intro"><div><h2>System snapshot</h2><p>Local information to help troubleshoot setup.</p></div></div><section className="panel diagnostics"><Row name="Electron" value={info?.electron || 'Loading'} /><Row name="Node" value={info?.node || 'Loading'} /><Row name="Platform" value={info?.platform || 'Loading'} /><Row name="Gemini key present" value={info?.geminiConfigured ? 'Yes' : 'No'} /><Row name="Gemini API" value={gemini.message} /><Row name="Selected model" value={settings.geminiModel} /><Row name="Selected voice" value={settings.geminiVoiceId} /><Row name="Audio outputs" value={String(outputs.length)} /><Row name={isLinux ? 'PipeWire virtual output' : 'VB-CABLE'} value={virtualCable ? 'Detected' : 'Not detected'} /><Row name="Selected output" value={selectedOutputLabel(outputs, settings.outputDeviceId)} /></section></div>}
    </main>
  </div>
}

function StatusCard({ title, value, tone }: { title: string; value: string; tone: string }): React.JSX.Element {
  return <div className="status-card"><span className="eyebrow">{title}</span><strong><span className={`status-dot ${tone}`} />{value}</strong></div>
}

function Row({ name, value }: { name: string; value: string }): React.JSX.Element {
  return <div className="diag-row"><span>{name}</span><strong>{value}</strong></div>
}

function selectedOutputLabel(outputs: AudioOutput[], deviceId: string): string {
  return outputs.find((output) => output.deviceId === deviceId)?.label ?? (deviceId === 'default' ? 'System default' : 'Saved device unavailable')
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}
