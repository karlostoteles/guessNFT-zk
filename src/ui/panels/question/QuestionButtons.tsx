import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import type { Question } from '@/core/data/questions';

// ─── Rarity tiers ─────────────────────────────────────────────────────────────
type RarityTier = 'legendary' | 'rare' | 'uncommon' | 'common';

function getRarityTier(matchPct: number): RarityTier {
  if (matchPct > 0 && matchPct < 5) return 'legendary';
  if (matchPct < 15) return 'rare';
  if (matchPct < 30) return 'uncommon';
  return 'common';
}

const RARITY_COLORS: Record<RarityTier, { color: string; border: string; bg: string; glow?: string }> = {
  legendary: {
    color: '#E8A444',
    border: 'rgba(232,164,68,0.5)',
    bg: 'rgba(232,164,68,0.1)',
    glow: '0 0 10px rgba(232,164,68,0.2)',
  },
  rare: {
    color: '#A78BFA',
    border: 'rgba(124,58,237,0.45)',
    bg: 'rgba(124,58,237,0.08)',
    glow: '0 0 8px rgba(124,58,237,0.15)',
  },
  uncommon: {
    color: '#22D3EE',
    border: 'rgba(6,182,212,0.35)',
    bg: 'rgba(6,182,212,0.06)',
  },
  common: {
    color: 'rgba(255,255,254,0.45)',
    border: 'rgba(255,255,255,0.12)',
    bg: 'rgba(255,255,255,0.04)',
  },
};

function stripPrefix(text: string): string {
  const prefixes = [
    'Does your character have a ',
    'Does your character have an ',
    'Does your character have ',
    'Does your character wear a ',
    'Does your character wear an ',
    'Does your character wear ',
    'Is your character ',
    'Does your character ',
  ];
  let result = text;
  for (const p of prefixes) {
    if (result.startsWith(p)) {
      result = result.slice(p.length);
      break;
    }
  }
  result = result.replace(/\?$/, '').trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// ─── NFT / Online mode question BUBBLE ────────────────────────────────────────

export function NFTQuestionButton({
  question, asked, onClick, matchPct,
}: { question: Question; asked: boolean; onClick: () => void; matchPct?: number }) {
  const tier = matchPct !== undefined ? getRarityTier(matchPct) : 'common';
  const rs = asked ? RARITY_COLORS.common : RARITY_COLORS[tier];
  const label = stripPrefix(question.text);

  return (
    <motion.button
      onClick={onClick}
      whileHover={asked ? {} : { scale: 1.06, boxShadow: rs.glow || 'none' }}
      whileTap={asked ? {} : { scale: 0.95 }}
      style={{
        padding: '6px 14px',
        border: `1.5px solid ${asked ? 'rgba(255,255,255,0.05)' : rs.border}`,
        borderRadius: 20,
        background: asked ? 'rgba(255,255,255,0.02)' : rs.bg,
        color: asked ? 'rgba(255,255,254,0.2)' : rs.color,
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 12,
        fontWeight: 600,
        cursor: asked ? 'default' : 'pointer',
        outline: 'none',
        transition: 'all 0.18s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap' as const,
        textDecoration: asked ? 'line-through' : 'none',
        boxShadow: (!asked && rs.glow) ? rs.glow : 'none',
      }}
    >
      {question.icon && (
        <span style={{ fontSize: 13, opacity: asked ? 0.2 : 0.8 }}>
          {question.icon}
        </span>
      )}
      {label}
      {asked && (
        <span style={{ fontSize: 10, color: 'rgba(232,164,68,0.5)' }}>✓</span>
      )}
    </motion.button>
  );
}

// ─── Rarity info tooltip (rendered as PORTAL to escape 3D canvas z-index) ─────

export function RarityInfoButton() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Calculate position when opened
  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        x: rect.right - 240, // align right edge
        y: rect.top - 8,     // above button
      });
    }
  }, [open]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <motion.button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: '5px 10px',
          cursor: 'pointer',
          outline: 'none',
          color: 'rgba(255,255,254,0.4)',
          fontSize: 12,
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        Info
      </motion.button>

      {/* Portal: render directly to document.body to escape Canvas stacking context */}
      {open && createPortal(
        <>
          {/* Backdrop to close on click */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
            }}
          />
          {/* Info tooltip panel */}
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            style={{
              position: 'fixed',
              left: pos.x,
              top: pos.y,
              transform: 'translateY(-100%)',
              width: 240,
              background: 'rgba(13, 12, 20, 0.97)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 12,
              padding: '12px 14px',
              zIndex: 9999,
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              pointerEvents: 'auto',
            }}
          >
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'rgba(255,255,254,0.5)',
              letterSpacing: '0.08em', marginBottom: 8,
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              TRAIT RARITY
            </div>
            {[
              { label: '★ LEGENDARY', color: '#E8A444', bg: 'rgba(232,164,68,0.12)', desc: '< 5%' },
              { label: '◆ RARE', color: '#A78BFA', bg: 'rgba(124,58,237,0.12)', desc: '< 15%' },
              { label: '● UNCOMMON', color: '#22D3EE', bg: 'rgba(6,182,212,0.1)', desc: '< 30%' },
              { label: 'COMMON', color: 'rgba(255,255,254,0.3)', bg: 'rgba(255,255,255,0.05)', desc: '≥ 30%' },
            ].map(({ label, color, bg, desc }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '3px 8px', borderRadius: 6, background: bg, marginBottom: 3,
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.06em' }}>{label}</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,254,0.2)' }}>{desc}</span>
              </div>
            ))}
            <div style={{ fontSize: 9, color: 'rgba(255,255,254,0.12)', marginTop: 6 }}>
              % of remaining characters that match
            </div>
          </motion.div>
        </>,
        document.body
      )}
    </div>
  );
}

// ─── Free mode question button ────────────────────────────────────────────────

export function FreeQuestionButton({
  question, asked, index, onClick,
}: { question: Question; asked: boolean; index: number; onClick: () => void }) {
  const dots = (['#4ADE80', '#FACC15', '#F87171'] as const)[index % 3];
  return (
    <motion.button
      onClick={onClick}
      whileHover={asked ? {} : { scale: 1.015, background: 'rgba(255,255,255,0.1)' }}
      whileTap={asked ? {} : { scale: 0.98 }}
      style={{
        padding: '11px 14px',
        border: asked
          ? '1px solid rgba(255,255,255,0.04)'
          : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        background: asked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
        color: asked ? 'rgba(255,255,254,0.22)' : '#FFFFFE',
        fontFamily: "'Inter', sans-serif",
        fontSize: 13, fontWeight: 500,
        cursor: asked ? 'default' : 'pointer',
        textAlign: 'left' as const, outline: 'none', lineHeight: 1.4,
        transition: 'all 0.18s',
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      }}
    >
      <span style={{ flex: 1 }}>{question.text}</span>
      {asked ? (
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(232,164,68,0.6)', flexShrink: 0 }}>
          ✓
        </span>
      ) : (
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: dots,
          flexShrink: 0, opacity: 0.7, boxShadow: `0 0 6px ${dots}88`,
        }} />
      )}
    </motion.button>
  );
}
