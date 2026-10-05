import { parseAvatarFaceId, parseAvatarSessionLimits, type AvatarSessionToken } from '../../shared/avatar'

async function request(path: string, key: string, body?: object): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`https://api.simli.ai${path}`, {
      method: body ? 'POST' : 'GET', headers: { 'x-simli-api-key': key, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000)
    })
  } catch { throw new Error('Simli non raggiungibile: verifica la connessione e riprova.') }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('Simli: accesso negato. Verifica chiave e limitazione IP.')
    if (response.status === 402 || response.status === 429) throw new Error('Simli: minuti esauriti o limite di sessioni raggiunto.')
    throw new Error(`Simli: richiesta non riuscita (${response.status}).`)
  }
  try { return await response.json() } catch { throw new Error('Simli ha restituito una risposta non valida.') }
}

export async function createAvatarSession(value: unknown, options?: unknown): Promise<AvatarSessionToken> {
  const faceId = parseAvatarFaceId(value)
  const limits = parseAvatarSessionLimits(options)
  const key = process.env.SIMLI_API_KEY?.trim()
  if (!key) throw new Error('Configura SIMLI_API_KEY in .env.local e riavvia NEB.')
  const data = await request('/compose/token', key, { faceId, apiVersion: 'v2', handleSilence: true, ...limits, audioInputFormat: 'pcm16' })
  if (!data || typeof data !== 'object' || !('session_token' in data) || typeof data.session_token !== 'string' || !data.session_token || data.session_token.length > 20000) throw new Error('Token Simli non valido.')
  const ice = await request('/compose/ice', key)
  if (!Array.isArray(ice) || !ice.length || ice.length > 20 || ice.some((server) => !server || typeof server !== 'object' || !(typeof server.urls === 'string' || Array.isArray(server.urls)) || [server.urls].flat().some((url: unknown) => typeof url !== 'string' || !/^(stun|turn|turns):/i.test(url)))) throw new Error('Configurazione WebRTC Simli non valida.')
  return { sessionToken: data.session_token, iceServers: ice as RTCIceServer[] }
}
