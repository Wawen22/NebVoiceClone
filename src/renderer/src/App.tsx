import { useEffect, useRef, useState } from 'react'
import { BrowserAudioEngine, type AudioOutput } from './audio/AudioEngine'
import { ConsoleView, ConversationView, type Metrics } from './ConsoleViews'
import { ReadyLinesPanel } from './ReadyLinesPanel'
import { DiagnosticsPage, SettingsPage } from './SecondaryViews'
import { Icon } from './Icons'
import { PanelLeftClose, PanelLeftOpen, Layers } from 'lucide-react'
import { OutlierPage } from './outlier/OutlierPage'
import { useOutlierWorkspace } from './outlier/useOutlierWorkspace'
import { SetupGuide } from './SetupGuide'
import { DEFAULT_SETTINGS, type AppInfo, type AppSettings, type ConversationModeStatus, type GeminiKeySource, type GeminiKeyStatus, type ProviderStatus, type SaveGeminiKeyRequest } from '../../shared/contracts'
import { routingStatus } from './conversationMode'
import { geminiKeyLabel } from '../../shared/geminiKeyLabels'
import { addReadyLine, editReadyLine, moveReadyLine, removeReadyLine, restoreReadyLine, toggleReadyLineDone, type ReadyLine } from './readyLines'

type Page = 'console' | 'outlier' | 'settings' | 'guide' | 'diagnostics'

