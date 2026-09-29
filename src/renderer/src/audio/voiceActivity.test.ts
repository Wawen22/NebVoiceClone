import { describe, expect, it } from 'vitest'
import { VoiceActivityDetector } from './voiceActivity'

describe('hands-free voice recording', () => {
  it('waits through quiet noise and a single loud click, then includes a lead-in when speech begins', () => {
    const detector = new VoiceActivityDetector('consent')
    for (let ms = 0; ms <= 850; ms += 50) detector.sample(0.002, ms)
    expect(detector.sample(0.04, 900).phase).toBe('waiting')
    expect(detector.sample(0.002, 950).phase).toBe('waiting')
    expect(detector.sample(0.03, 1200).phase).toBe('waiting')
    expect(detector.sample(0.03, 1250).phase).toBe('waiting')
    expect(detector.sample(0.03, 1300).phase).toBe('speaking')
    expect(detector.clipStartMs).toBe(900)
  })

  it('stops after sustained silence and trims the quiet tail', () => {
    const detector = new VoiceActivityDetector('consent')
    for (let ms = 0; ms <= 850; ms += 50) detector.sample(0.002, ms)
    for (let ms = 1200; ms <= 2000; ms += 50) detector.sample(0.03, ms)
    expect(detector.sample(0.002, 3000).phase).toBe('speaking')
    const finished = detector.sample(0.002, 4000)
    expect(finished.phase).toBe('finished')
    expect(finished.clip?.endMs).toBeLessThan(3000)
  })

  it('can be cancelled while waiting without saving a silent clip', () => {
    const detector = new VoiceActivityDetector('reference')
    for (let ms = 0; ms <= 850; ms += 50) detector.sample(0.002, ms)
    expect(detector.finishManually(1500)).toBeNull()
  })
})
