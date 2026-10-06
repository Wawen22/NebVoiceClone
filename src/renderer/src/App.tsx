import { useEffect, useRef, useState } from 'react'
import { BrowserAudioEngine, type AudioOutput } from './audio/AudioEngine'
import { AvatarSession } from './avatar/session'
import { createAvatarClient } from './avatar/sdk'
import { AvatarAudioEngine } from './avatar/AvatarAudioEngine'
import { AvatarPanel } from './avatar/AvatarPanel'
import { ConsoleView, ConversationView, type Metrics } from './ConsoleViews'
import { ReadyLinesPanel } from './ReadyLinesPanel'
import { AutomationPanel, AutomationLauncher } from './s2s/AutomationPanel'
import { useS2SAutomation } from './s2s/useS2SAutomation'
import { useLiveConversation } from './live/useLiveConversation'
import { LivePage } from './live/LivePage'
import { localSimulationOutputs } from './s2s/simulation'
import { importReadyLines } from './scriptImport'
import { DiagnosticsPage, SettingsPage } from './SecondaryViews'
import { Icon } from './Icons'
import { PanelLeftClose, PanelLeftOpen, Layers, Radio } from 'lucide-react'
import { OutlierPage } from './outlier/OutlierPage'
import { useOutlierWorkspace } from './outlier/useOutlierWorkspace'
import { SetupGuide } from './SetupGuide'
import { DEFAULT_SETTINGS, type AppInfo, type AppSettings, type ConversationModeStatus, type GeminiKeySource, type GeminiKeyStatus, type ProviderStatus, type SaveGeminiKeyRequest } from '../../shared/contracts'
import { routingStatus } from './conversationMode'
import { geminiKeyLabel } from '../../shared/geminiKeyLabels'
import { buildSpeechRequest } from '../../shared/speechRequest'
import { addReadyLine, completeReadyLine, createReadyLinesFromTexts, editReadyLine, moveReadyLine, removeReadyLine, restoreReadyLine, toggleReadyLineDone, type ReadyLine, type ReadyLinesTab } from './readyLines'
import type { CheckAction } from './sessionReadiness'

type Page = 'console' | 'outlier' | 'live' | 'settings' | 'guide' | 'diagnostics'

