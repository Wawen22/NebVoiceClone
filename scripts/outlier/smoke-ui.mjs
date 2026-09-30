import { createRequire } from 'node:module'
import path from 'node:path'
import assert from 'node:assert/strict'
const require = createRequire(path.resolve('.superpowers/outlier-smoke/package.json'))
const { _electron } = require('playwright')
const root = process.cwd()
const projectName = 'Progetto test locale ' + Date.now()
const env = { ...process.env, NEB_INSTANCE: 'outlier-review' }
delete env.ELECTRON_RUN_AS_NODE
delete env.GEMINI_API_KEY
delete env.GEMINI_API_KEY_NEBVOICCLONE
const app = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: [path.join(root, 'out/main/index.js')], env })
const page = await app.firstWindow()
try {
  await page.getByRole('button', { name: 'Outlier', exact: true }).click()
  await page.getByRole('heading', { name: 'I tuoi progetti Outlier' }).waitFor()
  await page.locator('#outlier-rationale').fill('Rationale personale: accenti è à, apostrofo l’ascolto.\n' + 'Testo mio. '.repeat(10))
  const draft = await page.locator('#outlier-rationale').inputValue()
  await page.getByRole('button', { name: 'Console', exact: true }).click()
  await page.getByRole('button', { name: 'Outlier', exact: true }).click()
  assert.equal(await page.locator('#outlier-rationale').inputValue(), draft)
  assert.equal(await page.getByRole('button', { name: 'Avvia inserimento' }).isDisabled(), true)
  await page.getByRole('button', { name: 'Conversazione e Battute', exact: true }).click()
  await page.getByRole('button', { name: /Modalità conversazione/ }).click()
  await page.getByRole('button', { name: /Esci dalla modalità/ }).click()
  await page.getByRole('button', { name: 'Rationale', exact: true }).click()
  assert.equal(await page.locator('#outlier-rationale').inputValue(), draft)
  await page.getByRole('button', { name: 'Nuovo progetto' }).click()
  await page.getByLabel('Nome', { exact: true }).fill(projectName)
  await page.getByLabel('Note personali').fill('Note di verifica')
  await page.getByRole('button', { name: 'Salva progetto', exact: true }).click()
  await page.getByRole('heading', { name: projectName, exact: true }).waitFor()
  await page.getByRole('button', { name: 'Archivia ' + projectName, exact: true }).click()
  await page.getByRole('button', { name: 'Ripristina ' + projectName, exact: true }).waitFor()
  await page.getByRole('button', { name: 'Ripristina ' + projectName, exact: true }).click()
  await page.getByRole('button', { name: 'Archivia ' + projectName, exact: true }).waitFor()
  await page.getByRole('button', { name: /S2S Conversazione/ }).click()
  await page.screenshot({ path: path.join(root, '.superpowers/outlier-smoke/outlier-ui.png') })
  console.log('PASS: Electron UI, draft survives navigation and compact voice mode, projects created/archived/restored, disconnected start disabled.')
} finally { await app.close() }
