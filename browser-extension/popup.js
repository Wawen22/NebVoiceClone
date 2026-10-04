document.getElementById('extension-id').textContent = chrome.runtime.id
async function showConnectionStatus() {
  const status = document.getElementById('status')
  try {
    const result = await chrome.runtime.sendMessage({ kind: 'audio-status' })
    status.textContent = result.error || (result.active
      ? 'Ascolto attivo. Torna a NEB Live o S2S in NEB.'
      : result.connected ? 'Scheda collegata: ' + result.title + '. Premi Ascolta questa scheda.'
        : 'Premi Collega questa scheda, poi Ascolta questa scheda.')
  } catch (error) { status.textContent = error.message }
}
void showConnectionStatus()
document.getElementById('associate').addEventListener('click', async () => {
  const status = document.getElementById('status')
  status.textContent = 'Collegamento…'
  try {
    const result = await chrome.runtime.sendMessage({ kind: 'associate' })
    status.textContent = result.error || ('Scheda collegata a NEB: ' + result.title + '. Premi Ascolta questa scheda.')
  } catch (error) { status.textContent = error.message }
})
for (const kind of ['audio-start', 'audio-stop']) {
  document.getElementById(kind).addEventListener('click', async () => {
    const status = document.getElementById('status')
    status.textContent = kind === 'audio-start' ? 'Avvio ascolto…' : 'Arresto ascolto…'
    try {
      const result = await chrome.runtime.sendMessage({ kind })
      status.textContent = result.error || (kind === 'audio-start' ? 'Ascolto attivo. Torna a NEB Live o S2S in NEB.' : 'Ascolto fermato.')
    } catch (error) { status.textContent = error.message }
  })
}
