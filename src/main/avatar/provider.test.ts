import { afterEach, expect, it, vi } from 'vitest'
import { createAvatarSession } from './provider'
import { AVATAR_PRESETS, parseAvatarFaceId } from '../../shared/avatar'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
it('rejects malformed face IDs and missing credentials before any request', async () => {
  vi.stubEnv('SIMLI_API_KEY', '')
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  expect(() => parseAvatarFaceId('https://evil.invalid')).toThrow()
  await expect(createAvatarSession(AVATAR_PRESETS[0].id)).rejects.toThrow('SIMLI_API_KEY')
  expect(fetcher).not.toHaveBeenCalled()
})
it('returns temporary token and ICE without exposing the API key', async () => {
  vi.stubEnv('SIMLI_API_KEY', 'secret-fixture')
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ session_token: 'temporary-fixture' }))).mockResolvedValueOnce(new Response(JSON.stringify([{ urls: 'stun:stun.example.invalid:3478' }])))
  vi.stubGlobal('fetch', fetcher)
  const result = await createAvatarSession(AVATAR_PRESETS[0].id)
  expect(result).toEqual({ sessionToken: 'temporary-fixture', iceServers: [{ urls: 'stun:stun.example.invalid:3478' }] })
  expect(fetcher.mock.calls[0][0]).toBe('https://api.simli.ai/compose/token')
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ faceId: AVATAR_PRESETS[0].id, maxSessionLength: 120 })
  expect(JSON.stringify(result)).not.toContain('secret-fixture')
})
it('does not leak provider response bodies or credentials on rejection', async () => {
  vi.stubEnv('SIMLI_API_KEY', 'secret-fixture')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('secret-fixture', { status: 401 })))
  await expect(createAvatarSession(AVATAR_PRESETS[0].id)).rejects.toThrow('accesso')
  await expect(createAvatarSession(AVATAR_PRESETS[0].id)).rejects.not.toThrow('secret-fixture')
})
