import { expect, it } from 'vitest'
import { MAX_LIVE_IMAGE_BYTES, parseLiveImageData, parseLiveMaterials } from './liveMaterials'
import { DEFAULT_LIVE_CONFIG, parseLiveTurnRequest } from './live'

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC'
const image = { id: 'image-1', name: 'Snippet.png', kind: 'image' as const, dataUrl: png, addedAt: 1 }

it('allows local PNG/JPEG and rejects remote links, disguised types and oversized payloads', () => {
  expect(parseLiveImageData(image).dataUrl).toBe(png)
  for (const dataUrl of ['https://example.com/image.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,not-an-image', 'data:image/png;base64,' + 'A'.repeat(MAX_LIVE_IMAGE_BYTES * 2)]) expect(() => parseLiveImageData({ name: 'Test', dataUrl })).toThrow()
})

it('validates ephemeral material count, unique IDs and snippet sizes without retaining extra fields', () => {
  const materials = parseLiveMaterials([image, { id: 'code', name: 'Code', kind: 'text', text: 'const n = 1', addedAt: 1, secret: 'drop' }])
  expect(materials[1]).not.toHaveProperty('secret')
  for (const value of [[image, image], Array.from({ length: 4 }, (_, i) => ({ ...image, id: String(i) })), [{ ...image, kind: 'text', text: ' ' }], [{ ...image, kind: 'text', text: 'x'.repeat(20001) }]]) expect(() => parseLiveMaterials(value)).toThrow()
})

it('accepts visual-only requests without inventing a remote transcript and rejects contradictory inputs', () => {
  const base = { requestId: 'visual', profile: DEFAULT_LIVE_CONFIG.profiles[0], background: '', persona: '', history: [], materials: [image], visualOnly: true }
  expect(parseLiveTurnRequest(base).visualOnly).toBe(true)
  expect(parseLiveTurnRequest(base)).not.toHaveProperty('transcript')
  for (const patch of [{ materials: [] }, { transcript: 'invented' }, { opening: true }, { audioPcm: new Uint8Array([0, 0]) }, { visualOnly: 'true' }]) expect(() => parseLiveTurnRequest({ ...base, ...patch })).toThrow()
})
