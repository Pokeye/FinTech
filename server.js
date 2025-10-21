const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const TICKETS_FILE = path.join(__dirname, 'support_tickets.json');

app.use(bodyParser.json());

// Serve static files from project root (the static site)
app.use(express.static(path.join(__dirname)));

// Simple tickets storage (append to JSON list)
function loadTickets(){ try{ const raw = fs.readFileSync(TICKETS_FILE, 'utf8'); return JSON.parse(raw); }catch(e){ return []; } }
function saveTickets(list){ try{ fs.writeFileSync(TICKETS_FILE, JSON.stringify(list, null, 2), 'utf8'); return true; }catch(e){ console.error('Failed to save tickets', e); return false; } }

// POST /api/support/tickets - accept a ticket object and store it
app.post('/api/support/tickets', (req, res) => {
  const ticket = req.body;
  if (!ticket || !ticket.id) return res.status(400).json({ error: 'invalid ticket' });
  const list = loadTickets();
  list.push(Object.assign({ receivedAt: Date.now() }, ticket));
  if (!saveTickets(list)) return res.status(500).json({ error: 'failed to save' });
  res.json({ ok: true, id: ticket.id });
});

// POST /api/support/ai - proxy to OpenAI (if OPENAI_API_KEY set) or echo fallback
app.post('/api/support/ai', async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'missing message' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
  try{
    if (!OPENAI_API_KEY){
      // Simple local echo fallback so developer can test client behavior
      return res.json({ reply: `(local-echo) ${message}` });
    }

    // Example OpenAI request using completion endpoint (adjust as needed)
    const payload = {
      model: 'text-davinci-003',
      prompt: message,
      max_tokens: 200,
      temperature: 0.6
    };

    const r = await fetch('https://api.openai.com/v1/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok){
      const txt = await r.text();
      return res.status(502).json({ error: 'upstream error', detail: txt });
    }

    const data = await r.json();
    // Map to { reply }
    const reply = (data && data.choices && data.choices[0] && (data.choices[0].text || data.choices[0].message && data.choices[0].message.content)) || null;
    return res.json({ reply });
  }catch(e){
    console.error('AI proxy failed', e);
    return res.status(500).json({ error: 'proxy failure' });
  }
});

// Start server
app.listen(PORT, () => console.log(`Dev server running on http://localhost:${PORT}`));
