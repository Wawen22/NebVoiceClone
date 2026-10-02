import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Play, X } from 'lucide-react'
import type { ReadyLine, ReadyLinesTab } from './readyLines'

interface Props {
  line: ReadyLine
  index: number
  total: number
  tab: ReadyLinesTab
  canPlay: boolean
  onNavigate: (direction: -1 | 1) => void
  onPlay: (text: string) => void
  onClose: () => void
}

export function PrepareLineDialog({ line, index, total, tab, canPlay, onNavigate, onPlay, onClose }: Props): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState(line.text)
  const dirty = text !== line.text
  function close(): void {
    if (dirty && !window.confirm('Scartare le modifiche alla battuta?')) return
    onClose()
  }
  function navigate(direction: -1 | 1): void {
    if (dirty && !window.confirm('Scartare le modifiche alla battuta?')) return
    onNavigate(direction)
  }
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    function focus(): void {
      if (!document.hasFocus()) return
      field.current?.focus()
      field.current?.setSelectionRange(line.text.length, line.text.length)
      window.removeEventListener('focus', focus)
    }
    window.addEventListener('focus', focus)
    focus()
    return () => {
      window.removeEventListener('focus', focus)
      if (element?.open) element.close()
    }
  }, [line.id])

  return <dialog ref={dialog} className={`prepare-dialog ${tab}`} aria-labelledby="prepare-title" onCancel={(event) => { event.preventDefault(); close() }}>
    <header>
      <div><span className="eyebrow">{tab === 'modelA' ? 'MODEL A' : 'MODEL B'} · BATTUTA {index + 1} DI {total}</span><h2 id="prepare-title">Pronta da pronunciare</h2></div>
      <button className="ready-icon" title="Chiudi" aria-label="Chiudi preparazione battuta" onClick={close}><X size={20} /></button>
    </header>
    <label htmlFor="prepare-text">Adatta il testo alla risposta del modello, oppure riproducilo subito.</label>
    <textarea id="prepare-text" ref={field} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => {
      if (event.ctrlKey && event.key === 'Enter' && !event.nativeEvent.isComposing) {
        event.preventDefault()
        if (canPlay && text.trim()) onPlay(text)
      }
    }} />
    <footer>
      <div className="prepare-navigation">
        <button className="ready-icon" aria-label="Battuta precedente" disabled={index === 0} onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
        <button className="ready-icon" aria-label="Battuta successiva" disabled={index === total - 1} onClick={() => navigate(1)}><ArrowRight size={18} /></button>
      </div>
      <button className="secondary-button" onClick={close}>Annulla</button>
      <button className="secondary-button ready-save" disabled={!canPlay || !text.trim()} onClick={() => onPlay(text)}><Play size={16} /> Riproduci <kbd>Ctrl + Invio</kbd></button>
    </footer>
  </dialog>
}
