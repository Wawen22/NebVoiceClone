import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DEFAULT_LIVE_CONFIG, parseLiveConfig, type LiveConfig } from '../../shared/live'

export class LiveConfigStore {
  private writes: Promise<unknown> = Promise.resolve()
  constructor(private readonly path: string) {}
  async read(): Promise<LiveConfig> { await this.writes.catch(() => undefined); return this.readFile() }
  private async readFile(): Promise<LiveConfig> {
    try { return parseLiveConfig(JSON.parse(await readFile(this.path, 'utf8'))) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return parseLiveConfig(DEFAULT_LIVE_CONFIG)
      throw new Error('Impossibile leggere la configurazione NEB Live. Il file originale è stato conservato.', { cause: error })
    }
  }
  save(value: unknown): Promise<LiveConfig> {
    const next = parseLiveConfig(value)
    const operation = this.writes.catch(() => undefined).then(async () => {
      await this.readFile()
      await mkdir(dirname(this.path), { recursive: true })
      const temporary = `${this.path}.${randomUUID()}.tmp`
      try {
        await writeFile(temporary, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 })
        await rename(temporary, this.path)
      } finally { await rm(temporary, { force: true }).catch(() => undefined) }
      return parseLiveConfig(next)
    })
    this.writes = operation
    return operation
  }
}
