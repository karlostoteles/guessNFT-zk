import * as THREE from 'three';
import { Character } from '@/core/data/characters';
import { drawFace } from './drawFace';
import { drawHair } from './drawHair';
import { drawAccessories } from './drawAccessories';

const SIZE = 512;
const NAME_HEIGHT = 80; // bottom name banner height

// Default palette — vibrant, distinct pastels
const DEFAULT_BG_COLORS = [
  '#C5DCE8', '#D5E8C5', '#E8C5D5', '#D5C5E8',
  '#E8E0B7', '#C5E8E0', '#E8CDB7', '#B7D5E8',
  '#D5E8B7', '#E8B7C5', '#C5B7E8', '#E8D8B0',
  '#C0D5E8', '#D8E8C0', '#E8C0D0', '#C8E8D0',
];

// Per-character config for meme crypto characters
const MEME_CONFIG: Record<string, { bg: string; badge: string }> = {
  m01: { bg: '#627EEA', badge: 'Ξ' },       // Vitalik
  m02: { bg: '#F7931A', badge: '₿' },       // Satoshi
  m03: { bg: '#F0B90B', badge: '🔶' },      // CZ
  m04: { bg: '#1A9BAC', badge: '💸' },      // SBF
  m05: { bg: '#3D9BE9', badge: '🌙' },      // Do Kwon
  m06: { bg: '#FF6B00', badge: '⚡' },      // Saylor
  m07: { bg: '#9945FF', badge: '◎' },       // Ansem — SOL
  m08: { bg: '#00A876', badge: '📈' },      // Cobie
  m09: { bg: '#4CAF50', badge: '🔮' },      // Hsaka
  m10: { bg: '#D4A017', badge: '💪' },      // Gigachad
  m11: { bg: '#34495E', badge: '🏛️' },      // Gensler
  m12: { bg: '#E74C3C', badge: '☀️' },      // Justin Sun
  m13: { bg: '#FF007A', badge: '🦄' },      // Hayden
  m14: { bg: '#B6509E', badge: '👻' },      // Stani
  m15: { bg: '#0052FF', badge: '🧪' },      // Andre
  m16: { bg: '#E6007A', badge: '⬛' },      // Gavin
  m17: { bg: '#FF9900', badge: '💻' },      // PajeetDev
  m18: { bg: '#607D8B', badge: '🤖' },      // NPC Trader
  m19: { bg: '#CC2200', badge: '🐱' },      // Roaringkitty
  m20: { bg: '#1A237E', badge: '❄️' },      // Zhu Su
  m21: { bg: '#0288D1', badge: '🔍' },      // ZachXBT
  m22: { bg: '#1565C0', badge: '🏴' },      // Rune
  m23: { bg: '#5D4037', badge: '☕' },      // Coffeezilla
  m24: { bg: '#6A1B9A', badge: '🪬' },      // Murad
};

export function renderPortrait(
  character: Character,
  nftImage?: HTMLImageElement | HTMLCanvasElement,
  lowRes: boolean = false
): THREE.CanvasTexture {
  const finalSize = lowRes ? 64 : SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = finalSize;
  canvas.height = finalSize;
  const ctx = canvas.getContext('2d')!;

  // Scale context if lowRes for internal drawing consistency
  if (lowRes) ctx.scale(64 / SIZE, 64 / SIZE);

  // Resolve background color
  const memeConf = MEME_CONFIG[character.id];
  const bg = memeConf
    ? memeConf.bg
    : DEFAULT_BG_COLORS[Math.abs(hashCode(character.id)) % DEFAULT_BG_COLORS.length];

  // Portrait area background
  const portraitH = SIZE - (lowRes ? 0 : NAME_HEIGHT); // No name banner in low-res thumbnails
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, portraitH || SIZE);

  // Skip vignette in low-res
  if (!lowRes) {
    const vgGrad = ctx.createRadialGradient(SIZE / 2, portraitH / 2, 60, SIZE / 2, portraitH / 2, SIZE / 2);
    vgGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
    vgGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = vgGrad;
    ctx.fillRect(0, 0, SIZE, portraitH);
  }

  // Draw portrait
  if (nftImage) {
    ctx.drawImage(nftImage, 0, 0, SIZE, portraitH || SIZE);
  } else {
    // Draw procedural portrait
    const traits = character.traits;
    if (traits.hair_style === 'long' || traits.hair_style === 'curly') {
      drawHair(ctx, traits);
      drawFace(ctx, traits);
    } else {
      drawFace(ctx, traits);
      drawHair(ctx, traits);
    }
    drawAccessories(ctx, traits);
  }

  // Skip badge/name banner in low-res thumbnails to save GPU/CPU
  if (!lowRes) {
    if (memeConf?.badge) {
      const bRadius = 34;
      const bx = SIZE - bRadius - 10;
      const by = bRadius + 10;
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, bRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = `${bRadius * 1.0}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(memeConf.badge, bx, by + 2);
      ctx.restore();
    }

    const bannerY = portraitH;
    const bannerGrad = ctx.createLinearGradient(0, bannerY, 0, SIZE);
    bannerGrad.addColorStop(0, 'rgba(8,8,18,0.93)');
    bannerGrad.addColorStop(1, 'rgba(8,8,18,0.98)');
    ctx.fillStyle = bannerGrad;
    ctx.fillRect(0, bannerY, SIZE, NAME_HEIGHT);

    ctx.fillStyle = lighten(bg, 50);
    ctx.fillRect(0, bannerY, SIZE, 3);

    const nameLen = character.name.length;
    const fontSize = nameLen > 12 ? 38 : nameLen > 9 ? 44 : 52;
    ctx.save();
    ctx.font = `bold ${fontSize}px "Space Grotesk", "Inter", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = lighten(bg, 40);
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(character.name, SIZE / 2, bannerY + NAME_HEIGHT / 2 + 2);
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function renderCardBack(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // Dark gradient
  const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(1, '#16213e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Diagonal line pattern
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = -SIZE; i < SIZE * 2; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + SIZE, SIZE);
    ctx.stroke();
  }

  // Question mark
  ctx.save();
  ctx.font = 'bold 200px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(232, 164, 68, 0.55)';
  ctx.shadowColor = 'rgba(232,164,68,0.3)';
  ctx.shadowBlur = 40;
  ctx.fillText('?', SIZE / 2, SIZE / 2);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function lighten(hex: string, amount: number): string {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return 'rgba(255,255,255,0)';
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `rgb(${r},${g},${b})`;
}
