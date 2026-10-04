import { useEffect, useRef, useState } from 'react'
import type { AppSettings } from '../../../shared/contracts'
import type { LiveConfig, LiveLimits } from '../../../shared/live'
import { MAX_LIVE_IMAGE_FILE_BYTES, type LiveImageData } from '../../../shared/liveMaterials'
import { sameTarget, type BrowserTarget } from '../../../shared/outlier'
import type { S2SAudioStatus } from '../../../shared/s2s'
import { BrowserAudioEngine } from '../audio/AudioEngine'
import { streamS2SSpeech } from '../s2s/speechPlayer'
import { LiveController, type LiveOptions } from './controller'
import { LiveStartGate } from './startGate'
import { buildLiveSpeechRequest } from './speechRequest'

interface Arguments { settings: AppSettings; available: boolean; unavailableReason: string; otherBusy(): boolean }
const inactive: S2SAudioStatus = { state: 'inactive', captureId: null, target: null, message: 'Nel popup NEB: Collega questa scheda → Ascolta questa scheda.' }
const sameSource = (a: BrowserTarget | null, b: BrowserTarget | null): boolean => Boolean(a && b && sameTarget(a, b))

export function useLiveConversation(args: Arguments) {
  const latest = useRef(args); latest.current = args
  const capture = useRef(inactive)
  const lastPcmAt = useRef(-Infinity)
  const startup = useRef(new LiveStartGate())
  const materialEpoch = useRef(0)
  const session = useRef<{ capture: S2SAudioStatus; settings: AppSettings; profileName: string } | null>(null)
  const [audioStatus, setAudioStatus] = useState(inactive)
  const [receiving, setReceiving] = useState(false)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [controller] = useState(() => new LiveController({
    now: () => performance.now(), changed: (next) => setSnapshot(next),
    decide: async (request, signal) => {
      signal.throwIfAborted()
      const abort = () => { void window.neb.cancelLiveTurn(request.requestId).catch(() => undefined) }
      signal.addEventListener('abort', abort, { once: true })
      try { return await window.neb.generateLiveTurn(request) }
      finally { signal.removeEventListener('abort', abort) }
    },
    speak: async (text, signal, onStarted) => {
      const settings = session.current?.settings
      if (!settings) throw new Error('Sessione vocale non disponibile.')
      const engine = new BrowserAudioEngine({ scheduled: () => undefined, suspended: () => controller.pause('Audio NEB sospeso: verifica l’uscita prima di riprendere.') }, { retainRecording: false })
      engine.setVolume(settings.outputVolume)
      try {
        await streamS2SSpeech(window.neb, engine, buildLiveSpeechRequest(settings, text), settings.outputDeviceId, signal, onStarted)
      } finally { engine.dispose() }
    }
  }))
  const [snapshot, setSnapshot] = useState(controller.snapshot)

  useEffect(() => {
    let mounted = true, receivedStatus = false
    const update = (status: S2SAudioStatus) => {
      if (!mounted) return
      if (capture.current.captureId !== status.captureId) { lastPcmAt.current = -Infinity; setReceiving(false) }
      if (status.state !== 'active') setReceiving(false)
      capture.current = status; setAudioStatus(status)
      if (controller.active && (status.state !== 'active' || status.captureId !== session.current?.capture.captureId || !sameSource(status.target, session.current?.capture.target ?? null))) controller.pause('Ascolto o scheda cambiati: verifica il collegamento prima di riprendere.')
    }
    const unsubscribe = window.neb.onS2SAudio((event) => {
      if (!mounted) return
      if (event.type === 'status') { receivedStatus = true; update(event.status); return }
      if (capture.current.state !== 'active' || capture.current.captureId !== event.captureId) return
      lastPcmAt.current = performance.now()
      if (controller.active && event.captureId === session.current?.capture.captureId) controller.feed(event.pcm)
    })
    void window.neb.getS2SAudioStatus().then((status) => { if (!receivedStatus) update(status) }).catch((reason) => { if (mounted) setError(String(reason)) })
    const timer = setInterval(() => {
      setReceiving(capture.current.state === 'active' && performance.now() - lastPcmAt.current < 1500)
      controller.tick()
    }, 100)
    return () => { mounted = false; materialEpoch.current++; startup.current.cancel(); clearInterval(timer); unsubscribe(); controller.stop() }
  }, [controller])

  useEffect(() => {
    if (controller.active && !args.available) controller.pause(args.unavailableReason || 'Configurazione audio o collegamento cambiati.')
  }, [controller, args.available, args.unavailableReason])

  function requireCapture(): S2SAudioStatus {
    const status = capture.current
    if (status.state !== 'active' || !status.captureId || !status.target || performance.now() - lastPcmAt.current > 1500) throw new Error('Collega e avvia l’ascolto della scheda dal popup NEB, poi attendi che arrivi il flusso audio.')
    return structuredClone(status)
  }
  async function start(config: LiveConfig, opening: boolean, save?: () => Promise<LiveConfig | null>, options: Partial<LiveOptions> = {}): Promise<void> {
    if (controller.locked || startup.current.pending) return
    setStarting(true); setError('')
    try {
      await startup.current.run(async (signal) => {
        const current = latest.current
        if (!current.available) throw new Error(current.unavailableReason)
        if (current.otherBusy()) throw new Error('Ferma la voce, l’automatico S2S o l’inserimento prima di avviare NEB Live.')
        const source = requireCapture()
        const saved = save ? await save() : config
        signal.throwIfAborted()
        if (!saved) return null
        const status = await window.neb.getS2SProviderStatus()
        signal.throwIfAborted()
        if (!status.ready) throw new Error(status.message || 'Configura OPENROUTER_API_KEY in .env.local e riavvia NEB.')
        if (!latest.current.available || latest.current.otherBusy()) throw new Error(latest.current.unavailableReason || 'Un’altra operazione è iniziata durante l’avvio.')
        const checked = requireCapture()
        if (checked.captureId !== source.captureId || !sameSource(source.target, checked.target)) throw new Error('La scheda è cambiata durante l’avvio. Riprova.')
        return { config: saved, source, settings: structuredClone(latest.current.settings) }
      }, (prepared) => {
        if (!prepared) return
        session.current = { capture: prepared.source, settings: prepared.settings, profileName: prepared.config.profiles.find((profile) => profile.id === prepared.config.selectedProfileId)?.name ?? 'Conversazione' }
        controller.start(prepared.config, opening, options)
      })
    } catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { if (!startup.current.pending) setStarting(false) }
  }
  function resume(): void {
    setError('')
    try {
      if (!latest.current.available || latest.current.otherBusy()) throw new Error(latest.current.unavailableReason || 'Ferma le altre operazioni prima di riprendere.')
      const status = requireCapture()
      if (!session.current || !sameSource(session.current.capture.target, status.target)) throw new Error('Scheda cambiata: premi Stop e avvia una nuova conversazione.')
      session.current.capture = status
      controller.resume()
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  function stop(): void { startup.current.cancel(); setStarting(false); setError(''); controller.stop() }
  function respondNow(): void {
    setError('')
    try {
      if (!latest.current.available || latest.current.otherBusy()) throw new Error(latest.current.unavailableReason || 'Ferma le altre operazioni prima di rispondere.')
      const status = requireCapture()
      if (!session.current || status.captureId !== session.current.capture.captureId || !sameSource(session.current.capture.target, status.target)) throw new Error('Ascolto o scheda cambiati: verifica il collegamento prima di rispondere.')
      controller.respondNow()
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  async function addImage(operation: () => Promise<LiveImageData>): Promise<void> {
    const epoch = materialEpoch.current
    try {
      const image = await operation()
      if (epoch !== materialEpoch.current) return
      controller.addMaterial({ id: crypto.randomUUID(), kind: 'image', ...image, addedAt: Date.now() })
    } catch (reason) { if (epoch === materialEpoch.current) throw reason }
  }
  async function importImage(file: File): Promise<void> {
    if (!file.size || file.size > MAX_LIVE_IMAGE_FILE_BYTES) throw new Error('Scegli uno screenshot PNG o JPEG fino a 10 MB.')
    await addImage(async () => window.neb.importLiveImage(new Uint8Array(await file.arrayBuffer()), file.name.slice(0, 160)))
  }
  function addSnippet(text: string): void { controller.addMaterial({ id: crypto.randomUUID(), name: 'Snippet di codice', kind: 'text', text, addedAt: Date.now() }) }
  function newConversation(): void { materialEpoch.current++; startup.current.cancel(); setStarting(false); controller.reset(); session.current = null; setError('') }
  function applyLimits(limits: LiveLimits): void { if (controller.snapshot.phase === 'paused') controller.updateLimits(limits) }
  function exportLog(): void {
    const snapshotForExport = { ...controller.snapshot, materials: controller.snapshot.materials.map((item) => item.kind === 'image' ? { id: item.id, kind: item.kind, name: item.name, addedAt: item.addedAt } : item) }
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), mode: 'neb-live', profile: session.current?.profileName, limits: controller.limits, snapshot: snapshotForExport }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `neb-live-${Date.now()}.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return { snapshot, audioStatus, receiving, error, starting, unavailableReason: args.unavailableReason, locked: controller.locked || starting, active: controller.active,
    sessionLimits: controller.limits, canRespond: controller.canRespond, isLocked: () => controller.locked || startup.current.pending, start, pause: () => controller.pause(), resume, respondNow, stop, newConversation, applyLimits, exportLog,
    captureSource: (id: string) => addImage(() => window.neb.captureLiveSource(id)), pasteImage: () => addImage(() => window.neb.readLiveClipboardImage()), importImage, addSnippet, removeMaterial: (id: string) => controller.removeMaterial(id) }
}
export type LiveConversation = ReturnType<typeof useLiveConversation>
