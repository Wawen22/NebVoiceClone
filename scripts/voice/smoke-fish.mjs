import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

export function summarize(values) {
  if(values.some(value=>!Number.isFinite(value) || value<0)) throw Error('Invalid timing')
  const sorted=[...values].sort((a,b)=>a-b), count=sorted.length
  return {count,medianMs:count ? count%2 ? sorted[Math.floor(count/2)] : (sorted[count/2-1]+sorted[count/2])/2 : null,maxMs:count ? sorted[count-1] : null}
}
export const standardTranscript='Ciao, sono qui per provare la mia voce digitale. Vorrei che mantenesse il mio timbro, il mio ritmo e il mio modo naturale di parlare. Durante una conversazione posso parlare con calma, fare una pausa e poi riprendere. Questa registrazione servirà a confrontare la qualità della voce e la velocità delle risposte.'
const phrases=[
  'Ciao, questa e una prova della mia voce.',
  'Partirei dai requisiti e poi verificherei il risultato.',
  'Hello, this is a short test of my voice.',
  'I would check the logs and reproduce the issue first.',
  'Possiamo procedere con il prossimo passaggio.',
  'Per affrontare un problema tecnico, inizio da un esempio piccolo e riproducibile. Controllo gli input, confronto il risultato atteso con quello effettivo e verifico una modifica alla volta. Alla fine aggiungo un test per evitare che il problema si ripresenti.',
  'When working on a new project, I start by understanding the requirements and the existing system. I then test a small solution, review the result, and improve it step by step. Clear communication and reliable tests help the team deliver with confidence.'
]
async function run() {
  if(process.platform!=='win32') throw Error('Run this acceptance test on Windows.')
  const args=process.argv.slice(2)
  const index=args.indexOf('--reference'), referencePath=index>=0 ? args[index+1] : null
  const transcriptIndex=args.indexOf('--transcript-file')
  if(!args.includes('--consent') || !referencePath || (!args.includes('--standard-transcript') && transcriptIndex<0)) throw Error('Use --reference <wav> --standard-transcript (or --transcript-file <txt>) --consent for a Free-only cloud test.')
  const transcript=transcriptIndex>=0 ? await readFile(args[transcriptIndex+1],'utf8') : standardTranscript
  const require=createRequire(path.resolve('.superpowers/outlier-smoke/package.json'))
  const {_electron:electron}=require('playwright')
  const root=process.env.NEB_RUNTIME_ROOT || process.cwd()
  const env={...process.env,NEB_INSTANCE:`fish-smoke-${Date.now()}`}
  delete env.ELECTRON_RUN_AS_NODE
  const application=await electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[path.join(root,'out/main/index.js')],cwd:root,env,timeout:30000})
  const results=[]
  try {
    const page=await application.firstWindow()
    await page.getByRole('button',{name:'Impostazioni',exact:true}).click()
    await page.getByLabel('Nome del profilo Fish').fill('Voce di prova')
    await page.getByLabel('Campione Fish WAV').setInputFiles(referencePath)
    await page.getByLabel('Trascrizione esatta del campione').fill(transcript)
    await page.getByRole('checkbox',{name:/Autorizzo l'invio/}).check()
    await page.getByRole('button',{name:'Salva riferimento Fish',exact:true}).click()
    await page.getByText('Riferimento Fish salvato cifrato.',{exact:true}).waitFor()
    await page.getByLabel('Provider vocale').selectOption('fish-openrouter')
    assert.equal(await page.getByLabel('Modello Fish').inputValue(),'fish-audio/s2.1-pro-free:free')
    // Exercise the real trusted IPC and resampler without playing audio into a call or starting Simli.
    for(const text of phrases) {
      const result=await page.evaluate(async(text)=>{
        const settings=await window.neb.getSettings(), started=performance.now()
        let first=null,bytes=0,chunks=0
        const result=await window.neb.synthesizeStream({providerId:'fish-openrouter',modelId:settings.fishModel,text,voice:{mode:'reference',voiceId:settings.fishVoice.id}},chunk=>{if(first===null) first=Math.round(performance.now()-started);bytes+=chunk.length;chunks++})
        return {firstPcmMs:first,generationMs:result.generationMs,durationSeconds:bytes/48000,chunks,estimatedCostUsd:result.ttsEstimatedCostUsd}
      },text)
      assert(result.durationSeconds>0 && result.chunks>0 && result.estimatedCostUsd===0)
      results.push(result)
      console.log(JSON.stringify({request:results.length,...result}))
    }
    const status=await page.evaluate(()=>window.neb.getSpeechProviderStatus('fish-openrouter'))
    assert(status.ready)
    const cancelled=await page.evaluate(async()=>{
      const s=await window.neb.getSettings()
      const work=window.neb.synthesizeStream({providerId:'fish-openrouter',modelId:s.fishModel,text:'Questa prova deve essere interrotta immediatamente.',voice:{mode:'reference',voiceId:s.fishVoice.id}},()=>{})
      setTimeout(()=>void window.neb.stopGeneration(),100)
      try{await work;return false}catch{return true}
    })
    assert(cancelled,'real Stop cancels a Free generation')
    console.log(JSON.stringify({firstRequest:results[0],subsequent:summarize(results.slice(1).map(r=>r.firstPcmMs)),all:summarize(results.map(r=>r.firstPcmMs)),stopVerified:true,provider:'fish-openrouter',model:'fish-audio/s2.1-pro-free:free'}))
    const artifacts=path.resolve('.superpowers/fish-smoke');await mkdir(artifacts,{recursive:true})
    await page.screenshot({path:path.join(artifacts,'fish-windows.png')})
  } finally {
    try {
      const page=await application.firstWindow()
      await page.evaluate(async()=>{
        await window.neb.stopGeneration()
        await window.neb.removeFishVoice()
      })
    } finally {
      await application.close()
    }
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  run().catch(()=>{console.error('Fish Windows acceptance failed. No paid fallback attempted.');process.exitCode=1})
}
