import { expect, it } from 'vitest'
import { estimateFishCost, speechTimingMetadata } from './speechMetrics'
it('estimates UTF-8 bytes, not characters or Qwen tokens, and keeps missing prices unknown',()=>{
  expect(estimateFishCost('fish-audio/s2.1-pro','èع',0.000015)).toBeCloseTo(4*0.000015)
  expect(estimateFishCost('fish-audio/s2.1-pro','Hello',null)).toBeNull()
  expect(estimateFishCost('fish-audio/s2.1-pro-free:free','Hello',null)).toBe(0)
  expect(speechTimingMetadata({providerId:'fish-openrouter',modelId:'fish-audio/s2.1-pro-free:free',text:'private sample',voice:{mode:'reference',voiceId:'private id'}})).toEqual({providerId:'fish-openrouter',modelId:'fish-audio/s2.1-pro-free:free'})
})