export function App(): React.JSX.Element {
  const outlierWorkspace = useOutlierWorkspace()
  const [page, setPage] = useState<Page>('console')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [gemini, setGemini] = useState<ProviderStatus>({ ready: false, message: 'Verifica Gemini…' })
  const [script, setScript] = useState('')
  const [readyLines, setReadyLines] = useState<ReadyLine[]>([])
  const [readyOpen, setReadyOpen] = useState(false)
  const [activeReadyLineId, setActiveReadyLineId] = useState<string | null>(null)
  const [outputs, setOutputs] = useState<AudioOutput[]>([])
  const [fileName, setFileName] = useState('')
  const [duration, setDuration] = useState<number | null>(null)
  const [status, setStatus] = useState('Pronto per generare audio')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [hasAudio, setHasAudio] = useState(false)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [conversationMode, setConversationMode] = useState(false)
  const [conversationStatus, setConversationStatus] = useState<ConversationModeStatus | null>(null)
  const [voiceProfileMessage, setVoiceProfileMessage] = useState('')
  const [voiceProfileError, setVoiceProfileError] = useState('')
  const [voiceProfileBusy, setVoiceProfileBusy] = useState(false)
  const [keyStatus, setKeyStatus] = useState<GeminiKeyStatus | null>(null)
  const [keyBusy, setKeyBusy] = useState(false)
  const [keyMessage, setKeyMessage] = useState('')
  const [keyError, setKeyError] = useState('')
  const audio = useRef(new BrowserAudioEngine())
  const requestId = useRef(0)
  const geminiCheckId = useRef(0)
  const playbackStartedAt = useRef<number | null>(null)
  const playbackMs = useRef<number | null>(null)
  const playbackActive = useRef(false)
  const generationInProgress = useRef(false)
  const scriptInput = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    void window.neb.getAppInfo().then(setInfo).catch((reason: unknown) => setError(message(reason)))
    void window.neb.getSettings()
      .then((nextSettings) => { audio.current.setVolume(nextSettings.outputVolume); setSettings(nextSettings) })
      .catch((reason: unknown) => setError(message(reason)))
    void window.neb.getGeminiKeyStatus().then(setKeyStatus).catch((reason: unknown) => setKeyError(message(reason)))
    void refreshOutputs()
    void checkGemini()
    audio.current.onEnded(() => {
      playbackActive.current = false
      setPlaying(false)
      setActiveReadyLineId(null)
      setStatus(generationInProgress.current ? 'Audio terminato · generazione in corso…' : 'Riproduzione terminata')
      if (playbackStartedAt.current !== null) {
        playbackMs.current = Math.round(performance.now() - playbackStartedAt.current)
        playbackStartedAt.current = null
        setMetrics((previous) => previous ? { ...previous, playbackMs: playbackMs.current ?? undefined } : null)
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
    const savedZoom = localStorage.getItem('neb:zoom-factor')
    const initialZoom = savedZoom ? Math.min(1.4, Math.max(0.65, Number(savedZoom))) : 0.88
    window.neb.setZoomFactor?.(initialZoom)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey && (event.key === '-' || event.key === '_')) {
        event.preventDefault()
        const current = window.neb.getZoomFactor ? window.neb.getZoomFactor() : 0.88
        const next = Math.max(0.65, Math.round((current - 0.05) * 100) / 100)
        window.neb.setZoomFactor?.(next)
        localStorage.setItem('neb:zoom-factor', String(next))
        return
      }
      if (event.ctrlKey && (event.key === '+' || event.key === '=')) {
        event.preventDefault()
        const current = window.neb.getZoomFactor ? window.neb.getZoomFactor() : 0.88
        const next = Math.min(1.35, Math.round((current + 0.05) * 100) / 100)
        window.neb.setZoomFactor?.(next)
        localStorage.setItem('neb:zoom-factor', String(next))
        return
      }
      if (event.ctrlKey && event.key === '0') {
        event.preventDefault()
        window.neb.setZoomFactor?.(0.88)
        localStorage.setItem('neb:zoom-factor', '0.88')
        return
      }
      if (event.key === 'Escape') stop()
      if ((event.target as HTMLElement | null)?.closest('[data-no-speech-shortcuts]') && event.ctrlKey) {
        if (event.key === 'Enter' || event.key.toLowerCase() === 'r') event.preventDefault()
        return
      }
      if (readyOpen && event.ctrlKey && (event.key === 'Enter' || event.key.toLowerCase() === 'r')) {
        event.preventDefault()
        return
      }
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
  }, [settings, script, busy, gemini.ready, hasAudio, readyOpen])

  useEffect(() => window.neb.onConversationRequested(() => { void toggleConversationMode() }), [conversationMode])
  useEffect(() => window.neb.onStopRequested(stop), [])

  async function checkGemini(): Promise<void> {
    const current = ++geminiCheckId.current
    try { const status = await window.neb.checkGemini(); if (current === geminiCheckId.current) setGemini(status) }
    catch (reason) { if (current === geminiCheckId.current) setGemini({ ready: false, message: message(reason) }) }
  }

  async function saveGeminiKey(request: SaveGeminiKeyRequest): Promise<boolean> {
    setKeyBusy(true)
    setKeyError('')
    setKeyMessage('')
    try {
      const status = await window.neb.saveGeminiKey(request)
      setKeyStatus(status)
      setSettings(await window.neb.getSettings())
      if (status.activeSource === 'saved') await checkGemini()
      setKeyMessage(status.activeSource === 'saved' ? 'Chiave aggiuntiva aggiornata e attiva.' : 'Chiave aggiuntiva salvata. Selezionala qui sopra per usarla.')
      return true
    } catch (reason) {
      setKeyError(message(reason))
      return false
    } finally { setKeyBusy(false) }
  }

  async function selectGeminiKey(source: GeminiKeySource): Promise<void> {
    setKeyBusy(true)
    setKeyError('')
    setKeyMessage('')
    try {
      const next = await window.neb.selectGeminiKey(source)
      setSettings(next)
      const [status, appInfo] = await Promise.all([window.neb.getGeminiKeyStatus(), window.neb.getAppInfo()])
      setKeyStatus(status)
      setInfo(appInfo)
      await checkGemini()
      setKeyMessage(`${geminiKeyLabel(source, status)} selezionata.`)
    } catch (reason) { setKeyError(message(reason)) }
    finally { setKeyBusy(false) }
  }

  async function removeGeminiKey(): Promise<void> {
    setKeyBusy(true)
    setKeyError('')
    setKeyMessage('')
    try {
      const next = await window.neb.removeGeminiKey()
      setSettings(next)
      const [status, appInfo] = await Promise.all([window.neb.getGeminiKeyStatus(), window.neb.getAppInfo()])
      setKeyStatus(status)
      setInfo(appInfo)
      await checkGemini()
      setKeyMessage(`Chiave aggiuntiva rimossa. Ora è selezionata ${geminiKeyLabel('environment', status)}.`)
    } catch (reason) { setKeyError(message(reason)) }
    finally { setKeyBusy(false) }
  }

  async function refreshOutputs(): Promise<void> {
    try {
      const found = await audio.current.listOutputs()
      setOutputs(found)
      if (found.length === 0) setError('Nessuna uscita audio disponibile. Apri l’app Windows nativa per ascoltare l’audio.')
    } catch (reason) {
      setError(`Impossibile elencare le uscite audio: ${message(reason)}`)
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
    playbackActive.current = false
    playbackStartedAt.current = null
    setPlaying(false)
    try {
      const seconds = await audio.current.load(file)
      setDuration(seconds)
      setFileName(file.name)
      setHasAudio(true)
      setMetrics(null)
      setStatus('WAV locale pronto')
      setError('')
    } catch (reason) {
      setFileName('')
      setDuration(null)
      setHasAudio(false)
      setError(message(reason))
    }
  }

  async function play(): Promise<void> {
    if (!fileName || busy) return
    try {
      await audio.current.play(settings.outputDeviceId)
      setActiveReadyLineId(null)
      playbackActive.current = true
      setPlaying(true)
      playbackStartedAt.current = performance.now()
      setStatus(`Riproduzione su ${selectedOutputLabel(outputs, settings.outputDeviceId)}`)
      setError('')
    } catch (reason) { setError(`Riproduzione non riuscita: ${message(reason)}`) }
  }

  async function replay(): Promise<void> {
    if (!hasAudio || busy) return
    try {
      await audio.current.replay(settings.outputDeviceId)
      setActiveReadyLineId(null)
      playbackActive.current = true
      setPlaying(true)
      playbackStartedAt.current = performance.now()
      setStatus(`Riascolto su ${selectedOutputLabel(outputs, settings.outputDeviceId)}`)
      setError('')
    } catch (reason) { setError(`Riascolto non riuscito: ${message(reason)}`) }
  }

  async function speak(text: string = script, readyLineId: string | null = null): Promise<void> {
    if (busy || !gemini.ready || !text.trim()) return
    if (outputs.length === 0) {
      setError('Nessuna uscita audio disponibile. Apri l’app Windows nativa prima di generare la voce.')
      return
    }
    const current = ++requestId.current
    const started = performance.now()
    setActiveReadyLineId(readyLineId)
    generationInProgress.current = true
    playbackActive.current = false
    setPlaying(false)
    playbackStartedAt.current = null
    playbackMs.current = null
    setBusy(true)
    setStatus('Generazione con Gemini…')
    setError('')
    audio.current.stop()
    setMetrics(null)
    let firstChunkMs: number | null = null
    let streamError: unknown = null
    try {
      await audio.current.beginStream(settings.outputDeviceId)
      if (current !== requestId.current) return
      const result = await window.neb.synthesizeStream({
        providerId: 'gemini', modelId: settings.geminiModel, text,
        voice: settings.replicatedVoice?.id === settings.geminiVoiceId ? { mode: 'stateful', voiceId: settings.geminiVoiceId } : { mode: 'prebuilt', voiceId: settings.geminiVoiceId }
      }, (chunk) => {
        if (current !== requestId.current || streamError) return
        try {
          audio.current.appendPcm(chunk)
          if (firstChunkMs === null) {
            firstChunkMs = Math.round(performance.now() - started)
            playbackActive.current = true
            setPlaying(true)
            playbackStartedAt.current = performance.now()
            setStatus(`Audio su ${selectedOutputLabel(outputs, settings.outputDeviceId)} · generazione in corso…`)
          }
        } catch (reason) {
          streamError = reason
          void window.neb.stopGeneration()
        }
      })
      if (current !== requestId.current) return
      if (streamError) throw streamError
      const durationSeconds = audio.current.finishStream()
      generationInProgress.current = false
      setHasAudio(true)
      setFileName('')
      setDuration(null)
      setMetrics({ firstChunkMs: firstChunkMs ?? result.generationMs, generationMs: result.generationMs, durationSeconds, playbackMs: playbackMs.current ?? undefined })
      setStatus(playbackActive.current ? `Audio su ${selectedOutputLabel(outputs, settings.outputDeviceId)}` : 'Riproduzione terminata')
    } catch (reason) {
      if (current === requestId.current) { generationInProgress.current = false; playbackActive.current = false; setPlaying(false); setActiveReadyLineId(null); audio.current.stop(); setError(message(streamError ?? reason)); setStatus('Generazione non riuscita') }
    } finally { if (current === requestId.current) setBusy(false) }
  }

  function stop(): void {
    requestId.current++
    audio.current.stop()
    generationInProgress.current = false
    playbackActive.current = false
    setPlaying(false)
    setActiveReadyLineId(null)
    playbackStartedAt.current = null
    setBusy(false)
    setStatus('Interrotto')
    void window.neb.stopGeneration().catch((reason: unknown) => setError(message(reason)))
    void window.neb.stopInsertion().catch((reason: unknown) => setError(message(reason)))
  }

  async function toggleConversationMode(): Promise<void> {
    try {
      const next = await window.neb.setConversationMode(!conversationMode)
      setConversationMode(next.enabled)
      setConversationStatus(next)
      setError('')
    } catch (reason) {
      setError(`Impossibile cambiare modalità conversazione: ${message(reason)}`)
    }
  }

  async function exportVoiceProfile(): Promise<void> {
    setVoiceProfileBusy(true)
    setVoiceProfileError('')
    setVoiceProfileMessage('')
    try {
      const result = await window.neb.exportVoiceProfile()
      if (result) setVoiceProfileMessage(`Profilo voce esportato: ${result.fileName}`)
    } catch (reason) { setVoiceProfileError(`Esportazione profilo non riuscita: ${message(reason)}`) }
    finally { setVoiceProfileBusy(false) }
  }

  async function importVoiceProfile(): Promise<void> {
    setVoiceProfileBusy(true)
    setVoiceProfileError('')
    setVoiceProfileMessage('')
    try {
      const next = await window.neb.importVoiceProfile()
      if (next) {
        setSettings(next)
        setVoiceProfileMessage(`${next.replicatedVoice?.displayName || 'Voce'} importata e selezionata.`)
      }
    } catch (reason) { setVoiceProfileError(`Importazione profilo non riuscita: ${message(reason)}`) }
    finally { setVoiceProfileBusy(false) }
  }

  const isLinux = info?.platform === 'linux'
  const virtualOutput = outputs.find((output) => isLinux ? /NEB[ _]Voice/i.test(output.label) : /CABLE Input/i.test(output.label))
  const routing = routingStatus(outputs, settings.outputDeviceId, info?.platform)
  const geminiMessage = gemini.message === 'Gemini connected' ? 'Connesso a Gemini' : gemini.message.startsWith('Gemini API key is missing') ? 'Chiave API Gemini assente' : gemini.message
  const activeKeyName = geminiKeyLabel(settings.geminiKeySource, keyStatus)
  const common = {
    settings, gemini, script, scriptInput, routing, isLinux, busy, playing, hasAudio, status, error, metrics, activeKeyName,
    readyLinesCount: readyLines.length, onOpenReadyLines: () => setReadyOpen(true),
    onScriptChange: setScript, onSpeak: speak, onStop: stop, onReplay: replay
  }
  const readyPanel = readyOpen && <ReadyLinesPanel lines={readyLines} currentScript={script} ready={gemini.ready} busy={busy} playing={playing} activeLineId={activeReadyLineId} status={status} error={error}
    onAdd={(text) => { const id = crypto.randomUUID(); setReadyLines((current) => addReadyLine(current, text, id)) }}
    onEdit={(id, text) => setReadyLines((current) => editReadyLine(current, id, text))}
    onMove={(id, direction) => setReadyLines((current) => moveReadyLine(current, id, direction))}
    onToggleDone={(id) => setReadyLines((current) => toggleReadyLineDone(current, id))}
    onRemove={(id) => setReadyLines((current) => removeReadyLine(current, id))}
    onRestore={(line, index) => setReadyLines((current) => restoreReadyLine(current, line, index))}
    onClear={() => setReadyLines([])}
    onSpeak={(line) => { void speak(line.text, line.id) }}
    onStop={stop}
    onClose={() => setReadyOpen(false)} />

  if (conversationMode) return <><ConversationView {...common} conversationStatus={conversationStatus} onClose={() => void toggleConversationMode()} />{readyPanel}</>

  const pageTitle = page === 'console' ? 'Console' : page === 'outlier' ? 'Outlier' : page === 'settings' ? 'Impostazioni' : page === 'guide' ? 'Guida' : 'Diagnostica'
  return <div className={sidebarCollapsed ? 'app-frame sidebar-collapsed' : 'app-frame'}>
    <aside className="sidebar">
      <button type="button" className="sidebar-toggle" aria-label={sidebarCollapsed ? 'Apri menu' : 'Chiudi menu'} title={sidebarCollapsed ? 'Apri menu' : 'Chiudi menu'} aria-controls="sidebar-nav" aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}>{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
      <div className="brand"><span className="brand-icon">N</span><div className="brand-copy"><strong>NEB VOICE</strong><small>VOICE CONSOLE</small></div></div>
      <nav id="sidebar-nav" aria-label="Navigazione principale">
        <button className={page === 'console' ? 'nav active' : 'nav'} aria-label="Console" title="Console" aria-current={page === 'console' ? 'page' : undefined} onClick={() => setPage('console')}><Icon name="console" /><span className="nav-label">Console</span></button>
        <button className={page === 'outlier' ? 'nav active' : 'nav'} aria-label="Outlier" title="Outlier" aria-current={page === 'outlier' ? 'page' : undefined} onClick={() => setPage('outlier')}><Layers size={20} /><span className="nav-label">Outlier</span></button>
        <button className={page === 'settings' ? 'nav active' : 'nav'} aria-label="Impostazioni" title="Impostazioni" aria-current={page === 'settings' ? 'page' : undefined} onClick={() => setPage('settings')}><Icon name="settings" /><span className="nav-label">Impostazioni</span></button>
        <button className={page === 'guide' ? 'nav active' : 'nav'} aria-label="Guida audio" title="Guida audio" aria-current={page === 'guide' ? 'page' : undefined} onClick={() => setPage('guide')}><Icon name="book" /><span className="nav-label">Guida audio</span></button>
        <button className={page === 'diagnostics' ? 'nav active' : 'nav'} aria-label="Diagnostica" title="Diagnostica" aria-current={page === 'diagnostics' ? 'page' : undefined} onClick={() => setPage('diagnostics')}><Icon name="diagnostics" /><span className="nav-label">Diagnostica</span></button>
      </nav>
      <div className="sidebar-bottom"><span className={gemini.ready && !keyBusy ? 'status-dot green' : 'status-dot amber'} /><span>API: {activeKeyName}</span></div>
    </aside>

    <main className="main">
      <header className="topbar"><div><span className="eyebrow">NEB VOICE / {pageTitle.toUpperCase()}</span><h1>{pageTitle}</h1></div><div className={gemini.ready && !keyBusy ? 'connection ready' : 'connection'} aria-live="polite"><span className="status-dot" /><span className="connection-copy"><strong title={activeKeyName}>API in uso: {activeKeyName}</strong><small>{keyBusy ? 'Verifica in corso…' : gemini.ready ? 'Gemini disponibile' : 'Gemini non disponibile'}</small></span></div></header>
      {page === 'console' && <ConsoleView {...common} outputs={outputs} virtualOutput={virtualOutput} fileName={fileName} duration={duration} onUpdate={(patch) => void update(patch)} onPreviewVolume={previewOutputVolume} onRefreshOutputs={() => void refreshOutputs()} onLoadFile={(file) => void loadFile(file)} onPlayFile={() => void play()} onOpenConversation={() => void toggleConversationMode()} />}
      {page === 'outlier' && <OutlierPage workspace={outlierWorkspace} voice={<ConsoleView {...common} outputs={outputs} virtualOutput={virtualOutput} fileName={fileName} duration={duration} onUpdate={(patch) => void update(patch)} onPreviewVolume={previewOutputVolume} onRefreshOutputs={() => void refreshOutputs()} onLoadFile={(file) => void loadFile(file)} onPlayFile={() => void play()} onOpenConversation={() => void toggleConversationMode()} />} />}
      {page === 'settings' && <SettingsPage gemini={gemini} geminiMessage={geminiMessage} info={info} settings={settings} keyStatus={keyStatus} keyBusy={keyBusy || busy} keyMessage={keyMessage} keyError={keyError} voiceProfileBusy={voiceProfileBusy} voiceProfileMessage={voiceProfileMessage} voiceProfileError={voiceProfileError} onCheckGemini={() => void checkGemini()} onSaveGeminiKey={saveGeminiKey} onSelectGeminiKey={selectGeminiKey} onRemoveGeminiKey={removeGeminiKey} onExportVoiceProfile={() => void exportVoiceProfile()} onImportVoiceProfile={() => void importVoiceProfile()} onVoiceCreated={setSettings} />}
      {page === 'guide' && <SetupGuide />}
      {page === 'diagnostics' && <DiagnosticsPage info={info} geminiMessage={geminiMessage} settings={settings} outputs={outputs} isLinux={isLinux} virtualOutput={virtualOutput} />}
    </main>
    {readyPanel}
  </div>
}

function selectedOutputLabel(outputs: AudioOutput[], deviceId: string): string {
  return outputs.find((output) => output.deviceId === deviceId)?.label ?? (deviceId === 'default' ? 'Predefinito di sistema' : 'Dispositivo salvato non disponibile')
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}
