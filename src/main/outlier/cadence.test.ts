import { describe, expect, it } from 'vitest'
import { CadencePlanner } from './cadence'

describe('CadencePlanner', () => {
  it('returns exact base delay in uniform mode', () => {
    const planner = new CadencePlanner({
      projectId: 's2s',
      text: 'test',
      charactersPerMinute: 600,
      cadenceMode: 'uniform'
    })
    const plan = planner.planNext('a', null)
    expect(plan.delayMs).toBe(100)
    expect(plan.typo).toBeUndefined()
    expect(plan.isThinkingPause).toBeUndefined()
  })

  it('produces variable delays with jitter in natural mode', () => {
    const planner = new CadencePlanner({
      projectId: 's2s',
      text: 'test',
      charactersPerMinute: 600,
      cadenceMode: 'natural'
    })
    const delays: number[] = []
    for (let i = 0; i < 50; i++) {
      delays.push(planner.planNext('a', 'b').delayMs)
    }
    const unique = new Set(delays)
    expect(unique.size).toBeGreaterThan(10)
    delays.forEach((delay) => {
      expect(delay).toBeGreaterThanOrEqual(25)
      expect(delay).toBeLessThanOrEqual(1500)
    })
  })

  it('adds pauses for punctuation and newline characters', () => {
    const planner = new CadencePlanner({
      projectId: 's2s',
      text: 'test',
      charactersPerMinute: 600,
      cadenceMode: 'natural'
    })
    const newlinePlan = planner.planNext('\n', 'a')
    expect(newlinePlan.delayMs).toBeGreaterThan(300)

    const periodPlan = planner.planNext('.', 'a')
    expect(periodPlan.delayMs).toBeGreaterThan(200)

    const commaPlan = planner.planNext(',', 'a')
    expect(commaPlan.delayMs).toBeGreaterThan(120)
  })

  it('generates thinking pauses when enabled', () => {
    const planner = new CadencePlanner({
      projectId: 's2s',
      text: 'test',
      charactersPerMinute: 600,
      cadenceMode: 'natural',
      thinkingPauses: true
    })
    let foundThinking = false
    for (let i = 0; i < 300; i++) {
      const plan = planner.planNext('a', ' ')
      if (plan.isThinkingPause) {
        expect(plan.delayMs).toBeGreaterThanOrEqual(1800)
        foundThinking = true
        break
      }
    }
    expect(foundThinking).toBe(true)
  })

  it('generates typos only when enabled', () => {
    const withTypos = new CadencePlanner({
      projectId: 's2s',
      text: 'test',
      charactersPerMinute: 600,
      cadenceMode: 'natural',
      simulateTypos: true
    })
    let foundTypo = false
    for (let i = 0; i < 300; i++) {
      const plan = withTypos.planNext('e', 't')
      if (plan.typo) {
        expect(typeof plan.typo).toBe('string')
        foundTypo = true
        break
      }
    }
    expect(foundTypo).toBe(true)

    const withoutTypos = new CadencePlanner({
      projectId: 's2s',
      text: 'test',
      charactersPerMinute: 600,
      cadenceMode: 'natural',
      simulateTypos: false
    })
    for (let i = 0; i < 300; i++) {
      const plan = withoutTypos.planNext('e', 't')
      expect(plan.typo).toBeUndefined()
    }
  })
})

