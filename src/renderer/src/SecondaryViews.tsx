import { useState } from 'react'
import type { AudioOutput } from './audio/AudioEngine'
import { Icon } from './Icons'
import { VoiceReplicationWizard } from './VoiceReplicationWizard'
import type { AppInfo, AppSettings, GeminiKeySource, GeminiKeyStatus, ProviderStatus, SaveGeminiKeyRequest } from '../../shared/contracts'
import { geminiKeyLabel } from '../../shared/geminiKeyLabels'

interface SettingsProps {
  gemini: ProviderStatus
  geminiMessage: string
  info: AppInfo | null
  settings: AppSettings
  keyStatus: GeminiKeyStatus | null
  keyBusy: boolean
  keyMessage: string
  keyError: string
  voiceProfileBusy: boolean
  voiceProfileMessage: string
  voiceProfileError: string
  onCheckGemini: () => void
  onSaveGeminiKey: (request: SaveGeminiKeyRequest) => Promise<boolean>
  onSelectGeminiKey: (source: GeminiKeySource) => Promise<void>
  onRemoveGeminiKey: () => Promise<void>
  onExportVoiceProfile: () => void
  onImportVoiceProfile: () => void
  onVoiceCreated: (settings: AppSettings) => void
}

export function SettingsPage({ gemini, geminiMessage, info, settings, keyStatus, keyBusy, keyMessage, keyError, voiceProfileBusy, voiceProfileMessage, voiceProfileError, onCheckGemini, onSaveGeminiKey, onSelectGeminiKey, onRemoveGeminiKey, onExportVoiceProfile, onImportVoiceProfile, onVoiceCreated }: SettingsProps): React.JSX.Element {
  const [keyLabel, setKeyLabel] = useState('Chiave aggiuntiva')
  const [keyDraft, setKeyDraft] = useState('')
  const activeKeyName = geminiKeyLabel(settings.geminiKeySource, keyStatus)
  const activeVoiceName = settings.replicatedVoice?.displayName || 'Nessuna voce personale'
  async function saveKey(): Promise<void> {
    if (await onSaveGeminiKey({ label: keyLabel, apiKey: keyDraft })) setKeyDraft('')
  }
  return <div className="content settings-page">
    <div className="page-intro"><span className="eyebrow">CONFIGURAZIONE</span><h2>Impostazioni</h2><p>La voce personale segue la chiave selezionata. Modello e audio sono condivisi.</p></div>
    <section className="settings-scope-overview" aria-label="Quali impostazioni cambiano con la chiave">
      <div className="scope-card scope-card-active"><span className="scope-tag">Solo chiave attiva</span><strong>{activeKeyName}</strong><span>Voce personale: {activeVoiceName}</span><p>La voce scelta in Console, il profilo esportato o importato e una nuova clonazione riguardano questa chiave.</p></div>
      <div className="scope-card"><span className="scope-tag scope-tag-shared">Condivise tra le chiavi</span><strong>Modello e uscita audio</strong><span>{settings.geminiModel}</span><p>Modello, dispositivo di uscita e volume restano uguali quando cambi chiave. Li regoli in Console.</p></div>
    </section>
    <section className="panel">
      <span className="eyebrow">CONNESSIONE</span><h3>Gemini API</h3>
      <p>Connessione per <strong>{activeKeyName}</strong>: <strong>{geminiMessage}</strong></p>
      <p>Chiave disponibile: <strong>{info?.geminiConfigured ? 'Sì' : 'No'}</strong>.</p>
      <div className="inline-actions"><button className="secondary-button" onClick={onCheckGemini}><Icon name="refresh" /> Ricontrolla connessione</button><a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer">Chiavi Google AI Studio <Icon name="external" size={13} /></a></div>
    </section>
    <section className="panel gemini-key-panel">
      <span className="eyebrow">CREDENZIALI</span><h3>Scegli la chiave Gemini</h3>
      <p>Quando cambi chiave, l’app ripristina automaticamente la sua voce personale e la voce selezionata in Console.</p>
      <label>Chiave attiva<select value={settings.geminiKeySource} disabled={keyBusy} onChange={(event) => void onSelectGeminiKey(event.target.value as GeminiKeySource)}><option value="environment">{geminiKeyLabel('environment', keyStatus)} · {keyStatus?.environmentConfigured ? 'disponibile' : 'non configurata'}</option><option value="project" disabled={!keyStatus?.projectConfigured}>{geminiKeyLabel('project', keyStatus)} · {keyStatus?.projectConfigured ? 'disponibile' : 'non configurata'}</option><option value="saved" disabled={!keyStatus?.savedLabel || !keyStatus.secureStorageAvailable}>{keyStatus?.savedLabel || 'Chiave aggiuntiva cifrata'} · {keyStatus?.savedLabel ? 'salvata' : 'non salvata'}</option></select></label>
      <div className="key-voice-summary" aria-label="Voci personali per chiave"><div className={settings.geminiKeySource === 'environment' ? 'diag-row is-active' : 'diag-row'}><span>{geminiKeyLabel('environment', keyStatus)}</span><strong>{settings.voiceProfiles.environment.replicatedVoice?.displayName || 'Nessuna voce personale'}</strong></div><div className={settings.geminiKeySource === 'project' ? 'diag-row is-active' : 'diag-row'}><span>{geminiKeyLabel('project', keyStatus)}</span><strong>{settings.voiceProfiles.project.replicatedVoice?.displayName || 'Nessuna voce personale'}</strong></div>{keyStatus?.savedLabel && <div className={settings.geminiKeySource === 'saved' ? 'diag-row is-active' : 'diag-row'}><span>{keyStatus.savedLabel}</span><strong>{settings.voiceProfiles.saved.replicatedVoice?.displayName || 'Nessuna voce personale'}</strong></div>}</div>
      <details className="extra-key-details"><summary>Gestisci una chiave aggiuntiva</summary><p>Se ti serve una terza chiave, puoi salvarla cifrata sul dispositivo. Dopo il salvataggio l’app mostra soltanto il nome.</p><form className="gemini-key-form" onSubmit={(event) => { event.preventDefault(); void saveKey() }}>
        <label>Nome della chiave<input type="text" value={keyLabel} maxLength={40} autoComplete="off" onChange={(event) => setKeyLabel(event.target.value)} /></label>
        <label>Nuova chiave API<input type="password" value={keyDraft} autoComplete="off" spellCheck={false} placeholder="Incolla la chiave qui" onChange={(event) => setKeyDraft(event.target.value)} /></label>
        <div className="inline-actions"><button className="secondary-button" type="submit" disabled={keyBusy || !keyDraft.trim() || !keyLabel.trim() || !keyStatus?.secureStorageAvailable}>Salva chiave aggiuntiva</button><button className="text-button" type="button" disabled={keyBusy || !keyStatus?.savedLabel} onClick={() => void onRemoveGeminiKey()}>Rimuovi chiave aggiuntiva</button></div>
      </form></details>
      {keyStatus && !keyStatus.secureStorageAvailable && <p className="hint">L’archiviazione cifrata non è disponibile in questo ambiente. Apri l’app Windows nativa per salvare una seconda chiave.</p>}
      {keyMessage && <p className="voice-profile-message" role="status">{keyMessage}</p>}
      {keyError && <p className="notice error" role="alert">{keyError}</p>}
    </section>
    <section className="panel voice-profile">
      <span className="eyebrow">PROFILO VOCE · SOLO {activeKeyName.toLocaleUpperCase('it-IT')}</span><h3>Esporta o importa la voce di {activeKeyName}</h3>
      <p>Il profilo esporta solo ID, nome e modello della voce. Non include chiavi, registrazioni, testo o routing audio.</p>
      <p>Voce personale di questa chiave: <strong>{activeVoiceName}</strong>. L’importazione è verificata con {activeKeyName} e non modifica il profilo delle altre chiavi.</p>
      <div className="action-row"><button disabled={!settings.replicatedVoice || voiceProfileBusy} onClick={onExportVoiceProfile}><Icon name="upload" /> Esporta profilo</button><button disabled={voiceProfileBusy} onClick={onImportVoiceProfile}><Icon name="copy" /> Importa profilo</button></div>
      {voiceProfileMessage && <p className="voice-profile-message" role="status">{voiceProfileMessage}</p>}
      {voiceProfileError && <p className="notice error" role="alert">{voiceProfileError}</p>}
    </section>
    <VoiceReplicationWizard gemini={{ ...gemini, message: geminiMessage }} settings={settings} activeKeyName={activeKeyName} onCreated={onVoiceCreated} />
    <section className="panel"><span className="eyebrow">PRIVACY</span><h3>Testo e audio</h3><p>Il testo resta in memoria durante la sessione e viene inviato a Gemini solo quando premi Pronuncia. Le registrazioni della voce vengono inviate solo quando avvii la creazione della voce.</p></section>
  </div>
}

