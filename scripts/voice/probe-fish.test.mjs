import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseProbeArgs, probeFish, validateReferenceWav, readBoundedFile } from './probe-fish.mjs'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('bounded local reads refuse oversized files and directories', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'neb-fish-probe-'))
  try {
    const file = join(dir, 'reference.wav')
    await writeFile(file, Buffer.alloc(100))
    await assert.rejects(readBoundedFile(file, 20), /limite|file/i)
    await assert.rejects(readBoundedFile(dir, 200), /file/i)
    assert.equal((await readBoundedFile(file, 100)).length, 100)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

function wav(rate = 24000, seconds = 5) {
  const bytes = Buffer.alloc(44 + rate * seconds * 2)
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36); bytes.writeUInt32LE(bytes.length - 44, 40)
  return bytes
}

test('validates reference WAV structure and duration before any upload', () => {
  for (const rate of [16000, 24000, 44100, 48000]) assert.equal(validateReferenceWav(wav(rate)).sampleRate, rate)
  const stereo = wav(); stereo.writeUInt16LE(2, 22)
  const truncated = wav().subarray(0, 100)
  const float = wav(); float.writeUInt16LE(3, 20)
  const odd = wav(); odd.writeUInt32LE(3, 40)
  for (const input of [stereo, truncated, float, odd, wav(24000, 4), wav(24000, 61)]) assert.throws(() => validateReferenceWav(input), /WAV/)
})

test('requires explicit consent and an explicit reference or preset-only choice', () => {
  assert.throws(() => parseProbeArgs(['--preset-only']), /consenso/i)
  assert.throws(() => parseProbeArgs(['--consent']), /riferimento/i)
  assert.throws(() => parseProbeArgs(['--consent', '--preset-only', '--reference', 'x']), /riferimento/i)
  assert.throws(() => parseProbeArgs(['--consent', '--preset-only', '--unknown']), /argomento/i)
  assert.equal(parseProbeArgs(['--consent', '--preset-only']).model, 'fish-audio/s2.1-pro-free:free')
  assert.equal(parseProbeArgs(['--consent', '--preset-only', '--paid']).model, 'fish-audio/s2.1-pro')
})

test('rejects invalid reference or missing consent before fetching', async () => {
  let calls = 0
  const fetchImpl = async () => { calls++; throw Error('should not fetch') }
  await assert.rejects(probeFish({ apiKey: 'fixture', presetOnly: true, consent: false }, { fetchImpl }), /consenso/i)
  await assert.rejects(probeFish({ apiKey: 'fixture', consent: true, reference: Buffer.from('invalid'), transcript: 'hello' }, { fetchImpl }), /WAV/)
  assert.equal(calls, 0)
})

test('streams Free metadata without claiming an unverified format or retaining samples', async () => {
  let body
  const result = await probeFish({ apiKey: 'fixture', presetOnly: true, consent: true }, { fetchImpl: async (_url, options) => {
    body = JSON.parse(options.body)
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.enqueue(new Uint8Array([2, 3, 4])); controller.close() } }), { headers: { 'content-type': 'audio/pcm' } })
  } })
  assert.equal(body.model, 'fish-audio/s2.1-pro-free:free')
  assert.equal(body.response_format, 'pcm')
  assert.equal('input_references' in body, false)
  assert.equal(result.byteCount, 4)
  assert.equal(result.chunkCount, 2)
  assert.equal(result.formatVerified, false)
  assert.equal('audio' in result, false)
  assert(result.firstByteMs <= result.completedMs)
})

test('verifies the documented PCM encoding only with explicit mono rate and whole samples', async () => {
  for (const [contentType, length, verified] of [
    ['audio/pcm;rate=44100;channels=1', 4, true],
    ['audio/pcm; channels=1; rate=24000', 4, true],
    ['audio/pcm;rate=44100;channels=1', 3, false],
    ['audio/pcm;rate=44100;channels=2', 4, false],
    ['audio/pcm;rate=44100', 4, false],
    ['audio/pcm;rate=12345;channels=1', 4, false],
    ['audio/pcm;rate=44100;rate=24000;channels=1', 4, false],
    ['audio/pcm;rate=44100;channels=1;bits=32', 4, false]
  ]) {
    const result = await probeFish({apiKey: 'fixture', presetOnly: true, consent: true}, {
      fetchImpl: async () => new Response(new Uint8Array(length), {headers: {'content-type': contentType}})
    })
    assert.equal(result.formatVerified, verified, `${contentType}, ${length} bytes`)
  }
})

test('redacts provider and transport errors and never switches Free to paid', async () => {
  let calls = 0
  for (const fetchImpl of [async () => { calls++; return new Response('secret reference base64', { status: 429 }) }, async () => { calls++; throw Error('secret key in URL') }]) {
    await assert.rejects(probeFish({ apiKey: 'secret', presetOnly: true, consent: true }, { fetchImpl }), (error) => !/secret|base64|reference|URL/.test(error.message))
  }
  assert.equal(calls, 2)
})

test('rejects JSON and empty audio without reporting successful PCM', async () => {
  for (const response of [new Response('{}', { headers: { 'content-type': 'application/json' } }), new Response(new Uint8Array(), { headers: { 'content-type': 'audio/pcm' } })]) {
    await assert.rejects(probeFish({ apiKey: 'fixture', presetOnly: true, consent: true }, { fetchImpl: async () => response }), /formato|vuoto/i)
  }
})

test('bounds request timeout and cancels its signal', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let signal
  const result = probeFish({ apiKey: 'fixture', presetOnly: true, consent: true }, { fetchImpl: async (_url, options) => {
    signal = options.signal
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Error('secret network detail')), { once: true }))
  } })
  const rejection = assert.rejects(result, /timeout/)
  t.mock.timers.tick(15000)
  await rejection
  assert.equal(signal.aborted, true)
})

test('caps the downloaded response and cleans the reader', async () => {
  let cancelled = false
  await assert.rejects(probeFish({ apiKey: 'fixture', presetOnly: true, consent: true }, { fetchImpl: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(32 * 1024 * 1024 + 1)) },
    cancel() { cancelled = true }
  }), { headers: { 'content-type': 'audio/pcm' } }) }), /limite/)
  assert.equal(cancelled, true)
})
