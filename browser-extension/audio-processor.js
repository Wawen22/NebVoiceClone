/* Downmix is performed by AudioWorkletNode's explicit mono channel configuration.
   Box averaging prevents selecting just every third sample at 48kHz. */
class NEBAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.phase = 0
    this.sum = 0
    this.count = 0
    this.offset = 0
    this.bytes = new ArrayBuffer(3200)
    this.view = new DataView(this.bytes)
  }
  process(inputs) {
    const channel = inputs[0]?.[0]
    if (!channel) return true
    for (const sample of channel) {
      this.sum += sample
      this.count++
      this.phase += 16000
      if (this.phase < sampleRate) continue
      this.phase -= sampleRate
      const value = Math.max(-1, Math.min(1, this.sum / this.count))
      this.view.setInt16(this.offset, Math.max(-32768, Math.min(32767, Math.round(value * 32768))), true)
      this.offset += 2
      this.sum = 0
      this.count = 0
      if (this.offset === 3200) {
        this.port.postMessage(this.bytes, [this.bytes])
        this.offset = 0
        this.bytes = new ArrayBuffer(3200)
        this.view = new DataView(this.bytes)
      }
    }
    return true
  }
}
registerProcessor('neb-audio', NEBAudioProcessor)
