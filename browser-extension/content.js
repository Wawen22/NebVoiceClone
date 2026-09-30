(() => {
  if (globalThis.__nebOutlierLoaded) return
  globalThis.__nebOutlierLoaded = true
  let documentId = crypto.randomUUID()
  let url = location.href
  let field = null
  let armed = false
  const invalidate = (reason = 'destination') => {
    if (armed) { if (reason !== 'focus') armed = false; chrome.runtime.sendMessage({ kind: 'invalidated', reason }).catch(() => undefined) }
  }
  function snapshot(message) {
    if (message.action === 'associate') {
      invalidate()
      field = null
      armed = false
      url = location.href
      documentId = crypto.randomUUID()
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
  new MutationObserver(() => {
    if (field && (!field.isConnected || document.querySelectorAll('textarea[data-track="comment:notes"]')[0] !== field)) invalidate()
  }).observe(document, { childList: true, subtree: true })
})()
