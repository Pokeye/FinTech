Vercel deployment notes for Findeshy
===================================

This file summarizes the minimal steps and environment variables needed to deploy the Findeshy static site + serverless API to Vercel.

What this repo includes
- Static site (HTML/CSS/JS) at the repository root — served as static assets.
- Serverless functions under `api/support/`:
  - `ai.js` — POST /api/support/ai (AI proxy to OpenAI Chat Completions)
  - `tickets.js` — POST /api/support/tickets (persists tickets to Upstash Redis if configured)

Required environment variables (set in Vercel dashboard → Project → Settings → Environment Variables)
- `OPENAI_API_KEY` — required for real AI replies. If missing the function responds with a `(local-echo)` reply for testing.
- `UPSTASH_REST_URL` — optional. Upstash REST base URL like `https://<id>.upstash.io`.
- `UPSTASH_REST_TOKEN` — optional. REST token for Upstash. If not set, ticketing will accept but not persist tickets.

Quick deploy steps (PowerShell)
```powershell
# (optional) install Vercel CLI
# npm i -g vercel

# link/deploy (interactive)
# vercel

# (recommended) set env vars via dashboard, or using the CLI prompts
# vercel env add OPENAI_API_KEY production
# vercel env add UPSTASH_REST_URL production
# vercel env add UPSTASH_REST_TOKEN production

# deploy to production
# vercel --prod
```

Notes & caveats
- Keep `server.js` for local development only; Vercel uses the `api/` functions in serverless mode.
- Avoid storing provider keys in client-side code.
- For durable ticket storage in production, using Upstash (simple), Supabase, or another managed DB is recommended.

If you'd like, I can also create a small `vercel.json` with rewrites or an example `supabase` integration for tickets.
