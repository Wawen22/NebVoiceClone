import { contextBridge, ipcRenderer, webFrame } from 'electron'
import type { DesktopApi } from '../shared/contracts'

let nextStreamId = 0
const api: DesktopApi = {
  getAvatarOutputStatus: () => ipcRenderer.invoke('avatarOutput:status'),
  setAvatarOutputEnabled: (enabled) => ipcRenderer.invoke('avatarOutput:enabled', enabled),
  getAvatarOutputUrl: () => ipcRenderer.invoke('avatarOutput:url'),
  beginAvatarOutput: () => ipcRenderer.invoke('avatarOutput:begin'),
  publishAvatarOutputFrame: (frame) => ipcRenderer.invoke('avatarOutput:frame', frame),
  clearAvatarOutput: (generation) => ipcRenderer.invoke('avatarOutput:clear', generation),
  getAvatarStatus: () => ipcRenderer.invoke('avatar:status'),
  createAvatarSession: (faceId, limits) => ipcRenderer.invoke('avatar:session', faceId, limits),
  getLiveConfig: () => ipcRenderer.invoke('live:getConfig'),
  saveLiveConfig: (config) => ipcRenderer.invoke('live:saveConfig', config),
  generateLiveTurn: (request) => ipcRenderer.invoke('live:generate', request),
  cancelLiveTurn: (id) => ipcRenderer.invoke('live:cancel', id),
  getLiveCaptureSources: () => ipcRenderer.invoke('live:captureSources'),
  captureLiveSource: (id) => ipcRenderer.invoke('live:captureSource', id),
  readLiveClipboardImage: () => ipcRenderer.invoke('live:clipboardImage'),
  importLiveImage: (data, name) => ipcRenderer.invoke('live:importImage', data, name),
  getS2SProviderStatus: () => ipcRenderer.invoke('s2s:providerStatus'),
  adaptS2STurn: (request) => ipcRenderer.invoke('s2s:adapt', request),
  cancelS2SAdaptation: (id) => ipcRenderer.invoke('s2s:cancelAdaptation', id),
  generateS2SSimulationReply: (request) => ipcRenderer.invoke('s2s:simulateReply', request),
  cancelS2SSimulationReply: (id) => ipcRenderer.invoke('s2s:cancelSimulation', id),
  getS2SAudioStatus: () => ipcRenderer.invoke('s2s:audioStatus'),
  stopS2SAudioCapture: () => ipcRenderer.invoke('s2s:stopAudio'),
  onS2SAudio: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, value: import('../shared/s2s').S2SAudioEvent): void => callback(value)
    ipcRenderer.on('s2s:audio', listener)
    return () => ipcRenderer.removeListener('s2s:audio', listener)
  },
  getOutlierData: () => ipcRenderer.invoke('outlier:get'),
  saveOutlierData: (value) => ipcRenderer.invoke('outlier:save', value),
  getInsertionStatus: () => ipcRenderer.invoke('outlier:getStatus'),
  startInsertion: (request) => ipcRenderer.invoke('outlier:start', request),
  pauseInsertion: () => ipcRenderer.invoke('outlier:pause'),
  resumeInsertion: (request) => ipcRenderer.invoke('outlier:resume', request),
  stopInsertion: () => ipcRenderer.invoke('outlier:stop'),
  getOutlierSetup: () => ipcRenderer.invoke('outlier:setup'),
  installOutlierHost: (id) => ipcRenderer.invoke('outlier:install', id),
  openOutlierExtensionFolder: () => ipcRenderer.invoke('outlier:openExtension'),
  onInsertionStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: import('../shared/outlier').InsertionStatus): void => callback(status)
    ipcRenderer.on('outlier:status', listener)
    return () => ipcRenderer.removeListener('outlier:status', listener)
  },
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  getGeminiKeyStatus: () => ipcRenderer.invoke('geminiKey:getStatus'),
  saveGeminiKey: (request) => ipcRenderer.invoke('geminiKey:save', request),
  selectGeminiKey: (source) => ipcRenderer.invoke('geminiKey:select', source),
  removeGeminiKey: () => ipcRenderer.invoke('geminiKey:remove'),
  checkGemini: () => ipcRenderer.invoke('gemini:check'),
  getSpeechProviderStatus: (providerId) => ipcRenderer.invoke('speech:providerStatus', providerId),
  importFishVoice: (request) => ipcRenderer.invoke('fishVoice:import', request),
  removeFishVoice: () => ipcRenderer.invoke('fishVoice:remove'),
  setSpeechSessionLock: (locked, sessionId) => ipcRenderer.invoke('speech:sessionLock', locked, sessionId),
  createReplicatedVoice: (request) => ipcRenderer.invoke('gemini:createReplicatedVoice', request),
  exportVoiceProfile: () => ipcRenderer.invoke('voiceProfile:export'),
  importVoiceProfile: () => ipcRenderer.invoke('voiceProfile:import'),
  synthesize: (request) => ipcRenderer.invoke('speech:synthesize', request),
  synthesizeStream: async (request, onChunk) => {
    const streamId = ++nextStreamId
    const listener = (_event: Electron.IpcRendererEvent, receivedId: number, chunk: Uint8Array): void => {
      if (receivedId === streamId) onChunk(chunk)
    }
    ipcRenderer.on('speech:chunk', listener)
    try {
      return await ipcRenderer.invoke('speech:synthesizeStream', request, streamId)
    } finally {
      ipcRenderer.removeListener('speech:chunk', listener)
    }
  },
  stopGeneration: () => ipcRenderer.invoke('speech:stop'),
  setConversationMode: (enabled) => ipcRenderer.invoke('window:setConversationMode', enabled),
  onConversationRequested: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('window:openConversationMode', listener)
    return () => ipcRenderer.removeListener('window:openConversationMode', listener)
  },
  onStopRequested: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('window:stopSpeech', listener)
    return () => ipcRenderer.removeListener('window:stopSpeech', listener)
  },
  setZoomFactor: (factor) => webFrame.setZoomFactor(factor),
  getZoomFactor: () => webFrame.getZoomFactor(),
  paraphraseReadyLines: (texts) => ipcRenderer.invoke('openrouter:paraphraseReadyLines', texts),
  paraphraseSingleLine: (text, avoidVariation) => ipcRenderer.invoke('openrouter:paraphraseSingleLine', text, avoidVariation)
}

contextBridge.exposeInMainWorld('neb', api)
