export const AVATAR_PRESETS = [
  { name: 'Fred', id: '1c6aa65c-d858-4721-a4d9-bda9fde03141' },
  { name: 'Mark', id: '804c347a-26c9-4dcf-bb49-13df4bed61e8' },
  { name: 'Tina', id: 'cace3ef7-a4c4-425d-a8cf-a5358eb0c427' }
] as const

export function parseAvatarFaceId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error('Face ID Simli non valido.')
  return value
}

export interface AvatarSessionToken { sessionToken: string; iceServers: RTCIceServer[] }
export interface AvatarSessionLimits { maxSessionLength: number; maxIdleTime: number }
export function parseAvatarSessionLimits(value: unknown): AvatarSessionLimits {
  if (value === undefined) return { maxSessionLength: 120, maxIdleTime: 30 }
  if (!value || typeof value !== 'object') throw new Error('Limiti sessione avatar non validi.')
  const limits = value as AvatarSessionLimits
  if (!Number.isInteger(limits.maxSessionLength) || limits.maxSessionLength < 120 || limits.maxSessionLength > 3600
    || !Number.isInteger(limits.maxIdleTime) || limits.maxIdleTime < 30 || limits.maxIdleTime > limits.maxSessionLength) throw new Error('Limiti sessione avatar non validi.')
  return { maxSessionLength: limits.maxSessionLength, maxIdleTime: limits.maxIdleTime }
}
export interface AvatarApi {
  getAvatarStatus(): Promise<{ configured: boolean }>
  createAvatarSession(faceId: string, limits?: AvatarSessionLimits): Promise<AvatarSessionToken>
}
