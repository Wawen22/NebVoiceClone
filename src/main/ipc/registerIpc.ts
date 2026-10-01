import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions, type WebContents } from 'electron'
import { basename } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { clearGeminiVoiceProfile, readSettings, saveReplicatedVoice, setGeminiKeySource, updateSettings } from '../config/settingsStore'
import { getGeminiKeyStatus, removeSavedGeminiKey, resolveGeminiApiKey, saveGeminiKey } from '../config/geminiKeyStore'
import { GeminiTtsProvider } from '../providers/gemini'
import { parseSynthesisRequest } from '../../shared/geminiRequest'
import type { AppInfo, GeminiKeySource } from '../../shared/contracts'
import { parseCreateReplicatedVoiceRequest } from '../../shared/voiceReplication'
import { parseVoiceProfile, serializeVoiceProfile } from '../../shared/voiceProfile'
import type { WindowPresentationController } from '../windowPresentation'
import { paraphraseWithNemotron } from '../providers/openrouter'

export function registerIpc(
  getWebContents: () => WebContents | undefined,
  windowPresentation: WindowPresentationController
): void {
  const gemini = new GeminiTtsProvider(resolveGeminiApiKey)
  let activeGeneration: AbortController | null = null
  let activeVoiceCreation = false
  function assertTrusted(sender: WebContents, frame: Electron.WebFrameMain | null): void {
    if (sender !== getWebContents() || frame !== sender.mainFrame) throw new Error('Untrusted window.')
  }

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
}
