import { expect, it } from 'vitest'
import { liveSpeechLanguageIssue } from './liveLanguage'

it('detects Italian sentences in English speech, including after an English introduction', () => {
  expect(liveSpeechLanguageIssue('Sure, happy to explain. Ehm, guarda, quindi partirei dai log e poi userei un profiler.', 'en')).toContain('italiana')
})

it('accepts technical English, proper names and quoted code regardless of Italian background', () => {
  expect(liveSpeechLanguageIssue('Well, I would inspect the logs first. Then I would run EXPLAIN on the query. The field is called "il che sono".', 'en')).toBeNull()
  expect(liveSpeechLanguageIssue('I would inspect the logs first.', 'auto')).toBeNull()
})

it('detects English prose under Italian and missing Arabic prose under Arabic', () => {
  expect(liveSpeechLanguageIssue('I would inspect the logs first and then explain this.', 'it')).toContain('inglese')
  expect(liveSpeechLanguageIssue('I would inspect the logs first.', 'ar')).toContain('arabo')
  expect(liveSpeechLanguageIssue('أبدأ بفحص السجلات ثم أحلل زمن الاستجابة.', 'ar')).toBeNull()
})
