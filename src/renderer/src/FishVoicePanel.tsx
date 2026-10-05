import { useEffect, useRef, useState } from 'react'
import { Save, Trash2, Upload } from 'lucide-react'
import type { AppSettings, ProviderStatus } from '../../shared/contracts'
import { MAX_FISH_AUDIO_BYTES, parseFishVoiceImport, validateFishWav } from '../../shared/fishVoice'
import './fishVoice.css'

interface Props { settings: AppSettings; status: ProviderStatus; locked: boolean; onChanged(settings: AppSettings): void; onBusy(busy: boolean): void }
export function FishVoicePanel({settings,status,locked,onChanged,onBusy}:Props):React.JSX.Element {
  const [name,setName]=useState('La mia voce'),[transcript,setTranscript]=useState(''),[consent,setConsent]=useState(false)
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
  const mounted=useRef(true)
  const selection=useRef(0)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  useEffect(()=>{if(!file){setPreview('');return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file])
  async function choose(file:File|undefined):Promise<void> {
    const epoch=++selection.current
    setError('');setNotice('');setFile(null)
    if(!file) return
    try {if(!file.size || file.size>MAX_FISH_AUDIO_BYTES) throw new Error('Scegli un WAV fino a 6 MiB.');validateFishWav(new Uint8Array(await file.arrayBuffer()));if(mounted.current && selection.current===epoch)setFile(file)}
    catch(reason){if(mounted.current && selection.current===epoch)setError(reason instanceof Error ? reason.message : 'WAV non valido.')}
  }
  async function save():Promise<void> {
    if(!file || locked || busy) return
    setBusy(true);onBusy(true);setError('');setNotice('')
    try {
      const request=parseFishVoiceImport({displayName:name,transcript,consentConfirmed:consent,sourceAudio:new Uint8Array(await file.arrayBuffer())})
      const next=await window.neb.importFishVoice(request)
      onChanged(next)
      if(mounted.current){setNotice('Riferimento Fish salvato cifrato.');setFile(null);setTranscript('');setConsent(false)}
    }catch(reason){if(mounted.current)setError(reason instanceof Error ? reason.message : 'Importazione non riuscita.')}
    finally{if(mounted.current)setBusy(false);onBusy(false)}
  }
  async function remove():Promise<void> {
    if(locked || busy || !window.confirm('Rimuovere il riferimento Fish dal PC? Questo non cancella eventuali dati conservati dai provider remoti.')) return
    setBusy(true);onBusy(true);setError('')
    try{onChanged(await window.neb.removeFishVoice());if(mounted.current)setNotice('Riferimento locale rimosso.')}
    catch(reason){if(mounted.current)setError(reason instanceof Error ? reason.message : 'Rimozione non riuscita.')}
    finally{if(mounted.current)setBusy(false);onBusy(false)}
  }
  return <section className="panel fish-voice-panel" data-no-speech-shortcuts>
    <h3>Voce personale Fish</h3>
    <p role="status">{status.message} · {settings.fishVoice?.displayName ?? 'Nessun riferimento salvato'}</p>
    <fieldset disabled={locked || busy} className="settings-session-lock">
      <label>Nome del profilo Fish<input value={name} maxLength={100} onChange={e=>setName(e.target.value)} /></label>
      <label className="file-button"><Upload size={16}/> Scegli campione WAV<input type="file" accept=".wav,audio/wav" aria-label="Campione Fish WAV" onChange={e=>{void choose(e.target.files?.[0]);e.target.value=''}} /></label>
      {file && <span className="file-name">{file.name}</span>}
      {preview && <audio controls src={preview} aria-label="Anteprima campione Fish" />}
      <label>Trascrizione esatta del campione<textarea value={transcript} maxLength={10000} onChange={e=>setTranscript(e.target.value)} rows={4} /></label>
      <label className="fish-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} /><span>Autorizzo l'invio di questo campione e della trascrizione a OpenRouter/Fish a ogni generazione della voce Fish.</span></label>
      <div className="inline-actions action-row"><button className="primary" type="button" disabled={!file || !name.trim() || !transcript.trim() || !consent} onClick={()=>void save()}><Save size={16}/> Salva riferimento Fish</button><button type="button" disabled={!settings.fishVoice} onClick={()=>void remove()}><Trash2 size={16}/> Rimuovi riferimento</button></div>
    </fieldset>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert" className="notice error">{error}</p>}
  </section>
}
