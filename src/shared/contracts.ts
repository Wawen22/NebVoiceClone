import type { OutlierApi } from './outlier'

export const GEMINI_MODELS = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'] as const
export const GEMINI_PREBUILT_VOICES = ['Kore', 'Puck'] as const
export type GeminiModel = (typeof GEMINI_MODELS)[number]
export type GeminiPrebuiltVoice = (typeof GEMINI_PREBUILT_VOICES)[number]
export type ProviderId = 'gemini' | 'azure'
export type GeminiKeySource = 'environment' | 'project' | 'saved'

export interface GeminiKeyStatus {
  activeSource: GeminiKeySource
  environmentConfigured: boolean
  projectConfigured: boolean
  environmentLabel: string
  projectLabel: string
  savedLabel: string | null
  secureStorageAvailable: boolean
}

export interface SaveGeminiKeyRequest {
  label: string
  apiKey: string
}

export interface ReplicatedVoiceRecord {
  id: string
  displayName: string
  model: GeminiModel
  createdAt: string
  expiresAt?: string
}

export interface GeminiVoiceProfile {
  replicatedVoice: ReplicatedVoiceRecord | null
  selectedVoiceId: string
}

export type GeminiVoiceProfiles = Record<GeminiKeySource, GeminiVoiceProfile>

export interface CreateReplicatedVoiceRequest {
  displayName: string
  sourceAudio: Uint8Array
  consentAudio: Uint8Array
  consentConfirmed: boolean
}

export type VoiceReference =
  | { mode: 'prebuilt'; voiceId: string }
  | { mode: 'stateful'; voiceId: string }
  | { mode: 'stateless'; voiceKey: string; expiresAt?: string }

export interface SynthesisRequest {
  providerId: ProviderId
  modelId: string
  text: string
  voice: VoiceReference
  style?: string
}

export interface SynthesizedAudio {
  data: Uint8Array
  mimeType: string
  durationSeconds?: number
  generationMs: number
}

export interface StreamedAudioResult {
  generationMs: number
}

export interface TtsProvider {
  readonly id: ProviderId
  readonly displayName: string
  validateConfiguration(): Promise<{ ready: boolean; message: string }>
  listVoices(): Promise<VoiceReference[]>
  synthesize(request: SynthesisRequest, signal: AbortSignal): Promise<SynthesizedAudio>
}

export interface AppSettings {
  schemaVersion: 1
  providerId: ProviderId
  geminiModel: GeminiModel
  geminiKeySource: GeminiKeySource
  geminiVoiceId: string
  replicatedVoice: ReplicatedVoiceRecord | null
  voiceProfiles: GeminiVoiceProfiles
  outputDeviceId: string
  outputVolume: number
  monitorDeviceId: string
  saveScriptHistory: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 1,
  providerId: 'gemini',
  geminiModel: 'gemini-3.8-flash-tts',
  geminiKeySource: 'environment',
  geminiVoiceId: 'Kore',
  replicatedVoice: null,
  voiceProfiles: {
    environment: { replicatedVoice: null, selectedVoiceId: 'Kore' },
    project: { replicatedVoice: null, selectedVoiceId: 'Kore' },
    saved: { replicatedVoice: null, selectedVoiceId: 'Kore' }
  },
  outputDeviceId: 'default',
  outputVolume: 0.85,
  monitorDeviceId: '',
  saveScriptHistory: false
}

export interface AppInfo {
  electron: string
  node: string
  platform: string
  geminiConfigured: boolean
}

export interface ProviderStatus {
  ready: boolean
  message: string
}

export interface ConversationModeStatus {
  enabled: boolean
  globalShortcutAvailable: boolean
}

export interface VoiceProfileExportResult {
  fileName: string
}

export interface DesktopApi extends OutlierApi {
  getAppInfo(): Promise<AppInfo>
  getSettings(): Promise<AppSettings>
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  getGeminiKeyStatus(): Promise<GeminiKeyStatus>
  saveGeminiKey(request: SaveGeminiKeyRequest): Promise<GeminiKeyStatus>
  selectGeminiKey(source: GeminiKeySource): Promise<AppSettings>
  removeGeminiKey(): Promise<AppSettings>
  checkGemini(): Promise<ProviderStatus>
  createReplicatedVoice(request: CreateReplicatedVoiceRequest): Promise<AppSettings>
  exportVoiceProfile(): Promise<VoiceProfileExportResult | null>
  importVoiceProfile(): Promise<AppSettings | null>
  synthesize(request: SynthesisRequest): Promise<SynthesizedAudio>
  synthesizeStream(request: SynthesisRequest, onChunk: (chunk: Uint8Array) => void): Promise<StreamedAudioResult>
  stopGeneration(): Promise<void>
  setConversationMode(enabled: boolean): Promise<ConversationModeStatus>
  onConversationRequested(callback: () => void): () => void
  onStopRequested(callback: () => void): () => void
}
