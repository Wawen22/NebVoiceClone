import { useState, type ReactNode } from 'react'
import {
  Archive,
  ArchiveRestore,
  Plus,
  Pencil,
  FolderOpen,
  PlugZap,
  Play,
  Pause,
  Square,
  Mic,
  FileText,
  Sparkles,
  Timer,
  Check,
  AlertCircle,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'
import type { OutlierProject } from '../../../shared/outlier'
import type { OutlierWorkspace } from './useOutlierWorkspace'

const AVAILABLE_SPEEDS = [450, 600, 650, 700, 750, 800]

function formatStatusMessage(text: string): ReactNode {
  const parts = text.split(/(Ctrl\+Alt\+[SP]|Riprendi)/g)
  return parts.map((part, i) => {
    if (part === 'Ctrl+Alt+S' || part === 'Ctrl+Alt+P' || part === 'Riprendi') {
      return <kbd key={i} className="outlier-kbd">{part}</kbd>
    }
    return part
  })
}

function formatPhase(phase: string): string {
  switch (phase) {
    case 'typing': return 'in corso'
    case 'preparing': return 'preparazione'
    case 'paused': return 'in pausa'
    case 'completed': return 'completato'
    case 'interrupted': return 'interrotto'
    case 'error': return 'errore'
    default: return phase
  }
}

export function OutlierPage({ workspace: w, voice }: { workspace: OutlierWorkspace; voice: ReactNode }): React.JSX.Element {
  const [editing, setEditing] = useState<OutlierProject | null>(null)
  const [extensionId, setExtensionId] = useState('')
  const [installing, setInstalling] = useState(false)
  const [projectsCollapsed, setProjectsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('neb:outlier-projects-collapsed') === 'true'
  })

  function toggleProjectsCollapsed(): void {
    setProjectsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('neb:outlier-projects-collapsed', String(next))
      return next
    })
  }

  const project = w.data.projects.find((entry) => entry.id === w.selectedId)
  const draft = w.drafts[w.selectedId] || ''
  const disabled = w.locked || w.saving || installing || !w.loaded
  const status = w.status
  const isTyping = Boolean(status && ['typing', 'preparing'].includes(status.phase))
  const isPaused = status?.phase === 'paused'
  const isCompleted = status?.phase === 'completed'
  const hasTextInField = Boolean(
    (status?.confirmed ?? 0) > 0 ||
    (status?.target?.initialValue && status.target.initialValue.length > 0)
  )
  const canOperate = Boolean(
    !w.saving &&
    !installing &&
    w.loaded &&
    project?.integration === 's2s' &&
    !project.archived &&
    draft.trim().length >= 100 &&
    draft.length <= 50_000 &&
    status?.supported &&
    status.connected &&
    status.stopAvailable
  )
  const canStart = canOperate && !isTyping && !isPaused && !hasTextInField
  const canResume = canOperate && !isTyping && !isCompleted && (isPaused || hasTextInField)
  const isThinking = Boolean(status?.message?.includes('Pausa di riflessione'))
  const isFixingTypo = Boolean(status?.message?.includes('refuso'))
  const currentSpeed = AVAILABLE_SPEEDS.includes(w.data.charactersPerMinute) ? w.data.charactersPerMinute : 600

  function buildRequest() {
    if (!project) throw new Error('Seleziona un progetto.')
    return {
      projectId: project.id,
      text: draft,
      charactersPerMinute: currentSpeed,
      cadenceMode: w.data.cadenceMode ?? 'natural',
      thinkingPauses: w.data.thinkingPauses ?? true,
      simulateTypos: w.data.simulateTypos ?? true
    }
  }

  async function saveProject(): Promise<void> {
    if (!editing) return
    const exists = w.data.projects.some((entry) => entry.id === editing.id)
    if (await w.save({ ...w.data, projects: exists ? w.data.projects.map((entry) => entry.id === editing.id ? editing : entry) : [...w.data.projects, editing] })) {
      w.setSelectedId(editing.id)
      w.setShowArchived(editing.archived)
      setEditing(null)
    }
  }

  async function toggleArchive(entry: OutlierProject): Promise<void> {
    if (await w.save({ ...w.data, projects: w.data.projects.map((candidate) => candidate.id === entry.id ? { ...candidate, archived: !candidate.archived } : candidate) })) {
      if (entry.id === w.selectedId) w.setShowArchived(!entry.archived)
    }
  }

  async function install(): Promise<void> {
    setInstalling(true)
    await w.action(async () => w.setSetup(await window.neb.installOutlierHost(extensionId.trim() || w.setup?.extensionId || '')))
    setInstalling(false)
  }

  function renderStatusBadge(): ReactNode {
    const rawMessage = status?.message || 'Verifica del servizio…'
    const message = formatStatusMessage(rawMessage)
    if (isThinking) {
      return (
        <div className="outlier-status-badge thinking" role="status" aria-live="polite">
          <Timer size={14} />
          <span>{message}</span>
        </div>
      )
    }
    if (isFixingTypo) {
      return (
        <div className="outlier-status-badge typo-fixing" role="status" aria-live="polite">
          <Pencil size={14} />
          <span>{message}</span>
        </div>
      )
    }
    if (isPaused) {
      return (
        <div className="outlier-status-badge paused" role="status" aria-live="polite">
          <Pause size={14} />
          <span>{message}</span>
        </div>
      )
    }
    if (isTyping) {
      return (
        <div className="outlier-status-badge typing" role="status" aria-live="polite">
          <Sparkles size={14} />
          <span>{message}</span>
        </div>
      )
    }
    if (isCompleted) {
      return (
        <div className="outlier-status-badge completed" role="status" aria-live="polite">
          <Check size={14} />
          <span>{message}</span>
        </div>
      )
    }
    if (status?.phase === 'error') {
      return (
        <div className="outlier-status-badge error" role="status" aria-live="polite">
          <AlertCircle size={14} />
          <span>{message}</span>
        </div>
      )
    }
    return (
      <div className="outlier-status-badge idle" role="status" aria-live="polite">
        <PlugZap size={14} />
        <span>{message}</span>
      </div>
    )
  }

  return (
    <section className="outlier-page">
      {/* Sleek Compact Toolbar */}
      <div className="outlier-toolbar">
        <div className="outlier-toolbar-left">
          <button
            type="button"
            className="outlier-sidebar-toggle"
            onClick={toggleProjectsCollapsed}
            title={projectsCollapsed ? 'Mostra barra progetti' : 'Nascondi barra progetti'}
            aria-label={projectsCollapsed ? 'Mostra barra progetti' : 'Nascondi barra progetti'}
          >
            {projectsCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>

          {projectsCollapsed && (
            <div className="outlier-quick-select-wrap">
              <select
                className="outlier-quick-select"
                disabled={disabled}
                value={w.selectedId}
                onChange={(e) => w.setSelectedId(e.target.value)}
                title="Seleziona progetto attivo"
              >
                {w.data.projects.filter((p) => !p.archived).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                {w.data.projects.some((p) => p.archived) && (
                  <optgroup label="Archiviati">
                    {w.data.projects.filter((p) => p.archived).map((p) => (
                      <option key={p.id} value={p.id}>[Archiviato] {p.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          {project && (
            <div className="outlier-project-title-group">
              <h2 className="outlier-active-title">{project.name}</h2>
              <span className="outlier-badge-tag">{project.integration === 's2s' ? 'S2S Rationale' : 'Note'}</span>
              {project.archived && <span className="outlier-badge-tag archived">Archiviato</span>}
              <button className="icon-action-btn" title="Modifica progetto" aria-label="Modifica progetto" onClick={() => setEditing({ ...project })}><Pencil size={13} /></button>
              <button className="icon-action-btn" title={project.archived ? 'Ripristina' : 'Archivia'} aria-label={project.archived ? 'Ripristina' : 'Archivia'} onClick={() => void toggleArchive(project)}>{project.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}</button>
            </div>
          )}
        </div>

        <div className="outlier-toolbar-right">
          {project && (
            <div className="outlier-view-tabs">
                <button
                  type="button"
                  className={w.tab === 'voice' ? 'tab-pill active' : 'tab-pill'}
                  onClick={() => w.setTab('voice')}
                >
                  <Mic size={14} /> Voce & Battute
                </button>
                <button
                  type="button"
                  className={w.tab === 'rationale' ? 'tab-pill active' : 'tab-pill'}
                  onClick={() => w.setTab('rationale')}
                >
                  <FileText size={14} /> Rationale
                </button>
              </div>
          )}

          <button
            type="button"
            className="secondary-button compact"
            disabled={disabled}
            onClick={() => setEditing({ id: crypto.randomUUID(), name: '', notes: '', archived: false, integration: 's2s' })}
          >
            <Plus size={14} /> Nuovo
          </button>
        </div>
      </div>

      {w.error && <p className="notice error" role="alert">{w.error}</p>}

      {/* Main Layout Area */}
      <div className={projectsCollapsed ? 'outlier-layout sidebar-hidden' : 'outlier-layout'}>
        {!projectsCollapsed && (
          <aside className="outlier-projects">
            <div className="outlier-tabs">
              <button className={!w.showArchived ? 'selected' : ''} disabled={disabled} onClick={() => w.setShowArchived(false)}>Attivi</button>
              <button className={w.showArchived ? 'selected' : ''} disabled={disabled} onClick={() => w.setShowArchived(true)}>Archiviati</button>
            </div>
            {w.data.projects.filter((entry) => entry.archived === w.showArchived).map((entry) => (
              <div key={entry.id} className={entry.id === w.selectedId ? 'outlier-project selected' : 'outlier-project'}>
                <button disabled={disabled} onClick={() => w.setSelectedId(entry.id)}>
                  <strong>{entry.name}</strong>
                  <small>{entry.integration === 's2s' ? 'Conversazione · Rationale S2S' : 'Progetto personale'}</small>
                </button>
                <div>
                  <button title="Modifica progetto" aria-label={'Modifica ' + entry.name} disabled={disabled} onClick={() => setEditing({ ...entry })}><Pencil size={13} /></button>
                  <button title={entry.archived ? 'Ripristina progetto' : 'Archivia progetto'} aria-label={(entry.archived ? 'Ripristina ' : 'Archivia ') + entry.name} disabled={disabled} onClick={() => void toggleArchive(entry)}>{entry.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}</button>
                </div>
              </div>
            ))}
            {!w.data.projects.some((entry) => entry.archived === w.showArchived) && (
              <p className="field-note">Nessun progetto {w.showArchived ? 'archiviato' : 'attivo'}.</p>
            )}
          </aside>
        )}

        <div className="outlier-detail">
          {editing && (
            <form className="control-card outlier-form" onSubmit={(event) => { event.preventDefault(); void saveProject() }}>
              <h3>{w.data.projects.some((entry) => entry.id === editing.id) ? 'Modifica progetto' : 'Nuovo progetto'}</h3>
              <label className="field">Nome<input autoFocus required maxLength={100} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
              <label className="field">Strumenti<select value={editing.integration} onChange={(event) => setEditing({ ...editing, integration: event.target.value as OutlierProject['integration'] })}><option value="none">Note ed editor</option><option value="s2s">S2S · collegamento Rationale</option></select></label>
              <label className="field">Note personali<textarea maxLength={10_000} value={editing.notes} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} /></label>
              <div className="outlier-actions"><button className="primary-button" disabled={disabled || !editing.name.trim()}>Salva progetto</button><button type="button" className="secondary-button" onClick={() => setEditing(null)}>Annulla</button></div>
            </form>
          )}

          {project && !editing && (
            <>
              {project.notes && <p className="outlier-notes">{project.notes}</p>}
              {w.tab === 'voice' ? (
                <div className="outlier-voice-wrap">{voice}</div>
              ) : (
                <div className="outlier-rationale-grid">
                  {/* Left Column: Textarea Editor */}
                  <div className="editor-card outlier-rationale-editor">
                    <div className="card-heading">
                      <div>
                        <span className="eyebrow">01 / RATIONALE</span>
                        <h3>Il tuo Rationale</h3>
                      </div>
                      <span className="subtle-badge">{draft.length.toLocaleString('it-IT')} / 50.000 car.</span>
                    </div>
                    <textarea
                      id="outlier-rationale"
                      data-no-speech-shortcuts
                      maxLength={50_000}
                      disabled={w.locked}
                      placeholder="Scrivi o incolla qui il tuo Rationale già preparato…"
                      value={draft}
                      onChange={(event) => w.setDrafts((current) => ({ ...current, [project.id]: event.target.value }))}
                    />
                    <div className="editor-meta">
                      <span>Minimo 100 caratteri per S2S</span>
                      <span>Solo in memoria fino alla chiusura di NEB</span>
                    </div>
                  </div>

                  {/* Right Column: Browser Insertion Controls */}
                  <div className="outlier-rationale-controls">
                    <div className="control-card outlier-insertion">
                      <div className="card-heading">
                        <div>
                          <span className="eyebrow">02 / OUTLIER BRIDGE</span>
                          <h3>Inserimento nel browser</h3>
                        </div>
                        <span className={status?.connected ? 'status-dot green' : 'status-dot amber'} title={status?.connected ? 'Collegato a Edge' : 'Non collegato'} />
                      </div>

                      {/* Live Dynamic Status Badge */}
                      {renderStatusBadge()}

                      {/* Immediate Action Buttons */}
                      <div className="action-row compact-actions">
                        <button className="primary" disabled={!canStart} onClick={() => void w.action(() => window.neb.startInsertion(buildRequest()))}><Play size={14} /> Avvia</button>
                        <button disabled={!isTyping} onClick={() => void w.action(() => window.neb.pauseInsertion())}><Pause size={14} /> Pausa</button>
                        <button disabled={!canResume} onClick={() => void w.action(() => window.neb.resumeInsertion(buildRequest()))}><Play size={14} /> Riprendi</button>
                        <button disabled={!isTyping && !isPaused && !hasTextInField} onClick={() => void w.action(() => window.neb.stopInsertion())}><Square size={14} /> Stop</button>
                      </div>

                      {status?.target && (
                        <div className="outlier-target compact">
                          <strong>{status.target.title}</strong>
                          <small>{status.target.url}</small>
                        </div>
                      )}

                      {/* Progress Bar & confirmed character count */}
                      {status && status.total > 0 && (
                        <div className="outlier-progress-wrap compact">
                          <progress aria-label="Caratteri confermati nel campo" max={status.total} value={status.confirmed} />
                          <div className="outlier-progress-meta">
                            <span>{status.confirmed.toLocaleString('it-IT')} / {status.total.toLocaleString('it-IT')} car. ({Math.round((status.confirmed / status.total) * 100)}%)</span>
                            <span className="outlier-phase-tag">{formatPhase(status.phase)}</span>
                          </div>
                        </div>
                      )}

                      {/* Speed & Cadence Controls */}
                      <div className="outlier-config-grid">
                        <label className="field-compact">
                          <span>Velocità</span>
                          <select disabled={disabled} value={currentSpeed} onChange={(event) => void w.save({ ...w.data, charactersPerMinute: Number(event.target.value) })}>
                            {AVAILABLE_SPEEDS.map((speed) => <option key={speed} value={speed}>{speed} cpm</option>)}
                          </select>
                        </label>
                        <label className="field-compact">
                          <span>Cadenza</span>
                          <select disabled={disabled} value={w.data.cadenceMode ?? 'natural'} onChange={(event) => void w.save({ ...w.data, cadenceMode: event.target.value as 'natural' | 'uniform' })}>
                            <option value="natural">Naturale (umana)</option>
                            <option value="uniform">Uniforme (fissa)</option>
                          </select>
                        </label>
                      </div>

                      {(w.data.cadenceMode ?? 'natural') === 'natural' && (
                        <div className="outlier-options-compact">
                          <label><input type="checkbox" disabled={disabled} checked={w.data.thinkingPauses ?? true} onChange={(event) => void w.save({ ...w.data, thinkingPauses: event.target.checked })} /> Pause riflessione & rilettura (1.8s - ~5s)</label>
                          <label><input type="checkbox" disabled={disabled} checked={w.data.simulateTypos ?? true} onChange={(event) => void w.save({ ...w.data, simulateTypos: event.target.checked })} /> Refusi & correzioni</label>
                        </div>
                      )}

                      {status && !status.stopAvailable && status.supported && (
                        <p className="notice">Ctrl+Alt+S non disponibile. Riavvia NEB dopo aver liberato la scorciatoia per abilitare l’inserimento.</p>
                      )}
                      {project.integration !== 's2s' && (
                        <p className="notice">Questo progetto dispone di note ed editor. Seleziona gli strumenti S2S nelle impostazioni del progetto per collegarne il Rationale.</p>
                      )}
                    </div>

                    {/* Edge Setup Card (Collapsed by default when installed) */}
                    <details className="control-card outlier-setup compact" open={!w.setup?.installed}>
                      <summary><PlugZap size={14} /> Configura collegamento Edge {w.setup?.installed && '· attivo'}</summary>
                      <div className="outlier-setup-body">
                        <ol>
                          <li>Apri <strong>edge://extensions</strong> e abilita la modalità sviluppatore.</li>
                          <li>Carica la cartella decompressa dell’estensione NEB.</li>
                          <li>Incolla l’ID di 32 lettere e premi Salva host.</li>
                        </ol>
                        <div className="outlier-setup-actions">
                          <button className="secondary-button compact" onClick={() => void w.action(() => window.neb.openOutlierExtensionFolder())}><FolderOpen size={14} /> Apri cartella</button>
                          <input className="compact-input" spellCheck={false} autoComplete="off" disabled={disabled} maxLength={32} value={extensionId || w.setup?.extensionId || ''} onChange={(event) => setExtensionId(event.target.value)} placeholder="ID estensione (32 lettere)" />
                          <button className="secondary-button compact" disabled={disabled || !status?.supported || !/^[a-p]{32}$/.test(extensionId.trim() || w.setup?.extensionId || '')} onClick={() => void install()}>{installing ? '…' : 'Salva host'}</button>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              )}
            </>
          )}

          {!project && !editing && <p className="field-note">Seleziona un progetto dalla barra o creane uno nuovo.</p>}
        </div>
      </div>
    </section>
  )
}
