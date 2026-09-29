import { useState } from 'react'
import { Icon } from './Icons'

const pipeWireSetup = `pactl load-module module-null-sink sink_name=neb_voice sink_properties=device.description=NEB_Voice
pactl load-module module-loopback source=neb_voice.monitor sink=@DEFAULT_SINK@ latency_msec=40
pactl load-module module-remap-source master=neb_voice.monitor source_name=neb_voice_mic source_properties=device.description=NEB_Voice_Microphone`

export function SetupGuide(): React.JSX.Element {
  return <div className="content narrow settings-page setup-guide-page">
    <div className="intro">
      <div><span className="eyebrow">GUIDA AL ROUTING</span><h2>Microfono del browser</h2><p>Configura il percorso audio, poi ricarica la pagina del browser prima della prova.</p></div>
    </div>

    <section className="panel guide-overview">
      <span className="eyebrow">OGNI CONVERSAZIONE</span>
      <h3>Usa NEB in tre passaggi</h3>
      <ol>
        <li>Nella Console scegli l’uscita virtuale del tuo sistema operativo.</li>
        <li>In Edge scegli il microfono virtuale corrispondente.</li>
        <li>Scrivi in NEB, premi <strong>Pronuncia</strong> e verifica che l’indicatore del microfono si muova nel browser.</li>
      </ol>
    </section>

    <section className="panel platform-guide">
      <div className="guide-platform-heading"><div><span className="eyebrow">WINDOWS</span><h3>VB-Audio Virtual Cable</h3></div><span className="platform-chip">CABLE</span></div>
      <div className="guide-grid">
        <GuideStep title="Invia la voce a Edge">
          <p>In NEB scegli <strong>CABLE Input (VB-Audio Virtual Cable)</strong> come uscita. In Edge scegli <strong>CABLE Output</strong> come microfono.</p>
        </GuideStep>
        <GuideStep title="Ascolta NEB nelle cuffie">
          <p>Premi <kbd>Win</kbd> + <kbd>R</kbd>, digita <code>mmsys.cpl</code>, poi apri <strong>Registrazione → CABLE Output → Ascolta</strong>. Attiva “Ascolta il dispositivo” e scegli le cuffie come uscita di ascolto.</p>
        </GuideStep>
        <GuideStep title="Torna al microfono delle cuffie">
          <p>Seleziona direttamente il microfono delle cuffie in Edge, poi ricarica la pagina. Non serve cambiare NEB.</p>
        </GuideStep>
        <GuideStep title="Risoluzione problemi">
          <p>Se CABLE non compare, aggiorna i dispositivi in NEB. Se non senti la voce, ricontrolla la scheda “Ascolta” e le cuffie selezionate. Ricarica il sito dopo aver cambiato microfono.</p>
        </GuideStep>
      </div>
    </section>

    <section className="panel platform-guide">
      <div className="guide-platform-heading"><div><span className="eyebrow">UBUNTU</span><h3>Microfono virtuale PipeWire</h3></div><span className="platform-chip">PIPEWIRE</span></div>
      <div className="guide-grid">
        <GuideStep title="Configurazione della sessione">
          <p>Esegui questi comandi dopo l’accesso o il riavvio. Creano <strong>NEB_Voice</strong>, lo collegano all’uscita normale ed espongono <strong>NEB_Voice_Microphone</strong> a Edge.</p>
          <CopyCommand value={pipeWireSetup} />
        </GuideStep>
        <GuideStep title="Invia la voce a Edge">
          <p>In NEB scegli <strong>NEB_Voice</strong> come uscita. In Edge scegli <strong>NEB_Voice_Microphone</strong>, poi ricarica la pagina.</p>
        </GuideStep>
        <GuideStep title="Torna alle cuffie Jabra o a un altro microfono">
          <p>Nel menu audio di Ubuntu scegli il microfono delle cuffie come ingresso. Seleziona lo stesso microfono in Edge e ricarica la pagina.</p>
        </GuideStep>
        <GuideStep title="Torna dalle cuffie a NEB">
          <p>Prima scegli <strong>NEB_Voice_Microphone</strong> come ingresso in Ubuntu. Poi selezionalo in Edge e ricarica la pagina. Questo passaggio può renderlo visibile a Edge.</p>
        </GuideStep>
      </div>
      <div className="guide-troubleshooting">
        <span className="eyebrow">PROBLEMI SU UBUNTU</span>
        <p><strong>Edge non vede il dispositivo:</strong> selezionalo come ingresso in Ubuntu, riapri Edge e controlla <code>edge://settings/content/microphone</code>.</p>
        <p><strong>OverconstrainedError / deviceId:</strong> il sito conserva un dispositivo non più disponibile. Ricarica la pagina e scegli di nuovo il microfono.</p>
        <p><strong>Controlla gli ingressi disponibili:</strong></p>
        <CopyCommand value="pactl list short sources" />
        <p className="hint">I moduli PipeWire restano attivi per la sessione corrente. Dopo la disconnessione o il riavvio, esegui di nuovo la configurazione.</p>
      </div>
    </section>

    <section className="panel guide-overview">
      <span className="eyebrow">EDGE</span><h3>Scegli direttamente il dispositivo</h3>
      <p>Apri <code>edge://settings/content/microphone</code> e seleziona il microfono. Quando passi da NEB alle cuffie, ricarica la pagina dopo ogni cambio.</p>
    </section>
  </div>
}

function GuideStep({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return <article className="guide-step"><h4>{title}</h4>{children}</article>
}

function CopyCommand({ value }: { value: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }
  return <div className="guide-command"><code>{value}</code><button type="button" onClick={() => void copy()}><Icon name="copy" /> {copied ? 'Copiato' : 'Copia'}</button></div>
}
