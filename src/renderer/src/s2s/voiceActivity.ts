export interface VoiceActivity { level: number; at: number }
export type VoiceSpeaker = 'neb' | 'model'
export function pcmLevel(pcm: Uint8Array): number {
  if (!pcm.length || pcm.length % 2) return 0
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  let sum = 0
  for (let i = 0; i < pcm.length; i += 2) { const value = view.getInt16(i, true) / 32768; sum += value * value }
  return Math.sqrt(sum / (pcm.length / 2))
}
export function freshVoiceLevel(activity: VoiceActivity, now: number): number {
  return now - activity.at > 250 ? 0 : activity.level
}
