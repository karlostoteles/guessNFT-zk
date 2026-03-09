/**
 * Vercel serverless function — Proxies NFT images through same-origin.
 * Usage: /api/nft-art?id=292
 *
 * Fetches the image from v1assets.schizod.io and STREAMS it back
 * (not redirect) so the browser treats it as same-origin.
 * This allows <canvas> and Three.js textures to use the image without CORS issues.
 */
export default async function handler(req, res) {
    const id = req.query.id;

    if (!id || !/^\d+$/.test(id)) {
        return res.status(400).json({ error: 'Invalid token ID' });
    }

    try {
        // 1. Get metadata to find the image URL
        const metaResp = await fetch(`https://v1assets.schizod.io/json/revealed/${id}.json`);
        if (!metaResp.ok) {
            return res.status(metaResp.status).end();
        }
        const data = await metaResp.json();
        const imageUrl = data.image;

        if (!imageUrl) {
            return res.status(404).end();
        }

        // 2. Fetch the actual image and stream it through
        const imgResp = await fetch(imageUrl);
        if (!imgResp.ok) {
            return res.status(imgResp.status).end();
        }

        const contentType = imgResp.headers.get('content-type') || 'image/png';
        const buffer = Buffer.from(await imgResp.arrayBuffer());

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(buffer);
    } catch (err) {
        return res.status(500).end();
    }
}
