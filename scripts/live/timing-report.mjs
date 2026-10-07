import { open, realpath } from 'node:fs/promises'
import { basename } from 'node:path'
import { summarizeLiveTimings } from '../../src/renderer/src/live/timingMetrics.ts'

const stageKeys = ['beforeQwenMs', 'qwenMs', 'beforeVoiceMs', 'voiceStartMs']
const stageNames = ['Prima di Qwen', 'Qwen · ultima richiesta', 'Attesa prima della voce', 'Preparazione audio/avatar']
const qwenKinds = ['decision', 'transcription', 'repair']
const qwenNames = ['Decisione iniziale', 'Trascrizione di recupero o preliminare', 'Correzione della decisione']
const validDuration = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const help = 'Uso: node scripts/live/timing-report.mjs [--json] sessione.json [altra-sessione.json ...]\nRichiede Node 22.18+ o 24+. Legge gli export NEB Live localmente, senza richieste ai provider.'

function stats(values) {
  const sorted = values.filter(validDuration).sort((a, b) => a - b)
  const count = sorted.length
  return { count, medianMs: count ? count % 2 ? sorted[Math.floor(count / 2)] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2 : null,
    p95Ms: count ? sorted[Math.ceil(count * 0.95) - 1] : null, maxMs: count ? sorted[count - 1] : null }
}

async function readExport(path) {
  const file = await open(path, 'r')
  try {
    const metadata = await file.stat()
    const limit = 16 * 1024 * 1024
    if (!metadata.isFile() || metadata.size > limit) throw new Error('File richiesto, massimo 16 MiB.')
    const buffer = Buffer.alloc(Math.min(metadata.size + 1, limit + 1))
    let size = 0
    while (size < buffer.length) {
      const { bytesRead } = await file.read(buffer, size, buffer.length - size, null)
      if (!bytesRead) break
      size += bytesRead
    }
    if (size > metadata.size) throw new Error('File modificato durante la lettura: riprovare.')
    let data
    try { data = JSON.parse(buffer.subarray(0, size).toString('utf8')) } catch { throw new Error('JSON non valido.') }
    if (!object(data) || data.mode !== 'neb-live' || data.schemaVersion !== 1 || !object(data.snapshot) || !Array.isArray(data.snapshot.log)) throw new Error('Export NEB Live schemaVersion 1 richiesto.')
    const log = data.snapshot.log.map(item => {
      if (!object(item) || typeof item.kind !== 'string' || !validDuration(item.atMs)) throw new Error('Evento del log non valido.')
      // Keep totals from old exports, but never turn incomplete external data into measured stages.
      const breakdown = object(item.breakdown) && stageKeys.every(key => validDuration(item.breakdown[key])) ? Object.fromEntries(stageKeys.map(key => [key, item.breakdown[key]])) : null
      return { kind: item.kind, atMs: item.atMs, text: '', durationMs: validDuration(item.durationMs) ? item.durationMs : undefined, breakdown,
        responseId: typeof item.responseId === 'string' && item.responseId ? item.responseId : undefined,
        providerId: ['gemini', 'fish-openrouter'].includes(item.providerId) ? item.providerId : undefined,
        modelId: typeof item.modelId === 'string' && item.modelId ? item.modelId : undefined }
    })
    const groups = new Map()
    for (const row of summarizeLiveTimings(log).rows) {
      const key = JSON.stringify([row.providerId, row.modelId])
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(row)
    }
    const decisions = data.snapshot.log.filter(item => ['decision', 'discarded'].includes(item.kind))
    const measured = decisions.filter(item => Array.isArray(item.qwenSteps) && item.qwenSteps.every(step => object(step) && qwenKinds.includes(step.kind) && validDuration(step.durationMs) && validDuration(step.costLookupMs) && step.costLookupMs <= step.durationMs))
    const requests = measured.flatMap(item => item.qwenSteps)
    const qwenRequests = measured.length ? { loggedDecisions: decisions.length, measuredDecisions: measured.length,
      stages: Object.fromEntries(qwenKinds.map(kind => [kind, stats(requests.filter(step => step.kind === kind).map(step => step.durationMs))])),
      costLookup: stats(requests.map(step => step.costLookupMs)) } : null
    return { file: basename(path), qwenRequests, groups: [...groups.values()].map(rows => ({ providerId: rows[0].providerId, modelId: rows[0].modelId, count: rows.length,
      total: stats(rows.map(row => row.totalMs)), stages: Object.fromEntries(stageKeys.map(key => [key, stats(rows.map(row => row.breakdown?.[key]))])),
      firstChunk: stats(rows.map(row => row.firstChunkMs)), generation: stats(rows.map(row => row.generationMs)) })) }
  } finally { await file.close() }
}

