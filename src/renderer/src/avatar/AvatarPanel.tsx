import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Plug, Unplug, Play, Video, Maximize2, X, Copy, Eye, EyeOff, GripVertical } from 'lucide-react'
import { AVATAR_PRESETS, parseAvatarFaceId } from '../../../shared/avatar'
import type { AvatarSession } from './session'
import type { AvatarOutputStatus } from '../../../shared/avatarOutput'
import { AvatarOutputPublisher } from './outputPublisher'
import './avatar.css'

interface Props { session: AvatarSession; deviceId: string; volume: number; locked: boolean; ready: boolean; visible: boolean; onStop(): void; onTest(): void }
export function AvatarPanel({ session, deviceId, volume, locked, ready, visible, onStop, onTest }: Props) {
  const snapshot = useSyncExternalStore((listener) => session.subscribe(listener), () => session.snapshot)
  const video = useRef<HTMLVideoElement>(null), audio = useRef<HTMLAudioElement>(null)
  const preview = useRef<HTMLDialogElement>(null), expandButton = useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [enabled, setEnabled] = useState(session.enabled), [configured, setConfigured] = useState(false)
  const [previewHidden, setPreviewHidden] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('neb:avatar-preview-position') || 'null')
      return saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? { x: saved.x, y: saved.y } : null
    } catch { return null }
  })
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  function movePreview(x: number, y: number): void {
    const bounds = preview.current?.getBoundingClientRect()
    if (!bounds) return
    const next = { x: Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8)), y: Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8)) }
    setPosition(next)
  }
  useEffect(() => {
    if (!position || drag.current) return
    try { localStorage.setItem('neb:avatar-preview-position', JSON.stringify(position)) } catch { /* Preview remains usable without storage. */ }
  }, [position])
  useEffect(() => {
    if (!enabled || !visible || previewHidden || expanded) return
    const fit = (): void => {
      const bounds = preview.current?.getBoundingClientRect()
      if (bounds) movePreview(bounds.x, bounds.y)
    }
    const frame = requestAnimationFrame(fit); window.addEventListener('resize', fit)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', fit) }
  }, [enabled, visible, previewHidden, expanded])
  const publisher = useRef<AvatarOutputPublisher | null>(null)
  const [output, setOutput] = useState<AvatarOutputStatus>({ enabled: false, available: false, viewers: 0 })
  const [outputError, setOutputError] = useState('')
  const [faceId, setFaceId] = useState(session.faceId), [custom, setCustom] = useState(''), [error, setError] = useState(''), [now, setNow] = useState(Date.now())
  const connecting = snapshot.phase === 'connecting'
  useEffect(() => {
    if (!video.current || !window.neb.getAvatarOutputStatus) return
    const instance = new AvatarOutputPublisher(window.neb, video.current)
    publisher.current = instance; instance.start()
    instance.setActive(session.snapshot.phase === 'ready' || session.snapshot.phase === 'speaking')
    let mounted = true, polling = false
    const refresh = async (): Promise<void> => {
      if (polling) return
      polling = true
      try { const status = await window.neb.getAvatarOutputStatus(); if (mounted) setOutput(status) }
      catch { if (mounted) setOutputError('Uscita OBS non disponibile.') }
      finally { polling = false }
    }
    void refresh(); const timer = setInterval(() => void refresh(), 1000)
    return () => { mounted = false; clearInterval(timer); instance.dispose(); publisher.current = null }
  }, [session])
  useEffect(() => { publisher.current?.setActive(snapshot.phase === 'ready' || snapshot.phase === 'speaking') }, [snapshot.phase])
  useEffect(() => {
    if (!expanded) return
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault(); event.stopImmediatePropagation(); setExpanded(false)
    }
    window.addEventListener('keydown', closeOnEscape, true)
    return () => window.removeEventListener('keydown', closeOnEscape, true)
  }, [expanded])
  useEffect(() => {
    const element = preview.current
    if (!element) return
    const previousFocus = document.activeElement as HTMLElement | null
    if (element.open) element.close()
    if (enabled && visible && !previewHidden) {
      if (expanded) element.showModal()
      else {
        element.show()
        if (previousFocus?.closest('.avatar-preview-heading')) expandButton.current?.focus()
        else previousFocus?.focus()
      }
    } else if (expanded) setExpanded(false)
    return () => { if (element.open) element.close() }
  }, [enabled, visible, expanded, previewHidden])
  useEffect(() => {
    if (video.current && audio.current) session.attach(video.current, audio.current)
    const saved = localStorage.getItem('neb:avatar-face-id')
    if (saved) { try { session.setFaceId(parseAvatarFaceId(saved)); setFaceId(saved); setCustom(saved) } catch { /* Invalid local config uses the default preset. */ } }
    let mounted = true
    void window.neb.getAvatarStatus?.().then((status) => { if (mounted) setConfigured(status.configured) }).catch(() => { if (mounted) setError('Configurazione Simli non disponibile.') })
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => { mounted = false; clearInterval(timer); session.disconnect() }
  }, [session])
  function select(id: string) {
    try { const valid = parseAvatarFaceId(id); session.setFaceId(valid); setFaceId(valid); localStorage.setItem('neb:avatar-face-id', valid); setError('') }
    catch { setError('Face ID non valido.') }
  }
  const preset = AVATAR_PRESETS.some((item) => item.id === faceId) ? faceId : 'custom'
  return <section className="avatar-panel" hidden={!visible} aria-label="Avatar Simli" data-no-speech-shortcuts>
    <div className="avatar-toolbar">
      <strong><Video size={16} /> Avatar</strong>
      <label className="avatar-toggle"><input type="checkbox" aria-label="Attiva avatar" checked={enabled} disabled={!configured || locked || connecting} onChange={(event) => { session.setEnabled(event.target.checked); setEnabled(event.target.checked); setError('') }} /> Simli</label>
      <select aria-label="Volto avatar" value={preset} disabled={locked || connecting} onChange={(event) => { if (event.target.value === 'custom') { setCustom(faceId); setFaceId('custom') } else select(event.target.value) }}>
        {AVATAR_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="custom">Face ID personale</option>
      </select>
      {preset === 'custom' && <input aria-label="Face ID Simli" value={custom} placeholder="Face ID" disabled={locked || connecting} onChange={(event) => setCustom(event.target.value)} onBlur={() => select(custom)} />}
      <span className="avatar-status" role="status">{!configured ? 'Chiave Simli non configurata' : error || snapshot.message}{snapshot.connectedAt !== null && ` · ${Math.max(0, Math.floor((now - snapshot.connectedAt) / 1000))} s`}</span>
      <label className="avatar-toggle"><input type="checkbox" aria-label="Uscita OBS" checked={output.enabled} disabled={!output.available} onChange={(event) => { setOutputError(''); void window.neb.setAvatarOutputEnabled(event.target.checked).then(setOutput).catch(() => setOutputError('Impossibile aggiornare uscita OBS.')) }} /> Uscita OBS</label>
      <span className="avatar-output-status" role="status">{outputError || output.error || (output.enabled ? output.viewers ? `OBS: ${output.viewers} collegato` : 'OBS in attesa' : '')}</span>
      <button className="icon-button" aria-label="Copia URL OBS" title="Copia URL OBS" disabled={!output.available} onClick={() => { void window.neb.getAvatarOutputUrl().then((url) => navigator.clipboard.writeText(url)).then(() => setOutputError('URL OBS copiato')).catch(() => setOutputError('Copia URL non riuscita.')) }}><Copy size={17} /></button>
      <button className="icon-button" aria-label="Collega avatar" title="Collega avatar" disabled={!enabled || locked || connecting || snapshot.phase === 'ready' || snapshot.phase === 'speaking'} onClick={() => { setError(''); void session.connect(session.faceId, deviceId, volume).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Connessione Simli fallita.')) }}><Plug size={17} /></button>
      <button className="icon-button" aria-label="Test voce avatar" title="Test voce avatar" disabled={!enabled || !ready || locked || connecting} onClick={onTest}><Play size={17} /></button>
      <button className="icon-button" aria-label={previewHidden ? 'Mostra anteprima avatar' : 'Nascondi anteprima avatar'} title={previewHidden ? 'Mostra anteprima avatar' : 'Nascondi anteprima avatar'} disabled={!enabled} onClick={() => setPreviewHidden(!previewHidden)}>{previewHidden ? <Eye size={17} /> : <EyeOff size={17} />}</button>
      <button ref={expandButton} className="icon-button" aria-label="Espandi avatar" title="Espandi avatar" disabled={!enabled} onClick={() => { setPreviewHidden(false); setExpanded(true) }}><Maximize2 size={17} /></button>
      <button className="icon-button" aria-label="Scollega avatar" title="Scollega avatar" disabled={snapshot.phase === 'off'} onClick={() => { onStop(); session.disconnect() }}><Unplug size={17} /></button>
    </div>
    <dialog ref={preview} style={!expanded && position ? { left: position.x, top: position.y, right: 'auto' } : undefined} className={`avatar-stage${expanded ? ' avatar-expanded' : ''}`} role={expanded ? 'dialog' : 'region'} aria-label={expanded ? 'Avatar ingrandito' : 'Video avatar'} aria-modal={expanded || undefined} onCancel={(event) => { event.preventDefault(); setExpanded(false) }} onKeyDown={(event) => {
      if (expanded && event.key === 'Tab') { event.preventDefault(); event.currentTarget.querySelector<HTMLButtonElement>('.avatar-preview-heading button')?.focus() }
    }}>
      <header className="avatar-preview-heading">
        {expanded ? <><strong>Avatar</strong><span>{snapshot.message}</span></> : <button className="avatar-drag-handle" aria-label="Sposta anteprima avatar" title="Sposta anteprima avatar" onPointerDown={(event) => {
          if (event.button !== 0) return
          const bounds = preview.current!.getBoundingClientRect()
          drag.current = { x: event.clientX, y: event.clientY, left: bounds.x, top: bounds.y }
          event.currentTarget.setPointerCapture(event.pointerId)
        }} onPointerMove={(event) => {
          const start = drag.current
          if (start) movePreview(start.left + event.clientX - start.x, start.top + event.clientY - start.y)
        }} onLostPointerCapture={() => {
          drag.current = null
          const bounds = preview.current?.getBoundingClientRect()
          if (bounds) movePreview(bounds.x, bounds.y)
        }} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }} onKeyDown={(event) => {
          const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
          const direction = directions[event.key], bounds = preview.current?.getBoundingClientRect()
          if (direction && bounds) { event.preventDefault(); const step = event.shiftKey ? 40 : 10; movePreview(bounds.x + direction[0] * step, bounds.y + direction[1] * step) }
        }}><GripVertical size={15} /><strong>Avatar</strong></button>}
        <button className="icon-button" aria-label={expanded ? 'Chiudi avatar ingrandito' : 'Chiudi anteprima avatar'} title={expanded ? 'Chiudi avatar ingrandito' : 'Chiudi anteprima avatar'} onClick={() => { if (expanded) setExpanded(false); else setPreviewHidden(true) }}><X size={17} /></button>
      </header>
      <div className="avatar-video-surface">
      <video ref={video} autoPlay playsInline muted aria-label="Anteprima avatar" />
      {(snapshot.phase === 'off' || snapshot.phase === 'connecting' || snapshot.phase === 'error') && <span className="avatar-placeholder">{snapshot.phase === 'connecting' ? 'Connessione...' : snapshot.phase === 'error' ? 'Avatar non disponibile' : AVATAR_PRESETS.find((item) => item.id === faceId)?.name || 'Avatar'}</span>}
      </div>
    </dialog>
    <audio ref={audio} autoPlay />
  </section>
}
