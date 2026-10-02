import { expect, it } from 'vitest'
import { pcmLevel, freshVoiceLevel } from './voiceActivity'

it('measures actual PCM amplitude and returns silence for stale audio', () => {
  const pcm = new Uint8Array(3200), view = new DataView(pcm.buffer)
  for (let i = 0; i < 1600; i++) view.setInt16(i * 2, 16384, true)
  expect(pcmLevel(pcm)).toBe(0.5)
  expect(pcmLevel(new Uint8Array(3200))).toBe(0)
  expect(freshVoiceLevel({ level: 0.5, at: 1000 }, 1100)).toBe(0.5)
  expect(freshVoiceLevel({ level: 0.5, at: 1000 }, 1300)).toBe(0)
})
