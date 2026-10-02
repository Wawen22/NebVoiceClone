import { sameTarget, type BrowserTarget } from '../../../shared/outlier'
export function assertS2STarget(original: BrowserTarget | null, current: BrowserTarget | null): void {
  if (!original || !current || !sameTarget(original, current)) throw new Error('Scheda o task cambiata: premi Stop e avvia una nuova sessione.')
}
