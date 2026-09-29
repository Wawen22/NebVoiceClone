import { useEffect, useRef, useState } from 'react'
import type { AppSettings, ProviderStatus } from '../../shared/contracts'
import { GEMINI_CONSENT_PHRASE_IT, GEMINI_VOICE_REPLICATION_DOCS } from '../../shared/voiceReplication'
import { prepareVoiceAudio, type PreparedVoiceAudio } from './audio/voiceCapture'
import { VoiceActivityDetector, type VoiceActivityPhase, type VoiceClipRange } from './audio/voiceActivity'
import { Icon } from './Icons'

type Kind = 'reference' | 'consent'
type Capture = { kind: Kind; phase: VoiceActivityPhase }
type CaptureSession = { kind: Kind; recorder: MediaRecorder; stream: MediaStream; context: AudioContext; timer: ReturnType<typeof setInterval>; detector: VoiceActivityDetector; startedAt: number; clip: VoiceClipRange | null; cancelled: boolean }

export function VoiceReplicationWizard({ gemini, settings, activeKeyName, onCreated }: { gemini: ProviderStatus; settings: AppSettings; activeKeyName: string; onCreated: (next: AppSettings) => void }): React.JSX.Element {
  const [name, setName] = useState('La mia voce')
  const [reference, setReference] = useState<PreparedVoiceAudio | null>(null)
  const [consent, setConsent] = useState<PreparedVoiceAudio | null>(null)
  const [capture, setCapture] = useState<Capture | null>(null)
  const [processing, setProcessing] = useState<Kind | null>(null)
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([])
  const [microphoneId, setMicrophoneId] = useState('')
  const [findingMicrophones, setFindingMicrophones] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)
  const session = useRef<CaptureSession | null>(null)
  const starting = useRef(false)

  useEffect(() => {
    void refreshMicrophones(false)
    const onDeviceChange = (): void => { void refreshMicrophones(false) }
    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange)
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange)
      const active = session.current
      if (active) {
        active.cancelled = true
        clearInterval(active.timer)
        active.recorder.onstop = null
        if (active.recorder.state !== 'inactive') active.recorder.stop()
        active.stream.getTracks().forEach((track) => track.stop())
        void active.context.close()
        session.current = null
      }
    }
  }, [])

  async function refreshMicrophones(requestAccess: boolean): Promise<void> {
    if (!navigator.mediaDevices?.enumerateDevices) { setError('La selezione del microfono non è disponibile in questo ambiente.'); return }
    let probe: MediaStream | null = null
    setFindingMicrophones(true)
    try {
      if (requestAccess) probe = await navigator.mediaDevices.getUserMedia({ audio: true })
      const devices = await navigator.mediaDevices.enumerateDevices()
      const inputs = devices.filter((device) => device.kind === 'audioinput' && device.deviceId && device.deviceId !== 'default')
      setMicrophones(inputs)
      setMicrophoneId((current) => current && !inputs.some((device) => device.deviceId === current) ? '' : current)
      setError('')
    } catch (reason) { setError(`Elenco dei microfoni non disponibile: ${message(reason)}`) }
    finally { probe?.getTracks().forEach((track) => track.stop()); setFindingMicrophones(false) }
  }

  async function choose(kind: Kind, file: File | undefined): Promise<void> {
    if (!file) return
    setProcessing(kind)
    try {
      const prepared = await prepareVoiceAudio(file, file.name)
      if (kind === 'reference') setReference(prepared)
      else setConsent(prepared)
      setConfirmed(false)
      setError('')
      setResult('')
    } catch (reason) { setError(message(reason)) }
    finally { setProcessing(null) }
  }

  async function toggleRecording(kind: Kind): Promise<void> {
    if (starting.current) return
    if (session.current) {
      const active = session.current
      if (active.kind !== kind) return
      active.clip = active.detector.finishManually(performance.now() - active.startedAt)
      active.cancelled = !active.clip
      clearInterval(active.timer)
      if (active.recorder.state !== 'inactive') active.recorder.stop()
      return
    }
    if (processing) return
    starting.current = true
    setCapture({ kind, phase: 'calibrating' })
    let mic: MediaStream | null = null
    let context: AudioContext | null = null
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { ...(microphoneId ? { deviceId: { exact: microphoneId } } : {}), echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      const microphone = mic
      void refreshMicrophones(false)
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
      const next = new MediaRecorder(mic, mime ? { mimeType: mime } : undefined)
      context = new AudioContext()
      const source = context.createMediaStreamSource(mic)
      const highpass = context.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = 120
      const lowpass = context.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.value = 3500
      const analyser = context.createAnalyser()
      analyser.fftSize = 2048
      source.connect(highpass).connect(lowpass).connect(analyser)
      await context.resume()
      const samples = new Float32Array(analyser.fftSize)
      const detector = new VoiceActivityDetector(kind)
      const chunks: BlobPart[] = []
      next.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      next.onstop = () => {
        microphone.getTracks().forEach((track) => track.stop())
        void context?.close()
        const active = session.current
        if (!active || active.recorder !== next) return
        clearInterval(active.timer)
        session.current = null
        setCapture(null)
        if (active.cancelled || !active.clip) return
        setProcessing(kind)
        void prepareVoiceAudio(new Blob(chunks, { type: next.mimeType }), `${kind === 'reference' ? 'Reference' : 'Consenso'} · microfono`, { startSeconds: active.clip.startMs / 1000, endSeconds: active.clip.endMs / 1000 })
          .then((prepared) => { if (kind === 'reference') setReference(prepared); else setConsent(prepared); setConfirmed(false); setResult(''); setError('') })
          .catch((reason: unknown) => setError(message(reason)))
          .finally(() => setProcessing(null))
      }
      next.start()
      const startedAt = performance.now()
      const active: CaptureSession = { kind, recorder: next, stream: mic, context, timer: 0 as unknown as ReturnType<typeof setInterval>, detector, startedAt, clip: null, cancelled: false }
      session.current = active
      active.timer = setInterval(() => {
        if (session.current !== active || next.state !== 'recording') return
        analyser.getFloatTimeDomainData(samples)
        let power = 0
        for (const sample of samples) power += sample * sample
        const update = detector.sample(Math.sqrt(power / samples.length), performance.now() - startedAt)
        if (update.phase === 'finished' || update.phase === 'timeout') {
          active.clip = update.clip ?? null
          active.cancelled = update.phase === 'timeout'
          clearInterval(active.timer)
          if (update.phase === 'timeout') setError('Nessuna voce rilevata dopo 2 minuti. Riprova più vicino al microfono selezionato.')
          next.stop()
        } else setCapture((current) => current?.kind === kind && current.phase === update.phase ? current : { kind, phase: update.phase })
      }, 50)
      setError('')
    } catch (reason) {
      mic?.getTracks().forEach((track) => track.stop())
      if (context) void context.close()
      setCapture(null)
      setError(`Microfono non disponibile: ${message(reason)}`)
    } finally { starting.current = false }
  }

  function discard(kind: Kind): void {
    if (kind === 'reference') setReference(null)
    else setConsent(null)
    setConfirmed(false)
    setResult('')
    setError('')
  }

  async function create(): Promise<void> {
    if (!reference || !consent || busy || !confirmed) return
    setBusy(true)
    setError('')
    setResult('')
    try {
      const next = await window.neb.createReplicatedVoice({ displayName: name, sourceAudio: reference.bytes, consentAudio: consent.bytes, consentConfirmed: true })
      onCreated(next)
      setReference(null)
      setConsent(null)
      setConfirmed(false)
      setResult(`Voce creata per ${activeKeyName} e selezionata. Apri la Console e prova una breve frase.`)
    } catch (reason) { setError(message(reason)) }
    finally { setBusy(false) }
  }

  return <section className="panel voice-wizard">
    <span className="eyebrow">GEMINI / VOCE PERSONALE · SOLO {activeKeyName.toLocaleUpperCase('it-IT')}</span><h3>Crea la tua voce per {activeKeyName}</h3>
    <p>Questa azione crea una voce per {activeKeyName}. Se ne hai già una, la nuova voce sostituirà solo il profilo locale di questa chiave. Le altre chiavi manterranno le proprie voci.</p>
    <p>Usa solo la tua voce adulta. Le registrazioni vengono inviate a Google quando premi Crea voce. L’audio resta in memoria durante questa sessione; viene salvato solo l’ID della voce creata.</p>
    <div className="wizard-step"><strong><span className="step-number">1</span> Stato API</strong><span className={gemini.ready ? 'wizard-ready' : 'wizard-warning'}>{gemini.message}</span></div>
    <div className="wizard-step"><strong><span className="step-number">2</span> Voce di riferimento</strong><p>Parla naturalmente per 10–30 secondi in una stanza tranquilla. Usa lo stesso microfono per entrambe le clip. La registrazione inizia quando viene rilevata la voce e termina dopo una pausa. Ascolta l’anteprima prima di continuare.</p>
      <AudioInput kind="reference" audio={reference} capture={capture} processing={processing} microphones={microphones} microphoneId={microphoneId} findingMicrophones={findingMicrophones} onMicrophoneChange={setMicrophoneId} onRefreshMicrophones={() => void refreshMicrophones(true)} onChoose={choose} onRecord={toggleRecording} onDiscard={discard} />
    </div>
    <div className="wizard-step"><strong><span className="step-number">3</span> Consenso</strong><p>Leggi ad alta voce questa frase esatta in una sola registrazione. Fai una breve pausa dopo l’ultima parola.</p><blockquote lang="it">{GEMINI_CONSENT_PHRASE_IT}</blockquote><button type="button" className="text-button copy-consent" onClick={() => { void navigator.clipboard.writeText(GEMINI_CONSENT_PHRASE_IT).then(() => setCopied(true)).catch((reason: unknown) => setError(`Copia non riuscita: ${message(reason)}`)) }}><Icon name="copy" /> {copied ? 'Copiata' : 'Copia frase'}</button>
      <AudioInput kind="consent" audio={consent} capture={capture} processing={processing} microphones={microphones} microphoneId={microphoneId} findingMicrophones={findingMicrophones} onMicrophoneChange={setMicrophoneId} onRefreshMicrophones={() => void refreshMicrophones(true)} onChoose={choose} onRecord={toggleRecording} onDiscard={discard} />
      <p className="hint">Frase verificata nella <a href={GEMINI_VOICE_REPLICATION_DOCS} target="_blank" rel="noreferrer">documentazione Gemini <Icon name="external" size={13} /></a>.</p>
    </div>
    <div className="wizard-step"><strong><span className="step-number">4</span> Verifica e crea</strong><p>Se necessario, le registrazioni vengono convertite localmente in WAV PCM mono, 24 kHz, 16 bit.</p>
      <label>Nome della voce<input className="voice-name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} /></label>
      <label className="checkbox"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Confermo che entrambe le registrazioni contengono la mia voce e acconsento alla creazione di una voce sintetica con Gemini.</label>
      <div className="action-row"><button className="primary" disabled={!gemini.ready || !reference || !consent || !confirmed || busy || Boolean(capture) || Boolean(processing) || !name.trim()} onClick={() => void create()}>{busy ? 'CREAZIONE IN CORSO…' : 'CREA VOCE'}</button></div>
      {error && <div className="notice error" role="alert">{error}</div>}{result && <div className="notice" role="status">{result}</div>}
    </div>
    {settings.replicatedVoice && <div className="wizard-step"><strong>Voce Gemini salvata</strong><div className="diag-row"><span>Nome</span><strong>{settings.replicatedVoice.displayName}</strong></div><div className="diag-row"><span>ID voce</span><strong>{settings.replicatedVoice.id}</strong></div><div className="diag-row"><span>Creata</span><strong>{new Date(settings.replicatedVoice.createdAt).toLocaleString('it-IT')}</strong></div><div className="diag-row"><span>Modello</span><strong>{settings.replicatedVoice.model}</strong></div>{settings.replicatedVoice.expiresAt && <div className="diag-row"><span>Scade</span><strong>{new Date(settings.replicatedVoice.expiresAt).toLocaleString('it-IT')}</strong></div>}</div>}
  </section>
}

