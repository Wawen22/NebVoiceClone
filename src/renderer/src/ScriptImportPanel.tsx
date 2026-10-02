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

  return <section className="ready-import" aria-label="Importa script">
    <label htmlFor="ready-import-text">Incolla lo script completo di MODEL A e MODEL B</label>
    <textarea id="ready-import-text" autoFocus value={script} onChange={(event) => {
      setScript(event.target.value)
      onDraftChange(Boolean(event.target.value.trim()))
    }} placeholder={'--- MODEL A ---\nTurn 1 (User): Ciao!\nTurn 2 (Model A): [Risposta del modello]\n--- MODEL B ---\nTurn 1 (User): Ehi, ciao!'} />
    <p>Importiamo solo i turni User, mantenendo il testo e l’ordine delle battute.</p>
    {script.trim() && <>
      <strong role="status">Anteprima: {result.modelA.length} battute per MODEL A · {result.modelB.length} per MODEL B</strong>
      {result.errors.length > 0 && <ul className="ready-import-errors" role="alert">{result.errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
      {(['modelA', 'modelB'] as const).map((tab) => result[tab].length > 0 && <div key={tab} className="ready-import-preview">
        <h3>{tab === 'modelA' ? 'MODEL A' : 'MODEL B'}</h3>
        <ol>{result[tab].map((text, index) => <li key={index}>{text}</li>)}</ol>
      </div>)}
    </>}
    <fieldset>
      <legend>Come importare</legend>
      <label><input type="radio" name="script-import-mode" checked={mode === 'append'} onChange={() => setMode('append')} /> Aggiungi alle battute esistenti</label>
      <label><input type="radio" name="script-import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Sostituisci le battute dei modelli importati</label>
    </fieldset>
    {mode === 'replace' && <p>{[
      result.modelA.length > 0 ? `MODEL A: ${countA} battute esistenti → ${result.modelA.length} importate.` : '',
      result.modelB.length > 0 ? `MODEL B: ${countB} battute esistenti → ${result.modelB.length} importate.` : ''
    ].filter(Boolean).join(' ')} I modelli senza battute nell’anteprima restano invariati.</p>}
    <div className="ready-editor-actions">
      <button className="secondary-button" onClick={onCancel}>Annulla</button>
      <button className="secondary-button ready-save" disabled={!valid} onClick={() => onImport(result, mode)}>Importa battute</button>
    </div>
  </section>
}
