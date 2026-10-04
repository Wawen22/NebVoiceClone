export const MAX_LIVE_MATERIALS = 3
export const MAX_LIVE_IMAGE_BYTES = 4 * 1024 * 1024
export const MAX_LIVE_IMAGE_FILE_BYTES = 10 * 1024 * 1024
export interface LiveImageData { name: string; dataUrl: string }
export interface LiveCaptureSource { id: string; name: string; thumbnail: string }
interface MaterialInfo { id: string; name: string; addedAt: number }
export type LiveMaterial = MaterialInfo & ({ kind: 'image'; dataUrl: string } | { kind: 'text'; text: string })

export function parseLiveImageData(value: unknown): LiveImageData {
  if (!value || typeof value !== 'object') throw new Error('Screenshot non valido.')
  const v = value as Record<string, unknown>
  if (typeof v.name !== 'string' || !v.name.trim() || v.name.length > 160 || typeof v.dataUrl !== 'string' || v.dataUrl.length > Math.ceil(MAX_LIVE_IMAGE_BYTES / 3) * 4 + 30) throw new Error('Screenshot mancante o troppo grande (massimo 4 MB).')
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(v.dataUrl)
  if (!match || match[2].length % 4 !== 0 || (match[1] === 'png' ? !match[2].startsWith('iVBORw0KGgo') : !match[2].startsWith('/9j/'))) throw new Error('Usa uno screenshot PNG o JPEG valido.')
  return { name: v.name.trim(), dataUrl: v.dataUrl }
}

export function parseLiveMaterials(value: unknown = []): LiveMaterial[] {
  if (!Array.isArray(value) || value.length > MAX_LIVE_MATERIALS) throw new Error('Puoi aggiungere al massimo 3 allegati. Rimuovine uno per continuare.')
  const materials = value.map((item): LiveMaterial => {
    if (!item || typeof item !== 'object') throw new Error('Allegato NEB Live non valido.')
    const v = item as Record<string, unknown>
    if (typeof v.id !== 'string' || !v.id.trim() || v.id.length > 100 || typeof v.name !== 'string' || !v.name.trim() || v.name.length > 160 || typeof v.addedAt !== 'number' || !Number.isFinite(v.addedAt) || v.addedAt < 0) throw new Error('Allegato NEB Live non valido.')
    const info = { id: v.id, name: v.name.trim(), addedAt: v.addedAt }
    if (v.kind === 'image') return { ...info, kind: 'image', ...parseLiveImageData(v) }
    if (v.kind === 'text' && typeof v.text === 'string' && v.text.trim() && v.text.length <= 20000) return { ...info, kind: 'text', text: v.text }
    throw new Error('Snippet mancante o troppo lungo (massimo 20.000 caratteri).')
  })
  if (new Set(materials.map((item) => item.id)).size !== materials.length) throw new Error('Allegato NEB Live duplicato.')
  return materials
}
