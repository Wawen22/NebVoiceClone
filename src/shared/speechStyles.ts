export const SPEECH_STYLES = [
  { id: 'original', label: 'Originale', description: 'Nessuna indicazione aggiuntiva: usa la resa abituale della voce.', direction: '' },
  { id: 'natural', label: 'Naturale', description: 'Conversazionale e spontaneo, con ritmo normale.', direction: 'Natural conversational delivery at a normal pace, as if talking to a friend. No acting or exaggerated emphasis.' },
  { id: 'professional', label: 'Professionale', description: 'Chiaro, sicuro e misurato, senza un tono rigido.', direction: 'Professional, clear and confident. Measured normal pace, warm and approachable, without stiff or theatrical delivery.' },
  { id: 'enthusiastic', label: 'Entusiasta', description: 'Più energia e partecipazione, senza urlare o forzare.', direction: 'Genuinely enthusiastic and upbeat, with lively intonation. Natural pace, no shouting or exaggerated acting.' },
  { id: 'social', label: 'Social / Reel / TikTok', description: 'Come nei tuoi Reel: naturale, ritmo normale, un po’ di energia. Raccontalo a un amico, senza recitare.', direction: 'Like telling a friend a story in a Reel: natural, normal pace, a little energy. No acting, announcer voice or hype.' },
  { id: 'calm', label: 'Calmo', description: 'Rilassato e rassicurante, con pause morbide.', direction: 'Calm, warm and reassuring, with relaxed pacing and gentle pauses. Natural voice, no whispering or theatrical acting.' },
  { id: 'custom', label: 'Personalizzato', description: 'Descrivi come vuoi parlare. Le indicazioni non vengono lette ad alta voce.', direction: '' }
] as const

export type SpeechStyle = (typeof SPEECH_STYLES)[number]['id']
export const MAX_SPEECH_STYLE_LENGTH = 120
