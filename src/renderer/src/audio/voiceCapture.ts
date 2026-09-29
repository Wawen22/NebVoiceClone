import { inspectWav, isGeminiReadyWav, type WavDetails } from '../../../shared/voiceReplication'

export interface PreparedVoiceAudio {
  name: string
  bytes: Uint8Array
  details: WavDetails
  converted: boolean
}

export async function prepareVoiceAudio(file: Blob, name: string, trim?: { startSeconds: number; endSeconds: number }): Promise<PreparedVoiceAudio> {
  const input = new Uint8Array(await file.arrayBuffer())
  try {
    const details = inspectWav(input)
    if (!trim && isGeminiReadyWav(details)) return { name, bytes: input, details, converted: false }
  } catch {
    // Browser decoders also accept microphone WebM and other local audio files.
  }
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer)
    if (!trim && decoded.duration > 35) throw new Error('Choose a clip no longer than 30 seconds.')
    const start = trim ? Math.max(0, Math.min(decoded.duration, trim.startSeconds)) : 0
    const end = trim ? Math.max(start, Math.min(decoded.duration, trim.endSeconds)) : decoded.duration
    if (end - start < 0.1) throw new Error('No speech was captured. Please record again.')
    const offline = new OfflineAudioContext(1, Math.ceil((end - start) * 24000), 24000)
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start(0, start, end - start)
    const rendered = await offline.startRendering()
    const samples = rendered.getChannelData(0)
    const bytes = new Uint8Array(44 + samples.length * 2)
    const view = new DataView(bytes.buffer)
    const writeTag = (offset: number, value: string): void => { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i) }
    writeTag(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); writeTag(8, 'WAVE')
    writeTag(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
    view.setUint16(22, 1, true); view.setUint32(24, 24000, true); view.setUint32(28, 48000, true)
    view.setUint16(32, 2, true); view.setUint16(34, 16, true)
    writeTag(36, 'data'); view.setUint32(40, samples.length * 2, true)
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]))
      view.setInt16(44 + i * 2, sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767), true)
    }
    return { name, bytes, details: inspectWav(bytes), converted: true }
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith('Choose a clip') || error.message.startsWith('No speech'))) throw error
    throw new Error('This audio file could not be decoded locally. Choose a readable WAV recording.')
  } finally {
    await context.close()
  }
}
