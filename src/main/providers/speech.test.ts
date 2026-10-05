import { expect, it, vi } from 'vitest'
import { SpeechProviderRouter } from './speech'
import type { GeminiTtsProvider } from './gemini'
import type { FishTtsProvider } from './fish'
import { DEFAULT_SETTINGS } from '../../shared/contracts'
import { buildSpeechRequest } from '../../shared/speechRequest'
it('routes only the explicit provider without retry or fallback', async()=>{
  const gemini={synthesizeStream:vi.fn().mockResolvedValue({generationMs:1}),validateConfiguration:vi.fn()}
  const fish={synthesizeStream:vi.fn().mockRejectedValue(Error('Fish: HTTP 429')),validateConfiguration:vi.fn()}
  const router=new SpeechProviderRouter(gemini as unknown as GeminiTtsProvider,fish as unknown as FishTtsProvider)
  const signal=new AbortController().signal
  await router.synthesizeStream(buildSpeechRequest(DEFAULT_SETTINGS,'Hello'),signal,()=>{})
  await expect(router.synthesizeStream(buildSpeechRequest({...DEFAULT_SETTINGS,providerId:'fish-openrouter',fishVoice:{id:'12345678-1234-4123-8123-123456789abc',displayName:'Test',createdAt:'2026-10-05T00:00:00Z'}},'Hello'),signal,()=>{})).rejects.toThrow('429')
  expect(gemini.synthesizeStream).toHaveBeenCalledTimes(1);expect(fish.synthesizeStream).toHaveBeenCalledTimes(1)
  expect(()=>router.validateConfiguration('azure')).toThrow()
})
