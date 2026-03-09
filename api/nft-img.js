/**
 * Vercel serverless function — Fast image proxy for NFT art.
 * Usage: /api/nft-img?hash=5b377cf6c45ad24030d367503854fc6b2ed621ee53ad1bcb36b4c5907f5efd52
 *
 * Directly fetches the image by hash WITHOUT the metadata lookup.
 * This is 2× faster than /api/nft-art which does metadata + image.
 */
export default async function handler(req, res) {
    const hash = req.query.hash;

    if (!hash || !/^[a-f0-9]+$/i.test(hash)) {
        return res.status(400).json({ error: 'Invalid hash' });
    }

    try {
        const imgResp = await fetch(`https://v1assets.schizod.io/images/revealed/${hash}.png`);
        if (!imgResp.ok) {
            return res.status(imgResp.status).end();
        }

        const contentType = imgResp.headers.get('content-type') || 'image/png';
        const buffer = Buffer.from(await imgResp.arrayBuffer());

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(buffer);
    } catch (err) {
        return res.status(500).end();
    }
}
