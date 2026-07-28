# Doctor-Visit Prep Kit

A Next.js app for women 50+ preparing to discuss memory/cognitive symptoms
with a doctor: questions worth asking, scripted replies if you're brushed
off, an AI coach, and a private notes log (saved to the browser's
`localStorage`).

## Local development

```bash
npm install
cp .env.local.example .env.local   # then paste your Anthropic API key
npm run dev
```

Open http://localhost:3000.

## How the Anthropic call works

The browser never talks to Anthropic directly. `pages/index.js` calls the
app's own `/api/chat` route, which is a serverless function
(`pages/api/chat.js`) that reads `ANTHROPIC_API_KEY` from the server
environment and forwards the request. This keeps the API key out of the
client bundle.

## Deploying to Vercel

1. Push this project to a GitHub repo (or run `vercel` from this folder with
   the Vercel CLI).
2. In the Vercel dashboard, import the project.
3. Before (or right after) the first deploy, go to the project's
   **Settings → Environment Variables** and add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your key from https://console.anthropic.com
   - Environments: check Production, Preview, and Development
4. Redeploy (or trigger the first deploy) so the function picks up the
   variable. Your live URL will look like
   `https://<project-name>.vercel.app`.
