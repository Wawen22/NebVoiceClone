import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Play, Plus, RotateCcw, Sparkles, Square, Trash2, X } from 'lucide-react'
import type { ReadyLine, ReadyLinesTab } from './readyLines'
import { ScriptImportPanel } from './ScriptImportPanel'
import type { ScriptImportMode, ScriptImportResult } from './scriptImport'

export interface ReadyLinesPanelProps {
  linesA: ReadyLine[]
  linesB: ReadyLine[]
  activeTab: ReadyLinesTab
  onTabChange: (tab: ReadyLinesTab) => void
  currentScript: string
  ready: boolean
  busy: boolean
  playing: boolean
  activeLineId: string | null
  status: string
  error: string
  generatingModelB: boolean
  onGenerateModelB: () => void
  singleRegeneratingId?: string | null
  onRegenerateLine?: (id: string, text: string, index: number) => void
  onAdd: (text: string) => void
  onImport: (result: ScriptImportResult, mode: ScriptImportMode) => void
  onEdit: (id: string, text: string) => void
  onMove: (id: string, direction: -1 | 1) => void
  onToggleDone: (id: string) => void
  onRemove: (id: string) => void
  onRestore: (line: ReadyLine, index: number) => void
  onClear: () => void
  onSpeak: (line: ReadyLine) => void
  onStop: () => void
  onClose: () => void
}

