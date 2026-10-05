// Explicit, bounded cloud probe. Returns metadata only; never saves reference or output audio.
import { open, stat } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const FREE = 'fish-audio/s2.1-pro-free:free'
const PAID = 'fish-audio/s2.1-pro'

export async function readBoundedFile(path, maxBytes) {
  if (!(await stat(path)).isFile()) throw Error('Scegli un file regolare.')
  const file = await open(path, 'r')
  try {
    const info = await file.stat()
    if (!info.isFile() || info.size > maxBytes) throw Error('File oltre il limite della prova.')
    const bytes = Buffer.alloc(maxBytes + 1)
    let size = 0
    while (size < bytes.length) {
      const result = await file.read(bytes, size, bytes.length - size, size)
      if (!result.bytesRead) break
      size += result.bytesRead
    }
    if (size > maxBytes) throw Error('File oltre il limite della prova.')
    return bytes.subarray(0, size)
  } finally { await file.close() }
}

export function validateReferenceWav(bytes) {
  const invalid = () => { throw Error('Riferimento WAV non valido: serve PCM16 mono, 5-60 secondi.') }
  if (!(bytes instanceof Uint8Array) || bytes.length < 44 || bytes.length > 6 * 1024 * 1024) invalid()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (at) => Buffer.from(bytes.subarray(at, at + 4)).toString('ascii')
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || view.getUint32(4, true) + 8 !== bytes.length) invalid()
  let format = null, dataSize = null, offset = 12
  while (offset + 8 <= bytes.length) {
    const kind = tag(offset), size = view.getUint32(offset + 4, true), start = offset + 8
    if (start + size > bytes.length) invalid()
    if (kind === 'fmt ') {
      if (format || size < 16) invalid()
      const rate = view.getUint32(start + 4, true)
      if (view.getUint16(start, true) !== 1 || view.getUint16(start + 2, true) !== 1 || ![16000, 24000, 44100, 48000].includes(rate) || view.getUint32(start + 8, true) !== rate * 2 || view.getUint16(start + 12, true) !== 2 || view.getUint16(start + 14, true) !== 16) invalid()
      format = { sampleRate: rate }
    } else if (kind === 'data') {
      if (dataSize !== null || !size || size % 2) invalid()
      dataSize = size
    }
    offset = start + size + size % 2
  }
  if (offset !== bytes.length || !format || dataSize === null || dataSize / (format.sampleRate * 2) < 5 || dataSize / (format.sampleRate * 2) > 60) invalid()
  return format
}

export function parseProbeArgs(args) {
  const result = { consent: false, presetOnly: false, model: FREE }
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--consent': result.consent = true; break
      case '--preset-only': result.presetOnly = true; break
      case '--paid': result.model = PAID; break
      case '--reference': result.referencePath = args[++i]; break
      case '--transcript-file': result.transcriptPath = args[++i]; break
      default: throw Error('Argomento probe non valido.')
    }
  }
  if (!result.consent) throw Error('Serve consenso esplicito alla prova remota.')
  if (result.presetOnly ? result.referencePath || result.transcriptPath : !result.referencePath || !result.transcriptPath) throw Error('Scegli un riferimento con trascrizione oppure --preset-only.')
  return result
}

export async function probeFish(options, { fetchImpl = fetch, now = () => performance.now() } = {}) {
  if (options.consent !== true) throw Error('Serve consenso esplicito alla prova remota.')
  if (!options.apiKey?.trim()) throw Error('OPENROUTER_API_KEY non configurata.')
  const model = options.model ?? FREE
  if (model !== FREE && model !== PAID) throw Error('Modello probe non valido.')
  const body = { model, input: 'Questa e una breve prova della voce. Hello, this is a short voice test.', response_format: 'pcm' }
  if (!options.presetOnly) {
    const bytes = options.reference
    validateReferenceWav(bytes)
    if (typeof options.transcript !== 'string' || !options.transcript.trim() || options.transcript.length > 10000) throw Error('Trascrizione non valida.')
    body.input_references = [{ type: 'input_audio', input_audio: { data: `data:audio/wav;base64,${Buffer.from(bytes).toString('base64')}` } }, { type: 'text', text: options.transcript.trim() }]
  } else if (options.reference || options.transcript) throw Error('Riferimento inatteso nella prova preset.')
  const started = now(), controller = new AbortController()
  let reader, firstByteMs = null, byteCount = 0, chunkCount = 0
  const initialTimer = setTimeout(() => controller.abort(), 15000)
  const totalTimer = setTimeout(() => controller.abort(), 120000)
  try {
    const response = await fetchImpl('https://openrouter.ai/api/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal })
    if (!response.ok) throw Error(`Fish: HTTP ${response.status}.`)
    const contentType = response.headers.get('content-type') ?? ''
    if (!/^audio\/pcm(?:\s*;|$)/i.test(contentType) || !response.body) throw Error('Fish: formato PCM non disponibile.')
    reader = response.body.getReader()
    while (true) {
      const { value, done } = await reader.read()
      if (controller.signal.aborted) throw Error('Fish: timeout della prova.')
      if (done) break
      if (!value?.length) continue
      if (firstByteMs === null) { firstByteMs = Math.round(now() - started); clearTimeout(initialTimer) }
      byteCount += value.length; chunkCount++
      if (byteCount > 32 * 1024 * 1024) throw Error('Fish: audio oltre il limite della prova.')
    }
    if (!byteCount) throw Error('Fish: stream audio vuoto.')
    // OpenRouter documents raw PCM as 16-bit little-endian; rate/channels still require response metadata.
    const parts = contentType.toLowerCase().split(';').map(part => part.trim())
    const rate = parts.find(part => /^rate=\d+$/.test(part))
    const formatVerified = parts.length === 3 && parts[0] === 'audio/pcm' && parts.includes('channels=1') && /^(rate=8000|rate=16000|rate=24000|rate=32000|rate=44100|rate=48000)$/.test(rate ?? '') && byteCount % 2 === 0
    return { model, httpStatus: response.status, contentType: contentType.slice(0, 150), firstByteMs, completedMs: Math.round(now() - started), byteCount, chunkCount, formatVerified }
  } catch (error) {
    const safe = error instanceof Error && /^Fish: (HTTP \d{3}\.|formato PCM non disponibile\.|timeout della prova\.|audio oltre il limite della prova\.|stream audio vuoto\.)$/.test(error.message)
    throw Error(controller.signal.aborted ? 'Fish: timeout della prova.' : safe ? error.message : 'Fish: prova remota non riuscita.')
  } finally {
    clearTimeout(initialTimer); clearTimeout(totalTimer)
    controller.abort()
    try { await reader?.cancel() } catch { /* A failed stream may already be closed. */ }
    reader?.releaseLock()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = parseProbeArgs(process.argv.slice(2))
    const reference = args.referencePath ? await readBoundedFile(args.referencePath, 6 * 1024 * 1024) : undefined
    const transcript = args.transcriptPath ? (await readBoundedFile(args.transcriptPath, 40000)).toString('utf8') : undefined
    console.log(JSON.stringify(await probeFish({ ...args, reference, transcript, apiKey: process.env.OPENROUTER_API_KEY })))
  } catch (error) {
    console.error(error?.code ? 'Impossibile leggere i file della prova.' : error instanceof Error ? error.message : 'Prova non riuscita.')
    process.exitCode = 1
  }
}
