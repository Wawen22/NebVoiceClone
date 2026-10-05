import { expect, it } from 'vitest'
import { Pcm24kStream } from './pcmStream'
const encode = (samples: number[]): Uint8Array => {const b=Buffer.alloc(samples.length*2); samples.forEach((s,i)=>b.writeInt16LE(s,i*2)); return b}
it('produces identical 24k PCM for whole or single-byte fragmented input at every supported rate', () => {
  for (const rate of [8000,16000,24000,32000,44100,48000]) {
    const source=encode(Array.from({length:rate/10},(_,i)=>Math.round(15000*Math.sin(i*0.1))))
    const whole=new Pcm24kStream(rate), split=new Pcm24kStream(rate)
    const a=Buffer.concat([whole.push(source),whole.finish()])
    const chunks=[...source].map(byte=>split.push(new Uint8Array([byte])))
    const b=Buffer.concat([...chunks,split.finish()])
    expect(a.equals(b)).toBe(true); expect(a.length).toBe(4800)
  }
})
it('rejects invalid rate and trailing odd bytes and preserves 24k samples', () => {
  expect(()=>new Pcm24kStream(12345)).toThrow()
  const odd=new Pcm24kStream(44100); odd.push(new Uint8Array([1])); expect(()=>odd.finish()).toThrow()
  const same=new Pcm24kStream(24000), source=encode([100,-200,32767,-32768])
  expect(Buffer.concat([same.push(source),same.finish()]).equals(source)).toBe(true)
})
it('attenuates frequencies above the target Nyquist instead of aliasing them', () => {
  const input=encode(Array.from({length:4800},(_,i)=>Math.round(20000*Math.sin(2*Math.PI*18000*i/48000))))
  const filter=new Pcm24kStream(48000), result=Buffer.concat([filter.push(input),filter.finish()])
  const samples=Array.from({length:result.length/2-100},(_,i)=>result.readInt16LE((i+100)*2))
  expect(Math.sqrt(samples.reduce((sum,s)=>sum+s*s,0)/samples.length)).toBeLessThan(500)
})
