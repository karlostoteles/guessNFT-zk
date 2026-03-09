#!/usr/bin/env node
/**
 * NFT Image Pipeline — downloads and resizes collection images for Three.js.
 *
 * Usage:
 *   node scripts/download-nft-images.mjs [--size 256] [--concurrency 10]
 *
 * Reads schizodio.json, downloads all image_url entries,
 * resizes to power-of-two dimensions (optimal for WebGL),
 * and saves to public/nft/ as {tokenId}.png.
 *
 * After running, the 3D board can load images from /nft/{tokenId}.png
 * with zero CORS issues (same-origin).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Config ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const SIZE = parseInt(args.find((_, i, a) => a[i - 1] === '--size') || '256', 10);
const CONCURRENCY = parseInt(args.find((_, i, a) => a[i - 1] === '--concurrency') || '10', 10);
const FORCE = args.includes('--force');

const DATA_PATH = path.join(ROOT, 'src/core/data/schizodio.json');
const OUTPUT_DIR = path.join(ROOT, 'public/nft');

// ── Helpers ─────────────────────────────────────────────────────────────────────

function downloadFile(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, { headers: { 'User-Agent': 'guessNFT-pipeline/1.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Follow redirect
                return downloadFile(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

let sharp;
try {
    sharp = (await import('sharp')).default;
} catch {
    sharp = null;
}

async function processImage(buffer) {
    if (!sharp) return buffer;
    return sharp(buffer)
        .resize(SIZE, SIZE, { fit: 'cover' })
        .png({ quality: 80, compressionLevel: 9 })
        .toBuffer();
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
    console.log('┌────────────────────────────────────────────────┐');
    console.log('│  NFT Image Pipeline                            │');
    console.log('│  Download & format NFT images for Three.js     │');
    console.log('└────────────────────────────────────────────────┘');
    console.log(`  Size: ${SIZE}×${SIZE} | Concurrency: ${CONCURRENCY} | Force: ${FORCE}`);
    if (!sharp) {
        console.log('  WARNING: sharp not installed — images saved at full size (~2.5MB each)');
        console.log('  Install sharp for resized thumbnails: npm i -D sharp');
    }
    console.log();

    // 1. Load collection data
    if (!fs.existsSync(DATA_PATH)) {
        console.error('❌ schizodio.json not found at', DATA_PATH);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    const characters = data.characters || [];
    console.log(`📦 Found ${characters.length} characters in collection`);

    // 2. Create output directory
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // 3. Filter characters that need downloading
    const toDownload = characters.filter((char) => {
        if (!char.image_url) return false;
        const outPath = path.join(OUTPUT_DIR, `${char.id}.png`);
        if (!FORCE && fs.existsSync(outPath)) return false; // Already downloaded
        return true;
    });

    const alreadyDone = characters.length - toDownload.length;
    if (alreadyDone > 0) {
        console.log(`✅ ${alreadyDone} already downloaded (skip with --force to re-download)`);
    }

    if (toDownload.length === 0) {
        console.log('✨ All images already downloaded!');
        return;
    }

    console.log(`⬇️  Downloading ${toDownload.length} images...`);
    console.log();

    // 4. Download in batches with concurrency limit
    let completed = 0;
    let failed = 0;
    const startTime = Date.now();

    async function downloadOne(char) {
        const outPath = path.join(OUTPUT_DIR, `${char.id}.png`);
        try {
            const buffer = await downloadFile(char.image_url);
            const processed = await processImage(buffer);
            fs.writeFileSync(outPath, processed);
            completed++;
            const pct = Math.round((completed / toDownload.length) * 100);
            process.stdout.write(`\r  [${'█'.repeat(Math.floor(pct / 2))}${'░'.repeat(50 - Math.floor(pct / 2))}] ${pct}% (${completed}/${toDownload.length})`);
        } catch (err) {
            failed++;
            console.error(`\n  ⚠️  Failed #${char.id}: ${err.message}`);
        }
    }

    // Process with concurrency limit
    const queue = [...toDownload];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        while (queue.length > 0) {
            const char = queue.shift();
            if (char) await downloadOne(char);
        }
    });

    await Promise.all(workers);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n✨ Done in ${elapsed}s — ${completed} downloaded, ${failed} failed`);
    console.log(`📁 Images saved to: ${OUTPUT_DIR}`);

    // 5. Generate manifest
    const manifest = characters
        .filter(c => fs.existsSync(path.join(OUTPUT_DIR, `${c.id}.png`)))
        .map(c => ({ id: c.id, path: `/nft/${c.id}.png` }));

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'manifest.json'),
        JSON.stringify({ total: manifest.length, images: manifest }, null, 2)
    );
    console.log(`📋 Manifest: ${manifest.length} entries in manifest.json`);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
