(() => {
  if (globalThis.__nebOutlierLoaded) return
  globalThis.__nebOutlierLoaded = true
  let documentId = crypto.randomUUID()
  let url = location.href
  let field = null
  let armed = false
  let associated = false
  const invalidate = (reason = 'destination') => {
    if (reason === 'focus' ? armed : armed || associated) {
      if (reason !== 'focus') { armed = false; associated = false }
      chrome.runtime.sendMessage({ kind: 'invalidated', reason, documentId, url }).catch(() => undefined)
    }
  }
  function snapshot(message) {
    if (message.action === 'associate') {
      invalidate()
      field = null
      armed = false
      associated = false
      url = location.href
      documentId = crypto.randomUUID()
      // Audio association identifies the document; only insertion needs a Rationale.
      const candidates = document.querySelectorAll('textarea[data-track="comment:notes"]')
      field = candidates.length === 1 ? candidates[0] : null
      associated = true
      return { documentId, url, value: field?.value, focused: false }
    }
    const candidates = document.querySelectorAll('textarea[data-track="comment:notes"]')
    if (candidates.length !== 1) throw new Error('Serve esattamente un campo Rationale nel documento principale.')
    const candidate = candidates[0]
    if (field && field !== candidate) throw new Error('Il campo Rationale è stato sostituito. Collega di nuovo la scheda.')
    field = candidate
    if (field.disabled || field.readOnly || !field.isConnected || field.getClientRects().length === 0) throw new Error('Il Rationale non è disponibile o modificabile.')
    if (location.href !== url || (message.documentId && message.documentId !== documentId) || (message.url && message.url !== url)) throw new Error('Il documento è cambiato. Collega di nuovo la scheda.')
    function autoScroll() {
      try {
        if (field && typeof field.scrollHeight === 'number') {
          field.scrollTop = field.scrollHeight
        }
      } catch { /* ignore */ }
    }
    if (message.action === 'prepare') {
      if (field.value !== message.expected) throw new Error('Il campo contiene testo inatteso. Non verrà sovrascritto.')
      field.scrollIntoView({ block: 'center' })
      field.focus()
      field.setSelectionRange(field.value.length, field.value.length)
      autoScroll()
      armed = true
    } else if (message.action === 'snapshot') {
      autoScroll()
    }
    return { documentId, url, value: field.value, focused: document.hasFocus() && document.activeElement === field && document.visibilityState === 'visible', selectionStart: field.selectionStart, selectionEnd: field.selectionEnd }
  }
  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (!['associate', 'inspect', 'prepare', 'snapshot'].includes(message.action)) return
    try { reply(snapshot(message)) } catch (error) { reply({ error: error.message }) }
  })
  document.addEventListener('focusout', () => { if (document.activeElement !== field) invalidate('focus') })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') invalidate('focus') })
  addEventListener('blur', () => invalidate('focus'))
  addEventListener('pagehide', () => invalidate())
  addEventListener('popstate', () => invalidate())
  addEventListener('hashchange', () => invalidate())
  new MutationObserver(() => {
    if ((armed || associated) && location.href !== url) { invalidate('destination'); return }
    if (field && (armed || associated)) {
      const candidates = document.querySelectorAll('textarea[data-track="comment:notes"]')
      if (!field.isConnected || candidates.length !== 1 || candidates[0] !== field) invalidate('destination')
    }
  }).observe(document, { childList: true, subtree: true })
  if (typeof setInterval === 'function') {
    setInterval(() => {
      if ((armed || associated) && location.href !== url) invalidate('destination')
      if (associated) {
        chrome.runtime.sendMessage({ kind: 'heartbeat' }).catch(() => undefined)
      }
    }, 10000)
  }
})()
