import { MAX_S2S_AUDIO_BYTES } from './s2s'

export interface LiveProfile {
  id: string
  name: string
  context: string
  language: 'auto' | 'it' | 'en' | 'ar'
  tone: 'professional' | 'conversational'
}
export interface LiveLimits { durationMinutes: number; maxTurns: number; maxCostUsd: number }
export const DEFAULT_LIVE_LIMITS: LiveLimits = { durationMinutes: 20, maxTurns: 40, maxCostUsd: 1 }
export interface LiveConfig { schemaVersion: 1; background: string; persona: string; profiles: LiveProfile[]; selectedProfileId: string; limits?: LiveLimits }
export interface LiveHistoryItem { role: 'neb' | 'interlocutor'; text: string; partial?: boolean }
export interface LiveTurnRequest {
  requestId: string
  profile: LiveProfile
  background: string
  persona: string
  history: LiveHistoryItem[]
  audioPcm?: Uint8Array
  transcript?: string
  opening?: boolean
}
export interface LiveDecision { action: 'speak' | 'wait' | 'pause' | 'complete'; transcript: string; text: string; reason: string; costUsd: number | null; qwenMs: number }
export interface LiveApi {
  getLiveConfig(): Promise<LiveConfig>
  saveLiveConfig(config: LiveConfig): Promise<LiveConfig>
  generateLiveTurn(request: LiveTurnRequest): Promise<LiveDecision>
  cancelLiveTurn(requestId?: string): Promise<void>
}

