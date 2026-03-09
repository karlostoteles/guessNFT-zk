// scripts/fetch-collection.ts
// Downloads all 999 Schizodio NFT metadata JSONs from the public API.
//
// Run once: npx tsx scripts/fetch-collection.ts
// Output:   scripts/data/schizodio-raw.json
//
// The raw JSON is committed to the repo — it's public metadata.
// Re-run only if the collection metadata changes.

import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { TOTAL } from './config.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL   = 'https://v1assets.schizod.io/json/revealed';
const CONCURRENCY = 20;
const MAX_RETRIES  = 3;

async function fetchOne(id: number): Promise<unknown> {
  const url = `${BASE_URL}/${id}.json`;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 400 * attempt));
    }
  }
  throw new Error(`NFT #${id} failed after ${MAX_RETRIES} attempts: ${lastErr}`);
}

async function main() {
  console.log(`Fetching ${TOTAL} Schizodio NFTs (${CONCURRENCY} concurrent)...`);
  const results: unknown[] = new Array(TOTAL);
  const failed: number[]   = [];
  let done = 0;

  for (let start = 0; start < TOTAL; start += CONCURRENCY) {
    const batch = Array.from(
      { length: Math.min(CONCURRENCY, TOTAL - start) },
      (_, i) => start + i,
    );
    await Promise.all(
      batch.map(async id => {
        try {
          results[id] = await fetchOne(id);
          done++;
          process.stdout.write(`\r  ${done}/${TOTAL}`);
        } catch (err) {
          failed.push(id);
          process.stderr.write(`\n  ✗ NFT #${id}: ${err}\n`);
        }
      }),
    );
  }

  process.stdout.write('\n');

  if (failed.length > 0) {
    console.error(`\nFailed ${failed.length} NFTs: ${failed.join(', ')}`);
    process.exit(1);
  }

  const outDir  = resolve(__dirname, 'data');
  const outFile = resolve(outDir, 'schizodio-raw.json');
  mkdirSync(outDir, { recursive: true });

  const json   = JSON.stringify(results, null, 2);
  writeFileSync(outFile, json);
  console.log(`\n✓ Saved to ${outFile} (${Math.round(json.length / 1024)}KB)`);
  console.log('→ Run: npx tsx scripts/prepare-collection.ts real');
}

main().catch(err => { console.error(err); process.exit(1); });
