import { useEffect, useRef, useState } from 'react'
import { ArrowDown, Download, FolderOpen, Headphones, Mic, Pause, Play, Plus, RefreshCw, Save, Square, Trash2 } from 'lucide-react'
import type { AppSettings } from '../../../shared/contracts'
import type { LiveConfig, LiveProfile } from '../../../shared/live'
import type { OutlierSetup } from '../../../shared/outlier'
import type { AudioOutput } from '../audio/AudioEngine'
import type { LiveConversation } from './useLiveConversation'
import './live.css'

interface LivePageProps {
  live: LiveConversation
  settings: AppSettings
  outputs: AudioOutput[]
  onUpdate(patch: Partial<AppSettings>): void
  onRefreshOutputs(): void
  platform: string | undefined
  geminiReady: boolean
  stopAvailable: boolean
}

// Preserve an unsaved draft when navigating to another section of the app.
let draftCache: { config: LiveConfig; saved: string } | null = null

const phaseLabels: Record<LiveConversation['snapshot']['phase'], string> = {
  idle: 'Pronto', listening: 'In ascolto', thinking: 'Elaborazione', ready: 'Risposta pronta',
  'preparing-voice': 'Preparazione voce', speaking: 'NEB sta parlando', paused: 'In pausa',
  stopped: 'Fermato', completed: 'Completato'
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

function timestamp(atMs: number): string {
  const seconds = Math.max(0, Math.floor(atMs / 1000))
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

export function LivePage({ live, settings, outputs, onUpdate, onRefreshOutputs, platform, geminiReady, stopAvailable }: LivePageProps): React.JSX.Element {
  const [config, setConfig] = useState<LiveConfig | null>(() => draftCache?.config ?? null)
  const [saved, setSaved] = useState(() => draftCache?.saved ?? '')
  const [loading, setLoading] = useState(!draftCache)
  const [loadError, setLoadError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [opening, setOpening] = useState(false)
  const [following, setFollowing] = useState(true)
  const [takeover, setTakeover] = useState(false)
  const [setup, setSetup] = useState<OutlierSetup | null>(null)
  const [extensionId, setExtensionId] = useState('')
  const [setupBusy, setSetupBusy] = useState(false)
  const [setupError, setSetupError] = useState('')
  const transcript = useRef<HTMLDivElement>(null)
  const mounted = useRef(true)
  const saveInProgress = useRef(false)
  const locked = live.locked || live.starting || saving
  const dirty = Boolean(config && JSON.stringify(config) !== saved)
  const profile = config?.profiles.find((item) => item.id === config.selectedProfileId)
  const output = outputs.find((item) => item.deviceId === settings.outputDeviceId)
  const routed = Boolean(output && /CABLE Input/i.test(output.label))
  const voiceName = settings.replicatedVoice?.id === settings.geminiVoiceId ? settings.replicatedVoice.displayName : settings.geminiVoiceId
  const captureReady = live.audioStatus.state === 'active' && live.receiving
  const prerequisites = platform !== 'win32' ? 'Avvia NEB dall’app Windows per collegare il browser.'
    : !geminiReady ? 'Configura la voce Gemini nelle Impostazioni.'
    : !stopAvailable ? 'Libera la scorciatoia Ctrl+Alt+S e riavvia NEB.'
    : !routed ? 'Seleziona CABLE Input come uscita NEB.'
    : !captureReady ? live.audioStatus.message || 'Avvia l’ascolto della scheda dal popup NEB.' : ''
  const canStart = Boolean(config && profile?.name.trim() && !loading && !loadError && !prerequisites && !locked)
  const canResume = live.snapshot.phase === 'paused' && !prerequisites && !live.starting

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (draftCache && loadAttempt === 0) return
    let current = true
    setLoading(true)
    setLoadError('')
    void window.neb.getLiveConfig().then((next) => {
      if (!current) return
      const serialized = JSON.stringify(next)
      draftCache = { config: next, saved: serialized }
      setConfig(next)
      setSaved(serialized)
    }).catch((reason: unknown) => {
      if (current) setLoadError(`Impossibile caricare i profili: ${errorMessage(reason)}`)
    }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [loadAttempt])

  useEffect(() => {
    if (config) draftCache = { config, saved }
  }, [config, saved])

  useEffect(() => {
    let current = true
    void window.neb.getOutlierSetup().then((next) => {
      if (current) { setSetup(next); setExtensionId(next.extensionId ?? '') }
    }).catch((reason: unknown) => { if (current) setSetupError(errorMessage(reason)) })
    return () => { current = false }
  }, [])

  useEffect(() => {
    if (following && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight
  }, [live.snapshot.history, live.snapshot.phase, following])

  useEffect(() => {
    if (live.snapshot.phase !== 'paused') setTakeover(false)
  }, [live.snapshot.phase])

  function edit(next: LiveConfig): void {
    if (locked || live.isLocked()) return
    setConfig(next)
    setSaveMessage('')
    setActionError('')
  }

  function editProfile(patch: Partial<LiveProfile>): void {
    if (config && profile) edit({ ...config, profiles: config.profiles.map((item) => item.id === profile.id ? { ...item, ...patch } : item) })
  }

  function addProfile(): void {
    if (!config || config.profiles.length >= 30) return
    const next: LiveProfile = { id: crypto.randomUUID(), name: `Nuovo profilo ${config.profiles.length + 1}`, context: '', language: 'auto', tone: 'conversational' }
    edit({ ...config, selectedProfileId: next.id, profiles: [...config.profiles, next] })
  }

  function removeProfile(): void {
    if (!config || !profile || config.profiles.length <= 1) return
    const profiles = config.profiles.filter((item) => item.id !== profile.id)
    edit({ ...config, profiles, selectedProfileId: profiles[0].id })
  }

  async function saveConfig(startingSave = false): Promise<LiveConfig | null> {
    if (!config || loading || loadError || live.isLocked() && !startingSave || saveInProgress.current) return null
    saveInProgress.current = true
    setSaving(true)
    setActionError('')
    setSaveMessage('')
    try {
      const next = await window.neb.saveLiveConfig(config)
      const serialized = JSON.stringify(next)
      draftCache = { config: next, saved: serialized }
      if (mounted.current) { setConfig(next); setSaved(serialized); setSaveMessage('Profili salvati sul dispositivo.') }
      return next
    } catch (reason) {
      if (mounted.current) setActionError(`Salvataggio non riuscito: ${errorMessage(reason)}`)
      return null
    } finally {
      saveInProgress.current = false
      if (mounted.current) setSaving(false)
    }
  }

  async function start(): Promise<void> {
    if (!canStart || !config || live.isLocked()) return
    setActionError('')
    setFollowing(true)
    try { await live.start(config, opening, dirty ? () => saveConfig(true) : undefined) }
    catch (reason) { if (mounted.current) setActionError(errorMessage(reason)) }
  }

  async function setupAction(action: () => Promise<void>): Promise<void> {
    if (setupBusy || locked) return
    setSetupBusy(true)
    setSetupError('')
    try { await action() }
    catch (reason) { if (mounted.current) setSetupError(errorMessage(reason)) }
    finally { if (mounted.current) setSetupBusy(false) }
  }

  return <section className="neb-live" data-no-speech-shortcuts>
    <header className="neb-live-heading">
      <div><span className="eyebrow">CONVERSAZIONE LIBERA</span><h2>Una voce, una conversazione.</h2><p>NEB ascolta la scheda collegata e risponde con il tuo contesto e la tua voce.</p></div>
      <span className={`neb-live-state neb-live-state-${live.snapshot.phase}`}><span className="status-dot" />{phaseLabels[live.snapshot.phase]}</span>
    </header>

    <div className="neb-live-grid">
      <aside className="neb-live-config">
        <section className="neb-live-card" aria-labelledby="neb-live-profile-heading">
          <div className="neb-live-card-heading"><h3 id="neb-live-profile-heading">Profilo della conversazione</h3>{dirty && <span className="neb-live-draft">Da salvare</span>}</div>
          {loading && <p className="neb-live-note" role="status">Caricamento dei profili…</p>}
          {loadError && <div className="neb-live-error" role="alert"><p>{loadError}</p><button type="button" className="secondary-button" onClick={() => setLoadAttempt((value) => value + 1)}>Riprova caricamento</button></div>}
          {config && profile && !loading && !loadError && <>
            <fieldset className="neb-live-fields" disabled={locked}>
              <div className="neb-live-profile-picker"><label htmlFor="neb-live-profile">Profilo salvato<select id="neb-live-profile" value={profile.id} onChange={(event) => edit({ ...config, selectedProfileId: event.target.value })}>{config.profiles.map((item) => <option key={item.id} value={item.id}>{item.name || 'Profilo senza nome'}</option>)}</select></label><button type="button" className="icon-button" aria-label="Aggiungi profilo" title="Aggiungi profilo" disabled={config.profiles.length >= 30} onClick={addProfile}><Plus size={16} /></button><button type="button" className="icon-button" aria-label="Elimina profilo selezionato" title={config.profiles.length <= 1 ? 'Conserva almeno un profilo' : 'Elimina profilo selezionato'} disabled={config.profiles.length <= 1} onClick={removeProfile}><Trash2 size={15} /></button></div>
              <label htmlFor="neb-live-name">Nome del profilo<input id="neb-live-name" value={profile.name} maxLength={120} onChange={(event) => editProfile({ name: event.target.value })} /></label>
              <label htmlFor="neb-live-context">Contesto della sessione<textarea id="neb-live-context" value={profile.context} maxLength={8000} onChange={(event) => editProfile({ context: event.target.value })} placeholder="Ruolo, argomento e obiettivo della conversazione." rows={5} /></label>
              <div className="neb-live-pair"><label htmlFor="neb-live-language">Lingua<select id="neb-live-language" value={profile.language} onChange={(event) => editProfile({ language: event.target.value as LiveProfile['language'] })}><option value="auto">Segui l’interlocutore</option><option value="it">Italiano</option><option value="en">English</option><option value="ar">العربية</option></select></label><label htmlFor="neb-live-tone">Tono<select id="neb-live-tone" value={profile.tone} onChange={(event) => editProfile({ tone: event.target.value as LiveProfile['tone'] })}><option value="professional">Professionale</option><option value="conversational">Conversazionale</option></select></label></div>
              <details className="neb-live-details"><summary>Background e stile personale</summary><label htmlFor="neb-live-background">Background<textarea id="neb-live-background" value={config.background} maxLength={40000} rows={8} onChange={(event) => edit({ ...config, background: event.target.value })} /></label><label htmlFor="neb-live-persona">Persona e modo di parlare<textarea id="neb-live-persona" value={config.persona} maxLength={20000} rows={7} onChange={(event) => edit({ ...config, persona: event.target.value })} /></label><p className="neb-live-note">Le esperienze personali vengono da questi fatti. NEB chiede chiarimenti quando manca un’informazione.</p></details>
              <label htmlFor="neb-live-opening">Avvio<select id="neb-live-opening" value={opening ? 'opening' : 'listen'} onChange={(event) => setOpening(event.target.value === 'opening')}><option value="listen">Ascolta prima l’interlocutore</option><option value="opening">Genera una breve apertura</option></select></label>
            </fieldset>
            <div className="neb-live-save-row"><button type="button" className="secondary-button" disabled={locked || !dirty || !profile.name.trim()} onClick={() => void saveConfig()}><Save size={14} />{saving ? 'Salvataggio…' : 'Salva profili'}</button><small>{live.locked ? 'Profilo bloccato durante la sessione.' : dirty ? 'Le modifiche si salvano anche all’avvio.' : 'Configurazione salvata.'}</small></div>
            {saveMessage && <p className="neb-live-note neb-live-success" role="status">{saveMessage}</p>}
          </>}
        </section>

        <section className="neb-live-card" aria-labelledby="neb-live-routing-heading">
          <div className="neb-live-card-heading"><h3 id="neb-live-routing-heading">Browser e voce</h3><Headphones size={16} /></div>
          <div className={`neb-live-capture ${captureReady ? 'neb-live-capture-ready' : ''}`}><span className={`status-dot ${captureReady ? 'green' : 'amber'}`} /><div><strong>{live.audioStatus.target?.title || 'Nessuna scheda in ascolto'}</strong><p>{captureReady ? 'Audio della scheda in ricezione' : live.audioStatus.message}</p>{live.audioStatus.target && <small title={live.audioStatus.target.url}>{live.audioStatus.target.url}</small>}</div></div>
          <fieldset className="neb-live-fields" disabled={locked}><div className="neb-live-output-picker"><label htmlFor="neb-live-output">Uscita NEB<select id="neb-live-output" value={settings.outputDeviceId} onChange={(event) => onUpdate({ outputDeviceId: event.target.value })}>{!output && <option value={settings.outputDeviceId}>{settings.outputDeviceId === 'default' ? 'Predefinito di sistema' : 'Uscita salvata non disponibile'}</option>}{outputs.map((item) => <option key={item.deviceId} value={item.deviceId}>{item.label}</option>)}</select></label><button type="button" className="icon-button" onClick={onRefreshOutputs} aria-label="Aggiorna uscite audio" title="Aggiorna uscite audio"><RefreshCw size={15} /></button></div></fieldset>
          <p className="neb-live-note">Voce: <strong>{voiceName}</strong> · {geminiReady ? 'Gemini disponibile' : 'Gemini da configurare'}</p>
          <p className="neb-live-note">NEB → <strong>CABLE Input</strong> · Microfono del sito → <strong>CABLE Output</strong>. Ascolta il sito dalle cuffie.</p>
          <details className="neb-live-details"><summary>Configura Edge o Chrome{setup?.installed ? ' · host installato' : ''}</summary><ol><li>Apri <strong>edge://extensions</strong> o <strong>chrome://extensions</strong> e abilita la modalità sviluppatore.</li><li>Carica la cartella decompressa dell’estensione NEB e copia il suo ID.</li><li>Salva l’host qui sotto, poi apri il popup NEB sul sito: <strong>Collega questa scheda</strong> → <strong>Ascolta questa scheda</strong>.</li></ol><fieldset className="neb-live-fields" disabled={locked || setupBusy}><button type="button" className="secondary-button" onClick={() => void setupAction(() => window.neb.openOutlierExtensionFolder())}><FolderOpen size={14} />Apri cartella estensione</button><label htmlFor="neb-live-extension-id">ID estensione<input id="neb-live-extension-id" value={extensionId} onChange={(event) => setExtensionId(event.target.value)} maxLength={32} spellCheck={false} autoComplete="off" placeholder="32 lettere, da a a p" /></label><button type="button" className="secondary-button" disabled={platform !== 'win32' || !/^[a-p]{32}$/.test(extensionId.trim())} onClick={() => void setupAction(async () => { await window.neb.installOutlierHost(extensionId.trim()); const next = await window.neb.getOutlierSetup(); if (mounted.current) { setSetup(next); setExtensionId(next.extensionId ?? '') } })}>{setupBusy ? 'Configurazione…' : 'Salva host per Edge e Chrome'}</button></fieldset>{setup?.extensionPath && <p className="neb-live-path">{setup.extensionPath}</p>}{setupError && <p className="neb-live-error" role="alert">{setupError}</p>}</details>
        </section>
      </aside>

      <section className="neb-live-session neb-live-card" aria-labelledby="neb-live-transcript-heading">
        <div className="neb-live-session-heading"><div><span className="eyebrow">LIVE</span><h3 id="neb-live-transcript-heading">Conversazione</h3></div><button type="button" className={following ? 'neb-live-follow active' : 'neb-live-follow'} aria-pressed={following} onClick={() => setFollowing((value) => !value)}><ArrowDown size={14} />Segui l’ultimo turno</button></div>
        <div className="neb-live-metrics"><div><span>Turni NEB</span><strong>{live.snapshot.turns}<small> / 40</small></strong></div><div><span>OpenRouter osservato</span><strong>${live.snapshot.costUsd.toFixed(4)}{!live.snapshot.costKnown && <small> + sconosciuto</small>}</strong></div><div className="neb-live-level"><span>Audio in ingresso</span><div className="neb-live-meter" role="meter" aria-label="Livello audio della scheda" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, Math.max(0, live.snapshot.level)) * 100)}><span style={{ width: `${Math.min(100, Math.max(0, live.snapshot.level * 100))}%` }} /></div></div></div>
        <p className="neb-live-session-status" aria-live="polite">{live.snapshot.message}</p>
        {(actionError || live.error) && <p className="neb-live-error" role="alert">{actionError || live.error}</p>}
        {takeover && live.snapshot.phase === 'paused' && <p className="neb-live-takeover" role="status">Hai il controllo. Usa il tuo microfono sul sito; NEB resta in pausa finché premi Riprendi ascolto.</p>}
        <div ref={transcript} className="neb-live-transcript" role="log" aria-label="Trascrizione della conversazione" aria-live="polite" aria-relevant="additions text" tabIndex={0} onScroll={() => { const node = transcript.current; if (node && node.scrollHeight - node.scrollTop - node.clientHeight > 70) setFollowing(false) }}>
          {!live.snapshot.history.length && <div className="neb-live-empty"><span className="neb-live-empty-icon"><Mic size={26} /></span><h4>La conversazione comincia qui.</h4><p>{opening ? 'NEB apre con una breve introduzione e lascia spazio all’interlocutore.' : 'Avvia la sessione e lascia parlare l’interlocutore. NEB risponderà al termine del suo turno.'}</p><small>La trascrizione resta in questa sessione. Esportala quando vuoi conservarla.</small></div>}
          {live.snapshot.history.map((item) => <article key={item.id} className={`neb-live-turn neb-live-turn-${item.role}`}><header><strong>{item.role === 'neb' ? 'NEB' : 'Interlocutore'}</strong><time>{timestamp(item.atMs)}</time>{item.partial && <span className="neb-live-partial">Interrotto · parziale</span>}</header><p dir="auto">{item.text}</p></article>)}
        </div>
        <div className="neb-live-controls">
          {!live.locked && <button type="button" className="primary-button neb-live-start" disabled={!canStart} onClick={() => void start()}><Play size={16} />{live.starting ? 'Avvio…' : 'Avvia conversazione'}</button>}
          {live.active && <><button type="button" className="secondary-button" onClick={live.pause}><Pause size={15} />Pausa</button><button type="button" className="secondary-button" onClick={() => { setTakeover(true); live.pause() }}><Mic size={15} />Prendi controllo</button></>}
          {live.snapshot.phase === 'paused' && <button type="button" className="primary-button neb-live-start" disabled={!canResume} onClick={() => { setTakeover(false); live.resume() }}><Play size={15} />Riprendi ascolto</button>}
          {live.locked && <button type="button" className="secondary-button neb-live-stop" onClick={live.stop}><Square size={15} />Stop</button>}
          <button type="button" className="secondary-button neb-live-export" disabled={!live.snapshot.log.length && !live.snapshot.history.length} onClick={live.exportLog}><Download size={14} />Esporta JSON</button>
        </div>
        {prerequisites && (!live.locked || live.snapshot.phase === 'paused') && <p className="neb-live-prerequisite" role="status">{prerequisites}</p>}
        <p className="neb-live-footer-note">Ctrl+Alt+S / Esc: stop · Limiti: 20 minuti, 40 turni, $1 OpenRouter. Costi Gemini esclusi; le richieste interrotte possono avere un costo.</p>
        <details className="neb-live-details neb-live-log"><summary>Dettagli della sessione{live.snapshot.log.length ? ` · ${live.snapshot.log.length} eventi` : ''}</summary><p className="neb-live-note">Audio e contesto sono inviati a Qwen tramite OpenRouter; Gemini genera la voce. Audio e trascrizione non vengono salvati automaticamente.</p>{live.snapshot.log.length ? <ol>{live.snapshot.log.slice(-40).map((entry, index) => <li key={`${entry.atMs}-${index}`}><time>{timestamp(entry.atMs)}</time><span>{entry.text}</span>{entry.qwenMs !== undefined && <small>Qwen {entry.qwenMs} ms</small>}</li>)}</ol> : <p className="neb-live-note">Tempi e decisioni appariranno dopo l’avvio.</p>}</details>
      </section>
    </div>
  </section>
}