/** Curated professional facts from the supplied background, as of 4 October 2026. */
export const DEFAULT_LIVE_CONFIG: LiveConfig = {
  schemaVersion: 1,
  limits: { ...DEFAULT_LIVE_LIMITS },
  background: `Sono Radhouane Nebili, preferisco Neb. Sono un Full-Stack Developer nell'area di Modena con 7+ anni di esperienza dichiarati nel CV di settembre 2026.
Nel CV lavoro come Web Developer in TEL&CO Srl da agosto 2019; nella stessa azienda ho svolto uno stage da giugno a settembre 2018. Mi occupo di sviluppo e manutenzione web full-stack, integrazioni API, funzionalità AI, integrazione LLM e workflow agentici, test, debugging, deployment e supporto in produzione. Collaboro con team e stakeholder per chiarire requisiti e consegnare soluzioni manutenibili.
Competenze dichiarate nel CV: PHP, JavaScript, TypeScript, Node.js, Next.js, REST API, Microsoft Power Platform, Docker, integrazione di sistemi, automazione e prompt engineering. Non sono documentati livelli di seniority per ciascuna tecnologia, metriche di impatto, clienti, dimensioni del team o singoli progetti aziendali.
Formazione: Technical Institute Diploma, Electronics & Computer Science, ITIS Fermo Corni (2016); Higher Technical Diploma in Software Systems Programming for Industry 4.0, IFOA (2019). Non ho una laurea documentata. Il CV riporta Microsoft Power Platform Developer Associate PL-400; data e validità corrente vanno verificate.
Italiano e arabo sono lingue native/bilingui; inglese Professional Working Proficiency. Non è documentato un livello CEFR o una certificazione linguistica.
Uso o esploro strumenti di coding AI quali Claude Code, Codex, GitHub Copilot, Hermes Agent, OpenClaw, ORCA ADE e Antigravity. Il contesto aggiuntivo comprende SQL, Power BI, Windows/WSL, DDEV, WordPress/Joomla, Azure AI Foundry, Supabase, Stripe e Vercel: non attribuire automaticamente esperienza avanzata o uso professionale in produzione a ciascuno.
Ho riferito attività di valutazione di interazioni vocali AI su Outlier nel settembre 2026, distinte dall'impiego aziendale; periodo contrattuale e titolo ufficiale non sono confermati. Non presentarle come ricerca accademica. Ho interesse per automazione, sistemi vocali e applicazioni AI; i progetti personali discussi sono esplorazioni, senza risultati, clienti o deployment verificati.
Il mio focus è applicare AI e integrazioni software a problemi concreti. Non sono documentati addestramento di modelli da zero, ruoli di leadership o gestione di persone. Se mancano dettagli personali o un episodio concreto, chiedere chiarimenti anziché inventare.`,
  persona: `Parla come Neb: diretto, pragmatico, curioso, competente e naturalmente critico. Risposte chiare, concrete e conversazionali, con frasi di lunghezza variabile. Spiega prima il concetto semplice, poi i dettagli utili. Adatta lingua e formalità al profilo e all'interlocutore; in auto usa la lingua della conversazione, con italiano come base se non è chiara.
Nel lavoro resta educato, sintetico e umano; evita formule burocratiche, enfasi artificiale e frasi da assistente AI. Usa transizioni come "secondo me", "più che altro", "nel senso" o "ci sta" solo quando naturali, senza caricature né intercalari ripetuti. Pause brevi e riformulazioni devono seguire il pensiero, senza teatralità. Non inserire istruzioni vocali o indicazioni di scena nel testo da pronunciare.
Riconosci l'incertezza, chiedi chiarimenti quando necessario e metti in discussione ciò che non torna. Non fingere certezza. Preferisci soluzioni semplici, utilizzabili e automatizzabili. Usa ironia leggera solo se adatta al contesto. Una risposta semplice è breve; una questione tecnica può richiedere qualche dettaglio concreto.`,
  profiles: [
    { id: 'full-stack', name: 'Colloquio full-stack', context: 'Colloquio tecnico e conoscitivo. Collega esperienza documentata a requisiti e domande. Non inventare episodi STAR, risultati o stack di singoli progetti.', language: 'auto', tone: 'professional' },
    { id: 'ai-automation', name: 'AI e automazione', context: 'Conversazione su integrazioni LLM, applicazioni AI e automazione. Distingui esperienze lavorative, esperimenti e idee. Spiega i compromessi in modo concreto.', language: 'auto', tone: 'professional' },
    { id: 'research', name: 'Intervista di ricerca', context: 'Intervista esplorativa su esperienze e preferenze di utilizzo della tecnologia. Rispondi sinceramente; non fingere attività accademica o esperienze mai riportate.', language: 'auto', tone: 'conversational' },
    { id: 'free', name: 'Conversazione libera', context: 'Conversazione spontanea; segui argomento e lingua dell’interlocutore senza uno script. Mantieni uno stile naturale e conciso.', language: 'auto', tone: 'conversational' }
  ],
  selectedProfileId: 'full-stack'
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dati NEB Live non validi.')
  return value as Record<string, unknown>
}
function text(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error('Testo NEB Live mancante o troppo lungo.')
  return value
}
export function parseLiveProfile(value: unknown): LiveProfile {
  const v = object(value)
  if (typeof v.language !== 'string' || !['auto', 'it', 'en', 'ar'].includes(v.language) || typeof v.tone !== 'string' || !['professional', 'conversational'].includes(v.tone)) throw new Error('Lingua o tono NEB Live non validi.')
  return { id: text(v.id, 100, true), name: text(v.name, 120, true), context: text(v.context, 8000), language: v.language as LiveProfile['language'], tone: v.tone as LiveProfile['tone'] }
}
export function parseLiveLimits(value: unknown): LiveLimits {
  const v = object(value)
  if (typeof v.durationMinutes !== 'number' || !Number.isInteger(v.durationMinutes) || v.durationMinutes < 1 || v.durationMinutes > 180
    || typeof v.maxTurns !== 'number' || !Number.isInteger(v.maxTurns) || v.maxTurns < 1 || v.maxTurns > 500
    || typeof v.maxCostUsd !== 'number' || !Number.isFinite(v.maxCostUsd) || v.maxCostUsd < 0.1 || v.maxCostUsd > 20) {
    throw new Error('Limiti NEB Live non validi: durata 1–180 minuti, 1–500 turni, budget OpenRouter $0,10–$20.')
  }
  return { durationMinutes: v.durationMinutes, maxTurns: v.maxTurns, maxCostUsd: v.maxCostUsd }
}
export function parseLiveConfig(value: unknown): LiveConfig {
  const v = object(value)
  if (v.schemaVersion !== 1 || !Array.isArray(v.profiles) || !v.profiles.length || v.profiles.length > 30) throw new Error('Configurazione NEB Live non valida.')
  const profiles = v.profiles.map(parseLiveProfile)
  const selectedProfileId = text(v.selectedProfileId, 100, true)
  if (new Set(profiles.map((p) => p.id)).size !== profiles.length || !profiles.some((p) => p.id === selectedProfileId)) throw new Error('Profilo NEB Live duplicato o selezione mancante.')
  return { schemaVersion: 1, background: text(v.background, 40000), persona: text(v.persona, 20000), profiles, selectedProfileId, limits: parseLiveLimits(v.limits === undefined ? DEFAULT_LIVE_LIMITS : v.limits) }
}
export function parseLiveTurnRequest(value: unknown): LiveTurnRequest {
  const v = object(value)
  if (v.opening !== undefined && typeof v.opening !== 'boolean') throw new Error('Apertura NEB Live non valida.')
  const audio = v.audioPcm instanceof Uint8Array && v.audioPcm.length > 0 && v.audioPcm.length % 2 === 0 && v.audioPcm.length <= MAX_S2S_AUDIO_BYTES
  const transcript = typeof v.transcript === 'string' && v.transcript.trim().length > 0 && v.transcript.length <= 16000
  if (!(audio && v.transcript === undefined && !v.opening || transcript && v.audioPcm === undefined && !v.opening || v.opening === true && v.audioPcm === undefined && v.transcript === undefined)) throw new Error('Audio, trascrizione o apertura NEB Live non validi (massimo 120 secondi).')
  if (!Array.isArray(v.history) || v.history.length > 60) throw new Error('Cronologia NEB Live non valida.')
  const history = v.history.map((item): LiveHistoryItem => {
    const h = object(item)
    if (typeof h.role !== 'string' || !['neb', 'interlocutor'].includes(h.role) || h.partial !== undefined && typeof h.partial !== 'boolean') throw new Error('Turno NEB Live non valido.')
    return { role: h.role as LiveHistoryItem['role'], text: text(h.text, 16000, true), ...(h.partial !== undefined ? { partial: h.partial as boolean } : {}) }
  })
  return { requestId: text(v.requestId, 100, true), profile: parseLiveProfile(v.profile), background: text(v.background, 40000), persona: text(v.persona, 20000), history,
    ...(audio ? { audioPcm: new Uint8Array(v.audioPcm as Uint8Array) } : {}), ...(transcript ? { transcript: v.transcript as string } : {}), ...(v.opening === true ? { opening: true } : {}) }
}

