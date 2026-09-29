import type { AudioOutput } from './audio/AudioEngine'
import { Icon } from './Icons'
import { VoiceReplicationWizard } from './VoiceReplicationWizard'
import type { AppInfo, AppSettings, ProviderStatus } from '../../shared/contracts'

interface SettingsProps {
  gemini: ProviderStatus
  geminiMessage: string
  info: AppInfo | null
  settings: AppSettings
  voiceProfileBusy: boolean
  voiceProfileMessage: string
  voiceProfileError: string
  onCheckGemini: () => void
  onExportVoiceProfile: () => void
  onImportVoiceProfile: () => void
  onVoiceCreated: (settings: AppSettings) => void
}

export function SettingsPage({ gemini, geminiMessage, info, settings, voiceProfileBusy, voiceProfileMessage, voiceProfileError, onCheckGemini, onExportVoiceProfile, onImportVoiceProfile, onVoiceCreated }: SettingsProps): React.JSX.Element {
  return <div className="content settings-page">
    <div className="page-intro"><span className="eyebrow">CONFIGURAZIONE</span><h2>La tua voce, le tue impostazioni.</h2><p>Gestisci la connessione Gemini e la tua voce personale.</p></div>
    <section className="panel">
      <span className="eyebrow">CONNESSIONE</span><h3>Gemini API</h3>
      <p>Stato: <strong>{geminiMessage}</strong></p>
      <p>Chiave disponibile: <strong>{info?.geminiConfigured ? 'Sì' : 'No'}</strong>. Per lo sviluppo locale, salva <code>GEMINI_API_KEY</code> nel file ignorato <code>.env.local</code> e riavvia l’app.</p>
      <div className="inline-actions"><button className="secondary-button" onClick={onCheckGemini}><Icon name="refresh" /> Ricontrolla connessione</button><a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer">Chiavi Google AI Studio <Icon name="external" size={13} /></a></div>
    </section>
    <section className="panel voice-profile">
      <span className="eyebrow">PROFILO VOCE</span><h3>Usa la tua voce su un altro computer</h3>
      <p>Il profilo esporta solo ID, nome e modello della voce. Non include chiavi, registrazioni, testo o routing audio.</p>
      <p>{settings.replicatedVoice ? <>Voce attuale: <strong>{settings.replicatedVoice.displayName}</strong></> : 'Nessuna voce personale salvata su questo computer.'}</p>
      <div className="action-row"><button disabled={!settings.replicatedVoice || voiceProfileBusy} onClick={onExportVoiceProfile}><Icon name="upload" /> Esporta profilo</button><button disabled={voiceProfileBusy} onClick={onImportVoiceProfile}><Icon name="copy" /> Importa profilo</button></div>
      {voiceProfileMessage && <p className="voice-profile-message" role="status">{voiceProfileMessage}</p>}
      {voiceProfileError && <p className="notice error" role="alert">{voiceProfileError}</p>}
    </section>
    <VoiceReplicationWizard gemini={{ ...gemini, message: geminiMessage }} settings={settings} onCreated={onVoiceCreated} />
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
