import { describe, expect, it } from 'vitest'
import { importReadyLines, parseReadyScript } from './scriptImport'

describe('script import', () => {
  it('extracts the four user turns for each model and excludes scenario and responses', () => {
    const script = ['=== SCENARIO: TOPIC SWITCH ===', ...['A', 'B'].flatMap((model) => [
      `--- MODEL ${model} ---`,
      ...Array.from({ length: 4 }, (_, index) => [
        `Turn ${index * 2 + 1} (User): Ehmm... battuta ${index + 1} per ${model}!`,
        `Turn ${index * 2 + 2} (Model ${model}): [Risposta del modello - Modalità Emotiva]`
      ]).flat()
    ])].join('\n')
    const result = parseReadyScript(script)
    expect(result.errors).toEqual([])
    expect(result.modelA).toEqual(Array.from({ length: 4 }, (_, index) => `Ehmm... battuta ${index + 1} per A!`))
    expect(result.modelB).toEqual(Array.from({ length: 4 }, (_, index) => `Ehmm... battuta ${index + 1} per B!`))
  })

  it('preserves multiline speech and inner spacing with Windows line endings', () => {
    expect(parseReadyScript('--- MODEL B ---\r\nTurn 1 (User): Ciao!  Ehmm…\r\nSeconda riga.\r\n\r\nAncora qui!\r\nTurn 2 (Model B): Ignora.')).toEqual({
      modelA: [], modelB: ['Ciao!  Ehmm…\nSeconda riga.\n\nAncora qui!'], errors: []
    })
  })

  it('uses the speaker label rather than odd turn numbers and accepts simple markdown headings', () => {
    expect(parseReadyScript('## model a\nTurn 2 (USER): Testo pari.\nTurn 3 (Model A): Ignora.').modelA).toEqual(['Testo pari.'])
  })

  it('reports missing sections, empty user turns and scripts without user speech', () => {
    expect(parseReadyScript('Turn 1 (User): Ciao').errors[0]).toContain('manca l’intestazione')
    expect(parseReadyScript('MODEL A\nTurn 1 (User):\nTurn 2 (Model A): Risposta').errors[0]).toContain('è vuoto')
    expect(parseReadyScript('MODEL A\nTurn 2 (Model A): Risposta').errors[0]).toContain('Nessuna battuta')
    expect(parseReadyScript('').errors).toHaveLength(1)
  })

  it('does not assign a new scenario to the previous model without a heading', () => {
    const result = parseReadyScript('MODEL A\nTurn 1 (User): Prima\n=== SCENARIO: ALTRO ===\nTurn 1 (User): Seconda')
    expect(result.modelA).toEqual(['Prima'])
    expect(result.errors).toHaveLength(1)
  })

  it('appends or replaces lines with new IDs and leaves absent models untouched', () => {
    const current = [{ id: 'old', text: 'Esistente', done: true }]
    const appended = importReadyLines(current, ['Importata'], 'append')
    expect(appended[0]).toBe(current[0])
    expect(appended[1]).toMatchObject({ text: 'Importata', done: false })
    expect(appended[1].id).not.toBe('old')
    const replaced = importReadyLines(current, ['Importata'], 'replace')
    expect(replaced).toHaveLength(1)
    expect(replaced[0]).toMatchObject({ text: 'Importata', done: false })
    expect(importReadyLines(current, [], 'replace')).toBe(current)
  })
})
