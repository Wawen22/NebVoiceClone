/** Keeps configuration saving and provider checks inside one cancellable start. */
export class LiveStartGate {
  private operation: AbortController | null = null
  get pending(): boolean { return this.operation !== null }
  async run<T>(prepare: (signal: AbortSignal) => Promise<T>, commit: (value: T) => void): Promise<boolean> {
    if (this.pending) return false
    const operation = new AbortController(); this.operation = operation
    try {
      const value = await prepare(operation.signal)
      if (operation.signal.aborted || this.operation !== operation) return false
      commit(value)
      return true
    } finally { if (this.operation === operation) this.operation = null }
  }
  cancel(): void { this.operation?.abort(); this.operation = null }
}
