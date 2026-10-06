import type { AppSettings, ProviderStatus } from '../../shared/contracts'
import { sameTarget, type BrowserTarget } from '../../shared/outlier'
import type { S2SAudioStatus } from '../../shared/s2s'
import type { AvatarOutputStatus } from '../../shared/avatarOutput'
import type { AvatarSnapshot } from './avatar/session'
import type { AudioOutput } from './audio/AudioEngine'
import { routingStatus } from './conversationMode'
import { speechVoiceLabel } from '../../shared/speechRequest'

export type SessionMode = 'console' | 'live'
export type CheckAction = 'settings' | 'audio' | 'browser' | 'guide' | 'avatar'
export interface SessionCheck {
  id: string; title: string; state: 'ready' | 'blocked' | 'pending' | 'manual' | 'optional'
  detail: string; blocking: boolean; action?: CheckAction
}
export interface SessionDiagnostics {
  platform?: string; settings: AppSettings; outputs: AudioOutput[]; speech: ProviderStatus | null
  connected: boolean; stopAvailable: boolean; target: BrowserTarget | null
  audio: S2SAudioStatus; receiving: boolean
  reasoning: { ready: boolean; model: string; message?: string } | null
  avatarEnabled: boolean; avatar: AvatarSnapshot; avatarConfigured: boolean | null; avatarConfigError?: boolean
  output: AvatarOutputStatus | null; operationBusy: boolean
}

export function selectedSpeech(settings: AppSettings): { provider: string; model: string; voice: string } {
  return settings.providerId === 'fish-openrouter'
    ? { provider: 'Fish · OpenRouter', model: settings.fishModel, voice: speechVoiceLabel(settings) }
    : { provider: 'Gemini', model: settings.geminiModel, voice: speechVoiceLabel(settings) }
}