export function App(): React.JSX.Element {
  const outlierWorkspace = useOutlierWorkspace()
  const [page, setPage] = useState<Page>('console')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [audioSettingsRequest, setAudioSettingsRequest] = useState(0)
  const [browserSetupRequest, setBrowserSetupRequest] = useState(0)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [gemini, setGemini] = useState<ProviderStatus>({ ready: false, message: 'Verifica Gemini…' })
  const [fish, setFish] = useState<ProviderStatus>({ready:false,message:'Verifica Fish...'})
  const speechStatus = settings.providerId === 'fish-openrouter' ? fish : gemini
  const [script, setScript] = useState('')
  const [readyLinesA, setReadyLinesA] = useState<ReadyLine[]>([])
  const [readyLinesB, setReadyLinesB] = useState<ReadyLine[]>([])
  const [activeReadyTab, setActiveReadyTab] = useState<ReadyLinesTab>('modelA')
  const [generatingModelB, setGeneratingModelB] = useState(false)
  const [singleRegeneratingId, setSingleRegeneratingId] = useState<string | null>(null)
  const [readyOpen, setReadyOpen] = useState(false)
  const [automationOpen, setAutomationOpen] = useState(false)
  const [activeReadyLineId, setActiveReadyLineId] = useState<string | null>(null)
  const [completedReadyLine, setCompletedReadyLine] = useState<{ id: string; tab: ReadyLinesTab } | null>(null)
  const [autoPrepare, setAutoPrepare] = useState(true)
  const [prepareRequested, setPrepareRequested] = useState(false)
  const autoPrepareRef = useRef(autoPrepare)
  autoPrepareRef.current = autoPrepare
  const playbackReadyLine = useRef<{ id: string; tab: ReadyLinesTab } | null>(null)
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
  const [avatar] = useState(() => new AvatarSession((faceId, limits) => window.neb.createAvatarSession(faceId, limits), createAvatarClient))
  const [consoleAudio] = useState(() => new AvatarAudioEngine(new BrowserAudioEngine(), avatar))
  const audio = useRef(consoleAudio)
  const requestId = useRef(0)
  const geminiCheckId = useRef(0)
  const fishCheckId = useRef(0)
  const outputCheckId = useRef(0)
  const playbackStartedAt = useRef<number | null>(null)
  const playbackMs = useRef<number | null>(null)
  const playbackActive = useRef(false)
  const generationInProgress = useRef(false)
  const scriptInput = useRef<HTMLTextAreaElement>(null)
  const liveUnavailableReason = info?.platform !== 'win32' ? 'Avvia NEB dalla versione Windows.'
    : !outlierWorkspace.status?.connected ? 'Collega la scheda dal popup NEB in Edge o Chrome.'
    : !outlierWorkspace.status.stopAvailable ? 'La scorciatoia globale Ctrl+Alt+S deve essere disponibile.'
    : outlierWorkspace.locked ? 'Ferma l’inserimento Outlier prima di avviare NEB Live.'
    : !speechStatus.ready ? 'Configura il provider vocale selezionato nelle Impostazioni.'
    : !routingStatus(outputs, settings.outputDeviceId, info?.platform).routed ? 'Seleziona CABLE Input come uscita NEB e CABLE Output come microfono del sito.' : ''
  const live = useLiveConversation({ settings, avatar, available: !liveUnavailableReason, unavailableReason: liveUnavailableReason,
    otherBusy: () => automation.isLocked() || busy || playing || generatingModelB || Boolean(singleRegeneratingId) || keyBusy || voiceProfileBusy || outlierWorkspace.locked
  })
  const s2sProject = outlierWorkspace.data.projects.find((project) => project.id === outlierWorkspace.selectedId)
  const s2sUnavailableReason = info?.platform !== 'win32' ? 'Avvia NEB dalla versione Windows.'
    : !s2sProject || s2sProject.integration !== 's2s' || s2sProject.archived ? 'Seleziona un progetto S2S attivo nella pagina Outlier.'
    : !outlierWorkspace.status?.connected ? 'Collega la scheda S2S dal popup NEB in Edge.'
    : !outlierWorkspace.status.stopAvailable ? 'La scorciatoia globale Ctrl+Alt+S deve essere disponibile.'
    : outlierWorkspace.locked ? 'Ferma l’inserimento Rationale prima della conversazione automatica.'
    : !gemini.ready ? 'Configura la voce Gemini prima di avviare.'
    : !routingStatus(outputs, settings.outputDeviceId, info?.platform).routed ? 'Seleziona CABLE Input come uscita NEB e CABLE Output come microfono in Edge.' : ''
  const automation = useS2SAutomation({ settings, available: !s2sUnavailableReason, unavailableReason: s2sUnavailableReason,
    simulationAvailable: gemini.ready && !outlierWorkspace.locked,
    simulationUnavailableReason: !gemini.ready ? 'Configura la voce Gemini prima della simulazione.' : 'Ferma l’inserimento Rationale prima della simulazione.',
    localOutputs: localSimulationOutputs(outputs),
    manualBusy: live.locked || busy || playing || generatingModelB || Boolean(singleRegeneratingId) || keyBusy || voiceProfileBusy,
    tab: activeReadyTab, projectId: outlierWorkspace.selectedId, target: outlierWorkspace.status?.target ?? null,
    onComplete: (tab, id) => (tab === 'modelA' ? setReadyLinesA : setReadyLinesB)((lines) => completeReadyLine(lines, id))
  })

  function sessionLocked(): boolean { return automation.isLocked() || live.isLocked() }

  useEffect(() => {
    void window.neb.getAppInfo().then(setInfo).catch((reason: unknown) => setError(message(reason)))
    void window.neb.getSettings()
      .then((nextSettings) => { audio.current.setVolume(nextSettings.outputVolume); setSettings(nextSettings) })
      .catch((reason: unknown) => setError(message(reason)))
    void window.neb.getGeminiKeyStatus().then(setKeyStatus).catch((reason: unknown) => setKeyError(message(reason)))
    void refreshOutputs()
    void checkGemini()
    audio.current.onEnded(() => {
      const completed = playbackReadyLine.current
      playbackReadyLine.current = null
      if (completed) {
        const updateLines = completed.tab === 'modelA' ? setReadyLinesA : setReadyLinesB
        updateLines((lines) => completeReadyLine(lines, completed.id))
        setCompletedReadyLine(completed)
        if (autoPrepareRef.current) setReadyOpen(true)
      }
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
    audio.current.onStarted(() => {
      playbackActive.current = true
      setPlaying(true)
      playbackStartedAt.current = performance.now()
      if (avatar.enabled) setStatus('Avatar sta parlando...')
      return true
    })
    audio.current.onError((reason) => {
      requestId.current++; generationInProgress.current = false; playbackActive.current = false
      playbackReadyLine.current = null; setPlaying(false); setBusy(false); setActiveReadyLineId(null)
      setError(reason.message); setStatus('Riproduzione interrotta'); audio.current.stop()
      void window.neb.stopGeneration().catch(() => undefined)
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
    function prepareShortcut(event: KeyboardEvent): void {
      if (event.ctrlKey && event.shiftKey && event.code === 'Space' && !readyOpen && !busy && !playing) {
        event.preventDefault()
        setPrepareRequested(true)
        setReadyOpen(true)
      }
    }
    window.addEventListener('keydown', prepareShortcut)
    return () => window.removeEventListener('keydown', prepareShortcut)
  }, [readyOpen, busy, playing])

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
  }, [settings, script, busy, playing, keyBusy, voiceProfileBusy, speechStatus.ready, hasAudio, readyOpen])

  useEffect(() => {
    let current = true
    const check = ++fishCheckId.current
    setFish({ready:false,message:'Verifica Fish...'})
    void window.neb.getSpeechProviderStatus('fish-openrouter').then(status=>{if(current && check === fishCheckId.current)setFish(status)}).catch(()=>{if(current && check === fishCheckId.current)setFish({ready:false,message:'Fish non disponibile.'})})
    return ()=>{current=false}
  }, [settings.fishVoice?.id, settings.providerId])

  useEffect(() => window.neb.onConversationRequested(() => { void toggleConversationMode() }), [conversationMode])
  useEffect(() => window.neb.onStopRequested(stop), [])

  async function checkGemini(): Promise<void> {
    const current = ++geminiCheckId.current
    try { const status = await window.neb.checkGemini(); if (current === geminiCheckId.current) setGemini(status) }
    catch (reason) { if (current === geminiCheckId.current) setGemini({ ready: false, message: message(reason) }) }
  }

  async function saveGeminiKey(request: SaveGeminiKeyRequest): Promise<boolean> {
    if (sessionLocked()) return false
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
    if (sessionLocked()) return
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
    if (sessionLocked()) return
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
    const current = ++outputCheckId.current
    try {
      const found = await audio.current.listOutputs()
      if (current !== outputCheckId.current) return
      setOutputs(found)
      if (found.length === 0) setError('Nessuna uscita audio disponibile. Apri l’app Windows nativa per ascoltare l’audio.')
    } catch (reason) {
      if (current !== outputCheckId.current) return
      setOutputs([])
      setError(`Impossibile elencare le uscite audio: ${message(reason)}`)
    }
  }

  async function refreshDiagnostics(): Promise<void> {
    const provider = settings.providerId
    const providerCheck = provider === 'gemini' ? ++geminiCheckId.current : ++fishCheckId.current
    const outputCheck = ++outputCheckId.current
    const results = await Promise.allSettled([window.neb.getSpeechProviderStatus(provider), window.neb.getAppInfo(), audio.current.listOutputs()])
    const [voice, appInfo, devices] = results
    const nextVoice = voice.status === 'fulfilled' ? voice.value : { ready: false, message: 'Impossibile verificare il provider vocale. Riprova.' }
    if (providerCheck === (provider === 'gemini' ? geminiCheckId.current : fishCheckId.current)) {
      if (provider === 'gemini') setGemini(nextVoice)
      else setFish(nextVoice)
      setInfo(appInfo.status === 'fulfilled' ? appInfo.value : null)
    }
    if (outputCheck === outputCheckId.current) setOutputs(devices.status === 'fulfilled' ? devices.value : [])
    if (results.some(result => result.status === 'rejected')) throw new Error('Alcuni controlli non sono disponibili.')
  }

  function openDiagnosticAction(action: CheckAction): void {
    if (action === 'settings') setPage('settings')
    else if (action === 'guide') setPage('guide')
    else if (action === 'browser') { setBrowserSetupRequest(value => value + 1); setPage('live') }
    else { if (action === 'audio') setAudioSettingsRequest(value => value + 1); setPage('console') }
  }

  async function update(patch: Partial<AppSettings>): Promise<void> {
    if (sessionLocked() || busy || playing || voiceProfileBusy || keyBusy) return
    try {
      const next = await window.neb.updateSettings(patch)
      audio.current.setVolume(next.outputVolume)
      setSettings(next)
      setError('')
    } catch (reason) { setError(message(reason)) }
  }

  function previewOutputVolume(volume: number): void {
    if (sessionLocked()) return
    audio.current.setVolume(volume)
    setSettings((current) => ({ ...current, outputVolume: volume }))
  }

  async function loadFile(file: File | undefined): Promise<void> {
    if (sessionLocked()) return
    if (!file) return
    playbackReadyLine.current = null
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
    if (sessionLocked()) return
    if (!fileName || busy) return
    playbackReadyLine.current = null
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
    if (sessionLocked()) return
    if (!hasAudio || busy) return
    playbackReadyLine.current = null
    const current = ++requestId.current
    setBusy(true)
    try {
      await audio.current.replay(settings.outputDeviceId)
      if (current !== requestId.current) return
      setActiveReadyLineId(null)
      playbackActive.current = true
      setPlaying(true)
      if (!avatar.enabled) playbackStartedAt.current = performance.now()
      setStatus(`Riascolto su ${selectedOutputLabel(outputs, settings.outputDeviceId)}`)
      setError('')
    } catch (reason) { if (current === requestId.current) setError(`Riascolto non riuscito: ${message(reason)}`) }
    finally { if (current === requestId.current) setBusy(false) }
  }

  async function speak(text: string = script, readyLineId: string | null = null): Promise<void> {
    if (sessionLocked()) return
    if (busy || playing || keyBusy || voiceProfileBusy || !speechStatus.ready || !text.trim()) return
    if (outputs.length === 0) {
      setError('Nessuna uscita audio disponibile. Apri l’app Windows nativa prima di generare la voce.')
      return
    }
    playbackReadyLine.current = null
    const current = ++requestId.current
    const started = performance.now()
    setActiveReadyLineId(readyLineId)
    generationInProgress.current = true
    playbackActive.current = false
    setPlaying(false)
    playbackStartedAt.current = null
    playbackMs.current = null
    setBusy(true)
    setStatus(settings.providerId === 'fish-openrouter' ? 'Generazione con Fish...' : 'Generazione con Gemini…')
    setError('')
    audio.current.stop()
    playbackReadyLine.current = readyLineId ? { id: readyLineId, tab: activeReadyTab } : null
    setMetrics(null)
    let firstChunkMs: number | null = null
    let streamError: unknown = null
    try {
      await audio.current.beginStream(settings.outputDeviceId)
      if (current !== requestId.current) return
      const result = await window.neb.synthesizeStream(buildSpeechRequest(settings, text), (chunk) => {
        if (current !== requestId.current || streamError) return
        try {
          audio.current.appendPcm(chunk)
          if (firstChunkMs === null) {
            firstChunkMs = Math.round(performance.now() - started)
            setPlaying(true)
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
      setMetrics({ firstChunkMs: firstChunkMs ?? result.generationMs, generationMs: result.generationMs, durationSeconds, playbackMs: playbackMs.current ?? undefined, modelId: settings.providerId === 'fish-openrouter' ? settings.fishModel : settings.geminiModel, ttsEstimatedCostUsd: result.ttsEstimatedCostUsd })
      setStatus(playbackActive.current ? `Audio su ${selectedOutputLabel(outputs, settings.outputDeviceId)}` : avatar.enabled ? 'Attendo la voce avatar...' : 'Riproduzione terminata')
    } catch (reason) {
      if (current === requestId.current) { playbackReadyLine.current = null; generationInProgress.current = false; playbackActive.current = false; setPlaying(false); setActiveReadyLineId(null); audio.current.stop(); setError(message(streamError ?? reason)); setStatus('Generazione non riuscita') }
    } finally { if (current === requestId.current) setBusy(false) }
  }

  function stop(): void {
    live.stop()
    automation.stop()
    playbackReadyLine.current = null
    requestId.current++
    audio.current.stop()
    avatar.disconnect()
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
    if (sessionLocked()) return
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

  async function generateModelBLines(): Promise<void> {
    if (sessionLocked()) return
    if (readyLinesA.length === 0 || generatingModelB) return
    setGeneratingModelB(true)
    setError('')
    setStatus('Generazione versione Model B con Nemotron (OpenRouter)…')
    try {
      const rawTexts = readyLinesA.map((line) => line.text)
      const paraphrased = await window.neb.paraphraseReadyLines(rawTexts)
      if (paraphrased.length === 0) {
        throw new Error('Nessuna battuta generata dal modello Nemotron.')
      }
      const nextLinesB = createReadyLinesFromTexts(paraphrased)
      setReadyLinesB(nextLinesB)
      setActiveReadyTab('modelB')
      setStatus(`Generate ${nextLinesB.length} battute per MODEL B con Nemotron 3 Ultra`)
    } catch (reason) {
      setError(`Generazione Model B non riuscita: ${message(reason)}`)
      setStatus('Errore generazione Model B')
    } finally {
      setGeneratingModelB(false)
    }
  }

  async function regenerateSingleLine(id: string, text: string, index: number): Promise<void> {
    if (sessionLocked()) return
    if (singleRegeneratingId || generatingModelB) return
    setSingleRegeneratingId(id)
    setError('')
    setStatus('Rielaborazione battuta con Nemotron…')
    try {
      const baseText = activeReadyTab === 'modelB' && readyLinesA[index] ? readyLinesA[index].text : text
      const newText = await window.neb.paraphraseSingleLine(baseText, text)
      if (newText.trim()) {
        setLines((current) => editReadyLine(current, id, newText.trim()))
        setStatus('Battuta rigenerata con successo con Nemotron 3 Ultra')
      }
    } catch (reason) {
      setError(`Rigenerazione non riuscita: ${message(reason)}`)
      setStatus('Errore rigenerazione battuta')
    } finally {
      setSingleRegeneratingId(null)
    }
  }

  const isLinux = info?.platform === 'linux'
  const virtualOutput = outputs.find((output) => isLinux ? /NEB[ _]Voice/i.test(output.label) : /CABLE Input/i.test(output.label))
  const routing = routingStatus(outputs, settings.outputDeviceId, info?.platform)
  const geminiMessage = gemini.message === 'Gemini connected' ? 'Connesso a Gemini' : gemini.message.startsWith('Gemini API key is missing') ? 'Chiave API Gemini assente' : gemini.message
  const activeKeyName = settings.providerId === 'fish-openrouter' ? settings.fishModel.endsWith(':free') ? 'Fish Free · OpenRouter' : 'Fish Pro · OpenRouter' : geminiKeyLabel(settings.geminiKeySource, keyStatus)
  const setLines = activeReadyTab === 'modelA' ? setReadyLinesA : setReadyLinesB
  const common = {
    settings, audioSettingsRequest, gemini: speechStatus, script, scriptInput, routing, isLinux, busy: busy || keyBusy || voiceProfileBusy || automation.locked || live.locked,
    playing: playing || automation.snapshot.phase === 'speaking', hasAudio,
    status: automation.locked ? automation.snapshot.message : status, error: automation.error || error, metrics, activeKeyName,
    readyLinesCount: readyLinesA.length + readyLinesB.length, onOpenReadyLines: () => live.locked ? setPage('live') : automation.locked ? setAutomationOpen(true) : setReadyOpen(true),
    onScriptChange: setScript, onSpeak: speak, onStop: stop, onReplay: replay
  }
  const readyPanel = readyOpen && (
    <ReadyLinesPanel
      automationLocked={automation.locked || live.locked}
      automation={(editorReady) => <AutomationLauncher editorReady={editorReady} onOpen={() => { setReadyOpen(false); setAutomationOpen(true) }} />}
      linesA={readyLinesA}
      linesB={readyLinesB}
      activeTab={activeReadyTab}
      onTabChange={setActiveReadyTab}
      currentScript={script}
      ready={speechStatus.ready}
      busy={busy || automation.locked || live.locked}
      playing={playing || automation.snapshot.phase === 'speaking'}
      activeLineId={activeReadyLineId}
      completedLine={completedReadyLine}
      onConsumeCompletion={() => setCompletedReadyLine(null)}
      autoPrepare={autoPrepare}
      onAutoPrepareChange={setAutoPrepare}
      prepareRequested={prepareRequested}
      onConsumePrepare={() => setPrepareRequested(false)}
      status={automation.locked ? automation.snapshot.message : status}
      error={automation.error || error}
      generatingModelB={generatingModelB}
      onGenerateModelB={() => void generateModelBLines()}
      singleRegeneratingId={singleRegeneratingId}
      onRegenerateLine={(id, text, index) => void regenerateSingleLine(id, text, index)}
      onImport={(result, mode) => {
        setReadyLinesA((current) => importReadyLines(current, result.modelA, mode))
        setReadyLinesB((current) => importReadyLines(current, result.modelB, mode))
        setActiveReadyTab(result.modelA.length > 0 ? 'modelA' : 'modelB')
        setError('')
        setStatus(`Importate ${result.modelA.length} battute per MODEL A e ${result.modelB.length} per MODEL B`)
      }}
      onAdd={(text) => { const id = crypto.randomUUID(); setLines((current) => addReadyLine(current, text, id)) }}
      onEdit={(id, text) => setLines((current) => editReadyLine(current, id, text))}
      onMove={(id, direction) => setLines((current) => moveReadyLine(current, id, direction))}
      onToggleDone={(id) => setLines((current) => toggleReadyLineDone(current, id))}
      onRemove={(id) => setLines((current) => removeReadyLine(current, id))}
      onRestore={(line, index) => setLines((current) => restoreReadyLine(current, line, index))}
      onClear={() => setLines([])}
      onSpeak={(line) => { void speak(line.text, line.id) }}
      onStop={stop}
      onClose={() => setReadyOpen(false)}
    />
  )
  const automationPanel = <>
    <AutomationPanel open={automationOpen} onClose={() => setAutomationOpen(false)} onScript={() => { setAutomationOpen(false); setReadyOpen(true) }} automation={automation} lines={activeReadyTab === 'modelA' ? readyLinesA : readyLinesB} tab={activeReadyTab} available={!s2sUnavailableReason} unavailableReason={s2sUnavailableReason} simulationAvailable={gemini.ready && !outlierWorkspace.locked} localOutputs={localSimulationOutputs(outputs)} />
    {!automationOpen && automation.locked && <button className="s2s-reopen" onClick={() => setAutomationOpen(true)}><span className="status-dot green" /> Automatico · {automation.snapshot.lineIndex}/{automation.snapshot.total} · Apri player</button>}
  </>

  const avatarPanel = <AvatarPanel session={avatar} deviceId={settings.outputDeviceId} volume={settings.outputVolume} locked={busy || playing || live.locked || automation.locked || keyBusy || voiceProfileBusy} ready={speechStatus.ready} visible={conversationMode || page === 'console' || page === 'live'} onStop={stop} onTest={() => void speak('Ciao, sono NEB. Questa e una breve prova della voce e del movimento delle labbra.')} />
  if (conversationMode) return <>{avatarPanel}<ConversationView {...common} conversationStatus={conversationStatus} onClose={() => void toggleConversationMode()} />{readyPanel}{automationPanel}</>

  const pageTitle = page === 'console' ? 'Console' : page === 'outlier' ? 'Outlier' : page === 'live' ? 'NEB Live' : page === 'settings' ? 'Impostazioni' : page === 'guide' ? 'Guida' : 'Diagnostica'
  return <div className={sidebarCollapsed ? 'app-frame sidebar-collapsed' : 'app-frame'}>
    <aside className="sidebar">
      <button type="button" className="sidebar-toggle" aria-label={sidebarCollapsed ? 'Apri menu' : 'Chiudi menu'} title={sidebarCollapsed ? 'Apri menu' : 'Chiudi menu'} aria-controls="sidebar-nav" aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}>{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
      <div className="brand"><span className="brand-icon">N</span><div className="brand-copy"><strong>NEB VOICE</strong><small>VOICE CONSOLE</small></div></div>
      <nav id="sidebar-nav" aria-label="Navigazione principale">
        <button className={page === 'console' ? 'nav active' : 'nav'} aria-label="Console" title="Console" aria-current={page === 'console' ? 'page' : undefined} onClick={() => setPage('console')}><Icon name="console" /><span className="nav-label">Console</span></button>
        <button className={page === 'outlier' ? 'nav active' : 'nav'} aria-label="Outlier" title="Outlier" aria-current={page === 'outlier' ? 'page' : undefined} onClick={() => setPage('outlier')}><Layers size={20} /><span className="nav-label">Outlier</span></button>
        <button className={page === 'live' ? 'nav active' : 'nav'} aria-label="NEB Live" title="NEB Live" aria-current={page === 'live' ? 'page' : undefined} onClick={() => setPage('live')}><Radio size={20} /><span className="nav-label">NEB Live</span></button>
        <button className={page === 'settings' ? 'nav active' : 'nav'} aria-label="Impostazioni" title="Impostazioni" aria-current={page === 'settings' ? 'page' : undefined} onClick={() => setPage('settings')}><Icon name="settings" /><span className="nav-label">Impostazioni</span></button>
        <button className={page === 'guide' ? 'nav active' : 'nav'} aria-label="Guida audio" title="Guida audio" aria-current={page === 'guide' ? 'page' : undefined} onClick={() => setPage('guide')}><Icon name="book" /><span className="nav-label">Guida audio</span></button>
        <button className={page === 'diagnostics' ? 'nav active' : 'nav'} aria-label="Diagnostica" title="Diagnostica" aria-current={page === 'diagnostics' ? 'page' : undefined} onClick={() => setPage('diagnostics')}><Icon name="diagnostics" /><span className="nav-label">Diagnostica</span></button>
      </nav>
      <div className="sidebar-bottom"><span className={speechStatus.ready && !keyBusy ? 'status-dot green' : 'status-dot amber'} /><span>API: {activeKeyName}</span></div>
    </aside>

    <main className="main">
      <header className="topbar"><div><span className="eyebrow">NEB VOICE / {pageTitle.toUpperCase()}</span><h1>{pageTitle}</h1></div><div className={speechStatus.ready && !keyBusy ? 'connection ready' : 'connection'} aria-live="polite"><span className="status-dot" /><span className="connection-copy"><strong title={activeKeyName}>API in uso: {activeKeyName}</strong><small>{keyBusy ? 'Verifica in corso…' : speechStatus.ready ? 'Voce disponibile' : speechStatus.message}</small></span></div></header>
      {avatarPanel}
      {page === 'console' && <ConsoleView {...common} outputs={outputs} virtualOutput={virtualOutput} fileName={fileName} duration={duration} onUpdate={(patch) => void update(patch)} onPreviewVolume={previewOutputVolume} onRefreshOutputs={() => void refreshOutputs()} onLoadFile={(file) => void loadFile(file)} onPlayFile={() => void play()} onOpenConversation={() => void toggleConversationMode()} />}
      {page === 'outlier' && <fieldset className="settings-session-lock" disabled={live.locked}><OutlierPage workspace={outlierWorkspace} voice={<ConsoleView {...common} outputs={outputs} virtualOutput={virtualOutput} fileName={fileName} duration={duration} onUpdate={(patch) => void update(patch)} onPreviewVolume={previewOutputVolume} onRefreshOutputs={() => void refreshOutputs()} onLoadFile={(file) => void loadFile(file)} onPlayFile={() => void play()} onOpenConversation={() => void toggleConversationMode()} />} /></fieldset>}
      <div className="neb-live-page" hidden={page !== 'live'}><fieldset className="settings-session-lock" disabled={automation.locked || busy || playing || keyBusy || voiceProfileBusy || outlierWorkspace.locked}><LivePage live={live} settings={settings} outputs={outputs} onUpdate={(patch) => void update(patch)} onRefreshOutputs={() => void refreshOutputs()} platform={info?.platform} geminiReady={speechStatus.ready} stopAvailable={Boolean(outlierWorkspace.status?.stopAvailable)} browserSetupRequest={browserSetupRequest} onOpenDiagnostics={() => setPage('diagnostics')} /></fieldset></div>
      {page === 'settings' && <fieldset className="settings-session-lock" disabled={automation.locked || live.locked || busy || playing}><SettingsPage fish={fish} onUpdate={(patch)=>void update(patch)} onFishBusy={setVoiceProfileBusy} gemini={gemini} geminiMessage={geminiMessage} info={info} settings={settings} keyStatus={keyStatus} keyBusy={keyBusy || busy || automation.locked || live.locked} keyMessage={keyMessage} keyError={keyError} voiceProfileBusy={voiceProfileBusy || automation.locked || live.locked} voiceProfileMessage={voiceProfileMessage} voiceProfileError={voiceProfileError} onCheckGemini={() => void checkGemini()} onSaveGeminiKey={saveGeminiKey} onSelectGeminiKey={selectGeminiKey} onRemoveGeminiKey={removeGeminiKey} onExportVoiceProfile={() => void exportVoiceProfile()} onImportVoiceProfile={() => void importVoiceProfile()} onVoiceCreated={setSettings} /></fieldset>}
      {page === 'guide' && <SetupGuide />}
      {page === 'diagnostics' && <DiagnosticsPage info={info} settings={settings} outputs={outputs} speech={speechStatus} browser={outlierWorkspace.status} audio={live.audioStatus} receiving={live.receiving} avatar={avatar} operationBusy={busy || playing || live.locked || automation.locked || keyBusy || voiceProfileBusy || outlierWorkspace.locked || generatingModelB || Boolean(singleRegeneratingId)} onRefresh={refreshDiagnostics} onNavigate={openDiagnosticAction} onOpenLive={() => setPage('live')} />}
    </main>
    {readyPanel}
    {automationPanel}
    {live.locked && page !== 'live' && <button className="neb-live-reopen" onClick={() => setPage('live')}>NEB Live · {live.snapshot.message} · Apri</button>}
  </div>
}

function selectedOutputLabel(outputs: AudioOutput[], deviceId: string): string {
  return outputs.find((output) => output.deviceId === deviceId)?.label ?? (deviceId === 'default' ? 'Predefinito di sistema' : 'Dispositivo salvato non disponibile')
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}
