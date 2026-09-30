import { useState, type ReactNode } from 'react'
import { Archive, ArchiveRestore, Plus, Pencil, FolderOpen, PlugZap, Play, Pause, Square, Mic, FileText } from 'lucide-react'
import type { OutlierProject } from '../../../shared/outlier'
import type { OutlierWorkspace } from './useOutlierWorkspace'

export function OutlierPage({ workspace: w, voice }: { workspace: OutlierWorkspace; voice: ReactNode }): React.JSX.Element {
  const [editing, setEditing] = useState<OutlierProject | null>(null)
  const [extensionId, setExtensionId] = useState('')
  const [installing, setInstalling] = useState(false)
  const project = w.data.projects.find((entry) => entry.id === w.selectedId)
  const draft = w.drafts[w.selectedId] || ''
  const disabled = w.locked || w.saving || installing || !w.loaded
  const status = w.status
  const canStart = !disabled && project?.integration === 's2s' && !project.archived && draft.trim().length >= 100 && draft.length <= 50_000 && status?.supported && status.connected && status.stopAvailable
  async function saveProject(): Promise<void> {
    if (!editing) return
    const exists = w.data.projects.some((entry) => entry.id === editing.id)
    if (await w.save({ ...w.data, projects: exists ? w.data.projects.map((entry) => entry.id === editing.id ? editing : entry) : [...w.data.projects, editing] })) { w.setSelectedId(editing.id); w.setShowArchived(editing.archived); setEditing(null) }
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
  return <section className="outlier-page">
    <div className="outlier-heading"><div><h2>I tuoi progetti Outlier</h2><p>Voce, battute e Rationale nello stesso spazio di lavoro.</p></div><button className="secondary-button" disabled={disabled} onClick={() => setEditing({ id: crypto.randomUUID(), name: '', notes: '', archived: false, integration: 'none' })}><Plus size={16} /> Nuovo progetto</button></div>
    {w.error && <p className="notice error" role="alert">{w.error}</p>}
    <div className="outlier-layout">
      <aside className="outlier-projects">
        <div className="outlier-tabs"><button className={!w.showArchived ? 'selected' : ''} disabled={disabled} onClick={() => w.setShowArchived(false)}>Attivi</button><button className={w.showArchived ? 'selected' : ''} disabled={disabled} onClick={() => w.setShowArchived(true)}>Archiviati</button></div>
        {w.data.projects.filter((entry) => entry.archived === w.showArchived).map((entry) => <div key={entry.id} className={entry.id === w.selectedId ? 'outlier-project selected' : 'outlier-project'}>
          <button disabled={disabled} onClick={() => w.setSelectedId(entry.id)}><strong>{entry.name}</strong><small>{entry.integration === 's2s' ? 'Conversazione · Rationale S2S' : 'Progetto personale'}</small></button>
          <div><button title="Modifica progetto" aria-label={'Modifica ' + entry.name} disabled={disabled} onClick={() => setEditing({ ...entry })}><Pencil size={14} /></button><button title={entry.archived ? 'Ripristina progetto' : 'Archivia progetto'} aria-label={(entry.archived ? 'Ripristina ' : 'Archivia ') + entry.name} disabled={disabled} onClick={() => void toggleArchive(entry)}>{entry.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}</button></div>
        </div>)}
        {!w.data.projects.some((entry) => entry.archived === w.showArchived) && <p className="field-note">Nessun progetto {w.showArchived ? 'archiviato' : 'attivo'}.</p>}
      </aside>
      <div className="outlier-detail">
        {editing && <form className="control-card outlier-form" onSubmit={(event) => { event.preventDefault(); void saveProject() }}>
          <h3>{w.data.projects.some((entry) => entry.id === editing.id) ? 'Modifica progetto' : 'Nuovo progetto'}</h3>
          <label className="field">Nome<input autoFocus required maxLength={100} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
          <label className="field">Strumenti<select value={editing.integration} onChange={(event) => setEditing({ ...editing, integration: event.target.value as OutlierProject['integration'] })}><option value="none">Note ed editor</option><option value="s2s">S2S · collegamento Rationale</option></select></label>
          <label className="field">Note personali<textarea maxLength={10_000} value={editing.notes} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} /></label>
          <div className="outlier-actions"><button className="primary-button" disabled={disabled || !editing.name.trim()}>Salva progetto</button><button type="button" className="secondary-button" onClick={() => setEditing(null)}>Annulla</button></div>
        </form>}
        {project && <>
          <header className="outlier-project-heading"><div><span className="eyebrow">OUTLIER / {project.archived ? 'ARCHIVIATO' : 'PROGETTO ATTIVO'}</span><h2>{project.name}</h2></div><label className="field">Conversazione<select value={w.models[project.id] || 'A'} disabled={disabled} onChange={(event) => w.setModels((current) => ({ ...current, [project.id]: event.target.value as 'A' | 'B' }))}><option value="A">Model A</option><option value="B">Model B</option></select></label></header>
          {project.notes && <p className="outlier-notes">{project.notes}</p>}
          <div className="outlier-tabs"><button className={w.tab === 'voice' ? 'selected' : ''} onClick={() => w.setTab('voice')}><Mic size={15} /> Conversazione e Battute</button><button className={w.tab === 'rationale' ? 'selected' : ''} onClick={() => w.setTab('rationale')}><FileText size={15} /> Rationale</button></div>
          {w.tab === 'voice' ? voice : <div className="outlier-rationale">
            <label htmlFor="outlier-rationale">Il tuo Rationale</label>
            <textarea id="outlier-rationale" data-no-speech-shortcuts maxLength={50_000} disabled={w.locked} placeholder="Scrivi o incolla qui il tuo Rationale già preparato…" value={draft} onChange={(event) => w.setDrafts((current) => ({ ...current, [project.id]: event.target.value }))} />
            <div className="editor-meta"><span>{draft.length.toLocaleString('it-IT')} / 50.000 caratteri · minimo 100 per S2S</span><span>Solo in memoria fino alla chiusura di NEB</span></div>
            <p className="field-note">Motiva ogni dimensione valutata e cita evidenze specifiche delle tue conversazioni. Il testo è separato dalla voce.</p>
            <div className="control-card outlier-insertion">
              <div className="outlier-heading"><h3>Inserimento nel browser</h3><span className={status?.connected ? 'status-dot green' : 'status-dot amber'} /></div>
              <p role="status" aria-live="polite">{status?.message || 'Verifica del servizio…'}</p>
              {status?.target && <div className="outlier-target"><strong>{status.target.title}</strong><small>{status.target.url}</small></div>}
              {status && !status.stopAvailable && status.supported && <p className="notice">Ctrl+Alt+S non disponibile. Riavvia NEB dopo aver liberato la scorciatoia per abilitare l’inserimento.</p>}
              <label className="field outlier-speed">Velocità<select disabled={disabled} value={w.data.charactersPerMinute} onChange={(event) => void w.save({ ...w.data, charactersPerMinute: Number(event.target.value) })}>{[60, 120, 180, 240, 300, 450, 600].map((speed) => <option key={speed} value={speed}>{speed} caratteri / minuto</option>)}</select></label>
              {status && status.total > 0 && <><progress aria-label="Caratteri confermati nel campo" max={status.total} value={status.confirmed} /><small>{status.confirmed} / {status.total} caratteri confermati · {status.phase}</small></>}
              <div className="outlier-actions">
                <button className="primary-button" disabled={!canStart} onClick={() => void w.action(() => window.neb.startInsertion({ projectId: project.id, text: draft, charactersPerMinute: w.data.charactersPerMinute }))}><Play size={16} /> Avvia inserimento</button>
                <button className="secondary-button" disabled={!status || !['typing', 'preparing'].includes(status.phase)} onClick={() => void w.action(() => window.neb.pauseInsertion())}><Pause size={16} /> Pausa</button>
                <button className="secondary-button" disabled={status?.phase !== 'paused' || !status.connected} onClick={() => void w.action(() => window.neb.resumeInsertion())}><Play size={16} /> Riprendi</button>
                <button className="secondary-button" disabled={!w.locked} onClick={() => void w.action(() => window.neb.stopInsertion())}><Square size={16} /> Stop</button>
              </div>
              <p className="field-note">Il campo iniziale deve essere vuoto. Il trasferimento si arresta se cambia la destinazione. Controllo finale e invio della task spettano a te.</p>
              {project.integration !== 's2s' && <p className="notice">Questo progetto dispone di note ed editor. Seleziona gli strumenti S2S nelle impostazioni del progetto per collegarne il Rationale.</p>}
            </div>
            <details className="control-card outlier-setup" open={!w.setup?.installed}>
              <summary><PlugZap size={16} /> Configura il collegamento Edge {w.setup?.installed && '· host installato'}</summary>
              <ol><li>Apri <strong>edge://extensions</strong>, attiva la modalità sviluppatore e scegli <strong>Carica decompressa</strong>.</li><li>Seleziona la cartella dell’estensione NEB usando il pulsante qui sotto.</li><li>Prendi l’ID di 32 lettere dalla scheda dell’estensione, inseriscilo qui e premi Configura.</li><li>Apri la demo o la task, premi l’icona NEB Outlier e scegli <strong>Collega questa scheda</strong>. Per un file locale abilita anche l’accesso ai file nei dettagli dell’estensione.</li></ol>
              <button className="secondary-button" onClick={() => void w.action(() => window.neb.openOutlierExtensionFolder())}><FolderOpen size={16} /> Apri cartella estensione</button>
              <label className="field">ID estensione Edge<input spellCheck={false} autoComplete="off" disabled={disabled} maxLength={32} value={extensionId || w.setup?.extensionId || ''} onChange={(event) => setExtensionId(event.target.value)} placeholder="32 lettere da a a p" /></label>
              <button className="secondary-button" disabled={disabled || !status?.supported || !/^[a-p]{32}$/.test(extensionId.trim() || w.setup?.extensionId || '')} onClick={() => void install()}>{installing ? 'Configurazione…' : 'Configura host Windows'}</button>
              <p className="field-note">L’installazione riguarda solo questo utente Windows. Nessun servizio AI riceve il Rationale.</p>
            </details>
          </div>}
        </>}
        {!project && !editing && <p>Seleziona un progetto o creane uno.</p>}
      </div>
    </div>
  </section>
}
