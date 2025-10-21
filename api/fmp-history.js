// Minimal Vercel serverless proxy for Financial Modeling Prep historical series
// Keeps the FMP API key on the server (read from process.env.FMP_API_KEY)
// and returns a compact { symbol, series, demo } payload that the client can consume.
const FMP_BASE = 'https://financialmodelingprep.com/api/v3/historical-price-full';

/**
 * Query params:
 *  - symbol (required)
 *  - points (optional, default 12)
 */
module.exports = async (req, res) => {
  try {
    const urlParams = req.query || {};
    const symbol = (urlParams.symbol || '').toString().trim();
    const points = Math.max(1, Math.min(200, Number(urlParams.points) || 12));
    if (!symbol) {
      res.status(400).json({ error: 'Missing symbol query param' });
      return;
    }

    const apiKey = process.env.FMP_API_KEY || '';
    const forceDemo = (process.env.FMP_FORCE_DEMO || '') === '1' || (req.query && req.query.demo === '1');

    // Demo fallback when key is missing or forced
    if (!apiKey || forceDemo) {
      const mock = Array.from({ length: points }, (_, i) => Math.round(100 + Math.sin(i / 2) * 4 + Math.random() * 2));
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
      res.status(200).json({ symbol, series: mock, demo: true });
      return;
    }

    // Build FMP URL and fetch
    const intervalUrl = `${FMP_BASE}/${encodeURIComponent(symbol)}?timeseries=${points}&apikey=${encodeURIComponent(apiKey)}`;

    const fetchRes = await fetch(intervalUrl);
    if (!fetchRes.ok) {
      const txt = await fetchRes.text().catch(() => '');
      res.status(502).json({ error: 'FMP fetch failed', status: fetchRes.status, body: txt });
      return;
    }

    const json = await fetchRes.json();
    // Try to extract series: either { historical: [ { date, close } ] } or fallback
    let series = [];
    if (json && Array.isArray(json.historical)) {
      series = json.historical.slice(0, points).map((p) => parseFloat(p.close || p.price || 0));
    } else if (Array.isArray(json)) {
      // Some FMP endpoints may return plain arrays
      series = json.slice(0, points).map((p) => parseFloat(p.close || p.price || p.value || 0));
    }

    // Normalize series order: client expects oldest->newest; FMP returns newest first so reverse
    series = series.slice(0, points).reverse();

    // Cache via Vercel CDN (s-maxage)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=60');
    res.status(200).json({ symbol, series, demo: false });
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: 'Server error', message: err.message });
  }
};
