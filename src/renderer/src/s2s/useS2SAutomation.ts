import { useEffect, useRef, useState } from 'react'
import type { AppSettings, DesktopApi } from '../../../shared/contracts'
import type { S2SAudioStatus } from '../../../shared/s2s'
import type { BrowserTarget } from '../../../shared/outlier'
import type { ReadyLine, ReadyLinesTab } from '../readyLines'
import { BrowserAudioEngine, type AudioOutput } from '../audio/AudioEngine'
import { DEFAULT_S2S_OPTIONS, S2SController, type S2SOptions } from './controller'
import { streamS2SSpeech } from './speechPlayer'
import { assertS2STarget } from './sessionTarget'
import { PcmTimeline, SimulatedModel } from './simulation'

interface Arguments {
  settings: AppSettings; available: boolean; unavailableReason: string; manualBusy: boolean
  simulationAvailable: boolean; simulationUnavailableReason: string; localOutputs: AudioOutput[]
  tab: ReadyLinesTab; projectId: string; target: BrowserTarget | null; onComplete: (tab: ReadyLinesTab, id: string) => void
}
const inactive: S2SAudioStatus = { state: 'inactive', captureId: null, target: null, message: 'In Edge: popup NEB → Collega questa scheda → Ascolta questa scheda.' }

