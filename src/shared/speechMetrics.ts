import type { ProviderId, SynthesisRequest } from './contracts'
export interface SpeechTimingMetadata { providerId: ProviderId; modelId: string; ttsEstimatedCostUsd?: number | null }
export function estimateFishCost(modelId:string,text:string,pricePerUtf8Byte:number|null):number|null {
  if(modelId==='fish-audio/s2.1-pro-free:free') return 0
  if(modelId!=='fish-audio/s2.1-pro' || pricePerUtf8Byte===null || !Number.isFinite(pricePerUtf8Byte) || pricePerUtf8Byte<0) return null
  return new TextEncoder().encode(text).length*pricePerUtf8Byte
}
export function speechTimingMetadata(request:SynthesisRequest):SpeechTimingMetadata {
  return {providerId:request.providerId,modelId:request.modelId}
}
