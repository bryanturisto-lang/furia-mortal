// ===== Escenario: "El Templo de las Sombras" con parallax =====
const Stage = {
  far: null,
  mid: null,
  torches: [],
  embers: [],
  FAR_K: 0.3,
  MID_K: 0.6,

  build() {
    // Capa lejana: montañas y pagoda
    const far = document.createElement('canvas');
    far.width = Math.ceil(W + (STAGE_W - W) * this.FAR_K) + 20;
    far.height = H;
    const c = far.getContext('2d');
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const range = (color, base, amp, step) => {
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(0, H);
      for (let x = 0; x <= far.width + step; x += step * (0.5 + rnd())) c.lineTo(x, base - rnd() * amp);
      c.lineTo(far.width, H);
      c.closePath();
      c.fill();
    };
    range('#2d1530', 300, 150, 60);
    // pagoda en la cima
    const px = far.width * 0.32, py = 210;
    c.fillStyle = '#1d0e22';
    for (let i = 0; i < 4; i++) {
      const w = 90 - i * 18, y = py - i * 30;
      c.fillRect(px - w / 3, y - 4, (w / 3) * 2, 30);
      c.beginPath();
      c.moveTo(px - w, y + 4); c.quadraticCurveTo(px, y - 12, px + w, y + 4);
      c.lineTo(px + w * 0.7, y - 6); c.lineTo(px - w * 0.7, y - 6);
      c.closePath(); c.fill();
    }
    c.fillRect(px - 3, py - 140, 6, 30);
    range('#1c0d22', 360, 110, 45);
    this.far = far;

    // Capa media: muro del templo, pilares, puerta y estandartes
    const mid = document.createElement('canvas');
    mid.width = Math.ceil(W + (STAGE_W - W) * this.MID_K) + 20;
    mid.height = H;
    const m = mid.getContext('2d');
    const MW = mid.width, gx = MW / 2;
    let g = m.createLinearGradient(0, 230, 0, 432);
    g.addColorStop(0, '#1d1218');
    g.addColorStop(1, '#33201f');
    m.fillStyle = g;
    m.fillRect(0, 232, MW, 200);
    m.strokeStyle = 'rgba(0,0,0,0.35)';
    m.lineWidth = 1;
    for (let y = 238, row = 0; y < 432; y += 18, row++) {
      m.beginPath(); m.moveTo(0, y); m.lineTo(MW, y); m.stroke();
      for (let x = row % 2 ? 0 : 24; x < MW; x += 48) {
        m.beginPath(); m.moveTo(x, y); m.lineTo(x, y + 18); m.stroke();
      }
    }
    // alero del techo
    m.fillStyle = '#120a0e';
    m.beginPath();
    m.moveTo(-20, 240); m.lineTo(MW + 20, 240); m.lineTo(MW + 20, 214);
    m.quadraticCurveTo(gx, 226, -20, 214);
    m.closePath(); m.fill();
    m.fillStyle = '#5a1418';
    m.fillRect(-20, 236, MW + 40, 4);

    // puerta central con resplandor rojo
    m.fillStyle = '#0a0508';
    m.beginPath();
    m.moveTo(gx - 70, 432); m.lineTo(gx - 70, 320); m.arc(gx, 320, 70, Math.PI, 0); m.lineTo(gx + 70, 432);
    m.closePath(); m.fill();
    g = m.createRadialGradient(gx, 432, 10, gx, 432, 140);
    g.addColorStop(0, 'rgba(255,60,20,0.55)');
    g.addColorStop(1, 'rgba(255,60,20,0)');
    m.fillStyle = g;
    m.fill();
    m.strokeStyle = '#6a4a2a';
    m.lineWidth = 6;
    m.stroke();

    // pilares y estandartes
    this.torches = [];
    const pillars = [gx - 560, gx - 300, gx - 150, gx + 150, gx + 300, gx + 560];
    for (const p of pillars) {
      g = m.createLinearGradient(p - 24, 0, p + 24, 0);
      g.addColorStop(0, '#1c1216');
      g.addColorStop(0.45, '#46302c');
      g.addColorStop(1, '#170e12');
      m.fillStyle = g;
      m.fillRect(p - 24, 160, 48, 272);
      m.fillStyle = '#2a1a1a';
      m.fillRect(p - 32, 152, 64, 16);
      m.fillRect(p - 30, 416, 60, 16);
      m.fillStyle = '#111';
      m.fillRect(p - 5, 300, 10, 22);
      this.torches.push([p, 292]);
    }
    for (const b of [gx - 430, gx + 430]) {
      m.fillStyle = '#5c0b10';
      m.beginPath();
      m.moveTo(b - 34, 250); m.lineTo(b + 34, 250); m.lineTo(b + 34, 370); m.lineTo(b, 350); m.lineTo(b - 34, 370);
      m.closePath(); m.fill();
      m.strokeStyle = '#c8961e';
      m.lineWidth = 3;
      m.beginPath(); m.arc(b, 296, 18, 0, Math.PI * 2); m.stroke();
      m.beginPath(); m.moveTo(b - 9, 286); m.lineTo(b + 9, 306); m.moveTo(b + 9, 286); m.lineTo(b - 9, 306); m.stroke();
    }
    this.mid = mid;
  },

  // Escenario realista: fondo pintado (Meshy) con parallax + suelo 3D en perspectiva (render3d.js).
  // Mientras la imagen no cargue (o si falla) se usa el escenario dibujado de siempre.
  foto: (() => { const im = new Image(); im.src = 'modelos/fondo.jpg'; return im; })(),
  FOTO_S: 0.8,
  // braseros de la imagen original (x, y de la llama, en px de la imagen 1376x768) y su tamaño
  BRASEROS: [[95, 488, 1.3], [440, 478, 0.7], [938, 478, 0.7], [1278, 488, 1.3]],
  // antorchas de pared (x, y, tamaño)
  ANTORCHAS: [[66, 296, 0.6], [1312, 296, 0.6], [397, 395, 0.4], [608, 418, 0.3], [774, 418, 0.3], [983, 395, 0.4]],

  draw(ctx, camX, t) {
    const im = this.foto;
    if (im.complete && im.naturalWidth) this.drawReal(ctx, camX, t, im);
    else this.drawClassic(ctx, camX, t);
  },

  drawReal(ctx, camX, t, im) {
    const s = this.FOTO_S, bw = im.naturalWidth * s, bh = im.naturalHeight * s;
    const ox = -Math.max(0, Math.min(STAGE_W - W, camX)) * (bw - W) / (STAGE_W - W);
    ctx.drawImage(im, ox, 0, bw, bh);

    // fuego vivo sobre los braseros y antorchas de la pintura
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const fuego = (x, y, k, i) => {
      const f = 0.75 + Math.sin(t * 0.21 + i * 2.3) * 0.12 + Math.sin(t * 0.53 + i) * 0.08 + Math.random() * 0.1;
      const r = 60 * k * f;
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, `rgba(255,190,90,${0.38 * f})`);
      g.addColorStop(0.35, `rgba(255,110,30,${0.18 * f})`);
      g.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      if (Math.random() < 0.18 * k) this.embers.push({ x: x - ox, y: y - 6 * k, vx: rand(-0.35, 0.35), vy: rand(-1.6, -0.6), life: rand(30, 70) });
    };
    this.BRASEROS.forEach(([x, y, k], i) => fuego(ox + x * s, y * s, k, i));
    this.ANTORCHAS.forEach(([x, y, k], i) => fuego(ox + x * s, y * s, k, i + 4));
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.x += e.vx + Math.sin((t + i * 13) * 0.05) * 0.2; e.y += e.vy; e.life--;
      if (e.life <= 0) { this.embers.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(255,${140 + (e.life | 0)},60,${Math.min(1, e.life / 30)})`;
      ctx.fillRect(e.x + ox, e.y, 2, 2);
    }
    ctx.restore();

    // neblina que se arrastra al pie de los muros
    for (let i = 0; i < 6; i++) {
      const x = ((i * 230 + t * (0.25 + i * 0.04)) % (W + 400)) - 200 + ox * 0.5 % 200;
      const y = 380 + (i % 3) * 14;
      const g = ctx.createRadialGradient(x, y, 10, x, y, 190);
      g.addColorStop(0, 'rgba(150,140,160,0.10)');
      g.addColorStop(1, 'rgba(150,140,160,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 190, y - 190, 380, 380);
    }

    // suelo de piedra en perspectiva (se mueve igual que los luchadores)
    if (!(window.R3D && R3D.drawFloor(ctx, camX))) this.drawFloor(ctx, camX);
    // viñeta para dar profundidad
    const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 1.05);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  },

  drawClassic(ctx, camX, t) {
    // cielo
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#07040c');
    g.addColorStop(0.45, '#2b0b1e');
    g.addColorStop(0.75, '#5a1420');
    g.addColorStop(1, '#14060a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // luna de sangre
    const mx = W * 0.72 - camX * 0.05, my = 112;
    const mg = ctx.createRadialGradient(mx, my, 40, mx, my, 160);
    mg.addColorStop(0, 'rgba(255,120,80,0.35)');
    mg.addColorStop(1, 'rgba(255,120,80,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(mx - 160, my - 160, 320, 320);
    ctx.fillStyle = '#f0c8a0';
    circle(ctx, mx, my, 56);
    ctx.fillStyle = 'rgba(160,70,50,0.35)';
    circle(ctx, mx - 18, my - 10, 12);
    circle(ctx, mx + 16, my + 14, 9);
    circle(ctx, mx + 8, my - 22, 6);

    // nubes
    ctx.fillStyle = 'rgba(20,5,15,0.55)';
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 260 + t * 0.15 - camX * 0.1) % (W + 300) + W + 300) % (W + 300) - 150;
      ctx.beginPath();
      ctx.ellipse(cx, 80 + (i % 3) * 30, 140, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.drawImage(this.far, Math.round(-camX * this.FAR_K), 0);
    // niebla
    const fg = ctx.createLinearGradient(0, 320, 0, 432);
    fg.addColorStop(0, 'rgba(90,20,30,0)');
    fg.addColorStop(1, 'rgba(90,20,30,0.35)');
    ctx.fillStyle = fg;
    ctx.fillRect(0, 320, W, 112);
    ctx.drawImage(this.mid, Math.round(-camX * this.MID_K), 0);

    // antorchas
    ctx.globalCompositeOperation = 'lighter';
    this.torches.forEach(([tx, ty], i) => {
      const sx = tx - camX * this.MID_K;
      if (sx < -100 || sx > W + 100) return;
      const f = Math.sin(t * 0.3 + i * 1.7) * 0.15 + Math.random() * 0.12;
      const rg = ctx.createRadialGradient(sx, ty, 4, sx, ty, 90);
      rg.addColorStop(0, 'rgba(255,140,40,0.35)');
      rg.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(sx - 90, ty - 90, 180, 180);
      ctx.fillStyle = '#ff6a1a';
      ctx.beginPath(); ctx.ellipse(sx, ty - 8, 8, 17 * (1 + f), 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd860';
      ctx.beginPath(); ctx.ellipse(sx, ty - 4, 4, 9 * (1 + f), 0, 0, Math.PI * 2); ctx.fill();
      if (Math.random() < 0.08) this.embers.push({ x: tx, y: ty - 10, vx: rand(-0.4, 0.4), vy: rand(-1.4, -0.6), life: rand(40, 80) });
    });
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.x += e.vx; e.y += e.vy; e.life--;
      if (e.life <= 0) { this.embers.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(255,${120 + (e.life | 0)},40,${Math.min(1, e.life / 40)})`;
      ctx.fillRect(e.x - camX * this.MID_K, e.y, 2, 2);
    }
    ctx.globalCompositeOperation = 'source-over';

    this.drawFloor(ctx, camX);
  },

  drawFloor(ctx, camX) {
    const top = 432;
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, '#3a2824');
    g.addColorStop(1, '#140c0a');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    for (const y of [top + 9, top + 24, top + 44, top + 70, top + 102]) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // juntas en perspectiva
    for (let wx = 0; wx <= STAGE_W; wx += 100) {
      const rel = wx - camX - W / 2;
      ctx.beginPath();
      ctx.moveTo(W / 2 + rel * this.MID_K, top);
      ctx.lineTo(W / 2 + rel * 1.4, H);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, top, W, 3);
  },
};
