// ===== Partículas: sangre, chispas, humo, brillos, restos y esqueletos =====
class FX {
  constructor() {
    this.parts = [];
    this.splats = [];
    this.skeletons = [];
  }

  clear() {
    this.parts.length = 0;
    this.splats.length = 0;
    this.skeletons.length = 0;
  }

  add(p) {
    if (this.parts.length >= 900) return;
    p.max = p.life;
    this.parts.push(p);
  }

  // Fuego realista: llamas que nacen blancas/amarillas, se enfrían a naranja y rojo y acaban en humo
  flame(x, y, size = 14, vy = -2.4, spread = 1) {
    this.add({ x, y, vx: rand(-0.6, 0.6) * spread, vy: vy * rand(0.7, 1.3), g: -0.04, life: rand(16, 30),
      size: size * rand(0.7, 1.3), kind: 'flame', rot: rand(0, 6) });
  }

  smokePuff(x, y, size = 16, dark = 0.55) {
    this.add({ x, y, vx: rand(-0.5, 0.5), vy: rand(-1.6, -0.6), g: -0.005, life: rand(40, 70), size: size * rand(0.8, 1.2),
      kind: 'smoke', dark });
  }

  // ceniza que flota y cae despacio
  ash(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.add({ x: x + rand(-30, 30), y: y + rand(-150, 0), vx: rand(-1.2, 1.2), vy: rand(-2.5, 0.5), g: 0.04, life: rand(60, 140),
        size: rand(1.5, 3.5), kind: 'ash', rot: rand(0, 6), vr: rand(-0.2, 0.2), hot: chance(0.3) });
    }
  }

  blood(x, y, dir, n) {
    for (let i = 0; i < n; i++) {
      this.add({ x, y, vx: dir * rand(1, 7) + rand(-2, 2), vy: rand(-7, 1), g: 0.45, life: rand(40, 70),
        size: rand(2, 5), color: chance(0.5) ? '#c0000f' : '#8a0008', kind: 'blood' });
    }
  }

  sparks(x, y, dir, color = '#ffe680') {
    for (let i = 0; i < 12; i++) {
      this.add({ x, y, vx: dir * rand(1, 6) + rand(-3, 3), vy: rand(-5, 3), g: 0.15, life: rand(8, 16),
        size: rand(1.5, 3), color, kind: 'glow' });
    }
  }

  burst(x, y, color, n = 18, speed = 6) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(1, speed);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.05, life: rand(14, 30),
        size: rand(2, 5), color, kind: 'glow' });
    }
  }

  trail(x, y, color) {
    this.add({ x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-0.5, 0.5), vy: rand(-0.8, 0.2), g: 0,
      life: rand(10, 20), size: rand(3, 7), color, kind: 'glow' });
  }

  smoke(x, y, color) {
    for (let i = 0; i < 26; i++) {
      this.add({ x: x + rand(-30, 30), y: y + rand(-70, 70), vx: rand(-1, 1), vy: rand(-1.5, -0.2), g: 0,
        life: rand(20, 40), size: rand(8, 18), color: chance(0.5) ? color : '#222', kind: 'puff' });
    }
  }

  splat(x, color, n) {
    for (let i = 0; i < n; i++) this.splats.push({ x: x + rand(-60, 60), y: GROUND_Y + rand(0, 14), w: rand(8, 20), c: color });
  }

  gibs(x, y, colors) {
    for (let i = 0; i < 30; i++) {
      this.add({ x: x + rand(-20, 20), y: y + rand(-60, 60), vx: rand(-9, 9), vy: rand(-14, -3), g: 0.5, life: 420,
        size: rand(6, 14), color: pick(colors), kind: 'gib', rot: rand(0, 6), vr: rand(-0.3, 0.3) });
    }
  }

  update() {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life--;
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      if (p.vr) p.rot += p.vr;
      if (p.kind === 'puff') p.size *= 1.02;
      else if (p.kind === 'smoke') { p.size *= 1.018; p.vx *= 0.98; }
      else if (p.kind === 'flame') { p.size *= 0.975; p.vx *= 0.96; }
      else if (p.kind === 'ash') { p.vx = p.vx * 0.97 + Math.sin(p.life * 0.15) * 0.06; if (p.y > GROUND_Y + 4) { p.y = GROUND_Y + 4; p.vy = 0; p.vx = 0; p.g = 0; } }
      if (p.kind === 'blood' && p.y >= GROUND_Y + 4) {
        if (this.splats.length < 160) this.splats.push({ x: p.x, y: GROUND_Y + rand(0, 12), w: rand(4, 12) });
        this.parts.splice(i, 1);
        continue;
      }
      if ((p.kind === 'gib' || p.kind === 'head') && p.y >= GROUND_Y + 6) {
        p.y = GROUND_Y + 6;
        p.vy *= -0.3;
        p.vx *= 0.6;
        p.vr *= 0.5;
        if (Math.abs(p.vy) < 1) { p.vy = 0; p.g = 0; }
      }
      if (p.life <= 0) this.parts.splice(i, 1);
    }
  }

  drawFloor(ctx, camX) {
    for (const s of this.splats) {
      ctx.fillStyle = s.c || 'rgba(110,0,8,0.8)';
      ctx.beginPath();
      ctx.ellipse(s.x - camX, s.y, s.w, s.w * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const sk of this.skeletons) drawSkeleton(ctx, sk.x - camX, GROUND_Y + 2, sk.dir, sk.burnt);
  }

  draw(ctx, camX) {
    for (const p of this.parts) {
      const x = p.x - camX;
      switch (p.kind) {
        case 'blood':
          ctx.fillStyle = p.color;
          ctx.fillRect(x, p.y, p.size, p.size);
          break;
        case 'gib':
          ctx.save();
          ctx.translate(x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
          ctx.restore();
          break;
        case 'head':
          ctx.save();
          ctx.translate(x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          circle(ctx, 0, 0, p.size);
          ctx.fillStyle = p.skin;
          ctx.fillRect(1, -6, 12, 7);
          ctx.fillStyle = '#8a0008';
          circle(ctx, 0, p.size - 2, 5);
          ctx.restore();
          break;
        case 'puff':
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 30)) * 0.7;
          ctx.fillStyle = p.color;
          circle(ctx, x, p.y, p.size);
          ctx.globalAlpha = 1;
          break;
        case 'glow':
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 15));
          ctx.fillStyle = p.color;
          circle(ctx, x, p.y, p.size);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
          break;
        case 'flame': {
          // edad 0 → 1: blanco-amarillo, naranja, rojo oscuro
          const age = 1 - p.life / p.max, spr = FLAME_SPRITES()[age < 0.3 ? 0 : age < 0.65 ? 1 : 2];
          const s = p.size * (age < 0.3 ? 1 : 1.25);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = Math.max(0, Math.min(1, (1 - age) * 1.4)) * 0.7;
          ctx.drawImage(spr, x - s, p.y - s * 1.3, s * 2, s * 2.6);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'smoke': {
          const age = 1 - p.life / p.max;
          ctx.globalAlpha = Math.max(0, Math.min(age * 4, 1 - age)) * p.dark;
          ctx.drawImage(FLAME_SPRITES()[3], x - p.size, p.y - p.size, p.size * 2, p.size * 2);
          ctx.globalAlpha = 1;
          break;
        }
        case 'ash':
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 40));
          ctx.fillStyle = p.hot && p.life > p.max * 0.5 ? '#ff9a40' : '#5a524c';
          ctx.save(); ctx.translate(x, p.y); ctx.rotate(p.rot);
          ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
          ctx.restore();
          ctx.globalAlpha = 1;
          break;
      }
    }
  }
}