export function buildSessionChecks(data: SessionDiagnostics, mode: SessionMode): SessionCheck[] {
  const { settings } = data
  const output = data.outputs.find(item => item.deviceId === settings.outputDeviceId)
  const routing = routingStatus(data.outputs, settings.outputDeviceId, data.platform)
  const checks: SessionCheck[] = [
    { id: 'platform', title: 'Applicazione Windows', state: !data.platform ? 'pending' : data.platform === 'win32' ? 'ready' : 'blocked', detail: data.platform === 'win32' ? 'Versione Windows in uso.' : 'Avvia NEB da Windows PowerShell con scripts/run-windows.ps1.', blocking: true },
    { id: 'speech', title: 'Provider vocale', state: !data.speech ? 'pending' : data.speech.ready ? 'ready' : 'blocked', detail: data.speech?.message ?? 'Verifica in corso…', blocking: true, action: 'settings' },
    { id: 'output', title: 'Uscita audio', state: output ? 'ready' : 'blocked', detail: output?.label ?? 'Dispositivo selezionato non disponibile. Aggiorna le uscite e scegline una.', blocking: true, action: 'audio' },
    { id: 'volume', title: 'Volume NEB', state: settings.outputVolume > 0 ? 'ready' : 'blocked', detail: settings.outputVolume > 0 ? `${Math.round(settings.outputVolume * 100)}%` : 'Il volume NEB è a zero. Aumentalo in Voce e audio.', blocking: true, action: 'audio' },
    { id: 'operation', title: 'Operazioni in corso', state: data.operationBusy ? 'blocked' : 'ready', detail: data.operationBusy ? 'Una sessione o un’operazione è già in corso. Torna al relativo pannello per fermarla.' : 'Nessuna operazione concorrente.', blocking: true }
  ]
  if (mode === 'live') {
    const matching = Boolean(data.target && data.audio.target && sameTarget(data.target, data.audio.target))
    const audioReady = data.connected && data.audio.state === 'active' && Boolean(data.audio.captureId) && data.receiving && matching
    checks.push(
      { id: 'browser', title: 'Scheda collegata', state: data.connected && data.target ? 'ready' : 'blocked', detail: data.connected && data.target ? data.target.title || 'Scheda associata' : 'Nel popup NEB del browser premi Collega questa scheda.', blocking: true, action: 'browser' },
      { id: 'capture', title: 'Audio della scheda', state: audioReady ? 'ready' : 'blocked', detail: audioReady ? 'Pacchetti audio ricevuti dalla scheda associata; possono contenere silenzio.' : data.audio.state === 'error' ? data.audio.message : !matching && data.audio.target ? 'L’ascolto appartiene a un’altra scheda. Collega e ascolta la stessa scheda.' : 'Nel popup premi Ascolta questa scheda. Attendo un flusso audio recente.', blocking: true, action: 'browser' },
      { id: 'routing', title: 'Routing verso il sito', state: routing.routed ? 'ready' : 'blocked', detail: routing.message, blocking: true, action: 'audio' },
      { id: 'stop', title: 'Stop globale', state: data.stopAvailable ? 'ready' : 'blocked', detail: data.stopAvailable ? 'Ctrl+Alt+S disponibile.' : 'Libera Ctrl+Alt+S da altre applicazioni e riavvia NEB.', blocking: true, action: 'guide' },
      { id: 'reasoning', title: 'Qwen · OpenRouter', state: !data.reasoning ? 'pending' : data.reasoning.ready ? 'ready' : 'blocked', detail: data.reasoning ? data.reasoning.ready ? `${data.reasoning.model} · chiave configurata; disponibilità remota verificata all’avvio del turno.` : data.reasoning.message || 'Configura OPENROUTER_API_KEY e riavvia NEB.' : 'Verifica in corso…', blocking: true, action: 'browser' },
      { id: 'site', title: 'Microfono nel sito', state: 'manual', detail: 'Scegli CABLE Output come microfono del sito e verifica con una registrazione. NEB non può leggere questa selezione.', blocking: false, action: 'guide' },
      { id: 'camera', title: 'Camera nel sito · se usi video', state: 'manual', detail: 'Se usi l’avatar come webcam, avvia OBS Virtual Camera e selezionala nel sito. Il collegamento di un visualizzatore locale non verifica la camera del sito.', blocking: false, action: 'avatar' }
    )
  }
  checks.push(
    { id: 'avatar', title: 'Avatar Simli', state: !data.avatarEnabled ? 'optional' : data.avatarConfigError ? 'blocked' : data.avatarConfigured === null ? 'pending' : !data.avatarConfigured || data.avatar.phase === 'error' ? 'blocked' : data.avatar.phase === 'connecting' ? 'pending' : 'ready', detail: !data.avatarEnabled ? 'Disattivato · la sessione può usare solo la voce.' : data.avatarConfigError ? 'Impossibile verificare Simli. Premi Ricontrolla.' : data.avatarConfigured === null ? 'Verifica configurazione Simli in corso…' : data.avatarConfigured === false ? 'Chiave Simli non configurata.' : data.avatar.phase === 'off' ? 'Configurato; la connessione verrà avviata con la voce.' : data.avatar.message, blocking: data.avatarEnabled, action: 'avatar' },
    { id: 'obs', title: 'Uscita video locale', state: !data.output ? 'pending' : data.output.error || !data.output.available ? 'blocked' : !data.output.enabled ? 'optional' : data.output.viewers ? 'ready' : 'manual', detail: !data.output ? 'Verifica in corso…' : data.output.error || (!data.output.available ? 'Uscita video locale non disponibile.' : !data.output.enabled ? 'Disattivata · facoltativa per la voce.' : data.output.viewers ? `${data.output.viewers} visualizzatori locali collegati. Verifica separatamente OBS Virtual Camera e la camera scelta nel sito.` : 'Attivata, nessun visualizzatore collegato. Apri la sorgente browser in OBS.'), blocking: false, action: 'avatar' }
  )
  return checks
}

export function sessionReady(checks: SessionCheck[]): boolean {
  return checks.every(check => !check.blocking || check.state === 'ready')
}
