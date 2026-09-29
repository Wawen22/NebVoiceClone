import { useEffect, useRef, useState } from 'react'
import type { AppSettings, ProviderStatus } from '../../shared/contracts'
import { GEMINI_CONSENT_PHRASE_IT, GEMINI_VOICE_REPLICATION_DOCS } from '../../shared/voiceReplication'
import { prepareVoiceAudio, type PreparedVoiceAudio } from './audio/voiceCapture'
import { VoiceActivityDetector, type VoiceActivityPhase, type VoiceClipRange } from './audio/voiceActivity'
import { Icon } from './Icons'

type Kind = 'reference' | 'consent'
type Capture = { kind: Kind; phase: VoiceActivityPhase }
type CaptureSession = { kind: Kind; recorder: MediaRecorder; stream: MediaStream; context: AudioContext; timer: ReturnType<typeof setInterval>; detector: VoiceActivityDetector; startedAt: number; clip: VoiceClipRange | null; cancelled: boolean }

export function VoiceReplicationWizard({ gemini, settings, onCreated }: { gemini: ProviderStatus; settings: AppSettings; onCreated: (next: AppSettings) => void }): React.JSX.Element {
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
    if (!navigator.mediaDevices?.enumerateDevices) { setError('Microphone selection is unavailable in this environment.'); return }
    let probe: MediaStream | null = null
    setFindingMicrophones(true)
    try {
      if (requestAccess) probe = await navigator.mediaDevices.getUserMedia({ audio: true })
      const devices = await navigator.mediaDevices.enumerateDevices()
      const inputs = devices.filter((device) => device.kind === 'audioinput' && device.deviceId && device.deviceId !== 'default')
      setMicrophones(inputs)
      setMicrophoneId((current) => current && !inputs.some((device) => device.deviceId === current) ? '' : current)
      setError('')
    } catch (reason) { setError(`Microphone list unavailable: ${message(reason)}`) }
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
          if (update.phase === 'timeout') setError('No voice detected after 2 minutes. Try again closer to the selected microphone.')
          next.stop()
        } else setCapture((current) => current?.kind === kind && current.phase === update.phase ? current : { kind, phase: update.phase })
      }, 50)
      setError('')
    } catch (reason) {
      mic?.getTracks().forEach((track) => track.stop())
      if (context) void context.close()
      setCapture(null)
      setError(`Microphone unavailable: ${message(reason)}`)
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
      setResult('Voice created and selected. Open Console and test a short sentence on your speakers.')
    } catch (reason) { setError(message(reason)) }
    finally { setBusy(false) }
  }

  return <section className="panel voice-wizard">
    <span className="eyebrow">GEMINI · VOICE REPLICATION</span><h3>Clone your voice</h3>
    <p>Only create a copy of your own adult voice. Both recordings are sent to Google only when you press CREATE VOICE. Audio is kept in memory for this session; only the returned voice ID is saved locally.</p>
    <div className="wizard-step"><strong><span className="step-number">1</span> API status</strong><span className={gemini.ready ? 'wizard-ready' : 'wizard-warning'}>{gemini.message}</span></div>
    <div className="wizard-step"><strong><span className="step-number">2</span> Reference voice</strong><p>Speak naturally for 10–30 seconds in a quiet room. Use the same microphone for both clips. After pressing RECORD MICROPHONE, you can move away: capture starts when your voice is detected and stops after a pause. Small background noises are filtered; listen to the preview before using it.</p>
      <AudioInput kind="reference" audio={reference} capture={capture} processing={processing} microphones={microphones} microphoneId={microphoneId} findingMicrophones={findingMicrophones} onMicrophoneChange={setMicrophoneId} onRefreshMicrophones={() => void refreshMicrophones(true)} onChoose={choose} onRecord={toggleRecording} onDiscard={discard} />
    </div>
    <div className="wizard-step"><strong><span className="step-number">3</span> Consent</strong><p>Read this exact Italian sentence aloud in one recording. Voice detection also works here; pause briefly after the final word.</p><blockquote lang="it">{GEMINI_CONSENT_PHRASE_IT}</blockquote><button type="button" className="text-button copy-consent" onClick={() => { void navigator.clipboard.writeText(GEMINI_CONSENT_PHRASE_IT).then(() => setCopied(true)).catch((reason: unknown) => setError(`Copy failed: ${message(reason)}`)) }}><Icon name="copy" /> {copied ? 'Copiata' : 'Copia frase'}</button>
      <AudioInput kind="consent" audio={consent} capture={capture} processing={processing} microphones={microphones} microphoneId={microphoneId} findingMicrophones={findingMicrophones} onMicrophoneChange={setMicrophoneId} onRefreshMicrophones={() => void refreshMicrophones(true)} onChoose={choose} onRecord={toggleRecording} onDiscard={discard} />
      <p className="hint">Phrase verified against the <a href={GEMINI_VOICE_REPLICATION_DOCS} target="_blank" rel="noreferrer">current Gemini documentation <Icon name="external" size={13} /></a>.</p>
    </div>
    <div className="wizard-step"><strong><span className="step-number">4</span> Validate and create</strong><p>Recordings are converted locally to mono, 24 kHz, 16-bit PCM WAV when needed.</p>
      <label>Voice name<input className="voice-name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} /></label>
      <label className="checkbox"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm both recordings are my own voice and I consent to Gemini creating a synthetic voice from them.</label>
      <div className="action-row"><button className="primary" disabled={!gemini.ready || !reference || !consent || !confirmed || busy || Boolean(capture) || Boolean(processing) || !name.trim()} onClick={() => void create()}>{busy ? 'CREATING VOICE…' : 'CREATE VOICE'}</button></div>
      {error && <div className="notice error" role="alert">{error}</div>}{result && <div className="notice" role="status">{result}</div>}
    </div>
    {settings.replicatedVoice && <div className="wizard-step"><strong>Saved Gemini voice</strong><div className="diag-row"><span>Name</span><strong>{settings.replicatedVoice.displayName}</strong></div><div className="diag-row"><span>Voice ID</span><strong>{settings.replicatedVoice.id}</strong></div><div className="diag-row"><span>Created</span><strong>{new Date(settings.replicatedVoice.createdAt).toLocaleString()}</strong></div><div className="diag-row"><span>Model</span><strong>{settings.replicatedVoice.model}</strong></div>{settings.replicatedVoice.expiresAt && <div className="diag-row"><span>Expires</span><strong>{new Date(settings.replicatedVoice.expiresAt).toLocaleString()}</strong></div>}</div>}
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
  const captureMessage = active === 'calibrating' ? 'Measuring background noise…' : active === 'waiting' ? 'Waiting for your voice · move to a quiet spot (2 min max)' : active === 'speaking' ? 'Recording your voice · stops after a pause' : null
  return <><div className="recording-controls"><div className="file-row"><button className={active ? 'record-button recording' : 'record-button'} onClick={() => void onRecord(kind)} disabled={Boolean((capture && capture.kind !== kind) || processing)}><Icon name={active ? 'stop' : 'mic'} /> {active ? active === 'speaking' ? 'Stop recording' : 'Cancel waiting' : 'Record microphone'}</button><label className="file-button"><Icon name="upload" /> Choose MP3 or WAV<input type="file" accept=".wav,.mp3,audio/wav,audio/mpeg" disabled={controlsBusy} onChange={(event) => { void onChoose(kind, event.target.files?.[0]); event.target.value = '' }} /></label><span className="file-name" role="status">{captureMessage || (processing === kind ? 'Preparing audio…' : audio?.name || 'No recording selected')}</span></div>
    <div className="microphone-picker"><label htmlFor={`microphone-${kind}`}>Microphone</label><select id={`microphone-${kind}`} value={microphoneId} disabled={controlsBusy || findingMicrophones} onChange={(event) => onMicrophoneChange(event.target.value)}><option value="">System default</option>{microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select><button type="button" className="text-button" disabled={controlsBusy || findingMicrophones} onClick={onRefreshMicrophones}>{findingMicrophones ? 'Detecting…' : 'Detect microphones'}</button></div></div>
    {audio && <><div className="audio-details"><span>{audio.details.durationSeconds.toFixed(1)} s</span><span>{audio.details.sampleRate.toLocaleString()} Hz</span><span>{audio.details.channels === 1 ? 'mono' : `${audio.details.channels} channels`}</span><span>{audio.details.bitsPerSample}-bit PCM WAV</span>{audio.converted && <span>converted locally</span>}</div>{kind === 'reference' && audio.details.durationSeconds < 10 && <p className="hint">Reference clip is too short. Record at least 10 seconds before creating the voice.</p>}<AudioPreview audio={audio} onDiscard={() => onDiscard(kind)} disabled={controlsBusy} /></>}
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
  return <div className="voice-preview"><audio ref={player} controls preload="metadata" src={url || undefined} aria-label={`Listen to ${audio.name}`} /><button type="button" disabled={disabled} onClick={onDiscard}>DISCARD</button><span>Listen before creating the voice.</span></div>
}

function message(reason: unknown): string { return reason instanceof Error ? reason.message : String(reason) }
