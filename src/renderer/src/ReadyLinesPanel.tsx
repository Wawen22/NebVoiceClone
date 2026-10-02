import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Play, Plus, RotateCcw, Sparkles, Square, Trash2, X } from 'lucide-react'
import { nextReadyLine, type ReadyLine, type ReadyLinesTab } from './readyLines'
import { PrepareLineDialog } from './PrepareLineDialog'
import { ScriptImportPanel } from './ScriptImportPanel'
import type { ScriptImportMode, ScriptImportResult } from './scriptImport'

export interface ReadyLinesPanelProps {
  automation?: (editorReady: boolean) => ReactNode
  automationLocked?: boolean
  linesA: ReadyLine[]
  linesB: ReadyLine[]
  activeTab: ReadyLinesTab
  onTabChange: (tab: ReadyLinesTab) => void
  currentScript: string
  ready: boolean
  busy: boolean
  playing: boolean
  activeLineId: string | null
  completedLine: { id: string; tab: ReadyLinesTab } | null
  onConsumeCompletion: () => void
  autoPrepare: boolean
  onAutoPrepareChange: (enabled: boolean) => void
  prepareRequested: boolean
  onConsumePrepare: () => void
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
  automation,
  automationLocked = false,
  linesA,
  linesB,
  activeTab,
  onTabChange,
  currentScript,
  ready,
  busy,
  playing,
  activeLineId,
  completedLine,
  onConsumeCompletion,
  autoPrepare,
  onAutoPrepareChange,
  prepareRequested,
  onConsumePrepare,
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
  const [preparedId, setPreparedId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [deleted, setDeleted] = useState<{ line: ReadyLine; index: number; tab: ReadyLinesTab } | null>(null)

  const lines = activeTab === 'modelA' ? linesA : linesB
  const nextLine = nextReadyLine(lines)
  const preparedIndex = lines.findIndex((line) => line.id === preparedId)
  const preparedLine = lines[preparedIndex]
  const canPrepare = !busy && !playing && !generatingModelB && !singleRegeneratingId && !importing && editingId === null

  useEffect(() => {
    if (!prepareRequested) return
    onConsumePrepare()
    if (canPrepare && nextLine) setPreparedId(nextLine.id)
  }, [prepareRequested, onConsumePrepare, canPrepare, nextLine])

  useEffect(() => {
    function dismiss(event: PointerEvent): void {
      if (!(event.target instanceof Element) || !event.target.closest('.ready-more')) setMenuId(null)
    }
    window.addEventListener('pointerdown', dismiss)
    return () => window.removeEventListener('pointerdown', dismiss)
  }, [])

  useEffect(() => {
    if (!completedLine || busy || playing) return
    onConsumeCompletion()
    if (!autoPrepare || importing || editingId !== null || preparedId || generatingModelB || singleRegeneratingId) return
    const completedLines = completedLine.tab === 'modelA' ? linesA : linesB
    const next = nextReadyLine(completedLines)
    if (!next) return
    onTabChange(completedLine.tab)
    setPreparedId(next.id)
  }, [completedLine, busy, playing, autoPrepare, importing, editingId, preparedId, generatingModelB, singleRegeneratingId, linesA, linesB, onConsumeCompletion, onTabChange])

  useEffect(() => {
    function keydown(event: KeyboardEvent): void {
      if (event.ctrlKey && event.shiftKey && event.code === 'Space' && canPrepare && nextLine && !preparedId) {
        event.preventDefault()
        setPreparedId(nextLine.id)
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [canPrepare, nextLine, preparedId])

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
    setMenuId(null)
    setExpandedId(null)
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
    <dialog ref={dialogRef} className="ready-dialog" aria-labelledby="ready-heading" onKeyDown={(event) => {
      if (event.key === 'Escape' && menuId && !preparedId) { event.preventDefault(); setMenuId(null) }
    }} onCancel={(event) => { event.preventDefault(); close() }}>
      <div className={`ready-panel ${activeTab}`}>
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

        {automation?.(!unsaved && !importing && editingId === null && !preparedId && !generatingModelB && !singleRegeneratingId)}
        <fieldset className="ready-script-fields" disabled={automationLocked} aria-label="Script e battute">
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
            <span className="ready-tab-count">{linesA.filter((line) => line.done).length} / {linesA.length} completate</span>
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
            <span className="ready-tab-count">{linesB.filter((line) => line.done).length} / {linesB.length} completate</span>
          </button>
        </div>

        <section className="ready-next" aria-label="Prossima battuta">
          <div><strong>{lines.length === 0 ? 'Importa o aggiungi le tue battute' : nextLine ? `Prossima · ${activeTab === 'modelA' ? 'MODEL A' : 'MODEL B'} · Battuta ${lines.indexOf(nextLine) + 1} di ${lines.length}` : 'Tutte le battute completate'}</strong>
            {nextLine && <p>{nextLine.text}</p>}
          </div>
          <button className="secondary-button ready-save" disabled={!nextLine || !canPrepare} title="Ctrl + Shift + Spazio" onClick={() => setPreparedId(nextLine?.id ?? null)}><Pencil size={16} /> Prepara prossima</button>
          <label className="ready-auto"><input type="checkbox" checked={autoPrepare} onChange={(event) => onAutoPrepareChange(event.target.checked)} /> Apri automaticamente la prossima</label>
        </section>

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
            disabled={linesA.length === 0 || generatingModelB || importing || busy || playing || Boolean(singleRegeneratingId)}
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
                    className={`ready-item${active ? ' active' : ''}${line.done ? ' done' : ''}${nextLine?.id === line.id && !active ? ' next' : ''}`}
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
                    <button type="button" className={`ready-copy${expandedId === line.id ? ' expanded' : ''}`} aria-expanded={expandedId === line.id} aria-label={`Espandi o riduci testo battuta ${index + 1}`} onClick={() => setExpandedId(expandedId === line.id ? null : line.id)}>
                      <span className="ready-line-state">{active ? (playing ? 'In riproduzione' : 'In preparazione') : line.done ? 'Completata' : nextLine?.id === line.id ? 'Prossima' : `Battuta ${index + 1}`}</span>
                      <p>{line.text}</p>
                    </button>
                    <div className="ready-item-actions">
                      <button
                        className={active ? 'ready-play active' : 'ready-play'}
                        aria-label={active ? `Interrompi battuta ${index + 1}` : `Pronuncia battuta ${index + 1}`}
                        title={active ? 'Interrompi' : 'Pronuncia battuta'}
                        disabled={!active && (!ready || busy || playing)}
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
                      <div className="ready-more">
                        <button className="ready-icon" aria-label={`Altre azioni battuta ${index + 1}`} aria-expanded={menuId === line.id} onClick={() => setMenuId(menuId === line.id ? null : line.id)}><MoreHorizontal size={18} /></button>
                        {menuId === line.id && <div className={`ready-more-menu${index >= lines.length - 2 ? ' above' : ''}`}>
                      {onRegenerateLine && (
                        <button
                          className="ready-icon ready-sparkle-btn"
                          aria-label={`Rigenera battuta ${index + 1} con Nemotron`}
                          title="Rigenera con Nemotron (OpenRouter)"
                          disabled={singleRegeneratingId === line.id || generatingModelB}
                          onClick={() => { setMenuId(null); onRegenerateLine(line.id, line.text, index) }}
                        >
                          {singleRegeneratingId === line.id ? (
                            <span className="spinner" aria-hidden="true" />
                          ) : (
                            <Sparkles size={14} />
                          )}
                          Rigenera
                        </button>
                      )}
                      <button
                        className="ready-icon"
                        aria-label={`Sposta battuta ${index + 1} su`}
                        title="Sposta su"
                        disabled={index === 0}
                        onClick={() => { setMenuId(null); onMove(line.id, -1) }}
                      >
                        <ArrowUp size={15} />
                        Sposta su
                      </button>
                      <button
                        className="ready-icon"
                        aria-label={`Sposta battuta ${index + 1} giù`}
                        title="Sposta giù"
                        disabled={index === lines.length - 1}
                        onClick={() => { setMenuId(null); onMove(line.id, 1) }}
                      >
                        <ArrowDown size={15} />
                        Sposta giù
                      </button>
                      <button
                        className="ready-icon danger"
                        aria-label={`Elimina battuta ${index + 1}`}
                        title="Elimina"
                        onClick={() => { setMenuId(null); remove(line, index) }}
                      >
                        <Trash2 size={15} />
                        Elimina
                      </button>
                        </div>}
                      </div>
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
        </fieldset>
        {preparedLine && <PrepareLineDialog key={preparedLine.id} line={preparedLine} index={preparedIndex} total={lines.length} tab={activeTab} canPlay={ready && canPrepare} onClose={() => setPreparedId(null)} onNavigate={(direction) => setPreparedId(lines[preparedIndex + direction]?.id ?? null)} onPlay={(text) => {
          onEdit(preparedLine.id, text)
          setPreparedId(null)
          onSpeak({ ...preparedLine, text })
        }} />}
      </div>
    </dialog>
  )
}
