// A continuous 3:2 linear converter preserves phase across arbitrary TTS chunks.
export class PcmResampler {
  private inputIndex = 0
  private nextPosition = 0
  private previous = 0

  push(bytes: Uint8Array): Uint8Array {
    if (!(bytes instanceof Uint8Array) || bytes.length % 2 || bytes.length > 48_000 * 180) throw new Error('Audio avatar non valido.')
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), samples: number[] = []
    for (let i = 0; i < bytes.length; i += 2) {
      const current = view.getInt16(i, true), index = this.inputIndex++
      while (this.nextPosition <= index) {
        const fraction = this.nextPosition - (index - 1)
        samples.push(index === 0 ? current : Math.round(this.previous + fraction * (current - this.previous)))
        this.nextPosition += 1.5
      }
      this.previous = current
    }
    const result = new Uint8Array(samples.length * 2), output = new DataView(result.buffer)
    samples.forEach((sample, i) => output.setInt16(i * 2, sample, true))
    return result
  }

  reset(): void { this.inputIndex = 0; this.nextPosition = 0; this.previous = 0 }
}
