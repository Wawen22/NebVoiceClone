export const AVATAR_OUTPUT_MAX_FPS = 25
export const AVATAR_OUTPUT_MAX_DIMENSION = 720

export interface AvatarOutputStatus { enabled: boolean; available: boolean; viewers: number; error?: string }
export interface AvatarOutputFrame { generation: string; jpeg: Uint8Array }
export interface AvatarOutputApi {
  getAvatarOutputStatus(): Promise<AvatarOutputStatus>
  setAvatarOutputEnabled(enabled: boolean): Promise<AvatarOutputStatus>
  getAvatarOutputUrl(): Promise<string>
  beginAvatarOutput(): Promise<string>
  publishAvatarOutputFrame(frame: AvatarOutputFrame): Promise<boolean>
  clearAvatarOutput(generation: string): Promise<void>
}
