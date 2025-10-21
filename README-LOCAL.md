Local development server and AI proxy for Findeshy

Quick start (PowerShell)

# 1) Install dependencies (one-time)
npm install

# 2) Run the dev server
# If you have an OpenAI key and want real AI replies, set the env var first:
# $env:OPENAI_API_KEY = 'sk-...'
npm start

# 3) Open the site
# In your browser: http://localhost:3000/index.html

Notes
- The server serves files from the repository root so you can browse the static site.
- /api/support/ai will proxy to OpenAI when OPENAI_API_KEY is set. Otherwise it returns a (local-echo) reply so the client can test remote flow.
- /api/support/tickets receives POSTed ticket objects and stores them in support_tickets.json.
- Production: NEVER expose provider keys to client-side code. Use a server-side proxy with proper rate-limiting and authentication.
