import { describe, expect, it } from 'vitest'
import { inspectWav, parseCreateReplicatedVoiceRequest } from './voiceReplication'

function wav(seconds: number, sampleRate = 24000): Uint8Array {
  const dataBytes = seconds * sampleRate * 2
  const bytes = new Uint8Array(44 + dataBytes)
  const view = new DataView(bytes.buffer)
  for (const [at, tag] of [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']] as const) for (let i = 0; i < 4; i++) bytes[at + i] = tag.charCodeAt(i)
  view.setUint32(4, bytes.length - 8, true); view.setUint32(16, 16, true)
  view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); view.setUint32(40, dataBytes, true)
  return bytes
}

describe('replicated voice upload boundary', () => {
  it('reads PCM WAV format and checks consent before upload', () => {
    expect(inspectWav(wav(10))).toMatchObject({ durationSeconds: 10, sampleRate: 24000, channels: 1, bitsPerSample: 16 })
    const request = { displayName: 'My voice', sourceAudio: wav(10), consentAudio: wav(3), consentConfirmed: false }
    expect(() => parseCreateReplicatedVoiceRequest(request)).toThrow('Confirm')
    expect(parseCreateReplicatedVoiceRequest({ ...request, consentConfirmed: true }).displayName).toBe('My voice')
  })

  it('rejects short, wrong-format, and incomplete recordings', () => {
    const request = { displayName: 'My voice', sourceAudio: wav(9), consentAudio: wav(3), consentConfirmed: true }
    expect(() => parseCreateReplicatedVoiceRequest(request)).toThrow('10 to 30')
    expect(() => parseCreateReplicatedVoiceRequest({ ...request, sourceAudio: wav(10, 48000) })).toThrow('24 kHz')
    expect(() => inspectWav(new Uint8Array(44))).toThrow('RIFF/WAV')
  })
})
