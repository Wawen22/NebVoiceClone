import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions, type WebContents } from 'electron'
import { basename } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { readSettings, saveReplicatedVoice, updateSettings } from '../config/settingsStore'
import { GeminiTtsProvider } from '../providers/gemini'
import { parseSynthesisRequest } from '../../shared/geminiRequest'
import type { AppInfo } from '../../shared/contracts'
import { parseCreateReplicatedVoiceRequest } from '../../shared/voiceReplication'
import { parseVoiceProfile, serializeVoiceProfile } from '../../shared/voiceProfile'
import type { WindowPresentationController } from '../windowPresentation'

export function registerIpc(
  getWebContents: () => WebContents | undefined,
  windowPresentation: WindowPresentationController
): void {
  const gemini = new GeminiTtsProvider()
  let activeGeneration: AbortController | null = null
  function assertTrusted(sender: WebContents, frame: Electron.WebFrameMain | null): void {
    if (sender !== getWebContents() || frame !== sender.mainFrame) throw new Error('Untrusted window.')
  }

  ipcMain.handle('app:getInfo', (event): AppInfo => {
    assertTrusted(event.sender, event.senderFrame)
    return {
      electron: process.versions.electron,
      node: process.versions.node,
      platform: process.platform,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim())
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
  ipcMain.handle('gemini:check', (event) => {
    assertTrusted(event.sender, event.senderFrame)
    return gemini.validateConfiguration()
  })
  ipcMain.handle('gemini:createReplicatedVoice', async (event, value: unknown) => {
    assertTrusted(event.sender, event.senderFrame)
    const request = parseCreateReplicatedVoiceRequest(value)
    const record = await gemini.createReplicatedVoice(request)
    return saveReplicatedVoice(record)
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
    return saveReplicatedVoice(parseVoiceProfile(data))
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
}
