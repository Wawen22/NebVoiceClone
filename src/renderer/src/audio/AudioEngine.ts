export interface AudioOutput {
  deviceId: string
  label: string
}

export interface AudioEngine {
  listOutputs(): Promise<AudioOutput[]>
  load(file: File): Promise<number>
  loadBytes(data: Uint8Array, mimeType: string): Promise<number>
  beginStream(deviceId: string): Promise<void>
  appendPcm(chunk: Uint8Array): void
  finishStream(): number
  play(deviceId: string): Promise<void>
  stop(): void
  replay(deviceId: string): Promise<void>
  setVolume(volume: number): void
  dispose(): void
  onEnded(callback: () => void): void
}

export class BrowserAudioEngine implements AudioEngine {
  private readonly element = new Audio()
  private readonly streamElement = new Audio()
  private url: string | null = null
  private streamContext: AudioContext | null = null
  private streamOutput: MediaStreamAudioDestinationNode | null = null
  private nextChunkTime = 0
  private streamChunks: Uint8Array[] = []
  private streamBytes = 0
  private streamSources = new Set<AudioBufferSourceNode>()
  private streamComplete = false
  private endedCallback: () => void = () => {}

  async listOutputs(): Promise<AudioOutput[]> {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
      .filter((device) => device.kind === 'audiooutput')
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || (device.deviceId === 'default' ? 'System default' : `Output ${index + 1}`)
      }))
  }

  async load(file: File): Promise<number> {
    if (file.type !== 'audio/wav' && !file.name.toLowerCase().endsWith('.wav')) {
      throw new Error('Choose a WAV audio file.')
    }
    return this.loadBlob(file)
  }

  async loadBytes(data: Uint8Array, mimeType: string): Promise<number> {
    if (mimeType !== 'audio/wav') throw new Error('Gemini returned an unsupported audio format.')
    return this.loadBlob(new Blob([Uint8Array.from(data).buffer], { type: mimeType }))
  }

  async beginStream(deviceId: string): Promise<void> {
    this.stop()
    const context = new AudioContext({ sampleRate: 24000 })
    this.streamContext = context
    const output = context.createMediaStreamDestination()
    this.streamOutput = output
    this.streamElement.srcObject = output.stream
    this.streamElement.volume = this.element.volume
    try {
      if (!('setSinkId' in this.streamElement)) throw new Error('This Electron build cannot choose an audio output device.')
      if (this.streamElement.sinkId !== deviceId) await this.streamElement.setSinkId(deviceId)
      await context.resume()
      await this.streamElement.play()
      this.nextChunkTime = context.currentTime
    } catch (error) {
      this.stop()
      throw error
    }
  }

  appendPcm(chunk: Uint8Array): void {
    const context = this.streamContext
    const output = this.streamOutput
    if (!context || !output || chunk.length === 0 || chunk.length % 2 !== 0) throw new Error('Invalid streaming audio data.')
    const copy = Uint8Array.from(chunk)
    this.streamChunks.push(copy)
    this.streamBytes += copy.length
    const samples = context.createBuffer(1, copy.length / 2, 24000)
    const channel = samples.getChannelData(0)
    const view = new DataView(copy.buffer)
    for (let index = 0; index < channel.length; index++) channel[index] = view.getInt16(index * 2, true) / 32768
    const source = context.createBufferSource()
    source.buffer = samples
    source.connect(output)
    this.streamSources.add(source)
    source.onended = () => {
      this.streamSources.delete(source)
      if (this.streamComplete && this.streamSources.size === 0) this.endedCallback()
    }
    const startAt = Math.max(this.nextChunkTime, context.currentTime + 0.04)
    source.start(startAt)
    this.nextChunkTime = startAt + samples.duration
  }

  finishStream(): number {
    if (this.streamBytes === 0) throw new Error('Gemini returned no audio.')
    const wav = new Uint8Array(44 + this.streamBytes)
    const view = new DataView(wav.buffer)
    const label = (offset: number, value: string): void => {
      for (let index = 0; index < value.length; index++) wav[offset + index] = value.charCodeAt(index)
    }
    label(0, 'RIFF')
    view.setUint32(4, 36 + this.streamBytes, true)
    label(8, 'WAVE')
    label(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, 24000, true)
    view.setUint32(28, 48000, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    label(36, 'data')
    view.setUint32(40, this.streamBytes, true)
    let offset = 44
    for (const chunk of this.streamChunks) {
      wav.set(chunk, offset)
      offset += chunk.length
    }
    this.streamChunks = []
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))
    this.element.src = this.url
    this.element.load()
    this.streamComplete = true
    if (this.streamSources.size === 0) queueMicrotask(() => {
      if (this.streamComplete && this.streamSources.size === 0) this.endedCallback()
    })
    return this.streamBytes / 48000
  }

  private async loadBlob(blob: Blob): Promise<number> {
    this.stop()
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = URL.createObjectURL(blob)
    this.element.src = this.url
    this.element.load()
    return await new Promise<number>((resolve, reject) => {
      this.element.onloadedmetadata = () => resolve(this.element.duration)
      this.element.onerror = () => reject(new Error('Could not read the WAV file.'))
    })
  }

  async play(deviceId: string): Promise<void> {
    if (!this.url) throw new Error('Select a WAV file first.')
    if (!('setSinkId' in this.element)) throw new Error('This Electron build cannot choose an audio output device.')
    if (this.element.sinkId !== deviceId) await this.element.setSinkId(deviceId)
    await this.element.play()
  }

  stop(): void {
    this.element.pause()
    this.element.currentTime = 0
    this.streamComplete = false
    for (const source of this.streamSources) source.stop()
    this.streamSources.clear()
    this.streamElement.pause()
    this.streamElement.srcObject = null
    if (this.streamContext) void this.streamContext.close()
    this.streamContext = null
    this.streamOutput = null
    this.streamChunks = []
    this.streamBytes = 0
    this.nextChunkTime = 0
  }

  async replay(deviceId: string): Promise<void> {
    this.stop()
    await this.play(deviceId)
  }

  setVolume(volume: number): void {
    this.element.volume = Math.min(1, Math.max(0, volume))
    this.streamElement.volume = this.element.volume
  }

  onEnded(callback: () => void): void {
    this.element.onended = callback
    this.endedCallback = callback
  }

  dispose(): void {
    this.stop()
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = null
    this.element.removeAttribute('src')
    this.element.load()
  }
}
