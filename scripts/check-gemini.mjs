import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadEnvFile } from 'node:process'
import { GoogleGenAI } from '@google/genai'

const localEnv = join(process.cwd(), '.env.local')
if (existsSync(localEnv)) loadEnvFile(localEnv)

const apiKey = process.env.GEMINI_API_KEY?.trim()
if (!apiKey) {
  console.error('Gemini key missing. Set GEMINI_API_KEY or add it to .env.local.')
  process.exitCode = 1
} else {
  try {
    const ai = new GoogleGenAI({ apiKey })
    const model = await ai.models.get({ model: 'gemini-3.8-flash-tts' })
    console.log(`Gemini API connected. Model: ${model.name ?? 'gemini-3.8-flash-tts'}`)
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? String(error.status) : ''
    const hint = status === '401' || status === '403'
      ? 'The key or project access was rejected.'
      : status === '429'
        ? 'The project is rate limited.'
        : 'The model could not be reached. Check project access and network.'
    console.error(`Gemini API check failed${status ? ` (${status})` : ''}. ${hint}`)
    process.exitCode = 1
  }
}
