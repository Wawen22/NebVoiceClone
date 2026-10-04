import type { LiveProfile } from './live'

const italian = new Set('il gli una della delle degli dello che perché quindi poi anche oppure questo questa sono farei userei controllerei praticamente guarda partirei'.split(' '))
const english = new Set('the would with that this because should first then which their while could does are explain'.split(' '))

/** Conservative mismatch check, not a general language detector. Technical terms remain valid. */
export function liveSpeechLanguageIssue(text: string, language: LiveProfile['language']): string | null {
  if (language === 'auto') return null
  if (language === 'ar') return /\p{Script=Arabic}/u.test(text) ? null : 'La risposta deve essere in arabo.'
  const prose = text.replace(/```[\s\S]*?```/g, '').replace(/"[^"\n]*"/g, '')
  for (const sentence of prose.split(/[.!?\n]/)) {
    const words = sentence.toLowerCase().match(/\p{L}+/gu) ?? []
    const it = words.filter((word) => italian.has(word)).length
    const en = words.filter((word) => english.has(word)).length
    if (language === 'en' && it >= 3 && it > en) return 'La risposta contiene una frase italiana: text deve essere esclusivamente in inglese.'
    if (language === 'it' && en >= 3 && en > it) return 'La risposta contiene una frase inglese: text deve essere esclusivamente in italiano.'
  }
  return null
}

export function liveLanguageInstruction(language: LiveProfile['language']): string {
  if (language === 'auto') return 'Follow the interlocutor’s language in text; preserve transcript in its original language.'
  const name = { en: 'English', it: 'Italian', ar: 'Arabic' }[language]
  return `MANDATORY OUTPUT LANGUAGE: ${name}. The JSON text field must contain only ${name} speech, every sentence and filler. This overrides the language and examples of the persona, background, history and question. Translate their meaning into ${name}; never copy their foreign filler words. Preserve transcript in the original audio language. Technical identifiers and proper names may stay unchanged.`
}
