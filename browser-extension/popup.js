document.getElementById('extension-id').textContent = chrome.runtime.id
document.getElementById('associate').addEventListener('click', async () => {
  const status = document.getElementById('status')
  status.textContent = 'Collegamento…'
  try {
    const result = await chrome.runtime.sendMessage({ kind: 'associate' })
    status.textContent = result.error || ('Scheda associata: ' + result.title + '. Controlla lo stato in NEB.')
  } catch (error) { status.textContent = error.message }
})
