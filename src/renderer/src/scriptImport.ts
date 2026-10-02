import { createReadyLinesFromTexts, type ReadyLine, type ReadyLinesTab } from './readyLines'

export type ScriptImportMode = 'append' | 'replace'
export interface ScriptImportResult {
  modelA: string[]
  modelB: string[]
  errors: string[]
}

export function parseReadyScript(script: string): ScriptImportResult {
  const result: ScriptImportResult = { modelA: [], modelB: [], errors: [] }
  let section: ReadyLinesTab | null = null
  let turn: { section: ReadyLinesTab | null; number: string; user: boolean; lines: string[] } | null = null

  function flush(): void {
    if (!turn?.user) return
    const text = turn.lines.join('\n').trim()
    if (!turn.section) result.errors.push(`Turn ${turn.number} (User): manca l’intestazione MODEL A o MODEL B.`)
    else if (!text) result.errors.push(`Turn ${turn.number} (User) in ${turn.section === 'modelA' ? 'MODEL A' : 'MODEL B'} è vuoto.`)
    else result[turn.section].push(text)
  }

  for (const line of script.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = line.trim().replace(/^[-=#*\s]+|[-=#*\s]+$/g, '').trim()
    const model = /^MODEL\s+([AB])$/i.exec(heading)
    if (model || /^SCENARIO\s*:/i.test(heading)) {
      flush()
      turn = null
      section = model ? (model[1].toUpperCase() === 'A' ? 'modelA' : 'modelB') : null
      continue
    }
    const match = /^\s*Turn\s+(\d+)\s*\(([^)]+)\)\s*:\s?(.*)$/i.exec(line)
    if (match) {
      flush()
      turn = { section, number: match[1], user: match[2].trim().toLowerCase() === 'user', lines: [match[3]] }
    } else if (turn) {
      turn.lines.push(line)
    }
  }
  flush()
  if (result.modelA.length + result.modelB.length === 0 && result.errors.length === 0) {
    result.errors.push('Nessuna battuta User trovata. Usa intestazioni MODEL A / MODEL B e turni nel formato Turn 1 (User): testo.')
  }
  return result
}

export function importReadyLines(current: ReadyLine[], texts: string[], mode: ScriptImportMode): ReadyLine[] {
  if (texts.length === 0) return current
  const imported = createReadyLinesFromTexts(texts)
  return mode === 'append' ? [...current, ...imported] : imported
}
