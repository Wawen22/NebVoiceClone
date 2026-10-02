import { useEffect, useRef } from 'react'
import { freshVoiceLevel, type VoiceActivity, type VoiceSpeaker } from './voiceActivity'

export function VoiceWave({ speaker, enabled, getActivity }: { speaker: VoiceSpeaker; enabled: boolean; getActivity: (speaker: VoiceSpeaker) => VoiceActivity }): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = canvas.current, context = element?.getContext('2d')
    if (!element || !context) return
    const history = Array<number>(64).fill(0)
    let frame = 0, lastSample = -Infinity
    const draw = (now: number): void => {
      if (now - lastSample >= 70) {
        const level = enabled ? freshVoiceLevel(getActivity(speaker), now) : 0
        history.shift(); history.push(level)
        element.dataset.level = String(level)
        lastSample = now
      }
      const width = element.clientWidth || 300, height = 52, ratio = Math.min(devicePixelRatio || 1, 2)
      if (element.width !== Math.round(width * ratio)) { element.width = Math.round(width * ratio); element.height = height * ratio }
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)
      context.fillStyle = speaker === 'neb' ? '#82b9ff' : '#68e5c8'
      const step = width / history.length
      history.forEach((level, index) => {
        const amplitude = Math.max(2, Math.min(46, Math.sqrt(level) * 90))
        context.globalAlpha = level >= 0.008 ? 0.9 : 0.25
        context.fillRect(index * step, (height - amplitude) / 2, Math.max(1, step - 3), amplitude)
      })
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [enabled, getActivity, speaker])
  return <canvas ref={canvas} className="s2s-wave" aria-label={`Onde audio ${speaker === 'neb' ? 'NEB' : 'MODEL A'}`} role="img" />
}
