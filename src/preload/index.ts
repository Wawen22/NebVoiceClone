import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi } from '../shared/contracts'

const api: DesktopApi = {
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  checkGemini: () => ipcRenderer.invoke('gemini:check'),
  createReplicatedVoice: (request) => ipcRenderer.invoke('gemini:createReplicatedVoice', request),
  synthesize: (request) => ipcRenderer.invoke('speech:synthesize', request),
  stopGeneration: () => ipcRenderer.invoke('speech:stop'),
  setConversationMode: (enabled) => ipcRenderer.invoke('window:setConversationMode', enabled),
  onConversationRequested: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('window:openConversationMode', listener)
    return () => ipcRenderer.removeListener('window:openConversationMode', listener)
  }
}

contextBridge.exposeInMainWorld('neb', api)
