// scripts/prepare-collection.ts
// Run: npx tsx scripts/prepare-collection.ts [--verify]
// Outputs: public/collections/schizodio.json
//
// Requires: scripts/data/schizodio-raw.json (run fetch-collection.ts first)

import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { computeBitmap, QUESTION_SCHEMA } from './question-schema.ts';
import { buildMerkleTree, computeLeaf, verifyPath } from './merkle.ts';
import { TOTAL, TREE_SIZE } from './config.ts';

interface RawNFT {
  name:       string;
  edition:    number;
  image:      string;
  attributes: { trait_type: string; value: string }[];
}

function rawToAttrs(raw: RawNFT): Record<string, string> {
  return Object.fromEntries(raw.attributes.map(a => [a.trait_type, a.value]));
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Spot-check indices when --verify is not set.
// A bug in buildMerkleTree fails ALL paths — 4 checks is sufficient.
// Run with --verify to check all 999 (e.g. in CI).
const SPOT_CHECK_IDS = [0, 42, Math.floor(TOTAL / 2), TOTAL - 1];

function main() {
  const rawFile = resolve(__dirname, 'data/schizodio-raw.json');
  const raw: RawNFT[] = JSON.parse(readFileSync(rawFile, 'utf8'));
  if (raw.length !== TOTAL) {
    throw new Error(`Expected ${TOTAL} NFTs, got ${raw.length}. Re-run fetch-collection.ts`);
  }

  const nfts = raw.map(r => ({
    id:        r.edition,
    name:      r.name,
    attrs:     rawToAttrs(r),
    image_url: r.image,
  }));

  // Compute bitmaps — each is [limb0, limb1, limb2, limb3]
  const bitmaps = nfts.map(nft => computeBitmap(nft.attrs));
  console.log(`Sample bitmaps (limb0): ${bitmaps.slice(0, 5).map(b => b[0].toString()).join(', ')}`);

  // Build Merkle tree
  const leaves = bitmaps.map((bitmap, id) => computeLeaf(BigInt(id), bitmap));
  const tree = buildMerkleTree(leaves, TREE_SIZE);
  const traitsRoot = tree.root;
  console.log(`traits_root: 0x${traitsRoot.toString(16)}`);
  console.log('-> Paste this value into the Dojo contract as SCHIZODIO_TRAITS_ROOT.');

  // Verify Merkle paths
  const checkIds = process.argv.includes('--verify')
    ? Array.from({ length: TOTAL }, (_, i) => i)
    : SPOT_CHECK_IDS;

  for (const id of checkIds) {
    const { siblings, isLeft } = tree.getPath(id);
    if (!verifyPath(leaves[id], id, siblings, isLeft, traitsRoot)) {
      throw new Error(`Merkle path verification failed for character ${id}`);
    }
  }
  console.log(`Merkle paths verified (${checkIds.length} checked)`);

  // Pre-compute paths for all characters
  const characters = nfts.map((nft, id) => {
    const { siblings, isLeft } = tree.getPath(id);
    return {
      id,
      name:                nft.name,
      image_url:           nft.image_url,
      bitmap:              bitmaps[id].map(limb => '0x' + limb.toString(16)),
      merkle_path:         siblings.map(s => '0x' + s.toString(16)),
      merkle_path_is_left: isLeft,
    };
  });

  const dataset = {
    total: TOTAL,
    tree_size: TREE_SIZE,
    tree_depth: tree.depth,
    traits_root: '0x' + traitsRoot.toString(16),
    question_schema: Object.fromEntries(
      Object.entries(QUESTION_SCHEMA).map(([k, v]) => [k, v.label]),
    ),
    characters,
  };

  const outDir = resolve(projectRoot, 'public/collections');
  mkdirSync(outDir, { recursive: true });
  const outFile = resolve(outDir, 'schizodio.json');

  const json = JSON.stringify(dataset, null, 2);
  writeFileSync(outFile, json);
  const sizeKb = Math.round(json.length / 1024);
  console.log(`Written: ${outFile} (${sizeKb}KB)`);
  console.log(`traits_root: 0x${traitsRoot.toString(16)}`);
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
