let port = null
let target = null
let capture = null
let pendingAssociation = null
let connectionError = null
let associating = false
function finishAssociation(error) {
  const pending = pendingAssociation
  if (!pending) return
  pendingAssociation = null
  clearTimeout(pending.timer)
  if (error) pending.reject(new Error(error))
  else pending.resolve()
}
function postNative(message) {
  try { port?.postMessage(message) } catch { /* Disconnect is handled separately. */ }
}
function stopCapture(message = 'Ascolto fermato.') {
  const previous = capture
  capture = null
  if (!previous) return
  postNative({ kind: 's2sAudio', state: 'stopped', captureId: previous.id, target: previous.target, message })
  void chrome.runtime.sendMessage({ destination: 'offscreen', action: 'audio-stop', captureId: previous.id }).catch(() => undefined)
}
function connect() {
  if (port) return port
  const connection = chrome.runtime.connectNative('com.nebvoice.outlier')
  port = connection
  connection.onDisconnect.addListener(() => {
    const detail = chrome.runtime.lastError?.message
    if (port !== connection) return
    connectionError = 'Collegamento a NEB interrotto.' + (detail ? ' ' + detail : '') + ' Apri NEB e premi Collega questa scheda.'
    stopCapture('NEB disconnesso.')
    port = null
    target = null
    finishAssociation(connectionError)
  })
  connection.onMessage.addListener(async (message) => {
    if (port !== connection) return
    if (message.kind === 'pong') return
    if (message.kind !== 'browser') return
    if (message.action === 'associated') {
      if (!pendingAssociation || pendingAssociation.id !== message.requestId) return
      const confirmed = message.payload?.target
      if (!target || !confirmed || ['tabId', 'windowId', 'documentId', 'url'].some((key) => confirmed[key] !== target[key])) {
        target = null
        finishAssociation('NEB ha confermato una scheda diversa. Collega nuovamente questa scheda.')
        return
      }
      connectionError = null
      finishAssociation()
      return
    }
    const response = { kind: 'reply', requestId: message.requestId }
    try {
      if (Date.now() > message.deadline) throw new Error('Richiesta scaduta.')
      if (message.action === 'audio-stop') {
        stopCapture()
        response.result = { stopped: true }
        postNative(response)
        return
      }
      const expectedTarget = message.payload.target
      if (!target || target.tabId !== expectedTarget.tabId || target.windowId !== expectedTarget.windowId || target.documentId !== expectedTarget.documentId || target.url !== expectedTarget.url) throw new Error('Destinazione non associata.')
      if (!['prepare', 'snapshot'].includes(message.action)) throw new Error('Operazione non disponibile.')
      if (message.action === 'prepare') {
        await chrome.windows.update(target.windowId, { focused: true })
        await chrome.tabs.update(target.tabId, { active: true })
      }
      const tab = await chrome.tabs.get(target.tabId)
      const window = await chrome.windows.get(target.windowId)
      if (!tab.active || tab.url !== target.url) throw new Error('Scheda o destinazione cambiata.')
      if (!window.focused) throw new Error('Finestra del browser non in primo piano (focus perso).')
      let snapshot = await chrome.tabs.sendMessage(target.tabId, { action: message.action, expected: message.payload.expected, documentId: target.documentId, url: target.url }, { frameId: 0 })
      // Activation may complete asynchronously. Wait only during preparation; never refocus during typing.
      if (message.action === 'prepare' && !snapshot.focused && !snapshot.error) {
        for (let attempt = 0; attempt < 10 && !snapshot.focused; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 50))
          snapshot = await chrome.tabs.sendMessage(target.tabId, { action: 'snapshot', documentId: target.documentId, url: target.url }, { frameId: 0 })
          if (snapshot.error) break
        }
      }
      if (snapshot.error) throw new Error(snapshot.error)
      if (Date.now() > message.deadline) throw new Error('Richiesta scaduta.')
      response.result = { ...snapshot, target }
    } catch (error) { response.error = error.message }
    try { port?.postMessage(response) } catch { /* Native disconnect stops NEB independently. */ }
  })
  return port
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.kind === 'audio-frame') {
    if (sender.tab || sender.url !== chrome.runtime.getURL('offscreen.html') || !capture || message.captureId !== capture.id) return
    postNative({ kind: 's2sAudio', state: message.state, captureId: capture.id, target: capture.target, sequence: message.sequence, pcm: message.pcm, message: message.message })
    if (message.state === 'error' || message.state === 'stopped') capture = null
    reply({ ok: true })
    return
  }
  if (['audio-start', 'audio-stop', 'audio-status'].includes(message.kind)) {
    if (sender.tab || sender.url !== chrome.runtime.getURL('popup.html')) return
    let operation = null
    ;(async () => {
      try {
        if (message.kind === 'audio-status') { reply({ active: Boolean(capture), connected: Boolean(target && port && !pendingAssociation), title: target?.title, error: connectionError }); return }
        if (message.kind === 'audio-stop') { stopCapture(); reply({ ok: true }); return }
        if (!target || !port) throw new Error(connectionError || 'Premi Collega questa scheda, poi Ascolta questa scheda.')
        if (pendingAssociation) throw new Error('Attendi la conferma del collegamento da NEB.')
        if (capture) throw new Error('Ascolto già attivo. Fermalo prima di ricominciare.')
        const selected = target
        operation = { id: crypto.randomUUID(), target: { ...selected } }
        capture = operation
        const check = () => { if (capture !== operation || target !== selected) throw new Error('Ascolto annullato o destinazione cambiata.') }
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        check()
        if (tabs[0]?.id !== target.tabId || tabs[0]?.url !== target.url) throw new Error('Apri la scheda associata prima di avviare l’ascolto.')
        const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })
        check()
        if (!contexts.length) await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['USER_MEDIA'], justification: 'Ascoltare l’audio della scheda associata per NEB Live o S2S.' })
        check()
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: selected.tabId })
        check()
        const result = await chrome.runtime.sendMessage({ destination: 'offscreen', action: 'audio-start', captureId: operation.id, streamId })
        if (result?.error) throw new Error(result.error)
        if (capture !== operation) throw new Error('Ascolto interrotto durante l’avvio.')
        reply({ ok: true })
      } catch (error) { if (operation && capture === operation) stopCapture(); reply({ error: error.message }) }
    })()
    return true
  }
  if (message.kind === 'heartbeat' && sender.tab?.id === target?.tabId) {
    try { port?.postMessage({ kind: 'ping' }) } catch { /* ignore */ }
    return
  }
  if (message.kind === 'invalidated' && sender.tab?.id === target?.tabId) {
    if (message.documentId && message.documentId !== target.documentId) return
    if (message.reason !== 'focus') stopCapture('Destinazione cambiata.')
    postNative({ kind: 'invalidated', reason: message.reason === 'focus' ? 'focus' : 'destination' })
    if (message.reason !== 'focus') { target = null; finishAssociation('La pagina è cambiata. Collega nuovamente questa scheda.') }
    return
  }
  if (message.kind !== 'associate' || sender.tab || sender.url !== chrome.runtime.getURL('popup.html')) return
  if (associating) { reply({ error: 'Collegamento in corso: attendi la conferma da NEB.' }); return }
  associating = true
  ;(async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const tab = tabs[0]
      if (!tab?.id || !/^(https?:\/\/|file:\/\/)/.test(tab.url || '')) throw new Error('Apri una pagina web HTTP(S), una task S2S o la demo locale.')
      await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, files: ['content.js'] })
      const snapshot = await chrome.tabs.sendMessage(tab.id, { action: 'associate' }, { frameId: 0 })
      if (snapshot.error) throw new Error(snapshot.error)
      stopCapture('Scheda associata nuovamente.')
      target = { tabId: tab.id, windowId: tab.windowId, documentId: snapshot.documentId, url: snapshot.url, title: (tab.title || 'Scheda browser').slice(0, 500) }
      const connection = connect()
      const id = crypto.randomUUID()
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          connectionError = 'NEB non ha confermato il collegamento. Riavvia NEB, ricarica l’estensione e riprova.'
          target = null
          finishAssociation(connectionError)
        }, 5000)
        pendingAssociation = { id, timer, resolve, reject }
        try { connection.postMessage({ kind: 'associated', requestId: id, target }) }
        catch (error) { target = null; connectionError = error.message; finishAssociation(connectionError) }
      })
      if (!target || port !== connection) throw new Error(connectionError || 'Collegamento a NEB interrotto.')
      reply({ ok: true, title: target.title })
    } catch (error) { reply({ error: error.message }) }
    finally { associating = false }
  })()
  return true
})
chrome.tabs.onRemoved.addListener((id) => { if (id === target?.tabId) { stopCapture('Scheda chiusa.'); postNative({ kind: 'invalidated' }); target = null; finishAssociation('Scheda chiusa.') } })
chrome.tabs.onUpdated.addListener((id, change) => { if (id === target?.tabId && (change.status === 'loading' || (change.url && change.url !== target.url))) { stopCapture('Navigazione della scheda.'); postNative({ kind: 'invalidated' }); target = null; finishAssociation('La pagina è cambiata. Collega nuovamente questa scheda.') } })
