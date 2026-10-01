import { describe, expect, it } from 'vitest'
import { addReadyLine, createReadyLinesFromTexts, editReadyLine, moveReadyLine, removeReadyLine, restoreReadyLine, toggleReadyLineDone } from './readyLines'

describe('ready lines', () => {
  it('accepts more than 30 manually added lines without changing their exact text', () => {
    const lines = Array.from({ length: 31 }, (_, index) => ({ id: String(index), text: `  Battuta ${index + 1}!  ` }))
      .reduce((current, line) => addReadyLine(current, line.text, line.id), [] as ReturnType<typeof addReadyLine>)
    expect(lines).toHaveLength(31)
    expect(lines[0]).toEqual({ id: '0', text: '  Battuta 1!  ', done: false })
    expect(addReadyLine(lines, '   ', 'empty')).toBe(lines)
  })

  it('edits only the chosen line and rejects empty replacements', () => {
    const lines = [{ id: 'a', text: 'A', done: false }, { id: 'b', text: 'B', done: true }]
    expect(editReadyLine(lines, 'b', 'B nuova')).toEqual([{ id: 'a', text: 'A', done: false }, { id: 'b', text: 'B nuova', done: true }])
    expect(editReadyLine(lines, 'a', '\n ')).toBe(lines)
  })

  it('moves a line one position and leaves boundary moves unchanged', () => {
    const lines = [{ id: 'a', text: 'A', done: false }, { id: 'b', text: 'B', done: false }, { id: 'c', text: 'C', done: false }]
    expect(moveReadyLine(lines, 'b', -1).map((line) => line.id)).toEqual(['b', 'a', 'c'])
    expect(moveReadyLine(lines, 'a', -1)).toBe(lines)
    expect(moveReadyLine(lines, 'c', 1)).toBe(lines)
  })

  it('restores a deleted line at its previous position', () => {
    const lines = [{ id: 'a', text: 'A', done: false }, { id: 'b', text: 'B', done: false }, { id: 'c', text: 'C', done: false }]
    const removed = removeReadyLine(lines, 'b')
    expect(restoreReadyLine(removed, lines[1], 1)).toEqual(lines)
    expect(restoreReadyLine(lines, lines[1], 1)).toBe(lines)
  })

  it('marks a line as done and back without deleting it or changing its text', () => {
    const lines = addReadyLine([], 'Battuta esatta!', 'a')
    const done = toggleReadyLineDone(lines, 'a')
    expect(done).toEqual([{ id: 'a', text: 'Battuta esatta!', done: true }])
    expect(toggleReadyLineDone(done, 'a')).toEqual(lines)
  })

  it('creates ready lines from texts using id generator and filters empty strings', () => {
    let idCounter = 1
    const lines = createReadyLinesFromTexts(
      ['  Prima battuta  ', '', '   ', 'Seconda battuta'],
      () => `id-${idCounter++}`
    )
    expect(lines).toEqual([
      { id: 'id-1', text: 'Prima battuta', done: false },
      { id: 'id-2', text: 'Seconda battuta', done: false }
    ])
  })
})