// Texturas suaves para el fuego y el humo (se crean una sola vez)
let _flameSprites = null;
function FLAME_SPRITES() {
  if (_flameSprites) return _flameSprites;
  const mk = (stops) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return c;
  };
  _flameSprites = [
    mk([[0, 'rgba(255,255,230,1)'], [0.25, 'rgba(255,220,120,0.9)'], [0.6, 'rgba(255,130,30,0.35)'], [1, 'rgba(255,80,0,0)']]),
    mk([[0, 'rgba(255,190,80,0.95)'], [0.35, 'rgba(255,110,20,0.6)'], [0.75, 'rgba(200,40,0,0.18)'], [1, 'rgba(120,20,0,0)']]),
    mk([[0, 'rgba(220,70,10,0.7)'], [0.5, 'rgba(140,25,0,0.3)'], [1, 'rgba(60,10,0,0)']]),
    mk([[0, 'rgba(40,34,32,0.9)'], [0.55, 'rgba(30,26,26,0.45)'], [1, 'rgba(20,18,18,0)']]),
  ];
  return _flameSprites;
}

function drawSkeleton(ctx, x, y, dir, burnt) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  // huesos carbonizados (tras el fuego) o limpios
  const bone = burnt ? '#2e2420' : '#e8e0c8';
  if (burnt) { ctx.shadowColor = '#ff5a10'; ctx.shadowBlur = 6; }
  ctx.strokeStyle = bone;
  ctx.fillStyle = bone;
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  // cráneo
  circle(ctx, -74, -12, 11);
  ctx.fillRect(-70, -8, 10, 6);
  ctx.fillStyle = '#111';
  circle(ctx, -78, -15, 2.6);
  circle(ctx, -71, -15, 2.6);
  // columna y costillas
  seg(ctx, -60, -7, 2, -7, 4, bone);
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(-48 + i * 8, -7, 3, 11 - i, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  // pelvis, piernas y brazos
  ctx.fillStyle = bone;
  ctx.beginPath();
  ctx.ellipse(6, -8, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  seg(ctx, 10, -6, 52, -4, 4, bone);
  seg(ctx, 52, -4, 94, -3, 4, bone);
  seg(ctx, 10, -9, 50, -14, 4, bone);
  seg(ctx, 50, -14, 90, -8, 4, bone);
  seg(ctx, -55, -7, -30, 4, 3.5, bone);
  seg(ctx, -30, 4, -6, 3, 3.5, bone);
  ctx.restore();
}
