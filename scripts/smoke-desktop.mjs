// Manual integration check. This makes one real Gemini TTS request.
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const page = targets.find((target) => target.type === 'page' && target.title === 'NEB Voice Console')
if (!page) throw new Error('NEB Voice Console page not found')

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

let sequence = 0
function evaluate(expression) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    const onMessage = (event) => {
      const response = JSON.parse(event.data)
      if (response.id !== id) return
      socket.removeEventListener('message', onMessage)
      if (response.error || response.result.exceptionDetails) reject(new Error('Desktop evaluation failed'))
      else resolve(response.result.result.value)
    }
    socket.addEventListener('message', onMessage)
    socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }))
  })
}

try {
  const connected = await evaluate('document.body.innerText.includes("Gemini connected")')
  if (!connected) throw new Error('Gemini is not connected in the desktop app')
  await evaluate(`(() => {
    const field = document.querySelector('textarea')
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field, 'This is a short standard voice test.')
    field.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await new Promise((resolve) => setTimeout(resolve, 200))
  const enabled = await evaluate('!document.querySelector(".primary").disabled')
  if (!enabled) throw new Error('SPEAK did not become enabled')
  await evaluate('document.querySelector(".primary").click(); true')

  let result = null
  for (let attempt = 0; attempt < 90; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    result = await evaluate('({metrics:document.querySelector(".metrics")?.innerText, error:document.querySelector(".notice.error")?.innerText, status:document.querySelector(".notice")?.innerText})')
    if (result.metrics || result.error) break
  }
  if (!result?.metrics) throw new Error(result?.error || 'Gemini audio did not arrive within 90 seconds')
  console.log(`Desktop synthesis completed. ${result.metrics.replaceAll('\n', ' · ')}`)
  console.log(`Playback status: ${result.status}`)
} finally {
  socket.close()
}
