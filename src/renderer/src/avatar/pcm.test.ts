import { expect, it } from 'vitest'
import { PcmResampler } from './pcm'

function pcm(values: number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 2), view = new DataView(bytes.buffer)
  values.forEach((value, i) => view.setInt16(i * 2, value, true)); return bytes
}
it('converts one second of 24 kHz PCM into one second of 16 kHz PCM', () => {
  const resampler = new PcmResampler()
  expect(resampler.push(pcm(Array(24000).fill(1000))).length).toBe(32000)
})
it('is invariant to input chunk boundaries and resets between utterances', () => {
  const input = pcm(Array.from({ length: 123 }, (_, i) => i * 100))
  const whole = new PcmResampler().push(input), streaming = new PcmResampler()
  const chunks = [input.subarray(0, 2), input.subarray(2, 40), input.subarray(40, 100), input.subarray(100)]
  expect(Uint8Array.from(chunks.flatMap((chunk) => Array.from(streaming.push(chunk))))).toEqual(whole)
  streaming.reset(); expect(streaming.push(input)).toEqual(whole)
})
it('rejects odd-byte and excessive buffers', () => {
  expect(() => new PcmResampler().push(new Uint8Array(3))).toThrow()
  expect(() => new PcmResampler().push(new Uint8Array(48_000 * 181))).toThrow()
})
