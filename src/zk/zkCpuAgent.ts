/**
 * ZK-aware CPU agent logic.
 *
 * Uses SCHIZODIO_QUESTIONS + evaluateBit instead of evaluateQuestion.
 * Post-merge, integrate into src/core/ai/cpuAgent.ts.
 */
import { SCHIZODIO_QUESTIONS, SchizodioQuestion } from './schizodioQuestions';
import { evaluateBit } from './evaluateBit';
import { getCachedCollectionData } from './collectionData';

function getNftBitmap(characterId: string): [string, string, string, string] | null {
  if (!characterId.startsWith('nft_')) return null;
  // nft_X IDs are already 0-based (0–998) — NO subtraction needed.
  const tokenId = parseInt(characterId.replace('nft_', ''), 10);
  if (isNaN(tokenId) || tokenId < 0 || tokenId > 998) return null;
  const dataset = getCachedCollectionData();
  if (!dataset) return null;
  const char = dataset.characters[tokenId];
  if (!char) return null;
  return char.bitmap as [string, string, string, string];
}

/**
 * Pick the question that eliminates closest to 50% of remaining characters.
 * Avoids questions already asked.
 */
export function pickBestQuestion(
  remaining: Array<{ id: string }>,
  askedIds: Set<number>,
): SchizodioQuestion | null {
  const available = SCHIZODIO_QUESTIONS.filter((q) => !askedIds.has(q.id));
  if (available.length === 0) return null;

  let best: SchizodioQuestion = available[0];
  let bestScore = Infinity;

  for (const q of available) {
    let yesCount = 0;
    for (const c of remaining) {
      const bitmap = getNftBitmap(c.id);
      if (bitmap && evaluateBit(bitmap, q.id)) yesCount++;
    }
    const noCount = remaining.length - yesCount;
    const score = Math.abs(yesCount - noCount);
    if (score < bestScore) {
      bestScore = score;
      best = q;
    }
  }

  return best;
}

/**
 * Check if CPU is confident enough to Risk It.
 * Returns the character ID to guess, or null if not confident.
 */
export function shouldRiskIt(remaining: Array<{ id: string }>): string | null {
  if (remaining.length === 1) return remaining[0].id;
  if (remaining.length === 2 && Math.random() < 0.35) return remaining[Math.floor(Math.random() * 2)].id;
  return null;
}
