import { clipboard, desktopCapturer, nativeImage, type NativeImage } from 'electron'
import { MAX_LIVE_IMAGE_BYTES, MAX_LIVE_IMAGE_FILE_BYTES, parseLiveImageData, type LiveCaptureSource, type LiveImageData } from '../../shared/liveMaterials'

function normalize(image: NativeImage, name: string): LiveImageData {
  if (image.isEmpty()) throw new Error('Immagine non disponibile. Verifica che la finestra sia aperta o copia uno screenshot.')
  const size = image.getSize()
  if (size.width > 16000 || size.height > 16000 || size.width * size.height > 40_000_000) throw new Error('Immagine troppo grande. Ritaglia il codice da analizzare.')
  const scale = Math.min(1, 2200 / size.width, 1600 / size.height)
  const resized = scale < 1 ? image.resize({ width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)), quality: 'best' }) : image
  let data = resized.toPNG(), mime = 'png'
  if (data.length > MAX_LIVE_IMAGE_BYTES) { data = resized.toJPEG(85); mime = 'jpeg' }
  return parseLiveImageData({ name: name.trim().slice(0, 160) || 'Screenshot', dataUrl: `data:image/${mime};base64,${data.toString('base64')}` })
}

export async function getLiveCaptureSources(): Promise<LiveCaptureSource[]> {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'], thumbnailSize: { width: 280, height: 160 }, fetchWindowIcons: false })
  return sources.filter((source) => !source.thumbnail.isEmpty()).map((source) => ({ id: source.id, name: source.name, thumbnail: source.thumbnail.toDataURL() }))
}

export async function captureLiveSource(id: unknown): Promise<LiveImageData> {
  if (typeof id !== 'string' || !/^(window|screen):\d+:\d+$/.test(id)) throw new Error('Seleziona una finestra o uno schermo da acquisire.')
  const sources = await desktopCapturer.getSources({ types: [id.startsWith('window:') ? 'window' : 'screen'], thumbnailSize: { width: 2200, height: 1600 }, fetchWindowIcons: false })
  const source = sources.find((item) => item.id === id)
  if (!source) throw new Error('La finestra scelta non è più disponibile. Scegli una nuova sorgente.')
  return normalize(source.thumbnail, source.name)
}

export async function readLiveClipboardImage(): Promise<LiveImageData> {
  const items = await clipboard.read()
  const item = items.find((entry) => entry.types.includes('image/png')) ?? items.find((entry) => entry.types.includes('image/jpeg'))
  if (!item) throw new Error('Nessuno screenshot negli appunti. Copialo prima con Win+Shift+S.')
  const type = item.types.includes('image/png') ? 'image/png' : 'image/jpeg'
  const blob = await item.getType(type)
  if (!('arrayBuffer' in blob) || !('size' in blob)) throw new Error('Formato degli appunti non leggibile come immagine.')
  if (blob.size > MAX_LIVE_IMAGE_FILE_BYTES) throw new Error('Screenshot negli appunti troppo grande. Ritaglia il codice da analizzare.')
  return importLiveImage(new Uint8Array(await blob.arrayBuffer()), 'Screenshot dagli appunti')
}

export function importLiveImage(data: unknown, name: unknown): LiveImageData {
  if (!(data instanceof Uint8Array) || !data.length || data.length > MAX_LIVE_IMAGE_FILE_BYTES || typeof name !== 'string' || !name.trim() || name.length > 160) throw new Error('Scegli uno screenshot PNG o JPEG fino a 10 MB.')
  const png = data.length >= 8 && Buffer.from(data.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const jpeg = data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255
  if (!png && !jpeg) throw new Error('Usa uno screenshot PNG o JPEG.')
  return normalize(nativeImage.createFromBuffer(Buffer.from(data)), name)
}