export function ReadyLinesPanel({
  linesA,
  linesB,
  activeTab,
  onTabChange,
  currentScript,
  ready,
  busy,
  playing,
  activeLineId,
  status,
  error,
  generatingModelB,
  onGenerateModelB,
  singleRegeneratingId,
  onRegenerateLine,
  onAdd,
  onImport,
  onEdit,
  onMove,
  onToggleDone,
  onRemove,
  onRestore,
  onClear,
  onSpeak,
  onStop,
  onClose
}: ReadyLinesPanelProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const activeItemRef = useRef<HTMLLIElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [importing, setImporting] = useState(false)
  const [importDirty, setImportDirty] = useState(false)
  const [deleted, setDeleted] = useState<{ line: ReadyLine; index: number; tab: ReadyLinesTab } | null>(null)

  const lines = activeTab === 'modelA' ? linesA : linesB

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  const original = editingId && editingId !== 'new' ? lines.find((line) => line.id === editingId)?.text ?? '' : ''
  const unsaved = importDirty || (editingId !== null && draft !== original)
  const activeIndex = lines.findIndex((line) => line.id === activeLineId)
  const activeLine = activeIndex >= 0 && (busy || playing) ? lines[activeIndex] : null

  useEffect(() => {
    if (activeLineId) revealActive()
  }, [activeLineId])

  function revealActive(): void {
    const list = listRef.current
    const item = activeItemRef.current
    if (!list || !item) return
    const listBounds = list.getBoundingClientRect()
    const itemBounds = item.getBoundingClientRect()
    if (itemBounds.top < listBounds.top + 6) list.scrollBy({ top: itemBounds.top - listBounds.top - 6 })
    else if (itemBounds.bottom > listBounds.bottom - 6) list.scrollBy({ top: itemBounds.bottom - listBounds.bottom + 6 })
  }

  function close(): void {
    if (unsaved && !window.confirm('Scartare il testo non salvato?')) return
    onClose()
  }

  function handleTabChange(nextTab: ReadyLinesTab): void {
    if (nextTab === activeTab) return
    if (unsaved && !window.confirm('Scartare il testo non salvato?')) return
    setEditingId(null)
    setDraft('')
    setDeleted(null)
    setImporting(false)
    setImportDirty(false)
    onTabChange(nextTab)
  }

  function handleGenerate(): void {
    if (linesA.length === 0 || generatingModelB) return
    if (linesB.length > 0) {
      const ok = window.confirm(`MODEL B contiene già ${linesB.length} battute. Vuoi sovrascriverle con la nuova versione generata da Nemotron?`)
      if (!ok) return
    }
    onGenerateModelB()
  }

  function beginEdit(id: string, text: string): void {
    if (unsaved && !window.confirm('Scartare il testo non salvato?')) return
    setEditingId(id)
    setImporting(false)
    setImportDirty(false)
    setDraft(text)
    requestAnimationFrame(() => editorRef.current?.focus())
  }

  function save(): void {
    if (!draft.trim()) return
    if (editingId === 'new') onAdd(draft)
    else if (editingId) onEdit(editingId, draft)
    setEditingId(null)
    setDraft('')
  }

  function remove(line: ReadyLine, index: number): void {
    onRemove(line.id)
    setDeleted({ line, index, tab: activeTab })
    if (editingId === line.id) { setEditingId(null); setDraft('') }
  }

  function playLine(line: ReadyLine): void {
    if (unsaved && !window.confirm('Scartare il testo non salvato?')) return
    onSpeak(line)
  }

  return (
    <dialog ref={dialogRef} className="ready-dialog" aria-labelledby="ready-heading" onCancel={(event) => { event.preventDefault(); close() }}>
      <div className="ready-panel">
        <header className="ready-header">
          <div>
            <span className="eyebrow">IN QUESTA SESSIONE</span>
            <h2 id="ready-heading">
              Battute pronte <span>{lines.length}</span>
            </h2>
          </div>
          <div className="ready-header-actions">
            {activeLineId && (busy || playing) && (
              <button className="ready-icon" aria-label="Interrompi battuta attiva" title="Interrompi" onClick={onStop}>
                <Square size={16} />
              </button>
            )}
            <button className="ready-icon" aria-label="Chiudi battute pronte" title="Chiudi" onClick={close}>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="ready-tabs" role="tablist" aria-label="Seleziona modello battute">
          <button
            role="tab"
            type="button"
            aria-selected={activeTab === 'modelA'}
            className={`ready-tab ${activeTab === 'modelA' ? 'active' : ''}`}
            onClick={() => handleTabChange('modelA')}
          >
            <span className="ready-tab-tag">A</span>
            <span className="ready-tab-title">MODEL A</span>
            <span className="ready-tab-count">{linesA.length}</span>
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={activeTab === 'modelB'}
            className={`ready-tab ${activeTab === 'modelB' ? 'active' : ''}`}
            onClick={() => handleTabChange('modelB')}
          >
            <span className="ready-tab-tag">B</span>
            <span className="ready-tab-title">MODEL B</span>
            <span className="ready-tab-count">{linesB.length}</span>
          </button>
        </div>

        <div className="ready-toolbar">
          <button className="secondary-button" disabled={generatingModelB || Boolean(singleRegeneratingId) || busy || playing} onClick={() => {
            if (importing) return
            if (unsaved && !window.confirm('Scartare il testo non salvato?')) return
            setEditingId(null)
            setDraft('')
            setImporting(true)
          }}>Importa script</button>
          <button className="secondary-button" disabled={importing} onClick={() => beginEdit('new', '')}>
            <Plus size={16} /> Nuova battuta
          </button>
          <button
            className="secondary-button"
            disabled={importing || !currentScript.trim()}
            onClick={() => { onAdd(currentScript); setDeleted(null) }}
          >
            <Plus size={16} /> Aggiungi testo corrente
          </button>
          <button
            type="button"
            className="secondary-button ready-generate-btn"
            disabled={linesA.length === 0 || generatingModelB || importing}
            onClick={handleGenerate}
            title={
              linesA.length === 0
                ? 'Aggiungi prima delle battute in MODEL A'
                : 'Genera la versione alternativa per MODEL B con Nemotron 3 Ultra'
            }
          >
            {generatingModelB ? (
              <>
                <span className="spinner" aria-hidden="true" />
                <span>Nemotron in corso…</span>
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>{linesB.length > 0 ? 'Rigenera MODEL B' : 'Genera per MODEL B'}</span>
              </>
            )}
          </button>
        </div>

        <div className={error ? 'ready-feedback error' : 'ready-feedback'} role={error ? 'alert' : 'status'}>
          <span className="status-dot" />
          {generatingModelB ? 'Rielaborazione battute con Nemotron (OpenRouter) in corso…' : (error || status)}
        </div>

        {activeLine && (
          <div className="ready-active-cue">
            <div>
              <strong>
                {playing ? 'In riproduzione' : 'In preparazione'} · Battuta {activeIndex + 1} ({activeTab === 'modelA' ? 'Model A' : 'Model B'})
              </strong>
              <span>{activeLine.text.trim().split(/\r?\n/, 1)[0]}</span>
            </div>
            <button className="text-button" onClick={revealActive}>Vai alla battuta</button>
          </div>
        )}

        {editingId !== null && (
          <section className="ready-editor" aria-label={editingId === 'new' ? 'Nuova battuta' : 'Modifica battuta'}>
            <label htmlFor="ready-text">{editingId === 'new' ? `Nuova battuta (${activeTab === 'modelA' ? 'Model A' : 'Model B'})` : `Modifica battuta (${activeTab === 'modelA' ? 'Model A' : 'Model B'})`}</label>
            <textarea
              id="ready-text"
              ref={editorRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Scrivi esattamente ciò che vuoi pronunciare…"
            />
            <div className="ready-editor-actions">
              <button className="secondary-button" onClick={() => { setEditingId(null); setDraft('') }}>Annulla</button>
              <button className="secondary-button ready-save" disabled={!draft.trim()} onClick={save}>Salva battuta</button>
            </div>
          </section>
        )}

        {importing && <ScriptImportPanel countA={linesA.length} countB={linesB.length} onDraftChange={setImportDirty} onCancel={() => {
          if (importDirty && !window.confirm('Scartare lo script non importato?')) return
          setImporting(false)
          setImportDirty(false)
        }} onImport={(result, mode) => {
          onImport(result, mode)
          setImporting(false)
          setImportDirty(false)
          setDeleted(null)
        }} />}
        <div ref={listRef} hidden={importing} className="ready-list" aria-label={`Battute preparate per ${activeTab === 'modelA' ? 'Model A' : 'Model B'}`}>
          {lines.length === 0 ? (
            <p className="ready-empty">
              {activeTab === 'modelA'
                ? 'Nessuna battuta preparata per MODEL A.'
                : 'Nessuna battuta in MODEL B. Clicca "Genera per MODEL B" per rielaborare le battute di MODEL A.'}
            </p>
          ) : (
            <ol>
              {lines.map((line, index) => {
                const active = activeLineId === line.id && (busy || playing)
                return (
                  <li
                    ref={active ? activeItemRef : null}
                    className={active ? `ready-item active${line.done ? ' done' : ''}` : line.done ? 'ready-item done' : 'ready-item'}
                    key={line.id}
                  >
                    <label className="ready-number">
                      {index + 1}
                      <input
                        type="checkbox"
                        checked={line.done}
                        aria-label={`Battuta ${index + 1} fatta`}
                        title="Segna come fatta"
                        onChange={() => onToggleDone(line.id)}
                      />
                      <small>Fatta</small>
                    </label>
                    <div className="ready-copy" tabIndex={0} role="group" aria-label={`Testo battuta ${index + 1}: ${line.text}`}>
                      <strong>{line.text.trim().split(/\r?\n/, 1)[0]}</strong>
                      <p>{line.text}</p>
                    </div>
                    <div className="ready-item-actions">
                      <button
                        className={active ? 'ready-play active' : 'ready-play'}
                        aria-label={active ? `Interrompi battuta ${index + 1}` : `Pronuncia battuta ${index + 1}`}
                        title={active ? 'Interrompi' : 'Pronuncia battuta'}
                        disabled={!active && (!ready || busy)}
                        onClick={() => active ? onStop() : playLine(line)}
                      >
                        {active ? (
                          playing ? (
                            <span className="voice-wave ready-wave" aria-hidden="true">
                              {Array.from({ length: 5 }, (_, position) => <span key={position} />)}
                            </span>
                          ) : (
                            <span className="spinner" aria-hidden="true" />
                          )
                        ) : (
                          <Play size={16} fill="currentColor" />
                        )}
                      </button>
                      <button
                        className="ready-icon"
                        aria-label={`Modifica battuta ${index + 1}`}
                        title="Modifica"
                        onClick={() => beginEdit(line.id, line.text)}
                      >
                        <Pencil size={15} />
                      </button>
                      {onRegenerateLine && (
                        <button
                          className="ready-icon ready-sparkle-btn"
                          aria-label={`Rigenera battuta ${index + 1} con Nemotron`}
                          title="Rigenera con Nemotron (OpenRouter)"
                          disabled={singleRegeneratingId === line.id || generatingModelB}
                          onClick={() => onRegenerateLine(line.id, line.text, index)}
                        >
                          {singleRegeneratingId === line.id ? (
                            <span className="spinner" aria-hidden="true" />
                          ) : (
                            <Sparkles size={14} />
                          )}
                        </button>
                      )}
                      <button
                        className="ready-icon"
                        aria-label={`Sposta battuta ${index + 1} su`}
                        title="Sposta su"
                        disabled={index === 0}
                        onClick={() => onMove(line.id, -1)}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        className="ready-icon"
                        aria-label={`Sposta battuta ${index + 1} giù`}
                        title="Sposta giù"
                        disabled={index === lines.length - 1}
                        onClick={() => onMove(line.id, 1)}
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        className="ready-icon danger"
                        aria-label={`Elimina battuta ${index + 1}`}
                        title="Elimina"
                        onClick={() => remove(line, index)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        <footer className="ready-footer">
          {deleted && deleted.tab === activeTab ? (
            <button
              className="text-button"
              onClick={() => {
                onRestore(deleted.line, deleted.index)
                setDeleted(null)
              }}
            >
              <RotateCcw size={15} /> Annulla eliminazione
            </button>
          ) : (
            <span>Le battute spariscono quando chiudi l’app.</span>
          )}
          {lines.length > 0 && (
            <button
              className="text-button ready-clear"
              disabled={importing}
              onClick={() => {
                if (window.confirm(`Eliminare tutte le ${lines.length} battute di ${activeTab === 'modelA' ? 'MODEL A' : 'MODEL B'}?`)) {
                  onClear()
                  setDeleted(null)
                  setEditingId(null)
                  setDraft('')
                }
              }}
            >
              <Trash2 size={15} /> Elimina tutte ({activeTab === 'modelA' ? 'A' : 'B'})
            </button>
          )}
        </footer>
      </div>
    </dialog>
  )
}
