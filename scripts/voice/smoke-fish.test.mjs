import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarize } from './smoke-fish.mjs'
test('reports median and maximum without inventing missing measurements',()=>{
  assert.deepEqual(summarize([1,8,2,4]),{count:4,medianMs:3,maxMs:8})
  assert.deepEqual(summarize([12,3,9]),{count:3,medianMs:9,maxMs:12})
  assert.deepEqual(summarize([]),{count:0,medianMs:null,maxMs:null})
  assert.throws(()=>summarize([NaN]))
})
