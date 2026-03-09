/**
 * Vercel serverless function — SCHIZODIO metadata proxy.
 *
 * Same as the Netlify version but using Vercel's API route format.
 * Usage: /api/schizodio-meta?id=292
 */
export default async function handler(req, res) {
  const id = req.query.id;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid token ID' });
  }

  try {
    const resp = await fetch(`https://v1assets.schizod.io/json/revealed/${id}.json`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; guessNFT/1.0)' },
    });

    if (!resp.ok) {
      return res.status(resp.status).json({ error: `Schizodio API returned ${resp.status}` });
    }

    const data = await resp.json();
    const imageUrl = data.image;
    const name = data.name || `SCHIZODIO #${id}`;
    const attributes = data.attributes || [];

    if (!imageUrl) {
      return res.status(404).json({ error: 'Image not found in metadata', name });
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
    return res.json({ imageUrl, name, tokenId: id, attributes });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
