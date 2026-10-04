import { memo, useEffect, useRef, useState } from 'react'
import { ArrowDown, AudioLines } from 'lucide-react'
import type { LivePhase, LiveUtterance } from './controller'

export function liveTimestamp(atMs: number): string {
  const seconds = Math.max(0, Math.floor(atMs / 1000))
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

// The audio meter changes frequently; unchanged history should keep its own render and scroll state.
export const LiveTranscript = memo(function LiveTranscript({ history, opening, phase }: { history: LiveUtterance[]; opening: boolean; phase: LivePhase }): React.JSX.Element {
  const viewport = useRef<HTMLDivElement>(null)
  const [following, setFollowing] = useState(true)
  useEffect(() => { if (!history.length) setFollowing(true) }, [history])
  useEffect(() => {
    const node = viewport.current
    if (following && node) node.scrollTop = node.scrollHeight
  }, [history, following, phase])
  const preparing = ['thinking', 'ready', 'preparing-voice'].includes(phase)
  return <div className="neb-live-transcript-wrap">
    <div ref={viewport} className="neb-live-transcript" role="log" aria-label="Trascrizione della conversazione" aria-live="polite" aria-relevant="additions text" tabIndex={0}
      onScroll={() => { const node = viewport.current; if (node) setFollowing(node.scrollHeight - node.scrollTop - node.clientHeight < 70) }}>
      <div className="neb-live-timeline">
        {!history.length && <div className="neb-live-empty">
          <span className="neb-live-empty-icon"><AudioLines size={32} /></span>
          <span className="eyebrow">LA TUA VOCE, IL TUO CONTESTO</span>
          <h4>Spazio alla conversazione.</h4>
          <p>{opening ? 'NEB inizierà con un breve saluto, poi ascolterà l’interlocutore.' : 'Avvia quando sei pronto. NEB ascolterà l’interlocutore e risponderà con la tua voce.'}</p>
          <small>Scegli il profilo qui sopra. Puoi personalizzarlo da Configura.</small>
        </div>}
        {history.map((item) => <article key={item.id} className={`neb-live-turn neb-live-turn-${item.role}`}>
          <header><strong>{item.role === 'neb' ? 'NEB' : 'Interlocutore'}</strong><time>{liveTimestamp(item.atMs)}</time>{item.partial && <span className="neb-live-partial">Interrotto · parziale</span>}</header>
          <p dir="auto">{item.text}</p>
        </article>)}
        {preparing && <div className="neb-live-preparing" role="status"><span /><span /><span /><small>{phase === 'thinking' ? 'NEB prepara la risposta' : 'La tua voce sta arrivando'}</small></div>}
      </div>
    </div>
    {!following && history.length > 0 && <button type="button" className="neb-live-follow" onClick={() => setFollowing(true)}><ArrowDown size={14} />Vai all’ultimo turno</button>}
  </div>
})
