document.getElementById('extension-id').textContent = chrome.runtime.id
document.getElementById('associate').addEventListener('click', async () => {
  const status = document.getElementById('status')
  status.textContent = 'Collegamento…'
  try {
    const result = await chrome.runtime.sendMessage({ kind: 'associate' })
    status.textContent = result.error || ('Scheda associata: ' + result.title + '. Controlla lo stato in NEB.')
  } catch (error) { status.textContent = error.message }
})
for (const kind of ['audio-start', 'audio-stop']) {
  document.getElementById(kind).addEventListener('click', async () => {
    const status = document.getElementById('status')
    status.textContent = kind === 'audio-start' ? 'Avvio ascolto…' : 'Arresto ascolto…'
    try {
      const result = await chrome.runtime.sendMessage({ kind })
      status.textContent = result.error || (kind === 'audio-start' ? 'Ascolto attivo. Torna alle Battute Pronte in NEB.' : 'Ascolto fermato.')
    } catch (error) { status.textContent = error.message }
  })
}
