/**
 * Evaluate whether a character's trait matches a question by reading the bitmap.
 *
 * This replaces evaluateQuestion() for nft/online modes.
 * In free mode (24 hardcoded characters), evaluateQuestion() is still used.
 *
 * @param bitmap  4 hex limbs from schizodio.json: [limb0, limb1, limb2, limb3]
 *                limb0 holds bits 0–127, limb1 holds bits 128–255, etc.
 * @param questionId  Bit index 0–417 (the circuit's question_id: u16)
 * @returns true if the character has the trait, false otherwise
 */
export function evaluateBit(
  bitmap: [string, string, string, string],
  questionId: number,
): boolean {
  if (questionId < 0 || questionId > 417) {
    throw new RangeError(`questionId ${questionId} out of valid range [0, 417]`);
  }
  const limbIndex = Math.floor(questionId / 128);
  const bitIndex  = questionId % 128;
  const limb      = BigInt(bitmap[limbIndex]);
  return Boolean((limb >> BigInt(bitIndex)) & 1n);
}
