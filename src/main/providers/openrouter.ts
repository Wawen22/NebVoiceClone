export interface ParaphraseOptions {
  apiKey?: string
  signal?: AbortSignal
  model?: string
}

export const DEFAULT_OPENROUTER_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free'

export async function paraphraseWithNemotron(
  lines: string[],
  options: ParaphraseOptions = {}
): Promise<string[]> {
  const cleanLines = lines.map((l) => l.trim()).filter(Boolean)
  if (cleanLines.length === 0) return []

  const apiKey = options.apiKey || process.env.OPENROUTER_API_KEY
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Chiave OPENROUTER_API_KEY assente. Configurala nel file .env.local.')
  }

  const model = options.model || DEFAULT_OPENROUTER_MODEL

  const systemPrompt = `Sei un assistente esperto nella riscrittura di battute e dialoghi parlati (TTS).
Il tuo compito è creare una versione alternativa ("Model B") dell'elenco di battute fornite dall'utente.
Regole fondamentali:
1. Mantieni al 100% lo stesso significato, le stesse informazioni e l'intento comunicativo di ciascuna battuta.
2. Cambia il modo di dirlo: varia le parole, i sinonimi e la struttura della frase rendendola naturale, fluida e colloquiale per il parlato.
3. Rispetta rigorosamente la corrispondenza 1 a 1: per ciascuna battuta in input deve corrispondere esattamente una battuta alternativa in output, nello stesso ordine.
4. Rispondi ESCLUSIVAMENTE con un array JSON di stringhe valido (es. ["frase 1 riscritta", "frase 2 riscritta"]).
5. NON aggiungere alcun testo di contorno, introduzione, spiegazione o commento al di fuori del JSON.`

  const userContent = JSON.stringify(cleanLines)

  const payload = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
    reasoning: { enabled: true }
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
      'HTTP-Referer': 'https://nebvoice.local',
      'X-Title': 'NEB Voice Console'
    },
    body: JSON.stringify(payload),
    signal: options.signal
  })

  if (!response.ok) {
    let errorMessage = `Errore OpenRouter (${response.status} ${response.statusText})`
    try {
      const errorData = (await response.json()) as { error?: { message?: string } }
      if (errorData?.error?.message) {
        errorMessage = `Errore OpenRouter: ${errorData.error.message}`
      }
    } catch {
      // Ignora errore parsing body
    }
    throw new Error(errorMessage)
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string
      }
    }>
  }

  const content = data.choices?.[0]?.message?.content
  if (!content || !content.trim()) {
    throw new Error('Nessuna risposta ricevuta da OpenRouter Nemotron.')
  }

  return parseParaphraseResponse(content, cleanLines.length)
}

export function parseParaphraseResponse(content: string, expectedCount: number): string[] {
  let cleaned = content.trim()

  // Rimuove blocchi markdown ```json ... ``` se presenti
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  }

  // Tenta di estrarre un array JSON racchiuso tra parentesi quadre
  const jsonMatch = cleaned.match(/\[\s*[\s\S]*\s*\]/)
  if (jsonMatch) {
    cleaned = jsonMatch[0]
  }

  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      const strings = parsed.map((item) => String(item).trim()).filter(Boolean)
      if (strings.length > 0) return strings
    }
  } catch {
    // Prova il fallback per righe numerate o separate da a-capo se il JSON fallisce
  }

  const fallbackLines = cleaned
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('[') && !line.startsWith(']'))

  if (fallbackLines.length > 0) {
    return fallbackLines.slice(0, expectedCount)
  }

  throw new Error('Impossibile interpretare la risposta di Nemotron in un elenco di battute valido.')
}
