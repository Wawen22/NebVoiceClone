import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi } from '../shared/contracts'

let nextStreamId = 0
const api: DesktopApi = {
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  checkGemini: () => ipcRenderer.invoke('gemini:check'),
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
  }
}

contextBridge.exposeInMainWorld('neb', api)
