import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { AppInfo, AppSettings, ProviderStatus } from '../../shared/contracts'
import type { InsertionStatus } from '../../shared/outlier'
import type { AvatarOutputStatus } from '../../shared/avatarOutput'
import type { S2SAudioStatus } from '../../shared/s2s'
import type { AudioOutput } from './audio/AudioEngine'
import type { AvatarSession } from './avatar/session'
import { buildSessionChecks, selectedSpeech, sessionReady, type CheckAction, type SessionMode } from './sessionReadiness'
import './diagnostics.css'

interface Props {
  info: AppInfo | null; settings: AppSettings; outputs: AudioOutput[]; speech: ProviderStatus
  browser: InsertionStatus | null; audio: S2SAudioStatus; receiving: boolean; avatar: AvatarSession
  operationBusy: boolean; onRefresh(): Promise<void>; onNavigate(action: CheckAction): void; onOpenLive(): void
}
type ReasoningStatus = { ready: boolean; model: string; message?: string }
const labels = { ready: 'Verificato', blocked: 'Da risolvere', pending: 'In verifica', manual: 'Da verificare', optional: 'Facoltativo' }
const actions: Record<CheckAction, string> = { settings: 'Apri impostazioni', audio: 'Voce e audio', browser: 'Configura browser', guide: 'Guida audio', avatar: 'Apri avatar' }

export function DiagnosticsPage({ info, settings, outputs, speech, browser, audio, receiving, avatar, operationBusy, onRefresh, onNavigate, onOpenLive }: Props): React.JSX.Element {
  const [mode, setMode] = useState<SessionMode>('live')
  const [reasoning, setReasoning] = useState<ReasoningStatus | null>(null)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [avatarConfigError, setAvatarConfigError] = useState(false)
  const [output, setOutput] = useState<AvatarOutputStatus | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [checkedAt, setCheckedAt] = useState<string>('')
  const mounted = useRef(false)
  const refreshingRef = useRef(false)
  const snapshot = useSyncExternalStore(listener => avatar.subscribe(listener), () => avatar.snapshot, () => avatar.snapshot)

  async function refreshServices(): Promise<void> {
    const results = await Promise.allSettled([window.neb.getS2SProviderStatus(), window.neb.getAvatarStatus(), window.neb.getAvatarOutputStatus()])
    if (!mounted.current) return
    const [qwen, simli, obs] = results
    setReasoning(qwen.status === 'fulfilled' ? qwen.value : { ready: false, model: '', message: 'Impossibile verificare OpenRouter. Riprova.' })
    setConfigured(simli.status === 'fulfilled' ? simli.value.configured : null)
    setAvatarConfigError(simli.status === 'rejected')
    setOutput(obs.status === 'fulfilled' ? obs.value : { enabled: false, available: false, viewers: 0, error: 'Impossibile verificare l’uscita video locale.' })
    setRefreshError(results.some(item => item.status === 'rejected') ? 'Alcuni controlli non sono disponibili. Premi Ricontrolla.' : '')
    setCheckedAt(new Date().toLocaleTimeString('it-IT'))
  }
  useEffect(() => {
    mounted.current = true
    void refreshServices()
    let polling = false
    const timer = setInterval(() => {
      if (polling) return
      polling = true
      void window.neb.getAvatarOutputStatus().then(status => { if (mounted.current) setOutput(status) })
        .catch(() => { if (mounted.current) setOutput({ enabled: false, available: false, viewers: 0, error: 'Uscita video locale non disponibile.' }) })
        .finally(() => { polling = false })
    }, 2000)
    return () => { mounted.current = false; clearInterval(timer) }
  }, [])
  async function refresh(): Promise<void> {
    if (refreshingRef.current) return
    refreshingRef.current = true; setRefreshing(true); setRefreshError('')
    try {
      const results = await Promise.allSettled([onRefresh(), refreshServices()])
      if (mounted.current && results.some(item => item.status === 'rejected')) setRefreshError('Impossibile aggiornare tutti i controlli. Riprova.')
    } finally { refreshingRef.current = false; if (mounted.current) setRefreshing(false) }
  }
  const selected = selectedSpeech(settings)
  const checks = buildSessionChecks({ platform: info?.platform, settings, outputs, speech, connected: browser?.connected ?? false, stopAvailable: browser?.stopAvailable ?? false,
    target: browser?.target ?? null, audio, receiving, reasoning, avatarEnabled: avatar.enabled, avatar: snapshot, avatarConfigured: configured, avatarConfigError, output, operationBusy }, mode)
  const ready = sessionReady(checks)
  const firstIssue = checks.find(check => check.blocking && check.state !== 'ready')
  return <div className="content settings-page session-diagnostics" data-no-speech-shortcuts>
    <div className="page-intro"><span className="eyebrow">PREPARAZIONE SESSIONE</span><h2>Diagnostica</h2><p>Controlla voce, audio e collegamenti prima di iniziare.</p></div>
    <section className="panel diagnostics-selection" aria-label="Configurazione selezionata">
      <div><span>Provider vocale</span><strong>{selected.provider}</strong></div>
      <div><span>Voce</span><strong>{selected.voice}</strong></div>
      <div><span>Modello</span><strong>{selected.model}</strong></div>
    </section>
    <section className="panel diagnostics-preparation" aria-label="Controlli della sessione">
      <div className="diagnostics-toolbar">
        <div className="diagnostics-modes" aria-label="Tipo di sessione"><button type="button" aria-pressed={mode === 'console'} onClick={() => setMode('console')}>Console</button><button type="button" aria-pressed={mode === 'live'} onClick={() => setMode('live')}>NEB Live</button></div>
        <button type="button" className="secondary-button" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? 'Verifica in corso…' : 'Ricontrolla'}</button>
      </div>
      <div className={`diagnostics-summary ${ready ? 'ready' : ''}`} role="status"><strong>{ready ? 'Controlli automatici superati' : 'Preparazione da completare'}</strong><span>{ready ? mode === 'live' ? 'Verifica il microfono nel sito, poi apri Live e scegli il profilo.' : 'Voce e uscita disponibili. Apri Console per scrivere e pronunciare.' : firstIssue?.detail}</span></div>
      {refreshError && <p className="error" role="alert">{refreshError}</p>}
      <ul className="diagnostics-checks">{checks.map(check => <li key={check.id} className={`diagnostics-check check-${check.state}`}>
        <div><div className="diagnostics-check-heading"><strong>{check.title}</strong><span className="diagnostics-badge">{labels[check.state]}</span></div><p>{check.detail}</p></div>
        {check.action && <button type="button" className="text-button" onClick={() => onNavigate(check.action!)}>{actions[check.action]}</button>}
      </li>)}</ul>
      <div className="diagnostics-footer"><small>{checkedAt ? `Servizi ricontrollati alle ${checkedAt}. Audio e collegamento si aggiornano in tempo reale.` : 'Verifica dei servizi in corso…'}</small>{mode === 'live' && <button type="button" className="secondary-button" onClick={onOpenLive}>Apri NEB Live</button>}</div>
    </section>
    <details className="panel diagnostics-system"><summary>Informazioni di sistema</summary><dl><div><dt>Electron</dt><dd>{info?.electron ?? 'In verifica'}</dd></div><div><dt>Node</dt><dd>{info?.node ?? 'In verifica'}</dd></div><div><dt>Piattaforma</dt><dd>{info?.platform ?? 'In verifica'}</dd></div><div><dt>Uscite rilevate</dt><dd>{outputs.length}</dd></div></dl></details>
  </div>
}
