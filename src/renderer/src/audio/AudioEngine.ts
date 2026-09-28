export interface AudioOutput {
  deviceId: string
  label: string
}

export interface AudioEngine {
  listOutputs(): Promise<AudioOutput[]>
  load(file: File): Promise<number>
  loadBytes(data: Uint8Array, mimeType: string): Promise<number>
  play(deviceId: string): Promise<void>
  stop(): void
  replay(deviceId: string): Promise<void>
  setVolume(volume: number): void
  dispose(): void
  onEnded(callback: () => void): void
}

export class BrowserAudioEngine implements AudioEngine {
  private readonly element = new Audio()
  private url: string | null = null

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
    if ((await this.listOutputs()).length === 0) throw new Error('No audio output device is available in this environment.')
    if (!('setSinkId' in this.element)) throw new Error('This Electron build cannot choose an audio output device.')
    await this.element.setSinkId(deviceId)
    await this.element.play()
  }

  stop(): void {
    this.element.pause()
    this.element.currentTime = 0
  }

  async replay(deviceId: string): Promise<void> {
    this.stop()
    await this.play(deviceId)
  }

  setVolume(volume: number): void {
    this.element.volume = Math.min(1, Math.max(0, volume))
  }

  onEnded(callback: () => void): void {
    this.element.onended = callback
  }

  dispose(): void {
    this.stop()
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = null
    this.element.removeAttribute('src')
    this.element.load()
  }
}
