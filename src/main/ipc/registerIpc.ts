import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions, type WebContents } from 'electron'
import { basename, join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { clearGeminiVoiceProfile, readSettings, saveReplicatedVoice, setGeminiKeySource, updateSettings } from '../config/settingsStore'
import { getGeminiKeyStatus, removeSavedGeminiKey, resolveGeminiApiKey, saveGeminiKey } from '../config/geminiKeyStore'
import { GeminiTtsProvider } from '../providers/gemini'
import { parseSynthesisRequest } from '../../shared/geminiRequest'
import type { AppInfo, GeminiKeySource } from '../../shared/contracts'
import { parseCreateReplicatedVoiceRequest } from '../../shared/voiceReplication'
import { parseVoiceProfile, serializeVoiceProfile } from '../../shared/voiceProfile'
import type { WindowPresentationController } from '../windowPresentation'
import { paraphraseSingleLine, paraphraseWithNemotron } from '../providers/openrouter'
import { adaptS2STurn, S2S_QWEN_MODEL } from '../providers/qwen'
import { parseS2SAdaptRequest, parseS2SSimulationRequest } from '../../shared/s2s'
import { generateSimulatedReply } from '../providers/s2sSimulation'
import { LiveConfigStore } from '../live/configStore'
import { generateLiveTurn } from '../providers/live'
import { parseLiveTurnRequest } from '../../shared/live'
import { captureLiveSource, getLiveCaptureSources, importLiveImage, readLiveClipboardImage } from '../live/materialCapture'
import { createAvatarSession } from '../avatar/provider'
import type { AvatarOutputRelay } from '../avatar/outputRelay'
import { registerAvatarOutputIpc } from '../avatar/outputIpc'

export function registerIpc(
  getWebContents: () => WebContents | undefined,
  windowPresentation: WindowPresentationController,
  avatarOutput?: AvatarOutputRelay
): void {
  const gemini = new GeminiTtsProvider(resolveGeminiApiKey)
  let activeGeneration: AbortController | null = null
  let activeVoiceCreation = false
  let activeAdaptation: { id: string; controller: AbortController } | null = null
  let activeSimulation: { id: string; controller: AbortController } | null = null
  let activeLiveTurn: { id: string; controller: AbortController } | null = null
  const liveStore = new LiveConfigStore(join(app.getPath('userData'), 'neb-live-config.json'))
  function assertTrusted(sender: WebContents, frame: Electron.WebFrameMain | null): void {
    if (sender !== getWebContents() || frame !== sender.mainFrame) throw new Error('Untrusted window.')
  }
  if (avatarOutput) registerAvatarOutputIpc<Electron.IpcMainInvokeEvent>(
    (channel, handler) => ipcMain.handle(channel, handler),
    (event) => assertTrusted(event.sender, event.senderFrame), avatarOutput
  )

  ipcMain.handle('avatar:status', (event) => {
    assertTrusted(event.sender, event.senderFrame)
    return { configured: Boolean(process.env.SIMLI_API_KEY?.trim()) }
  })
  ipcMain.handle('avatar:session', (event, faceId: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    return createAvatarSession(faceId)
  })

  ipcMain.handle('live:getConfig', (event) => {
    assertTrusted(event.sender, event.senderFrame)
    return liveStore.read()
  })
  ipcMain.handle('live:captureSources', (event) => { assertTrusted(event.sender, event.senderFrame); return getLiveCaptureSources() })
  ipcMain.handle('live:captureSource', (event, id: unknown) => { assertTrusted(event.sender, event.senderFrame); return captureLiveSource(id) })
  ipcMain.handle('live:clipboardImage', (event) => { assertTrusted(event.sender, event.senderFrame); return readLiveClipboardImage() })
  ipcMain.handle('live:importImage', (event, data: unknown, name: unknown) => { assertTrusted(event.sender, event.senderFrame); return importLiveImage(data, name) })
  ipcMain.handle('live:saveConfig', (event, value: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    return liveStore.save(value)
  })
  ipcMain.handle('live:generate', async (event, value: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    if (activeVoiceCreation) throw new Error('Attendi la fine della creazione della voce prima di avviare NEB Live.')
    const request = parseLiveTurnRequest(value)
    activeLiveTurn?.controller.abort()
    const operation = { id: request.requestId, controller: new AbortController() }
    activeLiveTurn = operation
    try { return await generateLiveTurn(request, { signal: operation.controller.signal }) }
    finally { if (activeLiveTurn === operation) activeLiveTurn = null }
  })
  ipcMain.handle('live:cancel', (event, id: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    if (id !== undefined && (typeof id !== 'string' || !id.trim() || id.length > 100)) throw new Error('Identificativo NEB Live non valido.')
    if (id === undefined || id === activeLiveTurn?.id) {
      activeLiveTurn?.controller.abort()
      activeLiveTurn = null
    }
  })

  ipcMain.handle('app:getInfo', async (event): Promise<AppInfo> => {
    assertTrusted(event.sender, event.senderFrame)
    const keys = await getGeminiKeyStatus()
    return {
      electron: process.versions.electron,
      node: process.versions.node,
      platform: process.platform,
      geminiConfigured: keys.activeSource === 'environment' ? keys.environmentConfigured : keys.activeSource === 'project' ? keys.projectConfigured : Boolean(keys.savedLabel && keys.secureStorageAvailable)
    }
  })
  ipcMain.handle('settings:get', (event) => {
    assertTrusted(event.sender, event.senderFrame)
    return readSettings()
  })
  ipcMain.handle('settings:update', (event, patch: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    return updateSettings(patch)
  })
  ipcMain.handle('geminiKey:getStatus', (event) => {
    assertTrusted(event.sender, event.senderFrame)
    return getGeminiKeyStatus()
  })
  ipcMain.handle('geminiKey:save', async (event, value: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    if (activeGeneration || activeVoiceCreation) throw new Error('Attendi la fine dell’operazione prima di cambiare chiave Gemini.')
    const status = await saveGeminiKey(value)
    await clearGeminiVoiceProfile('saved')
    return status
  })
  ipcMain.handle('geminiKey:select', async (event, source: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    if (source !== 'environment' && source !== 'project' && source !== 'saved') throw new Error('Selezione della chiave Gemini non valida.')
    if (activeGeneration || activeVoiceCreation) throw new Error('Attendi la fine dell’operazione prima di cambiare chiave Gemini.')
    if ((source as GeminiKeySource) === 'saved') {
      const status = await getGeminiKeyStatus()
      if (!status.savedLabel) throw new Error('Salva prima la chiave Gemini aggiuntiva.')
      if (!status.secureStorageAvailable) throw new Error('L’archiviazione cifrata non è disponibile su questo sistema.')
    }
    if (source === 'project' && !process.env.GEMINI_API_KEY_NEBVOICCLONE?.trim()) throw new Error('La seconda chiave Gemini non è configurata in questo ambiente.')
    return setGeminiKeySource(source as GeminiKeySource)
  })
  ipcMain.handle('geminiKey:remove', async (event) => {
    assertTrusted(event.sender, event.senderFrame)
    if (activeGeneration || activeVoiceCreation) throw new Error('Attendi la fine dell’operazione prima di rimuovere la chiave Gemini.')
    const settings = await setGeminiKeySource('environment')
    await removeSavedGeminiKey()
    await clearGeminiVoiceProfile('saved')
    return settings
  })
  ipcMain.handle('gemini:check', (event) => {
    assertTrusted(event.sender, event.senderFrame)
    return gemini.validateConfiguration()
  })
  ipcMain.handle('gemini:createReplicatedVoice', async (event, value: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    if (activeVoiceCreation) throw new Error('La creazione della voce è già in corso.')
    const request = parseCreateReplicatedVoiceRequest(value)
    activeVoiceCreation = true
    try {
      const source = (await readSettings()).geminiKeySource
      const record = await gemini.createReplicatedVoice(request)
      return await saveReplicatedVoice(record, source)
    } finally { activeVoiceCreation = false }
  })
  ipcMain.handle('voiceProfile:export', async (event) => {
    assertTrusted(event.sender, event.senderFrame)
    const voice = (await readSettings()).replicatedVoice
    if (!voice) throw new Error('Create or import a replicated voice before exporting a profile.')
    const options = {
      title: 'Export NEB voice profile',
      defaultPath: `neb-voice-${voice.displayName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'profile'}.json`,
      filters: [{ name: 'NEB voice profile', extensions: ['json'] }]
    }
    const owner = BrowserWindow.fromWebContents(event.sender)
    const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, serializeVoiceProfile(voice), { encoding: 'utf8', mode: 0o600 })
    return { fileName: basename(result.filePath) }
  })
  ipcMain.handle('voiceProfile:import', async (event) => {
    assertTrusted(event.sender, event.senderFrame)
    const options: OpenDialogOptions = {
      title: 'Import NEB voice profile',
      properties: ['openFile'],
      filters: [{ name: 'NEB voice profile', extensions: ['json'] }]
    }
    const owner = BrowserWindow.fromWebContents(event.sender)
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    let data: unknown
    try {
      data = JSON.parse(await readFile(result.filePaths[0], 'utf8'))
    } catch {
      throw new Error('The selected profile could not be read.')
    }
    const voice = parseVoiceProfile(data)
    await gemini.verifyReplicatedVoice(voice.id)
    return saveReplicatedVoice(voice)
  })
  ipcMain.handle('speech:synthesize', async (event, value: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    const request = parseSynthesisRequest(value)
    if (request.voice.mode === 'stateful' && request.voice.voiceId !== (await readSettings()).replicatedVoice?.id) throw new Error('Select a voice saved in this application.')
    if (activeGeneration) throw new Error('Generation is already in progress.')
    const controller = new AbortController()
    activeGeneration = controller
    try {
      return await gemini.synthesize(request, controller.signal)
    } finally {
      if (activeGeneration === controller) activeGeneration = null
    }
  })
  ipcMain.handle('speech:synthesizeStream', async (event, value: unknown, streamId: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    if (!Number.isSafeInteger(streamId) || Number(streamId) < 0) throw new Error('Invalid audio stream.')
    const request = parseSynthesisRequest(value)
    if (request.voice.mode === 'stateful' && request.voice.voiceId !== (await readSettings()).replicatedVoice?.id) throw new Error('Select a voice saved in this application.')
    if (activeGeneration) throw new Error('Generation is already in progress.')
    const controller = new AbortController()
    activeGeneration = controller
    try {
      return await gemini.synthesizeStream(request, controller.signal, (chunk) => {
        if (!controller.signal.aborted && !event.sender.isDestroyed()) event.sender.send('speech:chunk', streamId, chunk)
      })
    } finally {
      if (activeGeneration === controller) activeGeneration = null
    }
  })
  ipcMain.handle('speech:stop', (event) => {
    assertTrusted(event.sender, event.senderFrame)
    const pending = activeGeneration
    activeGeneration = null
    pending?.abort()
  })
  ipcMain.handle('window:setConversationMode', (event, enabled: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    if (typeof enabled !== 'boolean') throw new Error('Conversation mode must be a boolean.')
    return windowPresentation.setConversationMode(enabled)
  })
  ipcMain.handle('openrouter:paraphraseReadyLines', async (event, texts: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    if (!Array.isArray(texts)) throw new Error('Formato battute non valido.')
    const lines = texts.map((t) => typeof t === 'string' ? t.trim() : '').filter(Boolean)
    if (lines.length === 0) return []
    return paraphraseWithNemotron(lines)
  })
  ipcMain.handle('s2s:providerStatus', (event) => {
    assertTrusted(event.sender, event.senderFrame)
    if (activeVoiceCreation) return { ready: false, model: S2S_QWEN_MODEL, message: 'Attendi la fine della creazione della voce prima di avviare la conversazione.' }
    return { ready: Boolean(process.env.OPENROUTER_API_KEY?.trim()), model: S2S_QWEN_MODEL }
  })
  ipcMain.handle('s2s:adapt', async (event, value: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    const request = parseS2SAdaptRequest(value)
    activeAdaptation?.controller.abort()
    const operation = { id: request.requestId, controller: new AbortController() }
    activeAdaptation = operation
    try { return await adaptS2STurn(request, { signal: operation.controller.signal }) }
    finally { if (activeAdaptation === operation) activeAdaptation = null }
  })
  ipcMain.handle('s2s:cancelAdaptation', (event, id: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    if (id === undefined || id === activeAdaptation?.id) { activeAdaptation?.controller.abort(); activeAdaptation = null }
  })
  ipcMain.handle('s2s:simulateReply', async (event, value: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    const request = parseS2SSimulationRequest(value)
    activeSimulation?.controller.abort()
    const operation = { id: request.requestId, controller: new AbortController() }
    activeSimulation = operation
    try { return await generateSimulatedReply(request, { signal: operation.controller.signal }) }
    finally { if (activeSimulation === operation) activeSimulation = null }
  })
  ipcMain.handle('s2s:cancelSimulation', (event, id: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    if (id === activeSimulation?.id) { activeSimulation?.controller.abort(); activeSimulation = null }
  })
  ipcMain.handle('openrouter:paraphraseSingleLine', async (event, text: unknown, avoid: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    if (typeof text !== 'string' || !text.trim()) throw new Error('Testo battuta mancante.')
    const avoidText = typeof avoid === 'string' && avoid.trim() ? avoid.trim() : undefined
    return paraphraseSingleLine(text, avoidText)
  })
}
