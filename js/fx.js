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

  add(p) { if (this.parts.length < 900) this.parts.push(p); }

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
    for (const sk of this.skeletons) drawSkeleton(ctx, sk.x - camX, GROUND_Y + 2, sk.dir);
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
      }
    }
  }
}

function drawSkeleton(ctx, x, y, dir) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.strokeStyle = '#e8e0c8';
  ctx.fillStyle = '#e8e0c8';
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  // cráneo
  circle(ctx, -74, -12, 11);
  ctx.fillRect(-70, -8, 10, 6);
  ctx.fillStyle = '#111';
  circle(ctx, -78, -15, 2.6);
  circle(ctx, -71, -15, 2.6);
  // columna y costillas
  seg(ctx, -60, -7, 2, -7, 4, '#e8e0c8');
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(-48 + i * 8, -7, 3, 11 - i, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  // pelvis, piernas y brazos
  ctx.fillStyle = '#e8e0c8';
  ctx.beginPath();
  ctx.ellipse(6, -8, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  seg(ctx, 10, -6, 52, -4, 4, '#e8e0c8');
  seg(ctx, 52, -4, 94, -3, 4, '#e8e0c8');
  seg(ctx, 10, -9, 50, -14, 4, '#e8e0c8');
  seg(ctx, 50, -14, 90, -8, 4, '#e8e0c8');
  seg(ctx, -55, -7, -30, 4, 3.5, '#e8e0c8');
  seg(ctx, -30, 4, -6, 3, 3.5, '#e8e0c8');
  ctx.restore();
}