function AudioInput({ kind, audio, capture, processing, microphones, microphoneId, findingMicrophones, onMicrophoneChange, onRefreshMicrophones, onChoose, onRecord, onDiscard }: {
  kind: Kind
  audio: PreparedVoiceAudio | null
  capture: Capture | null
  processing: Kind | null
  microphones: MediaDeviceInfo[]
  microphoneId: string
  findingMicrophones: boolean
  onMicrophoneChange: (id: string) => void
  onRefreshMicrophones: () => void
  onChoose: (kind: Kind, file: File | undefined) => Promise<void>
  onRecord: (kind: Kind) => Promise<void>
  onDiscard: (kind: Kind) => void
}): React.JSX.Element {
  const controlsBusy = Boolean(capture || processing)
  const active = capture?.kind === kind ? capture.phase : null
  const captureMessage = active === 'calibrating' ? 'Misuro il rumore di fondo…' : active === 'waiting' ? 'Attendo la tua voce · vai in un luogo tranquillo (max 2 min)' : active === 'speaking' ? 'Registrazione in corso · termina dopo una pausa' : null
  return <><div className="recording-controls"><div className="file-row"><button className={active ? 'record-button recording' : 'record-button'} onClick={() => void onRecord(kind)} disabled={Boolean((capture && capture.kind !== kind) || processing)}><Icon name={active ? 'stop' : 'mic'} /> {active ? active === 'speaking' ? 'Ferma registrazione' : 'Annulla attesa' : 'Registra dal microfono'}</button><label className="file-button"><Icon name="upload" /> Scegli MP3 o WAV<input type="file" accept=".wav,.mp3,audio/wav,audio/mpeg" disabled={controlsBusy} onChange={(event) => { void onChoose(kind, event.target.files?.[0]); event.target.value = '' }} /></label><span className="file-name" role="status">{captureMessage || (processing === kind ? 'Preparo l’audio…' : audio?.name || 'Nessuna registrazione selezionata')}</span></div>
    <div className="microphone-picker"><label htmlFor={`microphone-${kind}`}>Microfono</label><select id={`microphone-${kind}`} value={microphoneId} disabled={controlsBusy || findingMicrophones} onChange={(event) => onMicrophoneChange(event.target.value)}><option value="">Predefinito di sistema</option>{microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microfono ${index + 1}`}</option>)}</select><button type="button" className="text-button" disabled={controlsBusy || findingMicrophones} onClick={onRefreshMicrophones}>{findingMicrophones ? 'Rilevamento…' : 'Rileva microfoni'}</button></div></div>
    {audio && <><div className="audio-details"><span>{audio.details.durationSeconds.toFixed(1)} s</span><span>{audio.details.sampleRate.toLocaleString('it-IT')} Hz</span><span>{audio.details.channels === 1 ? 'mono' : `${audio.details.channels} canali`}</span><span>WAV PCM {audio.details.bitsPerSample} bit</span>{audio.converted && <span>convertito localmente</span>}</div>{kind === 'reference' && audio.details.durationSeconds < 10 && <p className="hint">La clip di riferimento è troppo breve. Registra almeno 10 secondi prima di creare la voce.</p>}<AudioPreview audio={audio} onDiscard={() => onDiscard(kind)} disabled={controlsBusy} /></>}
  </>
}

function AudioPreview({ audio, onDiscard, disabled }: { audio: PreparedVoiceAudio; onDiscard: () => void; disabled: boolean }): React.JSX.Element {
  const [url, setUrl] = useState<string | null>(null)
  const player = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    const next = URL.createObjectURL(new Blob([Uint8Array.from(audio.bytes).buffer], { type: 'audio/wav' }))
    setUrl(next)
    return () => { player.current?.pause(); URL.revokeObjectURL(next) }
  }, [audio])
  return <div className="voice-preview"><audio ref={player} controls preload="metadata" src={url || undefined} aria-label={`Ascolta ${audio.name}`} /><button type="button" disabled={disabled} onClick={onDiscard}>SCARTA</button><span>Ascolta prima di creare la voce.</span></div>
}

function message(reason: unknown): string { return reason instanceof Error ? reason.message : String(reason) }
