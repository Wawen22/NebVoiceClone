import { useMemo, useState } from 'react'
import { parseReadyScript, type ScriptImportMode, type ScriptImportResult } from './scriptImport'

interface ScriptImportPanelProps {
  countA: number
  countB: number
  onImport: (result: ScriptImportResult, mode: ScriptImportMode) => void
  onCancel: () => void
  onDraftChange: (dirty: boolean) => void
}

export function ScriptImportPanel({ countA, countB, onImport, onCancel, onDraftChange }: ScriptImportPanelProps): React.JSX.Element {
  const [script, setScript] = useState('')
  const [mode, setMode] = useState<ScriptImportMode>('append')
  const result = useMemo(() => parseReadyScript(script), [script])
  const valid = result.errors.length === 0

  const total = result.modelA.length + result.modelB.length

  return <section className="ready-import" aria-label="Importa script">
    <div className="ready-import-workspace">
      <div className="ready-import-source">
        <div className="ready-import-heading"><label htmlFor="ready-import-text">Il tuo script</label><span>01 · Incolla</span></div>
        <p id="ready-import-help">Incolla le battute con i titoli MODEL A e MODEL B. Importiamo solo i turni User, nell’ordine originale.</p>
        <textarea id="ready-import-text" aria-describedby="ready-import-help" autoFocus value={script} onChange={(event) => {
          setScript(event.target.value)
          onDraftChange(Boolean(event.target.value.trim()))
        }} placeholder={'--- MODEL A ---\nTurn 1 (User): Ciao! Vorrei preparare una lezione.\nTurn 2 (User): Mi proponi un’attività semplice?\n\n--- MODEL B ---\nTurn 1 (User): Ciao! Vorrei preparare una lezione.'} />
      </div>
      <div className="ready-import-result">
        <div className="ready-import-heading"><h3>Anteprima</h3><span>02 · Controlla</span></div>
        <p className="ready-import-count" role="status">{script.trim() ? `${total} battute · ${result.modelA.length} MODEL A · ${result.modelB.length} MODEL B` : 'Le battute riconosciute appariranno qui.'}</p>
        <div className="ready-import-preview-list" tabIndex={0} aria-label="Anteprima delle battute importate">
          {result.errors.length > 0 && script.trim() && <ul className="ready-import-errors" role="alert">{result.errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
          {!script.trim() && <div className="ready-import-empty"><strong>Prima il testo, poi la voce.</strong><p>Controlla qui le battute prima di aggiungerle alla conversazione.</p></div>}
          {(['modelA', 'modelB'] as const).map((tab) => result[tab].length > 0 && <div key={tab} className="ready-import-preview">
            <h4>{tab === 'modelA' ? 'MODEL A' : 'MODEL B'} <span>{result[tab].length} battute</span></h4>
            <ol>{result[tab].map((text, index) => <li key={index}>{text}</li>)}</ol>
          </div>)}
        </div>
      </div>
    </div>
    <div className="ready-import-bottom">
      <fieldset className="ready-import-mode">
        <legend>Come importare</legend>
        <label><input type="radio" name="script-import-mode" checked={mode === 'append'} onChange={() => setMode('append')} /> Aggiungi alle battute esistenti</label>
        <label><input type="radio" name="script-import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Sostituisci i modelli importati</label>
      </fieldset>
      {mode === 'replace' && <p className="ready-import-replace" role="status">{[
        result.modelA.length > 0 ? `MODEL A: ${countA} esistenti → ${result.modelA.length} importate.` : '',
        result.modelB.length > 0 ? `MODEL B: ${countB} esistenti → ${result.modelB.length} importate.` : ''
      ].filter(Boolean).join(' ')} I modelli senza battute nell’anteprima restano invariati.</p>}
      <div className="ready-editor-actions">
        <button className="secondary-button" onClick={onCancel}>Annulla</button>
        <button className="secondary-button ready-save" disabled={!valid} onClick={() => onImport(result, mode)}>Importa battute{valid ? ` (${total})` : ''}</button>
      </div>
    </div>
  </section>
}
