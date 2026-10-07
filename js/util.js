// ===== Constantes y utilidades compartidas =====
const W = 960, H = 540;          // resolución lógica
const STAGE_W = 1600;            // ancho total del escenario (scroll horizontal)
const GROUND_Y = 470;            // línea del suelo
const FONT = "Impact, Haettenschweiler, 'Arial Narrow Bold', 'Arial Black', sans-serif";

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const chance = p => Math.random() < p;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function overlap(a, b) {
  return !!(a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
}

function seg(ctx, x1, y1, x2, y2, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

function drawText(ctx, str, x, y, size, fill = '#fff', align = 'center', stroke = '#000', lw) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw || Math.max(2, size / 9);
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

function fireGradient(ctx, y, size, top = '#fff27a', mid = '#ffb21e', bottom = '#c41a0a') {
  const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  g.addColorStop(0, top);
  g.addColorStop(0.5, mid);
  g.addColorStop(1, bottom);
  return g;
}
