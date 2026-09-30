import { describe, expect, it } from 'vitest'
import { defaultOutlierData, parseOutlierData, parseInsertionRequest } from './outlier'

describe('Outlier validation', () => {
  it('creates S2S and validates its archive status without deleting it', () => {
    const data = defaultOutlierData()
    data.projects[0].archived = true
    expect(parseOutlierData(data).projects[0]).toMatchObject({ id: 's2s', archived: true, integration: 's2s' })
  })
  it('rejects duplicated project identities and invalid names', () => {
    const data = defaultOutlierData()
    expect(() => parseOutlierData({ ...data, projects: [...data.projects, data.projects[0]] })).toThrow()
    expect(() => parseOutlierData({ ...data, projects: [{ ...data.projects[0], name: ' ' }] })).toThrow()
  })
  it('rejects invalid speeds, unknown schemas and excess text', () => {
    expect(() => parseOutlierData({ ...defaultOutlierData(), charactersPerMinute: 1201 })).toThrow()
    expect(() => parseOutlierData({ ...defaultOutlierData(), schemaVersion: 2 })).toThrow()
    expect(() => parseInsertionRequest({ projectId: 's2s', text: 'x'.repeat(50_001), charactersPerMinute: 180 })).toThrow()
  })
  it('preserves exact Unicode and paragraphs with LF line endings', () => {
    const text = "È l’apostrofo 😀\r\n" + 'a'.repeat(100)
    expect(parseInsertionRequest({ projectId: 's2s', text, charactersPerMinute: 180 }).text).toBe(text.replaceAll('\r\n', '\n'))
    expect(() => parseInsertionRequest({ projectId: 's2s', text: 'a'.repeat(100) + '\ud800', charactersPerMinute: 180 })).toThrow()
  })
})
