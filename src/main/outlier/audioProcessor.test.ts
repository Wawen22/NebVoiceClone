import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'

function processor(rate: number) {
  const chunks: ArrayBuffer[] = []
  let Processor: any
  runInNewContext(readFileSync('browser-extension/audio-processor.js', 'utf8'), {
    sampleRate: rate, AudioWorkletProcessor: class { port = { postMessage: (chunk: ArrayBuffer) => chunks.push(chunk) } },
    registerProcessor: (_name: string, value: any) => { Processor = value }
  })
  return { instance: new Processor(), chunks }
}

it('downsamples 48kHz audio into 100ms mono 16-bit 16kHz chunks', () => {
  const { instance, chunks } = processor(48000)
  for (let i = 0; i < 4800; i += 128) instance.process([[new Float32Array(Math.min(128, 4800 - i)).fill(0.25)]])
  expect(chunks).toHaveLength(1)
  const data = new DataView(chunks[0])
  expect(data.byteLength).toBe(3200)
  expect(data.getInt16(0, true)).toBe(8192)
  expect(data.getInt16(3198, true)).toBe(8192)
})

it('emits silence continuously and clips out-of-range samples at 44.1kHz', () => {
  const { instance, chunks } = processor(44100)
  instance.process([[new Float32Array(4410)]])
  instance.process([[new Float32Array(4410).fill(2)]])
  expect(chunks).toHaveLength(2)
  expect(new DataView(chunks[0]).getInt16(0, true)).toBe(0)
  expect(new DataView(chunks[1]).getInt16(0, true)).toBe(32767)
})
