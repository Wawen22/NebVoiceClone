import { useState } from 'react'
import { Icon } from './Icons'

const pipeWireSetup = `pactl load-module module-null-sink sink_name=neb_voice sink_properties=device.description=NEB_Voice
pactl load-module module-loopback source=neb_voice.monitor sink=@DEFAULT_SINK@ latency_msec=40
pactl load-module module-remap-source master=neb_voice.monitor source_name=neb_voice_mic source_properties=device.description=NEB_Voice_Microphone`

export function SetupGuide(): React.JSX.Element {
  return <div className="content narrow settings-page setup-guide-page">
    <div className="intro">
      <div><span className="eyebrow">ROUTING REFERENCE</span><h2>Browser microphone setup</h2><p>Choose the route you need, then reload the browser page before testing.</p></div>
    </div>

    <section className="panel guide-overview">
      <span className="eyebrow">EVERY CONVERSATION</span>
      <h3>Use NEB in three steps</h3>
      <ol>
        <li>In Console choose the virtual output for your operating system.</li>
        <li>In Edge choose the matching virtual microphone.</li>
        <li>Write in NEB, press <strong>Speak</strong>, and confirm the input meter moves in the browser.</li>
      </ol>
    </section>

    <section className="panel platform-guide">
      <div className="guide-platform-heading"><div><span className="eyebrow">WINDOWS</span><h3>VB-Audio Virtual Cable</h3></div><span className="platform-chip">CABLE</span></div>
      <div className="guide-grid">
        <GuideStep title="Speak through NEB">
          <p>In NEB select <strong>CABLE Input (VB-Audio Virtual Cable)</strong> as Output device. In Edge select <strong>CABLE Output</strong> as the microphone.</p>
        </GuideStep>
        <GuideStep title="Hear NEB in headphones">
          <p>Press <kbd>Win</kbd> + <kbd>R</kbd>, enter <code>mmsys.cpl</code>, then open <strong>Recording → CABLE Output → Listen</strong>. Enable “Listen to this device” and select your headphones under “Playback through this device”.</p>
        </GuideStep>
        <GuideStep title="Return to your headset microphone">
          <p>In Edge select your headset microphone directly, then reload the AI page. Keep the Windows output on your headphones; no NEB setting needs changing.</p>
        </GuideStep>
        <GuideStep title="Troubleshooting">
          <p>If CABLE is missing, press <strong>Refresh</strong> in NEB. If you cannot hear NEB, recheck the “Listen” tab and the selected headphones. If a site does not react, reload it after changing the microphone.</p>
        </GuideStep>
      </div>
    </section>

    <section className="panel platform-guide">
      <div className="guide-platform-heading"><div><span className="eyebrow">UBUNTU</span><h3>PipeWire virtual microphone</h3></div><span className="platform-chip">PIPEWIRE</span></div>
      <div className="guide-grid">
        <GuideStep title="One-time session setup">
          <p>Run these commands after login or reboot. They create <strong>NEB_Voice</strong>, route it to your normal output, and expose <strong>NEB_Voice_Microphone</strong> to Edge.</p>
          <CopyCommand value={pipeWireSetup} />
        </GuideStep>
        <GuideStep title="Speak through NEB">
          <p>In NEB select <strong>NEB_Voice</strong> as Output device. In Edge select <strong>NEB_Voice_Microphone</strong>, then reload the AI page.</p>
        </GuideStep>
        <GuideStep title="Return to Jabra or another headset">
          <p>Open Ubuntu’s top-right sound menu and select <strong>Handsfree — Neb Jabra Evolve2 65</strong> under Sound Input. Then choose the same microphone in Edge and reload the AI page.</p>
        </GuideStep>
        <GuideStep title="Return from headset to NEB">
          <p>First select <strong>NEB_Voice_Microphone</strong> in Ubuntu’s Sound Input menu. Then choose it in Edge and reload the AI page. Showing it in Ubuntu first makes it available to Edge.</p>
        </GuideStep>
      </div>
      <div className="guide-troubleshooting">
        <span className="eyebrow">UBUNTU TROUBLESHOOTING</span>
        <p><strong>Edge cannot see the device:</strong> select it in Ubuntu’s Sound Input menu, close and reopen Edge, then check <code>edge://settings/content/microphone</code>.</p>
        <p><strong>OverconstrainedError / deviceId:</strong> the website kept a device that is no longer available. Reload the page and choose the microphone again.</p>
        <p><strong>Inspect available sources:</strong></p>
        <CopyCommand value="pactl list short sources" />
        <p className="hint">PipeWire modules last for the current login session. After logout or reboot, run the session setup again.</p>
      </div>
    </section>

    <section className="panel guide-overview">
      <span className="eyebrow">EDGE</span><h3>Use direct device selection</h3>
      <p>Open <code>edge://settings/content/microphone</code> and choose the microphone explicitly. This is more reliable than “System default” when switching between NEB and a headset. Reload the active AI page after each change.</p>
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
  return <div className="guide-command"><code>{value}</code><button type="button" onClick={() => void copy()}><Icon name="copy" /> {copied ? 'Copied' : 'Copy'}</button></div>
}
