import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { defaultOutlierData, parseOutlierData, type OutlierData } from '../../shared/outlier'

export class ProjectStore {
  private writes: Promise<unknown> = Promise.resolve()
  constructor(private readonly path: string) {}
  async read(): Promise<OutlierData> {
    await this.writes.catch(() => undefined)
    return this.readFile()
  }
  private async readFile(): Promise<OutlierData> {
    try { return parseOutlierData(JSON.parse(await readFile(this.path, 'utf8'))) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultOutlierData()
      throw new Error('Impossibile leggere i progetti Outlier. Il file originale è stato conservato.', { cause: error })
    }
  }
  save(value: unknown): Promise<OutlierData> {
    const next = parseOutlierData(value)
    const operation = this.writes.catch(() => undefined).then(async () => {
      await this.readFile()
      await mkdir(dirname(this.path), { recursive: true })
      const temporary = `${this.path}.${randomUUID()}.tmp`
      await writeFile(temporary, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 })
      await rename(temporary, this.path)
      return next
    })
    this.writes = operation
    return operation
  }
}