interface DiagnosticsProps {
  info: AppInfo | null
  geminiMessage: string
  settings: AppSettings
  outputs: AudioOutput[]
  isLinux: boolean
  virtualOutput: AudioOutput | undefined
}

export function DiagnosticsPage({ info, geminiMessage, settings, outputs, isLinux, virtualOutput }: DiagnosticsProps): React.JSX.Element {
  const outputLabel = outputs.find((output) => output.deviceId === settings.outputDeviceId)?.label ?? (settings.outputDeviceId === 'default' ? 'Predefinito di sistema' : 'Dispositivo salvato non disponibile')
  return <div className="content settings-page">
    <div className="page-intro"><span className="eyebrow">SUPPORTO</span><h2>Diagnostica</h2><p>Informazioni locali utili per verificare connessione e dispositivi.</p></div>
    <section className="panel diagnostics">
      <Row name="Electron" value={info?.electron || 'Caricamento'} />
      <Row name="Node" value={info?.node || 'Caricamento'} />
      <Row name="Piattaforma" value={info?.platform || 'Caricamento'} />
      <Row name="Chiave Gemini" value={info?.geminiConfigured ? 'Presente' : 'Assente'} />
      <Row name="Gemini API" value={geminiMessage} />
      <Row name="Modello selezionato" value={settings.geminiModel} />
      <Row name="Voce selezionata" value={settings.geminiVoiceId} />
      <Row name="Uscite audio" value={String(outputs.length)} />
      <Row name={isLinux ? 'Uscita virtuale PipeWire' : 'VB-CABLE'} value={virtualOutput ? 'Rilevata' : 'Non rilevata'} />
      <Row name="Uscita selezionata" value={outputLabel} />
    </section>
  </div>
}

function Row({ name, value }: { name: string; value: string }): React.JSX.Element {
  return <div className="diag-row"><span>{name}</span><strong>{value}</strong></div>
}
