// Synthetic test audio; no personal reference data.
export function wav(rate = 24000, seconds = 5): Uint8Array {
  const bytes = new Uint8Array(44 + Math.round(rate * seconds) * 2)
  const view = new DataView(bytes.buffer)
  const tag = (text: string, at: number): void => bytes.set(new TextEncoder().encode(text), at)
  tag('RIFF', 0); view.setUint32(4, bytes.length - 8, true); tag('WAVEfmt ', 8)
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  tag('data', 36); view.setUint32(40, bytes.length - 44, true)
  return bytes
}
export const voiceInput = () => ({ displayName: 'Test', sourceAudio: wav(), transcript: 'A private transcript', consentConfirmed: true })
