import { useEffect, useRef, useState } from 'react'
import { Camera, Clipboard, Code2, ImagePlus, Monitor, Paperclip, RefreshCw, X } from 'lucide-react'
import { MAX_LIVE_MATERIALS, type LiveCaptureSource } from '../../../shared/liveMaterials'
import type { LiveConversation } from './useLiveConversation'

export function LiveMaterials({ live }: { live: LiveConversation }): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [picker, setPicker] = useState(false)
  const [sources, setSources] = useState<LiveCaptureSource[]>([])
  const [source, setSource] = useState<LiveCaptureSource | null>(null)
  const [snippetOpen, setSnippetOpen] = useState(false)
  const [snippet, setSnippet] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  const limit = live.snapshot.materials.length >= MAX_LIVE_MATERIALS
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  async function run(action: () => Promise<void>): Promise<void> {
    if (busy) return
    setBusy(true); setError('')
    try { await action() }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { if (mounted.current) setBusy(false) }
  }
  async function chooseSource(): Promise<void> {
    setPicker(true)
    await run(async () => { const next = await window.neb.getLiveCaptureSources(); if (mounted.current) setSources(next) })
  }
  function addSnippet(): void {
    setError('')
    try { live.addSnippet(snippet); setSnippet(''); setSnippetOpen(false) }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }

  return <div className="neb-live-materials" aria-label="Materiale della conversazione">
    <div className="neb-live-material-actions">
      <span className="neb-live-material-label"><Paperclip size={14} />Contesto</span>
      <button type="button" disabled={busy || limit} onClick={() => source ? void run(() => live.captureSource(source.id)) : void chooseSource()} title={source ? `Acquisisci ${source.name}` : 'Scegli la finestra Edge/Chrome con il codice da analizzare'}><Camera size={14} />{busy ? 'Acquisizione…' : 'Cattura finestra'}</button>
      {source && <button type="button" className="neb-live-material-change" disabled={busy} onClick={() => void chooseSource()} title="Cambia finestra da acquisire"><RefreshCw size={13} /><span className="sr-only">Cambia finestra</span></button>}
      <button type="button" disabled={busy || limit} onClick={() => void run(live.pasteImage)} title="Prima copia uno screenshot con Win+Shift+S"><Clipboard size={14} />Incolla screenshot</button>
      <button type="button" disabled={busy || limit} onClick={() => input.current?.click()}><ImagePlus size={14} />Carica immagine</button>
      <button type="button" disabled={busy || limit} aria-expanded={snippetOpen} onClick={() => setSnippetOpen((value) => !value)}><Code2 size={14} />Snippet</button>
      <input ref={input} className="neb-live-image-input" type="file" accept="image/png,image/jpeg" aria-label="Carica screenshot PNG o JPEG" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void run(() => live.importImage(file)) }} />
    </div>
    {live.snapshot.materials.length > 0 && <div className="neb-live-material-list">
      {live.snapshot.materials.map((item) => <div key={item.id} className="neb-live-material-chip">
        {item.kind === 'image' ? <img src={item.dataUrl} alt={`Anteprima: ${item.name}`} /> : <Code2 size={18} />}
        <span title={item.kind === 'text' ? item.text : item.name}>{item.name}</span>
        <button type="button" aria-label={`Rimuovi ${item.name}`} onClick={() => live.removeMaterial(item.id)}><X size={13} /></button>
      </div>)}
    </div>}
    {error && <p className="neb-live-material-error" role="alert">{error}</p>}
    {limit && <p className="neb-live-material-hint">3 allegati presenti. Rimuovi quelli precedenti per aggiungere nuovo materiale.</p>}
    {picker && <div className="neb-live-source-picker" role="region" aria-label="Scegli la finestra da acquisire">
      <div className="neb-live-material-panel-heading"><strong>Scegli la finestra dell’interview</strong><button type="button" aria-label="Chiudi scelta finestra" onClick={() => setPicker(false)}><X size={15} /></button></div>
      <p>La scelta resta disponibile per le catture successive. L’ascolto continua.</p>
      <div className="neb-live-source-list">{sources.map((item) => <button type="button" key={item.id} disabled={busy || limit} onClick={() => void run(async () => { await live.captureSource(item.id); if (mounted.current) { setSource(item); setPicker(false) } })}>
        <img src={item.thumbnail} alt="" /><span><Monitor size={13} />{item.name}</span>
      </button>)}</div>
      {!busy && !sources.length && <p>Nessuna finestra disponibile. Puoi incollare o caricare uno screenshot.</p>}
    </div>}
    {snippetOpen && <div className="neb-live-snippet-editor">
      <label htmlFor="neb-live-code">Codice o testo da analizzare</label>
      <textarea id="neb-live-code" value={snippet} onChange={(event) => setSnippet(event.target.value)} maxLength={20000} spellCheck={false} autoFocus placeholder="Incolla qui lo snippet…" />
      <div><small>Rimane disponibile per i prossimi turni. L’ascolto continua.</small><button type="button" disabled={!snippet.trim() || limit} onClick={addSnippet}>Aggiungi snippet</button><button type="button" onClick={() => setSnippetOpen(false)}>Chiudi</button></div>
    </div>}
  </div>
}
