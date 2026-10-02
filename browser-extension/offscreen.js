let session = null

async function emit(operation, fields) {
  return chrome.runtime.sendMessage({ kind: 'audio-frame', captureId: operation.id, ...fields })
}
function stop(operation = session) {
  if (!operation) return
  operation.cancelled = true
  if (session === operation) session = null
  if (operation.node) operation.node.port.onmessage = null
  operation.stream?.getTracks().forEach((track) => track.stop())
  if (operation.context) void operation.context.close().catch(() => undefined)
}

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message.destination !== 'offscreen') return
  if (message.action === 'audio-stop') {
    if (session?.id === message.captureId) stop()
    reply({ ok: true })
    return
  }
  if (message.action !== 'audio-start') return
  const operation = { id: message.captureId, cancelled: false, stream: null, context: null, node: null }
  stop()
  session = operation
  ;(async () => {
    try {
      operation.stream = await navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: message.streamId } } })
      if (operation.cancelled) { stop(operation); return reply({ error: 'Ascolto annullato.' }) }
      operation.context = new AudioContext()
      await operation.context.audioWorklet.addModule('audio-processor.js')
      if (operation.cancelled) { stop(operation); return reply({ error: 'Ascolto annullato.' }) }
      const source = operation.context.createMediaStreamSource(operation.stream)
      const node = new AudioWorkletNode(operation.context, 'neb-audio', { channelCount: 1, channelCountMode: 'explicit', numberOfOutputs: 1 })
      operation.node = node
      let sequence = 0
      let pending = 0
      const fail = (message) => {
        if (operation.cancelled) return
        void emit(operation, { state: 'error', message }).catch(() => undefined)
        stop(operation)
      }
      node.port.onmessage = (event) => {
        if (operation.cancelled) return
        if (++pending > 10) { fail('Trasporto audio in ritardo: riavvia l’ascolto.'); return }
        const pcm = btoa(String.fromCharCode(...new Uint8Array(event.data)))
        void emit(operation, { state: 'pcm', sequence: sequence++, pcm }).then((result) => {
          pending--
          if (!result?.ok) fail('Collegamento NEB non disponibile.')
        }).catch(() => fail('Collegamento NEB interrotto.'))
      }
      operation.stream.getAudioTracks()[0].addEventListener('ended', () => fail('Acquisizione della scheda terminata.'))
      operation.context.addEventListener('statechange', () => {
        if (operation.context.state === 'suspended') fail('Acquisizione audio sospesa dal browser.')
      })
      await operation.context.resume()
      await emit(operation, { state: 'active' })
      if (operation.cancelled) return reply({ error: 'Ascolto annullato.' })
      source.connect(operation.context.destination) // Preserve headphones playback.
      source.connect(node)
      node.connect(operation.context.destination) // Silent output keeps processing alive.
      reply({ ok: true })
    } catch (error) {
      if (!operation.cancelled) await emit(operation, { state: 'error', message: error.message }).catch(() => undefined)
      stop(operation)
      reply({ error: error.message })
    }
  })()
  return true
})