export class LiveDecisionError extends Error {
  constructor(message: string, readonly transcript = '') { super(`Decisione NEB Live non valida: ${message}`) }
}
export function parseLiveDecision(content: string, opening = false): Omit<LiveDecision, 'costUsd' | 'qwenMs'> {
  let raw: unknown
  try { raw = JSON.parse(content) } catch { throw new LiveDecisionError('JSON non leggibile.') }
  const v = object(raw)
  const transcript = typeof v.transcript === 'string' && v.transcript.length <= 16000 ? v.transcript.trim() : ''
  const invalid = (reason: string): never => { throw new LiveDecisionError(reason, transcript) }
  if (typeof v.action !== 'string' || !['speak', 'wait', 'pause', 'complete'].includes(v.action)) invalid('azione sconosciuta.')
  if (typeof v.transcript !== 'string' || v.transcript.length > 16000 || typeof v.text !== 'string' || v.text.length > 4000 || typeof v.reason !== 'string' || !v.reason.trim() || v.reason.length > 1000) invalid('trascrizione, testo o motivazione mancanti o troppo lunghi.')
  const speech = (v.text as string).trim()
  if (v.action === 'speak' && (!speech || !opening && !transcript)) invalid('parlato o trascrizione mancanti.')
  if (v.action !== 'speak' && speech) invalid('il testo deve essere vuoto se non si parla.')
  if (v.action === 'complete' && !opening && !transcript) invalid('chiusura senza trascrizione.')
  return { action: v.action as LiveDecision['action'], transcript, text: speech, reason: (v.reason as string).trim() }
}
