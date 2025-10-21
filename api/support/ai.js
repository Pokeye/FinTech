// Vercel serverless function: /api/support/ai
// Proxies user messages to OpenAI Chat Completions when OPENAI_API_KEY is configured.
// Falls back to a local echo reply when the key is missing (useful for demo/dev).

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'missing message' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
  if (!OPENAI_API_KEY) {
    // Local/dev fallback so client can exercise remote flow without a key.
    return res.json({ reply: `(local-echo) ${message}` });
  }

  try {
    const payload = {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful FinTech assistant.' },
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.6
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(502).json({ error: 'upstream error', detail: txt });
    }

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content ?? null;
    return res.json({ reply });
  } catch (err) {
    console.error('AI proxy error', err);
    return res.status(500).json({ error: 'proxy failure' });
  }
};
