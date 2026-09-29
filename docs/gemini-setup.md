# Gemini API setup checkpoint

Create or view a user-owned key at [Google AI Studio API keys](https://aistudio.google.com/api-keys). A key is associated with a Google Cloud project. New users may receive a default project and key; existing Cloud users may need to import a project first. See [Google's current key guide](https://ai.google.dev/gemini-api/docs/api-key).

For Windows local development, add `GEMINI_API_KEY` under **Environment Variables → User variables**, then restart the terminal and app. For this project checkout, you may put `GEMINI_API_KEY=...` in `.env.local`; Electron's main process loads it automatically. The file is excluded from Git. `.env.example` contains only the variable name. Never commit a real key.

Google lists a Free Tier for `gemini-3.8-flash-tts` standard requests, subject to model-specific limits. Billing is therefore not required just to create a key or attempt a free-tier test, but paid usage requires a billing account. Check the current [pricing](https://ai.google.dev/gemini-api/docs/pricing), [billing](https://ai.google.dev/gemini-api/docs/billing) and AI Studio quota before enabling billing. Run `npm run gemini:check` to verify model access without generating audio. The app also checks this when it opens. SPEAK streams the exact script with the selected prebuilt or replicated voice, then assembles a local WAV for Replay.
