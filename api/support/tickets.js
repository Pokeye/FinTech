// Vercel serverless function: /api/support/tickets
// Persists incoming tickets to Upstash REST Redis when UPSTASH_REST_URL and UPSTASH_REST_TOKEN are set.
// If not configured, the function will accept the ticket but return a warning that persistence is not enabled.

const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const ticket = req.body;
  if (!ticket || !ticket.id) return res.status(400).json({ error: 'invalid ticket' });

  const UPSTASH_REST_URL = process.env.UPSTASH_REST_URL || '';
  const UPSTASH_REST_TOKEN = process.env.UPSTASH_REST_TOKEN || '';

  // Add a timestamp
  const stored = Object.assign({}, ticket, { receivedAt: new Date().toISOString() });

  if (!UPSTASH_REST_URL || !UPSTASH_REST_TOKEN) {
    // Dev fallback: accept ticket but warn caller that persistence is not configured
    return res.json({ ok: true, id: ticket.id, warning: 'persistence not configured (UPSTASH_REST_URL/UPSTASH_REST_TOKEN)' });
  }

  try {
    // Use Redis RPUSH on list 'support:tickets' with JSON payload
    const r = await fetch(`${UPSTASH_REST_URL}/rpush/support:tickets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${UPSTASH_REST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([JSON.stringify(stored)])
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error('Upstash write failed', txt);
      return res.status(502).json({ error: 'failed to persist' });
    }

    return res.json({ ok: true, id: ticket.id });
  } catch (err) {
    console.error('Ticket persistence error', err);
    return res.status(500).json({ error: 'persistence failure' });
  }
};
