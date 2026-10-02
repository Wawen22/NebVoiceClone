import { describe, expect, it } from 'vitest'
import { addReadyLine, completeReadyLine, nextReadyLine, createReadyLinesFromTexts, editReadyLine, moveReadyLine, removeReadyLine, restoreReadyLine, toggleReadyLineDone } from './readyLines'

describe('ready lines', () => {
  it('advances to the first unfinished line after completion and handles replay idempotently', () => {
    const lines = [{ id: 'a', text: 'Prima', done: false }, { id: 'b', text: 'Seconda', done: false }]
    expect(nextReadyLine(lines)?.id).toBe('a')
    const completed = completeReadyLine(lines, 'a')
    expect(nextReadyLine(completed)?.id).toBe('b')
    expect(completeReadyLine(completed, 'a')).toEqual(completed)
    expect(nextReadyLine(completeReadyLine(completed, 'b'))).toBeUndefined()
    expect(nextReadyLine(toggleReadyLineDone(completed, 'a'))?.id).toBe('a')
    expect(nextReadyLine([])).toBeUndefined()
  })

  it('keeps progress independent across model lists and does not complete missing IDs', () => {
    const modelA = [{ id: 'a', text: 'A', done: false }]
    const modelB = [{ id: 'b', text: 'B', done: false }]
    expect(nextReadyLine(completeReadyLine(modelA, 'a'))).toBeUndefined()
    expect(nextReadyLine(modelB)?.id).toBe('b')
    expect(completeReadyLine(modelB, 'a')).toEqual(modelB)
  })
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
