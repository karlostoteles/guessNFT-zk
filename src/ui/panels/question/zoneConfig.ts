/**
 * Data-driven trait categories for NFT questions.
 *
 * Categories are DERIVED from the questions' traitKey field, not hardcoded.
 * The traitKey maps to the NFT metadata trait_type names:
 *   Accessories, Background, Body, Clothing, Eyebrows, Eyes, Eyewear,
 *   Hair, Headwear, Mask, Mouth, Overlays, Sidekick, Weapons
 *
 * The category name is the human-readable version of the traitKey
 * (e.g. "nft_hair" → "Hair", "nft_has_weapons" → "Weapons").
 */

import { NFT_QUESTIONS } from '@/core/data/questions';

export type TraitCategory = string;

/** Map traitKey → human-readable category name */
function traitKeyToCategory(traitKey: string): string {
  // Strip nft_ prefix and has_ prefix
  let name = traitKey
    .replace(/^nft_/, '')
    .replace(/^has_/, '');
  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Emoji icon by category name */
const CATEGORY_ICONS: Record<string, string> = {
  Hair: '💇',
  Eyes: '👁️',
  Eyebrows: '🤨',
  Mouth: '👄',
  Body: '🧬',
  Clothing: '👕',
  Mask: '🎭',
  Weapons: '⚔️',
  Eyewear: '🕶️',
  Headwear: '🎩',
  Accessories: '💎',
  Overlay: '✨',
  Sidekick: '🐾',
  Background: '🏖️',
};

/** Color per category (cycles through a palette for unknown categories) */
const CATEGORY_COLORS: Record<string, string> = {
  Hair: '#E8A444',
  Eyes: '#60CDFF',
  Eyebrows: '#FACC15',
  Mouth: '#F472B6',
  Body: '#A855F7',
  Clothing: '#22D3EE',
  Mask: '#FF6B6B',
  Weapons: '#EF4444',
  Eyewear: '#818CF8',
  Headwear: '#FB923C',
  Accessories: '#F97316',
  Overlay: '#4ADE80',
  Sidekick: '#A78BFA',
  Background: '#34D399',
};

const DEFAULT_COLORS = ['#E8A444', '#60CDFF', '#A855F7', '#22D3EE', '#EF4444', '#F472B6', '#4ADE80', '#FACC15'];

export interface TraitCategoryConfig {
  id: string;
  label: string;
  icon: string;
  color: string;
  traitKeys: string[];
}

/**
 * Derive trait categories from the actual NFT_QUESTIONS data.
 * Each unique traitKey becomes a category. This is fully data-driven:
 * when questions are added/removed, categories update automatically.
 */
function buildCategories(): TraitCategoryConfig[] {
  // Group questions by traitKey
  const keyMap = new Map<string, Set<string>>();
  for (const q of NFT_QUESTIONS) {
    const cat = traitKeyToCategory(q.traitKey);
    if (!keyMap.has(cat)) keyMap.set(cat, new Set());
    keyMap.get(cat)!.add(q.traitKey);
  }

  let colorIdx = 0;
  const categories: TraitCategoryConfig[] = [];
  for (const [label, traitKeys] of keyMap) {
    categories.push({
      id: label.toLowerCase(),
      label,
      icon: CATEGORY_ICONS[label] || '🏷️',
      color: CATEGORY_COLORS[label] || DEFAULT_COLORS[colorIdx++ % DEFAULT_COLORS.length],
      traitKeys: [...traitKeys],
    });
  }

  return categories;
}

export const TRAIT_CATEGORIES_CONFIG = buildCategories();
export const TRAIT_CATEGORY_IDS = TRAIT_CATEGORIES_CONFIG.map(c => c.id);

/** Given a question's traitKey, find which category it belongs to */
export function getTraitCategory(traitKey: string): string | null {
  const label = traitKeyToCategory(traitKey);
  const cat = TRAIT_CATEGORIES_CONFIG.find(c => c.label === label);
  return cat ? cat.id : null;
}

/** Get the config for a category by ID */
export function getCategoryConfig(categoryId: string): TraitCategoryConfig | undefined {
  return TRAIT_CATEGORIES_CONFIG.find(c => c.id === categoryId);
}
