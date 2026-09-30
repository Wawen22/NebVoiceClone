import type { InsertionRequest } from '../../shared/outlier'

export interface CharacterPlan {
  delayMs: number
  typo?: string
  isThinkingPause?: boolean
}

// Adjacent keys on standard QWERTY layout for typo simulation
const ADJACENT_KEYS: Record<string, string[]> = {
  a: ['s', 'q', 'z'],
  b: ['v', 'g', 'h', 'n'],
  c: ['x', 'd', 'v'],
  d: ['s', 'e', 'r', 'f', 'c', 'x'],
  e: ['w', 'r', 'd', 's'],
  f: ['d', 'r', 't', 'g', 'v', 'c'],
  g: ['f', 't', 'y', 'h', 'b', 'v'],
  h: ['g', 'y', 'u', 'j', 'n', 'b'],
  i: ['u', 'o', 'k', 'j'],
  j: ['h', 'u', 'i', 'k', 'm', 'n'],
  k: ['j', 'i', 'o', 'l', 'm'],
  l: ['k', 'o', 'p'],
  m: ['n', 'j', 'k'],
  n: ['b', 'h', 'j', 'm'],
  o: ['i', 'p', 'l', 'k'],
  p: ['o', 'l'],
  q: ['w', 'a'],
  r: ['e', 't', 'f', 'd'],
  s: ['a', 'w', 'e', 'd', 'x', 'z'],
  t: ['r', 'y', 'g', 'f'],
  u: ['y', 'i', 'j', 'h'],
  v: ['c', 'f', 'g', 'b'],
  w: ['q', 'e', 's', 'a'],
  x: ['z', 's', 'd', 'c'],
  y: ['t', 'u', 'h', 'g'],
  z: ['a', 's', 'x']
}

export class CadencePlanner {
  private readonly baseDelayMs: number
  private readonly mode: 'natural' | 'uniform'
  private readonly thinkingPauses: boolean
  private readonly simulateTypos: boolean
  private charsSinceThinking = 0
  private nextThinkingThreshold: number
  private charsSinceTypo = 0
  private nextTypoThreshold: number
  private thinkingPauseCount = 0

  constructor(request: InsertionRequest) {
    this.baseDelayMs = Math.round((60 / request.charactersPerMinute) * 1000)
    this.mode = request.cadenceMode ?? 'natural'
    this.thinkingPauses = request.thinkingPauses ?? true
    this.simulateTypos = request.simulateTypos ?? true
    this.nextThinkingThreshold = this.randomBetween(55, 120)
    this.nextTypoThreshold = this.randomBetween(85, 160)
  }

  planNext(character: string, prevChar: string | null): CharacterPlan {
    if (this.mode === 'uniform') {
      return { delayMs: this.baseDelayMs }
    }

    this.charsSinceThinking++
    this.charsSinceTypo++

    // 1. Thinking pause?
    // Occurs after punctuation or space when threshold reached (every 55-120 chars)
    if (
      this.thinkingPauses &&
      this.charsSinceThinking >= this.nextThinkingThreshold &&
      (prevChar === ' ' || prevChar === '.' || prevChar === '\n' || prevChar === ',' || prevChar === ';' || prevChar === ':')
    ) {
      this.charsSinceThinking = 0
      this.nextThinkingThreshold = this.randomBetween(55, 120)
      this.thinkingPauseCount++

      // Deep thinking pause (~5s, 4.5s - 5.6s) roughly every 3rd pause or ~30% of the time,
      // and regular reflection pause (1.8s - 3.2s) otherwise
      const isDeepPause = (this.thinkingPauseCount % 3 === 0) || Math.random() < 0.28
      const thinkingDelay = isDeepPause
        ? this.randomBetween(4500, 5600)
        : this.randomBetween(1800, 3200)

      return { delayMs: thinkingDelay, isThinkingPause: true }
    }

    // 2. Typo simulation?
    // Real humans occasionally type an adjacent key for ASCII letters, not right after a space or punctuation
    let typo: string | undefined
    if (
      this.simulateTypos &&
      this.charsSinceTypo >= this.nextTypoThreshold &&
      prevChar &&
      /[a-zA-Z]/.test(character) &&
      /[a-zA-Z]/.test(prevChar)
    ) {
      const lower = character.toLowerCase()
      const candidates = ADJACENT_KEYS[lower]
      if (candidates && candidates.length > 0) {
        const picked = candidates[Math.floor(Math.random() * candidates.length)]
        typo = character === character.toUpperCase() ? picked.toUpperCase() : picked
        this.charsSinceTypo = 0
        this.nextTypoThreshold = this.randomBetween(90, 170)
      }
    }

    // 3. Human cadence delay with Gaussian jitter and structural pauses
    let delay = this.gaussian(this.baseDelayMs, this.baseDelayMs * 0.25)

    // Structural modifiers:
    if (character === '\n') {
      // Paragraph break: realistic pause before starting the new thought block
      delay += this.randomBetween(1200, 2400)
    } else if (character === '.' || character === '!' || character === '?') {
      delay += this.randomBetween(280, 520)
    } else if (character === ',' || character === ';' || character === ':') {
      delay += this.randomBetween(150, 290)
    } else if (character === ' ') {
      delay += this.randomBetween(35, 90)
    } else if (prevChar && /[a-zA-Z0-9]/.test(prevChar) && /[a-zA-Z0-9]/.test(character)) {
      // Intra-word burst: slightly faster typing within a word
      delay = delay * 0.86
    }

    // Clamp delay to sensible human bounds: min 25ms, max 1500ms
    delay = Math.max(25, Math.min(1500, Math.round(delay)))

    return { delayMs: delay, typo }
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  private gaussian(mean: number, stdDev: number): number {
    let u1 = 0
    let u2 = 0
    while (u1 === 0) u1 = Math.random()
    while (u2 === 0) u2 = Math.random()
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
    return mean + z0 * stdDev
  }
}