const duration = ms => ms === null ? 'Non disponibile' : `${(ms / 1000).toFixed(2).replace('.', ',')} s`
const safeText = text => Array.from(text, char => { const code = char.codePointAt(0); return code < 32 || (code >= 127 && code <= 159) ? ' ' : char }).join('')
function render(report) {
  const lines = ['Tempi NEB Live · dalla fine del parlato rilevato al playback locale']
  for (const session of report.sessions) {
    lines.push(`\n${safeText(session.file)}`)
    if (session.qwenRequests) {
      const qwen = session.qwenRequests
      lines.push(`  Dettaglio Qwen: ${qwen.measuredDecisions}/${qwen.loggedDecisions} elaborazioni misurate, incluse attese e decisioni scartate.`)
      qwenKinds.forEach((kind, index) => lines.push(`  ${qwenNames[index]}: ${qwen.stages[kind].count} richieste · mediana ${duration(qwen.stages[kind].medianMs)}`))
      lines.push(`  Recupero costi: mediana ${duration(qwen.costLookup.medianMs)} per richiesta, già incluso nella durata.`)
    } else lines.push('  Dettaglio richieste Qwen: Non disponibile in questo export.')
    if (!session.groups.length) lines.push('  Nessun turno misurato.')
    for (const group of session.groups) {
      lines.push(`  ${group.providerId ?? 'Provider non disponibile'} / ${safeText(group.modelId ?? 'Modello non disponibile')} · ${group.count} turni`,
        `  Totale: mediana ${duration(group.total.medianMs)} · P95 ${duration(group.total.p95Ms)} · massimo ${duration(group.total.maxMs)}`)
      stageKeys.forEach((key, index) => lines.push(`  ${stageNames[index]}: mediana ${duration(group.stages[key].medianMs)} (${group.stages[key].count} misure)`))
      const measured = stageKeys.filter(key => group.stages[key].count > 0).sort((a, b) => group.stages[b].medianMs - group.stages[a].medianMs)
      if (measured.length) lines.push(`  Fase con mediana maggiore: ${stageNames[stageKeys.indexOf(measured[0])]}.`)
      lines.push(`  Primo blocco: ${duration(group.firstChunk.medianMs)} (${group.firstChunk.count} misure) · generazione: ${duration(group.generation.medianMs)} (${group.generation.count} misure)`)
    }
  }
  lines.push('\nP95: rango più vicino, ceil(0,95 × n); con pochi turni coincide spesso con il massimo.',
    'Le mediane delle fasi non si sommano. Primo blocco e generazione si sovrappongono al playback.',
    'Solo log conservati nell’export; risposte interrotte dopo l’avvio incluse. Confrontare sessioni con domande e configurazioni equivalenti.')
  return lines.join('\n')
}

async function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) { console.log(help); return }
  const json = args.includes('--json')
  const paths = args.filter(arg => arg !== '--json')
  if (!paths.length || paths.some(path => path.startsWith('-'))) throw new Error(help)
  const seen = new Set(), sessions = []
  for (const path of paths) {
    try {
      const canonical = await realpath(path)
      if (seen.has(canonical)) throw new Error('File duplicato.')
      seen.add(canonical)
      sessions.push(await readExport(canonical))
    } catch (error) {
      // Do not print file contents or full paths from filesystem/parser errors.
      const detail = error.code === 'ENOENT' ? 'File non trovato. Premi Esporta JSON in NEB Live e usa il percorso del file salvato; i nomi negli esempi sono segnaposto.' : error.code ? `Errore file (${error.code}).` : error.message
      throw new Error(`${safeText(basename(path))}: ${detail}`)
    }
  }
  const report = { schemaVersion: 1, sessions }
  console.log(json ? JSON.stringify(report, null, 2) : render(report))
}

main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1 })