export function useS2SAutomation(args: Arguments) {
  const latest = useRef(args)
  latest.current = args
  const capture = useRef(inactive)
  const lastPcmAt = useRef(-Infinity)
  const lastVoiceAt = useRef(-Infinity)
  const capturedAt = useRef(0)
  const lastMeterAt = useRef(0)
  const session = useRef<{ mode: 'outlier' | 'simulation'; tab: ReadyLinesTab; projectId: string; target: BrowserTarget | null; captureId: string | null; settings: AppSettings; silenceMs: number; userText: string } | null>(null)
  const simulation = useRef<SimulatedModel | null>(null)
  const timeline = useRef(new PcmTimeline())
  const [simulationMessage, setSimulationMessage] = useState('')
  const lastSimulationTick = useRef(0)
  const lastSimulationVoice = useRef(-Infinity)
  const previousPhase = useRef('idle')
  const simulationNeedsReplay = useRef(false)
  const [audioStatus, setAudioStatus] = useState(inactive)
  const [receiving, setReceiving] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [providerReady, setProviderReady] = useState(false)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const startup = useRef(0)
  const startPending = useRef(false)
  const [controller] = useState(() => new S2SController({
    now: () => performance.now(), changed: (next) => {
      if (next.phase === 'paused' && previousPhase.current !== 'paused') simulationNeedsReplay.current = ['preparing-voice', 'speaking'].includes(previousPhase.current)
      previousPhase.current = next.phase
      setSnapshot(next)
      if (['paused', 'stopped', 'completed'].includes(next.phase)) {
        simulation.current?.pause(); timeline.current = new PcmTimeline()
        if (session.current?.mode === 'simulation') setSimulationMessage(next.phase === 'paused' ? 'Simulazione in pausa.' : next.phase === 'completed' ? 'Simulazione completata.' : 'Simulazione fermata.')
        if (next.phase !== 'paused') { simulation.current?.stop(); simulation.current = null }
      }
    },
    completed: (id) => {
      if (session.current?.mode === 'simulation') {
        timeline.current = new PcmTimeline()
        timeline.current.begin(performance.now())
        simulation.current?.respond(session.current.userText)
      }
      else if (session.current) latest.current.onComplete(session.current.tab, id)
    },
    adapt: async (request, signal) => {
      signal.throwIfAborted()
      const abort = (): void => { void window.neb.cancelS2SAdaptation(request.requestId).catch(() => undefined) }
      signal.addEventListener('abort', abort, { once: true })
      try { return await window.neb.adaptS2STurn(request) }
      finally { signal.removeEventListener('abort', abort) }
    },
    speak: async (text, signal, onStarted) => {
      const current = session.current, settings = current?.settings
      if (!current || !settings) throw new Error('Sessione vocale non disponibile.')
      const engine = new BrowserAudioEngine()
      engine.setVolume(settings.outputVolume)
      try {
        await streamS2SSpeech(window.neb, engine, {
          providerId: 'gemini', modelId: settings.geminiModel, text,
          voice: settings.replicatedVoice?.id === settings.geminiVoiceId ? { mode: 'stateful', voiceId: settings.geminiVoiceId } : { mode: 'prebuilt', voiceId: settings.geminiVoiceId }
        }, settings.outputDeviceId, signal, onStarted)
        if (!signal.aborted && current === session.current) current.userText = text
      } finally { engine.dispose() }
    }
  }))
  const [snapshot, setSnapshot] = useState(controller.snapshot)

  useEffect(() => {
    let mounted = true, statusReceived = false
    const updateStatus = (status: S2SAudioStatus): void => {
      if (!mounted) return
      if (status.captureId !== capture.current.captureId) {
        lastPcmAt.current = -Infinity; lastVoiceAt.current = -Infinity; capturedAt.current = performance.now()
        setReceiving(false); setAudioLevel(0)
      }
      capture.current = status
      setAudioStatus(status)
      if (session.current?.mode !== 'simulation' && controller.active && (status.state !== 'active' || status.captureId !== session.current?.captureId)) controller.pause(status.message || 'Ascolto cambiato.')
    }
    const unsubscribe = window.neb.onS2SAudio((event) => {
      if (!mounted) return
      if (event.type === 'status') { statusReceived = true; updateStatus(event.status); return }
      if (session.current?.mode === 'simulation') return
      if (event.captureId !== capture.current.captureId || capture.current.state !== 'active') return
      lastPcmAt.current = performance.now()
      const view = new DataView(event.pcm.buffer, event.pcm.byteOffset, event.pcm.byteLength)
      let sum = 0
      for (let i = 0; i < event.pcm.length; i += 2) { const value = view.getInt16(i, true) / 32768; sum += value * value }
      const level = Math.sqrt(sum / (event.pcm.length / 2))
      if (level >= 0.008) lastVoiceAt.current = lastPcmAt.current
      if (lastPcmAt.current - lastMeterAt.current > 500) { lastMeterAt.current = lastPcmAt.current; setAudioLevel(level) }
      if (event.captureId === session.current?.captureId) controller.feed(event.pcm)
    })
    void window.neb.getS2SAudioStatus().then((status) => { if (!statusReceived) updateStatus(status) }).catch((error) => { if (mounted) setError(String(error)) })
    void window.neb.getS2SProviderStatus().then((status) => { if (mounted) setProviderReady(status.ready) }).catch((error) => { if (mounted) setError(String(error)) })
    const timer = setInterval(() => {
      if (session.current?.mode === 'simulation') {
        if (controller.active) {
          const now = performance.now()
          if (now - lastSimulationTick.current > 500) controller.pause('Temporizzazione della simulazione sospesa: riporta NEB in primo piano e riprendi.')
          else {
            for (const pcm of timeline.current.drain(now)) {
              controller.feed(pcm)
              if (controller.snapshot.level >= 0.008) lastSimulationVoice.current = now
            }
          }
          lastSimulationTick.current = now
        }
        controller.tick()
        return
      }
      setReceiving(capture.current.state === 'active' && performance.now() - lastPcmAt.current < 1500)
      controller.tick()
    }, 100)
    return () => { mounted = false; clearInterval(timer); unsubscribe(); startup.current++; controller.stop() }
  }, [controller])

  useEffect(() => {
    if (!controller.active || !session.current) return
    if (session.current.mode === 'simulation') {
      if (!args.simulationAvailable || !args.localOutputs.some((output) => output.deviceId === session.current?.settings.outputDeviceId)) controller.pause('Uscita cuffie o configurazione simulazione cambiata.')
    } else if (args.projectId !== session.current.projectId || !args.available) controller.pause('Progetto o collegamento cambiato: controlla la sessione prima di riprendere.')
  }, [args.projectId, args.available, args.simulationAvailable, args.localOutputs, controller])

  function requireAudio(silenceMs = 0): void {
    const now = performance.now()
    if (capture.current.state !== 'active' || !capture.current.captureId || now - lastPcmAt.current > 1500 || now - capturedAt.current < 500) throw new Error('Avvia l’ascolto della scheda in Edge e attendi che arrivi l’audio.')
    if (now - lastVoiceAt.current < silenceMs) throw new Error('Outlier sta ancora parlando: attendi prima di avviare la voce NEB.')
  }
  async function start(lines: ReadyLine[], scenario: string, options: Partial<S2SOptions>, simulationOutput?: string): Promise<void> {
    if (startPending.current || controller.locked) return
    const token = ++startup.current
    startPending.current = true; setStarting(true); setError('')
    try {
      const current = latest.current
      const simulating = simulationOutput !== undefined
      if (!(simulating ? current.simulationAvailable : current.available)) throw new Error(simulating ? current.simulationUnavailableReason : current.unavailableReason)
      if (current.manualBusy) throw new Error('Attendi la fine della voce o rielaborazione manuale.')
      if (simulating) {
        if (!current.localOutputs.some((output) => output.deviceId === simulationOutput)) throw new Error('Scegli cuffie o altoparlanti reali per la simulazione.')
      } else {
        requireAudio(options.silenceMs ?? DEFAULT_S2S_OPTIONS.silenceMs)
        assertS2STarget(current.target, capture.current.target)
      }
      const status = await window.neb.getS2SProviderStatus()
      if (token !== startup.current) return
      setProviderReady(status.ready)
      if (!status.ready) throw new Error('Configura OPENROUTER_API_KEY in .env.local e riavvia NEB.')
      if (!(simulating ? latest.current.simulationAvailable : latest.current.available) || latest.current.projectId !== current.projectId || latest.current.tab !== current.tab || latest.current.manualBusy) throw new Error('Configurazione cambiata durante l’avvio.')
      if (!simulating) {
        requireAudio(options.silenceMs ?? DEFAULT_S2S_OPTIONS.silenceMs)
        assertS2STarget(current.target, capture.current.target)
        assertS2STarget(current.target, latest.current.target)
      } else if (!latest.current.localOutputs.some((output) => output.deviceId === simulationOutput)) throw new Error('Uscita cuffie cambiata durante l’avvio.')
      session.current = { mode: simulating ? 'simulation' : 'outlier', tab: current.tab, projectId: current.projectId, target: simulating ? null : { ...capture.current.target! }, captureId: simulating ? null : capture.current.captureId, settings: { ...current.settings, outputDeviceId: simulationOutput ?? current.settings.outputDeviceId }, silenceMs: options.silenceMs ?? DEFAULT_S2S_OPTIONS.silenceMs, userText: '' }
      if (simulating) {
        timeline.current.clear(); lastSimulationTick.current = performance.now(); lastSimulationVoice.current = -Infinity
        timeline.current.begin(lastSimulationTick.current)
        setSimulationMessage('Prova locale · MODEL A generato da Qwen, voce Gemini distinta.')
        const ownedSession = session.current
        let lastModelAudio: { text: string; chunks: Uint8Array[] } | null = null
        simulation.current = new SimulatedModel(scenario, {
          reply: async (request, signal) => {
            signal.throwIfAborted()
            const abort = (): void => { void window.neb.cancelS2SSimulationReply(request.requestId).catch(() => undefined) }
            signal.addEventListener('abort', abort, { once: true })
            try { return await window.neb.generateS2SSimulationReply(request) }
            finally { signal.removeEventListener('abort', abort) }
          },
          play: async (text, signal) => {
            const settings = session.current!.settings
            const playbackTimeline = timeline.current
            const engine = new BrowserAudioEngine({
              scheduled: (pcm, startAt, currentTime) => playbackTimeline.schedule(pcm, performance.now() + (startAt - currentTime) * 1000),
              suspended: () => controller.pause('Audio della simulazione sospeso: riprendi la prova.')
            })
            engine.setVolume(settings.outputVolume)
            const cached = lastModelAudio?.text === text ? lastModelAudio : null
            const chunks: Uint8Array[] = []
            const speechApi: Pick<DesktopApi, 'synthesizeStream' | 'stopGeneration'> = {
              synthesizeStream: async (request, onChunk) => {
                if (cached) { cached.chunks.forEach(onChunk); return { generationMs: 0 } }
                return window.neb.synthesizeStream(request, (pcm) => { chunks.push(Uint8Array.from(pcm)); onChunk(pcm) })
              },
              stopGeneration: () => cached ? Promise.resolve() : window.neb.stopGeneration()
            }
            try {
              await streamS2SSpeech(speechApi, engine, { providerId: 'gemini', modelId: settings.geminiModel, text, voice: { mode: 'prebuilt', voiceId: settings.geminiVoiceId === 'Puck' ? 'Kore' : 'Puck' } }, settings.outputDeviceId, signal, () => controller.active)
              if (!signal.aborted && !cached) lastModelAudio = { text, chunks }
            } finally { if (signal.aborted) playbackTimeline.clear(); engine.dispose() }
          },
          cost: (reply) => session.current === ownedSession && controller.recordSimulationReply(reply), state: setSimulationMessage,
          failed: (message) => controller.pause(message)
        })
      }
      controller.start(lines.filter((line) => !line.done), scenario, options)
    } catch (error) {
      if (token === startup.current) {
        simulation.current?.stop(); simulation.current = null; timeline.current.clear()
        setError(error instanceof Error ? error.message : String(error))
      }
    }
    finally { if (token === startup.current) { startPending.current = false; setStarting(false) } }
  }
  function resume(replay = false): void {
    setError('')
    try {
      if (session.current?.mode === 'simulation') {
        if (!latest.current.simulationAvailable || !latest.current.localOutputs.some((output) => output.deviceId === session.current?.settings.outputDeviceId)) throw new Error('Verifica cuffie e configurazione Gemini prima di riprendere.')
        if (!replay && simulationNeedsReplay.current) throw new Error('La battuta NEB è stata interrotta: scegli Ripeti battuta pendente per riprendere la prova.')
        if (replay && performance.now() - lastSimulationVoice.current < session.current.silenceMs) throw new Error('MODEL A stava parlando: attendi prima di ripetere la battuta.')
        lastSimulationTick.current = performance.now()
        timeline.current.begin(lastSimulationTick.current)
        controller.resume(replay)
        if (controller.active && !replay) simulation.current?.resume()
        return
      }
      if (!latest.current.available || latest.current.projectId !== session.current?.projectId) throw new Error('Torna al progetto S2S della sessione prima di riprendere.')
      requireAudio(replay ? session.current!.silenceMs : 0)
      assertS2STarget(session.current?.target ?? null, capture.current.target)
      assertS2STarget(session.current?.target ?? null, latest.current.target)
      session.current!.captureId = capture.current.captureId!
      controller.resume(replay)
    } catch (error) { setError(error instanceof Error ? error.message : String(error)) }
  }
  function stop(): void { startup.current++; startPending.current = false; setStarting(false); controller.stop() }
  function exportLog(): void {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, mode: session.current?.mode, exportedAt: new Date().toISOString(), model: 'qwen/qwen3.8-omni-flash', tab: session.current?.tab, projectId: session.current?.projectId, snapshot }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `neb-s2s-${session.current?.tab ?? 'session'}-${Date.now()}.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const isSimulation = session.current?.mode === 'simulation'
  return { snapshot, audioStatus, receiving: isSimulation ? controller.locked : receiving, audioLevel: isSimulation ? snapshot.level : audioLevel, providerReady, error, starting,
    isSimulation, simulationMessage,
    startSimulation: (lines: ReadyLine[], scenario: string, options: Partial<S2SOptions>, deviceId: string) => start(lines, scenario, options, deviceId),
    locked: controller.locked || starting, active: controller.active, start, resume, stop,
    pause: () => controller.pause('Pausa manuale. Riprendi l’ascolto o ripeti esplicitamente la battuta pendente.'),
    exportLog, sessionTab: session.current?.tab, controller,
    isLocked: () => controller.locked || startPending.current }
}
export type S2SAutomation = ReturnType<typeof useS2SAutomation>
