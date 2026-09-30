let port = null
let target = null
function connect() {
  if (port) return port
  port = chrome.runtime.connectNative('com.nebvoice.outlier')
  port.onDisconnect.addListener(() => { const error = chrome.runtime.lastError; void error; port = null; target = null })
  port.onMessage.addListener(async (message) => {
    if (message.kind !== 'browser') return
    const response = { kind: 'reply', requestId: message.requestId }
    try {
      if (Date.now() > message.deadline) throw new Error('Richiesta scaduta.')
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
      if (!window.focused) throw new Error('Finestra Edge non in primo piano (focus perso).')
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
  if (message.kind === 'invalidated' && sender.tab?.id === target?.tabId) { port?.postMessage({ kind: 'invalidated', reason: message.reason === 'focus' ? 'focus' : 'destination' }); return }
  if (message.kind !== 'associate' || sender.tab) return
  ;(async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const tab = tabs[0]
      if (!tab?.id || !/^(https?:\/\/|file:\/\/)/.test(tab.url || '')) throw new Error('Apri la task S2S o la demo locale.')
      await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, files: ['content.js'] })
      const snapshot = await chrome.tabs.sendMessage(tab.id, { action: 'associate' }, { frameId: 0 })
      if (snapshot.error) throw new Error(snapshot.error)
      target = { tabId: tab.id, windowId: tab.windowId, documentId: snapshot.documentId, url: snapshot.url, title: (tab.title || 'S2S').slice(0, 500) }
      connect().postMessage({ kind: 'associated', target })
      reply({ ok: true, title: target.title })
    } catch (error) { reply({ error: error.message }) }
  })()
  return true
})
chrome.tabs.onRemoved.addListener((id) => { if (id === target?.tabId) { port?.postMessage({ kind: 'invalidated' }); target = null } })
chrome.tabs.onUpdated.addListener((id, change) => { if (id === target?.tabId && (change.status === 'loading' || (change.url && change.url !== target.url))) { port?.postMessage({ kind: 'invalidated' }); target = null } })
