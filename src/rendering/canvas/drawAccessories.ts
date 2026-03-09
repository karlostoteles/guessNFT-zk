import { CharacterTraits, SKIN_COLORS } from '@/core/data/traits';

const SIZE = 512;
const CX = SIZE / 2;
const CY = SIZE / 2 + 20;

export function drawAccessories(ctx: CanvasRenderingContext2D, traits: CharacterTraits) {
  if (traits.has_beard) drawBeard(ctx, traits);
  if (traits.has_glasses) drawGlasses(ctx);
  if (traits.has_hat) drawHat(ctx, traits);
  if (traits.has_earrings) drawEarrings(ctx);
}

function drawBeard(ctx: CanvasRenderingContext2D, traits: CharacterTraits) {
  const skinColor = SKIN_COLORS[traits.skin_tone];
  ctx.save();
  ctx.fillStyle = darken(skinColor, 50);
  ctx.globalAlpha = 0.6;

  // Full beard shape
  ctx.beginPath();
  ctx.moveTo(CX - 80, CY + 25);
  ctx.quadraticCurveTo(CX - 100, CY + 60, CX - 70, CY + 100);
  ctx.quadraticCurveTo(CX - 40, CY + 140, CX, CY + 150);
  ctx.quadraticCurveTo(CX + 40, CY + 140, CX + 70, CY + 100);
  ctx.quadraticCurveTo(CX + 100, CY + 60, CX + 80, CY + 25);
  ctx.fill();

  // Stubble texture dots
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = darken(skinColor, 70);
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI;
    const dist = 30 + Math.random() * 80;
    const x = CX + Math.cos(angle) * dist * (Math.random() > 0.5 ? 1 : -1) * 0.8;
    const y = CY + 50 + Math.random() * 80;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawGlasses(ctx: CanvasRenderingContext2D) {
  const eyeY = CY - 20;
  const eyeSpacing = 50;

  ctx.save();
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  // Left lens
  ctx.beginPath();
  roundedRect(ctx, CX - eyeSpacing - 28, eyeY - 22, 56, 44, 10);
  ctx.stroke();

  // Right lens
  ctx.beginPath();
  roundedRect(ctx, CX + eyeSpacing - 28, eyeY - 22, 56, 44, 10);
  ctx.stroke();

  // Bridge
  ctx.beginPath();
  ctx.moveTo(CX - eyeSpacing + 28, eyeY);
  ctx.quadraticCurveTo(CX, eyeY - 8, CX + eyeSpacing - 28, eyeY);
  ctx.stroke();

  // Temples (arms)
  ctx.beginPath();
  ctx.moveTo(CX - eyeSpacing - 28, eyeY - 10);
  ctx.lineTo(CX - 140, eyeY - 8);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(CX + eyeSpacing + 28, eyeY - 10);
  ctx.lineTo(CX + 140, eyeY - 8);
  ctx.stroke();

  // Lens tint
  ctx.fillStyle = 'rgba(200, 220, 255, 0.12)';
  ctx.beginPath();
  roundedRect(ctx, CX - eyeSpacing - 28, eyeY - 22, 56, 44, 10);
  ctx.fill();
  ctx.beginPath();
  roundedRect(ctx, CX + eyeSpacing - 28, eyeY - 22, 56, 44, 10);
  ctx.fill();

  ctx.restore();
}

function drawHat(ctx: CanvasRenderingContext2D, traits: CharacterTraits) {
  ctx.save();

  const hatColor = '#444466';
  const hatLight = '#555577';

  // Brim
  ctx.fillStyle = darken(hatColor, 15);
  ctx.beginPath();
  ctx.ellipse(CX, CY - 145, 150, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = darken(hatColor, 40);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Crown
  ctx.fillStyle = hatColor;
  ctx.beginPath();
  ctx.moveTo(CX - 100, CY - 145);
  ctx.quadraticCurveTo(CX - 105, CY - 220, CX - 70, CY - 250);
  ctx.quadraticCurveTo(CX, CY - 270, CX + 70, CY - 250);
  ctx.quadraticCurveTo(CX + 105, CY - 220, CX + 100, CY - 145);
  ctx.fill();
  ctx.stroke();

  // Band
  ctx.fillStyle = '#CC6633';
  ctx.fillRect(CX - 100, CY - 160, 200, 15);

  ctx.restore();
}

function drawEarrings(ctx: CanvasRenderingContext2D) {
  ctx.save();

  // Gold earring studs
  const earY = CY + 10;
  const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, 8);
  gradient.addColorStop(0, '#FFD700');
  gradient.addColorStop(1, '#B8860B');

  // Left earring
  ctx.save();
  ctx.translate(CX - 140, earY);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8B6914';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Dangle
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.lineTo(-4, 22);
  ctx.lineTo(4, 22);
  ctx.closePath();
  ctx.fillStyle = '#FFD700';
  ctx.fill();
  ctx.restore();

  // Right earring
  ctx.save();
  ctx.translate(CX + 140, earY);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8B6914';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.lineTo(-4, 22);
  ctx.lineTo(4, 22);
  ctx.closePath();
  ctx.fillStyle = '#FFD700';
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
}

function darken(hex: string, amount: number): string {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return 'rgba(0,0,0,0)';
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `rgb(${r},${g},${b})`;
}
