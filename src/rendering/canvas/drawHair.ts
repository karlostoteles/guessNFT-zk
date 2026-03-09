import { CharacterTraits, HAIR_COLORS } from '@/core/data/traits';

const SIZE = 512;
const CX = SIZE / 2;
const CY = SIZE / 2 + 20;

export function drawHair(ctx: CanvasRenderingContext2D, traits: CharacterTraits) {
  if (traits.hair_style === 'bald') {
    // Just a shine highlight on the head
    ctx.save();
    const grad = ctx.createRadialGradient(CX - 20, CY - 120, 5, CX - 20, CY - 100, 60);
    grad.addColorStop(0, 'rgba(255,255,255,0.15)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.restore();
    return;
  }

  const color = HAIR_COLORS[traits.hair_color];
  const dark = darken(color, 30);

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;

  switch (traits.hair_style) {
    case 'short':
      drawShortHair(ctx, color, dark);
      break;
    case 'long':
      drawLongHair(ctx, color, dark);
      break;
    case 'curly':
      drawCurlyHair(ctx, color, dark);
      break;
    case 'mohawk':
      drawMohawk(ctx, color, dark);
      break;
    case 'ponytail':
      drawPonytail(ctx, color, dark);
      break;
  }

  ctx.restore();
}

function drawShortHair(ctx: CanvasRenderingContext2D, color: string, dark: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(CX - 135, CY - 20);
  ctx.quadraticCurveTo(CX - 140, CY - 120, CX - 80, CY - 170);
  ctx.quadraticCurveTo(CX, CY - 200, CX + 80, CY - 170);
  ctx.quadraticCurveTo(CX + 140, CY - 120, CX + 135, CY - 20);
  ctx.quadraticCurveTo(CX + 130, CY - 50, CX + 110, CY - 80);
  ctx.quadraticCurveTo(CX, CY - 130, CX - 110, CY - 80);
  ctx.quadraticCurveTo(CX - 130, CY - 50, CX - 135, CY - 20);
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawLongHair(ctx: CanvasRenderingContext2D, color: string, dark: string) {
  // Back hair (behind everything, drawn first)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(CX - 145, CY - 10);
  ctx.quadraticCurveTo(CX - 150, CY + 100, CX - 120, CY + 200);
  ctx.quadraticCurveTo(CX - 100, CY + 240, CX - 60, CY + 230);
  ctx.lineTo(CX + 60, CY + 230);
  ctx.quadraticCurveTo(CX + 100, CY + 240, CX + 120, CY + 200);
  ctx.quadraticCurveTo(CX + 150, CY + 100, CX + 145, CY - 10);
  ctx.fill();

  // Top hair
  ctx.beginPath();
  ctx.moveTo(CX - 140, CY - 10);
  ctx.quadraticCurveTo(CX - 145, CY - 130, CX - 80, CY - 175);
  ctx.quadraticCurveTo(CX, CY - 210, CX + 80, CY - 175);
  ctx.quadraticCurveTo(CX + 145, CY - 130, CX + 140, CY - 10);
  ctx.lineTo(CX + 130, CY - 50);
  ctx.quadraticCurveTo(CX, CY - 120, CX - 130, CY - 50);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawCurlyHair(ctx: CanvasRenderingContext2D, color: string, dark: string) {
  // Draw curls as overlapping circles
  const curls = [
    { x: CX - 110, y: CY - 80, r: 35 },
    { x: CX - 80, y: CY - 130, r: 38 },
    { x: CX - 40, y: CY - 160, r: 36 },
    { x: CX, y: CY - 170, r: 40 },
    { x: CX + 40, y: CY - 160, r: 36 },
    { x: CX + 80, y: CY - 130, r: 38 },
    { x: CX + 110, y: CY - 80, r: 35 },
    { x: CX - 130, y: CY - 30, r: 32 },
    { x: CX + 130, y: CY - 30, r: 32 },
    { x: CX - 140, y: CY + 30, r: 30 },
    { x: CX + 140, y: CY + 30, r: 30 },
    { x: CX - 60, y: CY - 170, r: 30 },
    { x: CX + 60, y: CY - 170, r: 30 },
  ];

  ctx.fillStyle = color;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  for (const curl of curls) {
    ctx.beginPath();
    ctx.arc(curl.x, curl.y, curl.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawMohawk(ctx: CanvasRenderingContext2D, color: string, dark: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(CX - 25, CY - 160);
  ctx.quadraticCurveTo(CX - 30, CY - 260, CX, CY - 280);
  ctx.quadraticCurveTo(CX + 30, CY - 260, CX + 25, CY - 160);
  ctx.quadraticCurveTo(CX + 20, CY - 80, CX + 15, CY + 20);
  ctx.quadraticCurveTo(CX, CY + 30, CX - 15, CY + 20);
  ctx.quadraticCurveTo(CX - 20, CY - 80, CX - 25, CY - 160);
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Sides are shaved - add a subtle stubble effect
  ctx.fillStyle = darken(color, 80);
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.ellipse(CX, CY - 80, 130, 100, 0, Math.PI + 0.3, Math.PI * 2 - 0.3);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPonytail(ctx: CanvasRenderingContext2D, color: string, dark: string) {
  // Base hair (short on top)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(CX - 135, CY - 20);
  ctx.quadraticCurveTo(CX - 140, CY - 120, CX - 80, CY - 170);
  ctx.quadraticCurveTo(CX, CY - 200, CX + 80, CY - 170);
  ctx.quadraticCurveTo(CX + 140, CY - 120, CX + 135, CY - 20);
  ctx.quadraticCurveTo(CX + 130, CY - 50, CX + 110, CY - 80);
  ctx.quadraticCurveTo(CX, CY - 130, CX - 110, CY - 80);
  ctx.quadraticCurveTo(CX - 130, CY - 50, CX - 135, CY - 20);
  ctx.fill();

  // Ponytail going to the right
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(CX + 100, CY - 80);
  ctx.quadraticCurveTo(CX + 160, CY - 60, CX + 180, CY + 20);
  ctx.quadraticCurveTo(CX + 190, CY + 80, CX + 170, CY + 140);
  ctx.quadraticCurveTo(CX + 150, CY + 100, CX + 150, CY + 40);
  ctx.quadraticCurveTo(CX + 140, CY - 20, CX + 100, CY - 50);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Hair tie
  ctx.fillStyle = '#CC4444';
  ctx.beginPath();
  ctx.ellipse(CX + 135, CY - 55, 8, 12, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function darken(hex: string, amount: number): string {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return 'rgba(0,0,0,0)';
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `rgb(${r},${g},${b})`;
}
