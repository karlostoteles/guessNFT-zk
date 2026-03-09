import { CharacterTraits, SKIN_COLORS, EYE_COLORS } from '@/core/data/traits';

const SIZE = 512;
const CX = SIZE / 2;
const CY = SIZE / 2 + 20;

export function drawFace(ctx: CanvasRenderingContext2D, traits: CharacterTraits) {
  const skinColor = SKIN_COLORS[traits.skin_tone];
  const eyeColor = EYE_COLORS[traits.eye_color];

  // Face shape - oval
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(CX, CY, 130, 160, 0, 0, Math.PI * 2);
  ctx.fillStyle = skinColor;
  ctx.fill();
  ctx.strokeStyle = darken(skinColor, 30);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // Eyes
  const eyeY = CY - 20;
  const eyeSpacing = 50;
  drawEye(ctx, CX - eyeSpacing, eyeY, eyeColor, traits.gender);
  drawEye(ctx, CX + eyeSpacing, eyeY, eyeColor, traits.gender);

  // Eyebrows
  const browY = eyeY - 28;
  ctx.save();
  ctx.strokeStyle = darken(skinColor, 60);
  ctx.lineWidth = traits.gender === 'male' ? 5 : 3;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(CX - eyeSpacing - 18, browY + 3);
  ctx.quadraticCurveTo(CX - eyeSpacing, browY - 5, CX - eyeSpacing + 18, browY + 1);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(CX + eyeSpacing - 18, browY + 1);
  ctx.quadraticCurveTo(CX + eyeSpacing, browY - 5, CX + eyeSpacing + 18, browY + 3);
  ctx.stroke();
  ctx.restore();

  // Nose
  ctx.save();
  ctx.strokeStyle = darken(skinColor, 25);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(CX, CY - 5);
  ctx.quadraticCurveTo(CX + 12, CY + 20, CX, CY + 22);
  ctx.stroke();
  ctx.restore();

  // Mouth
  ctx.save();
  ctx.strokeStyle = darken(skinColor, 40);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(CX - 22, CY + 45);
  ctx.quadraticCurveTo(CX, CY + 55, CX + 22, CY + 45);
  ctx.stroke();

  // Lips fill
  ctx.fillStyle = traits.gender === 'female' ? '#C06060' : darken(skinColor, 20);
  ctx.beginPath();
  ctx.moveTo(CX - 20, CY + 45);
  ctx.quadraticCurveTo(CX, CY + 38, CX + 20, CY + 45);
  ctx.quadraticCurveTo(CX, CY + 55, CX - 20, CY + 45);
  ctx.fill();
  ctx.restore();

  // Ears
  ctx.save();
  ctx.fillStyle = skinColor;
  ctx.strokeStyle = darken(skinColor, 25);
  ctx.lineWidth = 2;
  // Left
  ctx.beginPath();
  ctx.ellipse(CX - 128, CY, 14, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Right
  ctx.beginPath();
  ctx.ellipse(CX + 128, CY, 14, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, gender: string) {
  ctx.save();
  // Eye white
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(x, y, 18, gender === 'female' ? 14 : 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Iris
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();

  // Pupil
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(x + 3, y - 3, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function darken(hex: string, amount: number): string {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return 'rgba(0,0,0,0)';
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `rgb(${r},${g},${b})`;
}
