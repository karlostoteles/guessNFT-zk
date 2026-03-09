/**
 * FreeModeBody — the body content of QuestionPanel in free (vs-CPU) mode.
 * Updated to use the new NFTModeBody layout and bubble buttons.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FREE_QUESTIONS, type Question } from '@/core/data/questions';
import type { Character } from '@/core/data/characters';
import { evaluateQuestion } from '@/core/rules/evaluateQuestion';
import { NFTQuestionButton } from './QuestionButtons';
import { useIsMobile } from '@/shared/hooks/useMediaQuery';

const FREE_CATEGORIES = [
  { key: 'hair' as const, label: 'Hair', icon: '💇', color: '#E8A444' },
  { key: 'face' as const, label: 'Face', icon: '👁️', color: '#F472B6' },
  { key: 'accessories' as const, label: 'Accessories', icon: '🎩', color: '#A78BFA' },
] as const;

type FreeCategory = typeof FREE_CATEGORIES[number]['key'];

interface FreeModeBodyProps {
  askedIds: Set<string>;
  remaining: Character[];
  onAsk: (q: Question) => void;
}

export function FreeModeBody({ askedIds, remaining, onAsk }: FreeModeBodyProps) {
  const [freeCategory, setFreeCategory] = useState<FreeCategory | null>(null);
  const isMobile = useIsMobile();

  // Info-gain filtered question IDs
  const usefulIds = useMemo(() => {
    const ids = new Set<string>();
    for (const q of FREE_QUESTIONS) {
      if (askedIds.has(q.id)) { ids.add(q.id); continue; }
      const yesCount = remaining.filter((c) => evaluateQuestion(q, c)).length;
      if (yesCount > 0 && yesCount < remaining.length) ids.add(q.id);
    }
    if (ids.size === askedIds.size) FREE_QUESTIONS.forEach((q) => ids.add(q.id));
    return ids;
  }, [remaining, askedIds]);

  // Category stats
  const categoryStats = useMemo(() => {
    const stats = new Map<string, { total: number; asked: number; remaining: number }>();
    for (const cat of FREE_CATEGORIES) {
      const qs = FREE_QUESTIONS.filter(q => q.category === cat.key && usefulIds.has(q.id));
      const asked = qs.filter(q => askedIds.has(q.id)).length;
      stats.set(cat.key, { total: qs.length, asked, remaining: qs.length - asked });
    }
    return stats;
  }, [usefulIds, askedIds]);

  // Match % map
  const matchPctMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of FREE_QUESTIONS) {
      if (askedIds.has(q.id) || !usefulIds.has(q.id)) continue;
      const yesCount = remaining.filter((c) => evaluateQuestion(q, c)).length;
      map.set(q.id, remaining.length > 0 ? Math.round((yesCount / remaining.length) * 100) : 0);
    }
    return map;
  }, [remaining, askedIds, usefulIds]);

  const activeQuestions = useMemo(() => {
    if (!freeCategory) return [];
    return FREE_QUESTIONS.filter(q => q.category === freeCategory && usefulIds.has(q.id));
  }, [freeCategory, usefulIds]);

  const sortedQuestions = useMemo(() => {
    return [...activeQuestions].sort((a, b) => {
      if (askedIds.has(a.id) && !askedIds.has(b.id)) return 1;
      if (!askedIds.has(a.id) && askedIds.has(b.id)) return -1;
      return (matchPctMap.get(a.id) ?? 50) - (matchPctMap.get(b.id) ?? 50);
    });
  }, [activeQuestions, matchPctMap, askedIds]);

  const topQuestions = useMemo(() => {
    return FREE_QUESTIONS
      .filter((q) => usefulIds.has(q.id) && !askedIds.has(q.id))
      .map((q) => {
        const yesCount = remaining.filter((c) => evaluateQuestion(q, c)).length;
        const pct = remaining.length > 0 ? Math.round((yesCount / remaining.length) * 100) : 0;
        return { q, pct, score: Math.abs(50 - pct) };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 12);
  }, [remaining, askedIds, usefulIds]);

  const activeCfg = FREE_CATEGORIES.find(c => c.key === freeCategory);

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
      {/* ── Category tabs ── */}
      <div style={{
        display: 'flex', gap: 2, padding: '8px 10px 0',
        background: 'rgba(255,255,255,0.02)', flexShrink: 0,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch' as never,
        scrollbarWidth: 'none',
      }}>
        {FREE_CATEGORIES.map((cat) => {
          const stats = categoryStats.get(cat.key);
          if (!stats || stats.total === 0) return null;

          const isActive = freeCategory === cat.key;
          const allDone = stats.remaining === 0;

          return (
            <motion.button
              key={cat.key}
              onClick={() => setFreeCategory(isActive ? null : cat.key)}
              whileHover={{ background: isActive ? undefined : 'rgba(255,255,255,0.07)' }}
              style={{
                padding: '6px 8px 8px', border: 'none',
                borderRadius: '6px 6px 0 0',
                background: isActive ? `${cat.color}1A` : 'transparent',
                borderBottom: isActive ? `2px solid ${cat.color}` : '2px solid transparent',
                color: allDone ? 'rgba(255,255,254,0.2)' : isActive ? cat.color : 'rgba(255,255,254,0.4)',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600, fontSize: 10,
                cursor: 'pointer', outline: 'none',
                transition: 'all 0.18s',
                display: 'flex', alignItems: 'center', gap: 3,
                whiteSpace: 'nowrap', opacity: allDone ? 0.5 : 1, flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 13 }}>{cat.icon}</span>
              <span style={{ letterSpacing: '0.03em' }}>{isMobile && cat.key === 'accessories' ? 'Accs' : cat.label}</span>
              <span style={{
                fontSize: 8,
                background: allDone ? 'rgba(76,175,80,0.2)' : isActive ? `${cat.color}25` : 'rgba(255,255,255,0.07)',
                borderRadius: 6, padding: '1px 4px',
                color: allDone ? '#4CAF50' : isActive ? cat.color : 'rgba(255,255,254,0.25)',
              }}>
                {stats.asked > 0 && <span>✓{stats.asked} </span>}
                {stats.remaining}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* ── Question area ── */}
      <div style={{
        overflowY: 'auto', flex: 1, padding: '10px 12px 14px',
        WebkitOverflowScrolling: 'touch' as never,
      }}>
        <AnimatePresence mode="wait">
          {!freeCategory ? (
            <motion.div
              key="top-picks"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>⚡</span>
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700, fontSize: 11, color: '#E8A444', letterSpacing: '0.06em',
                }}>
                  TOP PICKS
                </span>
                <span style={{
                  fontSize: 9, color: 'rgba(255,255,254,0.25)',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}>
                  Best questions to narrow it down
                </span>
              </div>

              {topQuestions.length === 0 ? (
                <div style={{
                  textAlign: 'center', fontSize: 12,
                  color: 'rgba(255,255,254,0.22)', marginTop: 20, fontStyle: 'italic',
                }}>
                  No more questions available
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '2px 0' }}>
                  {topQuestions.map(({ q, pct }) => (
                    <NFTQuestionButton
                      key={q.id} question={q} asked={false}
                      onClick={() => onAsk(q)} matchPct={pct}
                    />
                  ))}
                </div>
              )}

              <div style={{
                borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8,
                fontSize: 9, color: 'rgba(255,255,254,0.15)',
                fontFamily: "'Space Grotesk', sans-serif",
              }}>
                Or pick a category above
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={freeCategory}
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.14 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 14 }}>{activeCfg?.icon}</span>
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700, fontSize: 11, color: activeCfg?.color,
                  letterSpacing: '0.06em',
                }}>
                  {activeCfg?.label}
                </span>
                {(categoryStats.get(freeCategory)?.asked ?? 0) > 0 && (
                  <span style={{
                    fontSize: 9,
                    background: `${activeCfg?.color}20`,
                    border: `1px solid ${activeCfg?.color}40`,
                    borderRadius: 20, padding: '1px 7px',
                    color: activeCfg?.color,
                  }}>
                    {categoryStats.get(freeCategory)!.asked} confirmed ✓
                  </span>
                )}
              </div>

              {sortedQuestions.length === 0 ? (
                <div style={{
                  textAlign: 'center', fontSize: 12,
                  color: 'rgba(255,255,254,0.22)', marginTop: 16, fontStyle: 'italic',
                }}>
                  All {activeCfg?.label.toLowerCase()} questions answered ✓
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '2px 0' }}>
                  {sortedQuestions.map((q) => (
                    <NFTQuestionButton
                      key={q.id} question={q} asked={askedIds.has(q.id)}
                      onClick={() => onAsk(q)} matchPct={matchPctMap.get(q.id)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
