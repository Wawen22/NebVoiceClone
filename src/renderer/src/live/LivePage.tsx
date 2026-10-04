import { useEffect, useRef, useState } from 'react'
import { AudioLines, Check, ChevronRight, Download, FolderOpen, Headphones, Mic, Pause, Play, Plus, RefreshCw, Save, Settings2, Square, Trash2, X } from 'lucide-react'
import type { AppSettings } from '../../../shared/contracts'
import type { LiveConfig, LiveProfile } from '../../../shared/live'
import type { OutlierSetup } from '../../../shared/outlier'
import type { AudioOutput } from '../audio/AudioEngine'
import type { LiveConversation } from './useLiveConversation'
import { LiveTranscript, liveTimestamp } from './LiveTranscript'
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
  const [configOpen, setConfigOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'profile' | 'audio' | 'details'>('profile')
  const [silenceMs, setSilenceMs] = useState(2500)
  const [takeover, setTakeover] = useState(false)
  const [setup, setSetup] = useState<OutlierSetup | null>(null)
  const [extensionId, setExtensionId] = useState('')
  const [setupBusy, setSetupBusy] = useState(false)
  const [setupError, setSetupError] = useState('')
  const configToggle = useRef<HTMLButtonElement>(null)
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
    : !captureReady ? live.audioStatus.state === 'active' ? 'Attendo il flusso audio della scheda…' : live.audioStatus.message || 'Avvia l’ascolto della scheda dal popup NEB.'
    : live.unavailableReason
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
    try { await live.start(config, opening, dirty ? () => saveConfig(true) : undefined, { silenceMs }) }
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

  function newConversation(): void {
    live.newConversation()
    setTakeover(false)
    setActionError('')
  }
  function showAudio(): void { setConfigOpen(true); setSettingsTab('audio') }
  function closeConfig(): void { setConfigOpen(false); configToggle.current?.focus() }

  return <section className="neb-live" data-no-speech-shortcuts>
    <header className="neb-live-heading">
      <div className="neb-live-title"><span className="eyebrow">NEB LIVE</span><h2>Conversazione</h2></div>
      <div className="neb-live-heading-actions">
        <span className={`neb-live-state neb-live-state-${live.snapshot.phase}`}><span className="status-dot" />{phaseLabels[live.snapshot.phase]}</span>
        <button type="button" className="secondary-button neb-live-new" onClick={newConversation} title="Ferma il turno e pulisci la sessione; profilo, voce e collegamento restano disponibili"><Plus size={16} />Nuova conversazione</button>
        <button ref={configToggle} type="button" className={`secondary-button neb-live-config-toggle ${configOpen ? 'active' : ''}`} aria-expanded={configOpen} aria-controls="neb-live-configuration" onClick={() => setConfigOpen((value) => !value)}><Settings2 size={16} />Configura{dirty && <span className="neb-live-unsaved-dot" title="Modifiche da salvare" />}</button>
      </div>
    </header>

    <div className={`neb-live-workspace ${configOpen ? 'with-config' : ''}`}>
      <section className="neb-live-session" aria-label="Conversazione live">
        <div className="neb-live-toolbar">
          <label className="neb-live-profile-select" htmlFor="neb-live-profile"><span>Profilo</span><select id="neb-live-profile" value={profile?.id ?? ''} disabled={locked || loading || !config} onChange={(event) => { if (config) edit({ ...config, selectedProfileId: event.target.value }) }}>
            {config?.profiles.map((item) => <option key={item.id} value={item.id}>{item.name || 'Profilo senza nome'}</option>)}
          </select></label>
          <button type="button" className={`neb-live-connection ${captureReady ? 'ready' : ''}`} onClick={showAudio} title={live.audioStatus.target?.url || 'Collega e ascolta la scheda dal popup del browser'}>
            <span className={`status-dot ${captureReady ? 'green' : 'amber'}`} /><span>{captureReady ? live.audioStatus.target?.title || 'Browser in ascolto' : 'Collega il browser'}</span><ChevronRight size={14} />
          </button>
          <button type="button" className="neb-live-voice-chip" onClick={showAudio} title={`Voce: ${voiceName}. Uscita: ${output?.label || 'Da configurare'}`}><Headphones size={14} /><span>{geminiReady && routed ? 'Voce pronta' : 'Configura la voce'}</span></button>
        </div>
        {loading && <p className="neb-live-inline-note" role="status">Caricamento dei profili…</p>}
        {loadError && <div className="neb-live-error" role="alert"><p>{loadError}</p><button type="button" className="secondary-button" onClick={() => setLoadAttempt((value) => value + 1)}>Riprova caricamento</button></div>}
        {(actionError || live.error) && <p className="neb-live-error" role="alert">{actionError || live.error}</p>}
        {takeover && live.snapshot.phase === 'paused' && <p className="neb-live-takeover" role="status">Hai il controllo. Usa il tuo microfono sul sito; NEB resta in pausa finché premi Riprendi ascolto.</p>}
        <LiveTranscript history={live.snapshot.history} opening={opening} phase={live.snapshot.phase} />
        <footer className="neb-live-session-footer">
          <div className="neb-live-status-row">
            <div className="neb-live-status-message"><AudioLines size={16} /><span className="neb-live-session-status" aria-live="polite">{prerequisites && (!live.locked || live.snapshot.phase === 'paused') ? prerequisites : live.snapshot.message}</span></div>
            <div className="neb-live-meter" role="meter" aria-label="Livello audio della scheda" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, Math.max(0, live.snapshot.level)) * 100)}><span style={{ width: `${Math.min(100, Math.max(0, live.snapshot.level * 100))}%` }} /></div>
          </div>
          <div className="neb-live-controls">
            {!live.active && live.snapshot.phase !== 'paused' && <button type="button" className="primary-button neb-live-start" disabled={!canStart} onClick={() => void start()}><Play size={16} />{live.starting ? 'Avvio…' : 'Avvia conversazione'}</button>}
            {live.active && <><button type="button" className="secondary-button" onClick={live.pause}><Pause size={15} />Pausa</button><button type="button" className="secondary-button" onClick={() => { setTakeover(true); live.pause() }}><Mic size={15} />Prendi controllo</button></>}
            {live.snapshot.phase === 'paused' && <button type="button" className="primary-button neb-live-start" disabled={!canResume} onClick={() => { setTakeover(false); live.resume() }}><Play size={15} />Riprendi ascolto</button>}
            {live.locked && <button type="button" className="secondary-button neb-live-stop" onClick={live.stop}><Square size={15} />Stop</button>}
            <div className="neb-live-session-meta"><span title="Interventi NEB in questa sessione">{live.snapshot.turns}<small> / 40 turni</small></span><button type="button" onClick={() => { setConfigOpen(true); setSettingsTab('details') }} title="Costo OpenRouter osservato; Gemini escluso">${live.snapshot.costUsd.toFixed(4)}{!live.snapshot.costKnown && ' + ?'}</button></div>
            <button type="button" className="neb-live-export" disabled={!live.snapshot.log.length && !live.snapshot.history.length} onClick={live.exportLog} title="Conserva la sessione prima di iniziarne una nuova"><Download size={15} />Esporta JSON</button>
          </div>
        </footer>
      </section>

      {configOpen && <aside id="neb-live-configuration" className="neb-live-config" aria-label="Configurazione della conversazione">
        <div className="neb-live-panel-heading"><h3>Configurazione</h3><button type="button" className="icon-button" aria-label="Chiudi configurazione" onClick={closeConfig}><X size={17} /></button></div>
        <div className="neb-live-panel-tabs" role="tablist" aria-label="Configurazione NEB Live">
          {([['profile', 'Profilo'], ['audio', 'Audio'], ['details', 'Dettagli']] as const).map(([id, label], index, tabs) => <button key={id} id={`neb-live-tab-${id}`} type="button" role="tab" aria-selected={settingsTab === id} aria-controls={`neb-live-panel-${id}`} tabIndex={settingsTab === id ? 0 : -1} onClick={() => setSettingsTab(id)} onKeyDown={(event) => {
            if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
            setSettingsTab(tabs[next][0]); document.getElementById(`neb-live-tab-${tabs[next][0]}`)?.focus()
          }}>{label}{id === 'profile' && dirty && <span className="neb-live-unsaved-dot" />}</button>)}
        </div>
        <div className="neb-live-panel-body">
          <section id="neb-live-panel-profile" role="tabpanel" aria-labelledby="neb-live-tab-profile" hidden={settingsTab !== 'profile'}>
            {config && profile && !loading && !loadError && <>
              <div className="neb-live-card-heading"><h4>Personalizza il profilo</h4><div className="neb-live-profile-actions"><button type="button" className="icon-button" aria-label="Aggiungi profilo" title="Aggiungi profilo" disabled={locked || config.profiles.length >= 30} onClick={addProfile}><Plus size={16} /></button><button type="button" className="icon-button" aria-label="Elimina profilo selezionato" title="Elimina profilo selezionato" disabled={locked || config.profiles.length <= 1} onClick={removeProfile}><Trash2 size={15} /></button></div></div>
              <fieldset className="neb-live-fields" disabled={locked}>
                <label htmlFor="neb-live-name">Nome<input id="neb-live-name" value={profile.name} maxLength={120} onChange={(event) => editProfile({ name: event.target.value })} /></label>
                <label htmlFor="neb-live-context">Obiettivo della conversazione<textarea id="neb-live-context" value={profile.context} maxLength={8000} onChange={(event) => editProfile({ context: event.target.value })} placeholder="Ruolo, argomento e obiettivo." rows={4} /></label>
                <div className="neb-live-pair"><label htmlFor="neb-live-language">Lingua<select id="neb-live-language" value={profile.language} onChange={(event) => editProfile({ language: event.target.value as LiveProfile['language'] })}><option value="auto">Segui l’interlocutore</option><option value="it">Italiano</option><option value="en">English</option><option value="ar">العربية</option></select></label><label htmlFor="neb-live-tone">Tono<select id="neb-live-tone" value={profile.tone} onChange={(event) => editProfile({ tone: event.target.value as LiveProfile['tone'] })}><option value="professional">Professionale</option><option value="conversational">Conversazionale</option></select></label></div>
                <label htmlFor="neb-live-opening">Chi inizia<select id="neb-live-opening" value={opening ? 'opening' : 'listen'} onChange={(event) => setOpening(event.target.value === 'opening')}><option value="listen">Ascolta prima l’interlocutore</option><option value="opening">Genera una breve apertura</option></select></label>
                <label htmlFor="neb-live-pace">Pausa prima di rispondere<select id="neb-live-pace" value={silenceMs} onChange={(event) => setSilenceMs(Number(event.target.value))}><option value={1500}>Rapida · 1,5 secondi</option><option value={2500}>Naturale · 2,5 secondi</option><option value={3500}>Riflessiva · 3,5 secondi</option></select></label>
                <p className="neb-live-note">Una pausa breve riduce l’attesa, ma può anticipare una frase non ancora conclusa. I tempi di elaborazione e voce si aggiungono.</p>
                <details className="neb-live-details"><summary>Background e stile personale</summary><label htmlFor="neb-live-background">Background<textarea id="neb-live-background" value={config.background} maxLength={40000} rows={8} onChange={(event) => edit({ ...config, background: event.target.value })} /></label><label htmlFor="neb-live-persona">Modo di parlare<textarea id="neb-live-persona" value={config.persona} maxLength={20000} rows={7} onChange={(event) => edit({ ...config, persona: event.target.value })} /></label></details>
              </fieldset>
              <div className="neb-live-save-row"><button type="button" className="secondary-button" disabled={locked || !dirty || !profile.name.trim()} onClick={() => void saveConfig()}><Save size={14} />{saving ? 'Salvataggio…' : 'Salva profili'}</button>{!dirty && <small><Check size={12} />Salvato</small>}</div>
              <p className="neb-live-note">{live.locked ? 'Il profilo resta fisso durante la sessione.' : dirty ? 'Le modifiche si salvano anche all’avvio.' : 'Profili conservati su questo dispositivo.'}</p>
              {saveMessage && <p className="neb-live-note neb-live-success" role="status">{saveMessage}</p>}
            </>}
          </section>
          <section id="neb-live-panel-audio" role="tabpanel" aria-labelledby="neb-live-tab-audio" hidden={settingsTab !== 'audio'}>
            <h4>Browser e voce</h4>
            <div className={`neb-live-capture ${captureReady ? 'neb-live-capture-ready' : ''}`}><span className={`status-dot ${captureReady ? 'green' : 'amber'}`} /><div><strong>{live.audioStatus.target?.title || 'Nessuna scheda in ascolto'}</strong><p>{captureReady ? 'Audio della scheda in ricezione' : live.audioStatus.message}</p>{live.audioStatus.target && <small title={live.audioStatus.target.url}>{live.audioStatus.target.url}</small>}</div></div>
            {!captureReady && <div className="neb-live-connect-guide"><strong>Dal popup NEB nel browser</strong><ol><li>Premi <b>Collega questa scheda</b>.</li><li>Attendi la conferma e premi <b>Ascolta questa scheda</b>.</li></ol></div>}
            <fieldset className="neb-live-fields" disabled={locked}><div className="neb-live-output-picker"><label htmlFor="neb-live-output">Uscita NEB<select id="neb-live-output" value={settings.outputDeviceId} onChange={(event) => onUpdate({ outputDeviceId: event.target.value })}>{!output && <option value={settings.outputDeviceId}>{settings.outputDeviceId === 'default' ? 'Predefinito di sistema' : 'Uscita salvata non disponibile'}</option>}{outputs.map((item) => <option key={item.deviceId} value={item.deviceId}>{item.label}</option>)}</select></label><button type="button" className="icon-button" onClick={onRefreshOutputs} aria-label="Aggiorna uscite audio" title="Aggiorna uscite audio"><RefreshCw size={15} /></button></div></fieldset>
            <div className="neb-live-voice-summary"><Mic size={16} /><div><strong>{voiceName}</strong><small>{geminiReady ? 'Gemini disponibile' : 'Configura Gemini nelle Impostazioni'}</small></div></div>
            <p className="neb-live-note">NEB → <strong>CABLE Input</strong><br />Microfono del sito → <strong>CABLE Output</strong><br />Audio del sito → le tue cuffie</p>
            <details className="neb-live-details"><summary>Configura Edge o Chrome{setup?.installed ? ' · host installato' : ''}</summary><ol><li>Apri <strong>edge://extensions</strong> o <strong>chrome://extensions</strong> e abilita la modalità sviluppatore.</li><li>Carica la cartella dell’estensione NEB e copia il suo ID.</li><li>Salva l’host qui sotto e collega la scheda dal popup.</li></ol><fieldset className="neb-live-fields" disabled={locked || setupBusy}><button type="button" className="secondary-button" onClick={() => void setupAction(() => window.neb.openOutlierExtensionFolder())}><FolderOpen size={14} />Apri cartella estensione</button><label htmlFor="neb-live-extension-id">ID estensione<input id="neb-live-extension-id" value={extensionId} onChange={(event) => setExtensionId(event.target.value)} maxLength={32} spellCheck={false} autoComplete="off" placeholder="32 lettere, da a a p" /></label><button type="button" className="secondary-button" disabled={platform !== 'win32' || !/^[a-p]{32}$/.test(extensionId.trim())} onClick={() => void setupAction(async () => { await window.neb.installOutlierHost(extensionId.trim()); const next = await window.neb.getOutlierSetup(); if (mounted.current) { setSetup(next); setExtensionId(next.extensionId ?? '') } })}>{setupBusy ? 'Configurazione…' : 'Salva host per Edge e Chrome'}</button></fieldset>{setup?.extensionPath && <p className="neb-live-path">{setup.extensionPath}</p>}{setupError && <p className="neb-live-error" role="alert">{setupError}</p>}</details>
          </section>
          <section id="neb-live-panel-details" role="tabpanel" aria-labelledby="neb-live-tab-details" hidden={settingsTab !== 'details'}>
            <h4>Questa sessione</h4>
            <dl className="neb-live-session-facts"><div><dt>Turni NEB</dt><dd>{live.snapshot.turns} / 40</dd></div><div><dt>Costo OpenRouter osservato</dt><dd>${live.snapshot.costUsd.toFixed(4)}{!live.snapshot.costKnown && ' + sconosciuto'}</dd></div><div><dt>Durata massima</dt><dd>20 minuti</dd></div><div><dt>Limite OpenRouter</dt><dd>$1</dd></div></dl>
            <p className="neb-live-note">Il costo esclude Gemini. Le richieste interrotte possono essere fatturate.</p>
            <p className="neb-live-note"><kbd>Esc</kbd> o <kbd>Ctrl+Alt+S</kbd> fermano NEB. <strong>Stop</strong> conserva la trascrizione; <strong>Nuova conversazione</strong> la pulisce. Esporta prima se vuoi conservarla.</p>
            <details className="neb-live-details neb-live-log"><summary>Eventi e tempi{live.snapshot.log.length ? ` · ${live.snapshot.log.length}` : ''}</summary>{live.snapshot.log.length ? <ol>{live.snapshot.log.slice(-40).map((entry, index) => <li key={`${entry.atMs}-${index}`}><time>{liveTimestamp(entry.atMs)}</time><span>{entry.text}</span>{entry.qwenMs !== undefined && <small>Qwen {(entry.qwenMs / 1000).toFixed(1)} s</small>}</li>)}</ol> : <p className="neb-live-note">I tempi appariranno dopo l’avvio.</p>}</details>
            <p className="neb-live-note">Audio e contesto sono inviati a Qwen tramite OpenRouter; Gemini genera la voce. Audio e trascrizione non vengono salvati automaticamente.</p>
          </section>
        </div>
      </aside>}
    </div>
  </section>
}
