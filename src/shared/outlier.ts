export interface OutlierProject { id: string; name: string; notes: string; archived: boolean; integration: 's2s' | 'none' }
export interface OutlierData { schemaVersion: 1; projects: OutlierProject[]; charactersPerMinute: number }
export interface BrowserTarget { tabId: number; windowId: number; documentId: string; url: string; title: string }
export interface FieldSnapshot { target: BrowserTarget; value: string; focused: boolean; selectionStart: number; selectionEnd: number }
export interface NativeLease { hwnd: string; controlId: string }
export type InsertionPhase = 'disconnected' | 'ready' | 'preparing' | 'typing' | 'paused' | 'completed' | 'interrupted' | 'error'
export interface InsertionStatus {
  supported: boolean; connected: boolean; stopAvailable: boolean; phase: InsertionPhase
  target: BrowserTarget | null; projectId: string | null; confirmed: number; total: number; message: string
}
export interface InsertionRequest { projectId: string; text: string; charactersPerMinute: number }
export interface OutlierSetup { extensionPath: string; installed: boolean; extensionId: string | null }
export interface OutlierApi {
  getOutlierData(): Promise<OutlierData>
  saveOutlierData(value: OutlierData): Promise<OutlierData>
  getInsertionStatus(): Promise<InsertionStatus>
  startInsertion(request: InsertionRequest): Promise<InsertionStatus>
  pauseInsertion(): Promise<InsertionStatus>
  resumeInsertion(): Promise<InsertionStatus>
  stopInsertion(): Promise<InsertionStatus>
  onInsertionStatus(callback: (status: InsertionStatus) => void): () => void
  getOutlierSetup(): Promise<OutlierSetup>
  installOutlierHost(extensionId: string): Promise<OutlierSetup>
  openOutlierExtensionFolder(): Promise<void>
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dati Outlier non validi.')
  return value as Record<string, unknown>
}
function string(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Testo Outlier non valido.')
  return value
}
export function parseSpeed(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 60 || value > 600) throw new Error('Scegli una velocità fra 60 e 600 caratteri al minuto.')
  return value
}
export function defaultOutlierData(): OutlierData {
  return { schemaVersion: 1, charactersPerMinute: 180, projects: [{ id: 's2s', name: 'S2S', notes: '', archived: false, integration: 's2s' }] }
}
export function parseOutlierData(value: unknown): OutlierData {
  const data = object(value)
  if (data.schemaVersion !== 1 || !Array.isArray(data.projects) || data.projects.length > 100) throw new Error('Archivio progetti Outlier non valido.')
  const ids = new Set<string>()
  const projects = data.projects.map((entry): OutlierProject => {
    const project = object(entry)
    const id = string(project.id, 100)
    const name = string(project.name, 100).trim()
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id) || !name || typeof project.archived !== 'boolean' || !['s2s', 'none'].includes(String(project.integration))) throw new Error('Progetto Outlier non valido o duplicato.')
    ids.add(id)
    return { id, name, notes: string(project.notes, 10_000), archived: project.archived, integration: project.integration as OutlierProject['integration'] }
  })
  return { schemaVersion: 1, projects, charactersPerMinute: parseSpeed(data.charactersPerMinute) }
}
export function parseInsertionRequest(value: unknown): InsertionRequest {
  const data = object(value)
  const projectId = string(data.projectId, 100)
  const text = string(data.text, 50_000).replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  const controls = Array.from(text).some((character) => { const code = character.codePointAt(0)!; return (code < 32 && code !== 9 && code !== 10) || code === 127 })
  if (!projectId || text.trim().length < 100 || controls || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)) throw new Error('Rationale non valido: minimo 100 caratteri, massimo 50.000; niente caratteri di controllo.')
  return { projectId, text, charactersPerMinute: parseSpeed(data.charactersPerMinute) }
}
export function parseTarget(value: unknown): BrowserTarget {
  const data = object(value)
  if (!Number.isSafeInteger(data.tabId) || Number(data.tabId) < 0 || !Number.isSafeInteger(data.windowId) || Number(data.windowId) < 0) throw new Error('Scheda non valida.')
  const url = string(data.url, 4000)
  if (!/^(https?:\/\/|file:\/\/)/.test(url)) throw new Error('Questa pagina non può essere associata.')
  const documentId = string(data.documentId, 100)
  if (!documentId) throw new Error('Documento non valido.')
  return { tabId: Number(data.tabId), windowId: Number(data.windowId), url, title: string(data.title, 500), documentId }
}
export function sameTarget(a: BrowserTarget, b: BrowserTarget): boolean {
  return a.tabId === b.tabId && a.windowId === b.windowId && a.documentId === b.documentId && a.url === b.url
}
export function parseSnapshot(value: unknown): FieldSnapshot {
  const data = object(value)
  if (typeof data.focused !== 'boolean' || !Number.isSafeInteger(data.selectionStart) || !Number.isSafeInteger(data.selectionEnd)) throw new Error('Stato del campo non valido.')
  return { target: parseTarget(data.target), value: string(data.value, 50_000), focused: data.focused, selectionStart: Number(data.selectionStart), selectionEnd: Number(data.selectionEnd) }
}
export function parseLease(value: unknown): NativeLease {
  const data = object(value)
  const hwnd = string(data.hwnd, 30)
  const controlId = string(data.controlId, 500)
  if (!/^\d+$/.test(hwnd) || hwnd === '0' || !controlId) throw new Error('Controllo Windows non verificato.')
  return { hwnd, controlId }
}
export function insertionLocked(status: InsertionStatus): boolean { return ['preparing', 'typing', 'paused'].includes(status.phase) }
