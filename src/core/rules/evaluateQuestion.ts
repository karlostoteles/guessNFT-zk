import type { Character } from '@/core/data/characters';
import type { Question } from '@/core/data/questions';

/**
 * Evaluate whether a question matches a character.
 *
 * Priority:
 * 1. question.matchFn — custom evaluator for keyword/partial matching (SCHIZODIO questions).
 * 2. Fallback — exact equality: character.traits[traitKey] === traitValue.
 */
export function evaluateQuestion(question: Question, character: Character): boolean {
  if (question.matchFn) {
    return question.matchFn(character);
  }
  const traits = character.traits as unknown as Record<string, unknown>;
  return traits[question.traitKey] === question.traitValue;
}
