import type { AvatarSessionToken } from '../../../shared/avatar'
import type { AvatarClient } from './session'

export async function createAvatarClient(token: AvatarSessionToken, video: HTMLVideoElement, audio: HTMLAudioElement): Promise<AvatarClient> {
  const { SimliClient, LogLevel } = await import('simli-client')
  return new SimliClient(token.sessionToken, video, audio, token.iceServers, LogLevel.CRITICAL, 'p2p')
}
