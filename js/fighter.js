// ===== Luchador: estados, física, golpes, especiales y dibujo procedural (esqueleto con cinemática inversa) =====
const TORSO = 58, THIGH = 47, SHIN = 46, UARM = 32, FARM = 30;
const GRAV = 0.85;
const CONTROL_STATES = new Set(['idle', 'walk', 'run', 'crouch', 'block', 'cblock']);
const LYING = new Set(['down', 'dead', 'launched', 'getup']);
const NO_HURT = new Set(['down', 'getup', 'dead', 'held', 'intro']);
const THROWABLE = new Set(['idle', 'walk', 'run', 'crouch', 'block', 'cblock', 'attack', 'recover', 'land', 'prejump', 'dizzy', 'hit']);
const LIMBS = ['ff', 'bf', 'fh', 'bh'];
const TAIL_ANCHOR = { hood: [-12, -2], hair: [-12, -6], bun: [-16, -9], long: [-10, -6], mask: [-10, 10] };

function clonePose(p) {
  return { h: p.h, lean: p.lean, rot: p.rot || 0, ff: [...p.ff], bf: [...p.bf], fh: [...p.fh], bh: [...p.bh] };
}
function copyPose(d, s) {
  d.h = s.h; d.lean = s.lean; d.rot = s.rot || 0;
  for (const k of LIMBS) { d[k][0] = s[k][0]; d[k][1] = s[k][1]; }
}
function blendPose(c, t, k, withRot = true) {
  c.h = lerp(c.h, t.h, k);
  c.lean = lerp(c.lean, t.lean, k);
  if (withRot) c.rot = lerp(c.rot, t.rot || 0, k);
  for (const key of LIMBS) {
    c[key][0] = lerp(c[key][0], t[key][0], k);
    c[key][1] = lerp(c[key][1], t[key][1], k);
  }
}

// IK de dos huesos: devuelve [articulación x, y, extremo x, y]. s = sentido del doblez.
function ik(rx, ry, tx, ty, l1, l2, s) {
  let dx = tx - rx, dy = ty - ry;
  let d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.5;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  if (d < 1) d = 1;
  const th = Math.atan2(dy, dx);
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  return [rx + Math.cos(th + s * a) * l1, ry + Math.sin(th + s * a) * l1, rx + dx, ry + dy];
}

function rotPt(x, y, r) {
  const c = Math.cos(r), s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// ---------- Paletas ----------
function basePalette(ch) {
  if (ch._pal) return ch._pal;
  const L = ch.look, pants = L.pants || '#24232c', boots = L.boots || ch.color;
  ch._pal = {
    pants, pants2: shade(pants, 0.65), main: ch.color, dark: ch.dark, skin: ch.skin, skin2: shade(ch.skin, 0.75),
    eyes: ch.eyes, boots, boots2: shade(boots, 0.6), hair: L.hair || '#141414', band: L.band || ch.color,
    metal: '#aab3be', metal2: '#6c7680', straw: '#d8c890',
    lava: L.lava || ch.color, armor: L.armor || '#211d22', armor2: shade(L.armor || '#211d22', 0.7),
    mask: L.mask || '#2b2629', plate: '#3c363b', plate2: '#262226', spike: '#9a9498',
    bracer: '#2a2426', bracer2: '#1c181a', glove: '#181416', tattoo: '#8a1a10', strap: '#5a3a24',
  };
  return ch._pal;
}
function flatPalette(c, eyes) {
  return { pants: c, pants2: c, main: c, dark: c, skin: c, skin2: c, eyes: eyes || c, boots: c, boots2: c,
    hair: c, band: c, metal: c, metal2: c, straw: c, lava: c, armor: c, armor2: c, mask: c, plate: c, plate2: c,
    spike: c, bracer: c, bracer2: c, glove: c, tattoo: c, strap: c, flat: true };
}
const FLASH_PAL = flatPalette('#ffffff');
const FROZEN_PAL = { pants: '#5d8fc0', pants2: '#4a7aa8', main: '#c8ecff', dark: '#86bde6', skin: '#e4f6ff', skin2: '#b8e0f8',
  eyes: '#fff', boots: '#9fd0f0', boots2: '#7ab0d8', hair: '#86bde6', band: '#c8ecff', metal: '#d0f0ff', metal2: '#9ac8e8', straw: '#d0f0ff',
  lava: '#e8fbff', armor: '#7aa8d0', armor2: '#6090b8', mask: '#9ac8e8', plate: '#a8d4f0', plate2: '#86bde6', spike: '#e0f6ff',
  bracer: '#7aa8d0', bracer2: '#6090b8', glove: '#5d8fc0', tattoo: '#9ac8e8', strap: '#86bde6', flat: true };

// Línea de lava brillante (grietas incandescentes)
function lavaLine(ctx, pal, pts, w = 2) {
  ctx.save();
  if (!pal.flat) { ctx.shadowColor = pal.lava; ctx.shadowBlur = 7; }
  ctx.strokeStyle = pal.lava;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
  ctx.restore();
}

// Púa triangular sobre un segmento (de a hacia b), apuntando hacia el lado "side"
function spikeOn(ctx, ax, ay, bx, by, t0, t1, len, side, color) {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, px = -dy / l * side, py = dx / l * side;
  const x0 = ax + dx * t0, y0 = ay + dy * t0, x1 = ax + dx * t1, y1 = ay + dy * t1;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  ctx.fillStyle = color;
  poly(ctx, [x0 + px * 4, y0 + py * 4, mx + px * len + dx / l * 3, my + py * len + dy / l * 3, x1 + px * 4, y1 + py * 4]);
}

// Hoz curva (punta de las cadenas de fuego)
function drawSickle(ctx, x, y, ang, pal, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(s, s);
  if (!pal.flat) { ctx.shadowColor = pal.lava; ctx.shadowBlur = 10; }
  ctx.fillStyle = pal.flat ? pal.spike : '#d8d2cc';
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.quadraticCurveTo(10, -4, 20, -16);
  ctx.quadraticCurveTo(14, -2, 4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = pal.lava;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(2, -1); ctx.quadraticCurveTo(11, -5, 20, -16); ctx.stroke();
  ctx.restore();
}

// Cadena de fuego a lo largo de una lista de puntos [x0,y0,x1,y1,...]
function drawFireChain(ctx, pal, pts, t) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = pal.flat ? pal.plate2 : '#2a1208';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
  if (!pal.flat) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = '#ff6a10';
    ctx.shadowBlur = 12;
  }
  ctx.strokeStyle = pal.lava;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([5, 4]);
  ctx.lineDashOffset = -t * 0.8;
  ctx.stroke();
  ctx.setLineDash([]);
  if (!pal.flat) {
    // lenguas de fuego a lo largo de la cadena
    ctx.fillStyle = 'rgba(255,150,40,0.55)';
    for (let i = 2; i < pts.length; i += 2) {
      const f = Math.sin(t * 0.5 + i) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.ellipse(pts[i], pts[i + 1] - 3 - f * 3, 2.5, 4 + f * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  const n = pts.length;
  drawSickle(ctx, pts[n - 2], pts[n - 1], Math.atan2(pts[n - 1] - pts[n - 3], pts[n - 2] - pts[n - 4]), pal);
}
const tintCache = {};
function fighterPalette(ch, o) {
  if (o.flash) return FLASH_PAL;
  if (o.frozen) return FROZEN_PAL;
  if (o.tint) return tintCache[o.tint] || (tintCache[o.tint] = flatPalette(o.tint, '#fff'));
  return basePalette(ch);
}

// ---------- Dibujo de partes ----------
function drawLeg(ctx, rx, ry, k, pal, back, th, look = {}) {
  const [kx, ky, ax, ay] = k;
  const pants = back ? pal.pants2 : pal.pants, boot = back ? pal.boots2 : pal.boots;
  const baggy = look.torso === 'warrior' ? 1.15 : 1;
  seg(ctx, rx, ry, kx, ky, 17 * th * baggy, pants);
  seg(ctx, kx, ky, ax, ay, 14 * th * baggy, pants);
  seg(ctx, lerp(kx, ax, 0.45), lerp(ky, ay, 0.45), ax, ay, 15 * th, boot);
  const dx = ax - kx, dy = ay - ky, l = Math.hypot(dx, dy) || 1;
  seg(ctx, ax, ay, ax + dy / l * 13, ay - dx / l * 13, 9 * th, boot);
  if (look.knee) {
    // vendas rojas en la bota
    seg(ctx, lerp(kx, ax, 0.72), lerp(ky, ay, 0.72), lerp(kx, ax, 0.84), lerp(ky, ay, 0.84), 16 * th, back ? pal.dark : pal.main);
    // grieta de lava en la espinilla
    if (!back) lavaLine(ctx, pal, [lerp(kx, ax, 0.48) + 3, lerp(ky, ay, 0.48), lerp(kx, ax, 0.6) + 5, lerp(ky, ay, 0.6), lerp(kx, ax, 0.68) + 2, lerp(ky, ay, 0.68)], 1.8);
    // rodillera con púa hacia adelante
    ctx.fillStyle = back ? pal.plate2 : pal.plate;
    circle(ctx, kx, ky, 9 * th);
    spikeOn(ctx, rx, ry, kx, ky, 0.82, 1, 11, -1, back ? pal.plate : pal.spike);
    if (!back) lavaLine(ctx, pal, [kx - 4, ky - 3, kx + 1, ky + 1, kx + 4, ky - 2], 1.5);
  }
}

function drawArm(ctx, rx, ry, a, pal, back, type, th) {
  const [ex, ey, hx, hy] = a;
  let up, fore, cuff, fist, uw = 13, fw = 11;
  switch (type) {
    case 'bare':
      up = fore = fist = back ? pal.skin2 : pal.skin; cuff = back ? pal.dark : pal.main; break;
    case 'metal':
      up = fore = fist = back ? pal.metal2 : pal.metal; cuff = back ? '#3a3e46' : '#5a626c'; uw = 15; fw = 14; break;
    case 'robe':
      up = back ? pal.dark : pal.main; fore = fist = back ? pal.skin2 : pal.skin; cuff = null; uw = 17; break;
    case 'warrior':
      up = back ? pal.skin2 : pal.skin; fore = back ? pal.bracer2 : pal.bracer; cuff = back ? pal.dark : pal.main;
      fist = pal.glove; uw = 14; fw = 13; break;
    default:
      up = cuff = back ? pal.dark : pal.main; fore = fist = back ? pal.pants2 : pal.pants;
  }
  seg(ctx, rx, ry, ex, ey, uw * th, up);
  seg(ctx, ex, ey, hx, hy, fw * th, fore);
  if (type === 'robe') seg(ctx, ex, ey, lerp(ex, hx, 0.4), lerp(ey, hy, 0.4), 18 * th, up);
  else if (type === 'warrior') {
    // tatuaje en el brazo, vendas rojas y púas en el brazalete
    if (!back) lavaLine(ctx, { lava: pal.tattoo, flat: true }, [lerp(rx, ex, 0.25) + 2, lerp(ry, ey, 0.25), lerp(rx, ex, 0.5) - 3, lerp(ry, ey, 0.5), lerp(rx, ex, 0.75) + 2, lerp(ry, ey, 0.75)], 2.2);
    seg(ctx, ex, ey, lerp(ex, hx, 0.18), lerp(ey, hy, 0.18), (fw + 2) * th, cuff);
    seg(ctx, lerp(ex, hx, 0.78), lerp(ey, hy, 0.78), lerp(ex, hx, 0.9), lerp(ey, hy, 0.9), (fw + 2) * th, cuff);
    spikeOn(ctx, ex, ey, hx, hy, 0.3, 0.48, 9, -1, back ? pal.plate : pal.spike);
    spikeOn(ctx, ex, ey, hx, hy, 0.5, 0.68, 8, -1, back ? pal.plate : pal.spike);
  } else seg(ctx, lerp(ex, hx, 0.55), lerp(ey, hy, 0.55), hx, hy, (fw + 1) * th, cuff);
  ctx.fillStyle = fist;
  circle(ctx, hx, hy, 7.5 * th);
}

// Cabeza en su propio marco: centro en (0,0), cara hacia +x
function drawHead(ctx, ch, pal, o) {
  const look = ch.look, glow = ch.glow && !o.flash && !o.frozen && !o.tint;
  const eyes = (x1, x2, y, r = 1.9) => {
    if (glow) { ctx.shadowColor = pal.eyes; ctx.shadowBlur = 8; }
    ctx.fillStyle = pal.eyes;
    circle(ctx, x1, y, r);
    if (x2 != null) circle(ctx, x2, y, r * 0.9);
    ctx.shadowBlur = 0;
  };
  switch (look.head) {
    case 'hat':
      ctx.fillStyle = pal.hair; circle(ctx, -5, 5, 9);
      ctx.fillStyle = pal.skin; circle(ctx, 0, 0, 12.5);
      eyes(7, 12, -1, 2.1);
      ctx.fillStyle = pal.straw;
      poly(ctx, [-32, -3, 32, -3, 4, -30]);
      ctx.strokeStyle = shade(pal.straw, 0.6);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-32, -3); ctx.lineTo(32, -3); ctx.stroke();
      break;
    case 'hair': case 'long':
      ctx.fillStyle = pal.skin; circle(ctx, 0, 0, 12.5);
      ctx.fillStyle = pal.hair;
      ctx.beginPath(); ctx.arc(0, 0, 13.5, Math.PI * 0.7, Math.PI * 1.95); ctx.closePath(); ctx.fill();
      if (look.head === 'long') ctx.fillRect(-13, -4, 9, 20);
      if (look.band) seg(ctx, -12, -7, 13, -8, 4, pal.band);
      eyes(8, null, -1, 1.7);
      break;
    case 'bald':
      ctx.fillStyle = pal.skin; circle(ctx, 0, 0, 13.5);
      ctx.fillStyle = '#111'; ctx.fillRect(3, -4, 11, 4);
      ctx.fillStyle = pal.skin2; ctx.fillRect(-3, 6, 12, 3);
      break;
    case 'helmet':
      ctx.fillStyle = pal.metal; circle(ctx, 0, 0, 13.5);
      ctx.fillStyle = '#1a1c20'; ctx.fillRect(2, -6, 12, 7);
      if (glow) { ctx.shadowColor = pal.eyes; ctx.shadowBlur = 10; }
      ctx.fillStyle = pal.eyes; ctx.fillRect(4, -4, 10, 2.5);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = pal.main; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 11, Math.PI * 1.1, Math.PI * 1.75); ctx.stroke();
      break;
    case 'bun':
      ctx.fillStyle = pal.hair; circle(ctx, -12, -9, 6.5);
      ctx.fillStyle = pal.skin; circle(ctx, 0, 0, 12.5);
      ctx.fillStyle = pal.hair;
      ctx.beginPath(); ctx.arc(0, 0, 13.5, Math.PI * 0.85, Math.PI * 1.85); ctx.closePath(); ctx.fill();
      ctx.fillStyle = pal.main;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 12.8, -0.1, Math.PI * 0.6); ctx.closePath(); ctx.fill();
      eyes(7, 11.5, -3, 1.6);
      break;
    case 'mask':
      // pelo negro en puntas
      ctx.fillStyle = pal.hair;
      poly(ctx, [-13, 2, -26, -6, -14, -9, -22, -19, -8, -14, -9, -26, 1, -15, 6, -25, 9, -13, 17, -15, 13, -5]);
      circle(ctx, -2, -3, 13);
      // cara
      ctx.fillStyle = pal.skin;
      ctx.beginPath(); ctx.arc(1, 1, 12, -Math.PI * 0.42, Math.PI * 0.62); ctx.closePath(); ctx.fill();
      ctx.fillStyle = pal.hair;
      poly(ctx, [-2, -12, 8, -13, 14, -6, 6, -9, -2, -6]);
      // máscara metálica con grietas de lava
      ctx.fillStyle = pal.mask;
      poly(ctx, [-3, -1, 14, -1, 13.5, 7, 6, 12, -4, 10]);
      lavaLine(ctx, pal, [4, 0, 7, 5, 5, 10], 1.6);
      lavaLine(ctx, pal, [10, 0, 12, 5], 1.4);
      // ojos encendidos y ceño
      eyes(7, 12, -4, 1.8);
      seg(ctx, 3, -7.5, 13.5, -5.5, 2, pal.hair);
      break;
    default: // capucha ninja
      ctx.fillStyle = pal.main; circle(ctx, 0, 0, 13.5);
      ctx.fillStyle = pal.skin; ctx.fillRect(1, -6, 12, 7);
      eyes(6, 11, -2.5);
      ctx.strokeStyle = pal.dark; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 12, Math.PI * 1.05, Math.PI * 1.85); ctx.stroke();
  }
}

// Dibuja al luchador en coordenadas locales: cadera en (0,0), mirando a la derecha.
function drawFigure(ctx, ch, p, o = {}) {
  const pal = fighterPalette(ch, o), look = ch.look, th = look.thick || 1;
  const L = p.lean * Math.PI / 180;
  const ux = Math.sin(L), uy = -Math.cos(L);
  const nx = Math.cos(L), ny = Math.sin(L);
  const sx = ux * TORSO, sy = uy * TORSO;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const bl = ik(-5, 0, p.bf[0], p.bf[1], THIGH, SHIN, -1);
  const fl = ik(6, 0, p.ff[0], p.ff[1], THIGH, SHIN, -1);
  const ba = ik(sx - 6, sy + 3, sx + p.bh[0], sy + p.bh[1], UARM, FARM, 1);
  const fa = ik(sx + 4, sy, sx + p.fh[0], sy + p.fh[1], UARM, FARM, 1);

  // faldón trasero desgarrado
  if (look.tabard) {
    const bx0 = ux * 8, by0 = uy * 8, sw = clamp(p.bf[0] * 0.3, -24, 6);
    ctx.fillStyle = pal.dark;
    poly(ctx, [bx0 - 15 * nx, by0 - 15 * ny, bx0 - 2 * nx, by0 - 2 * ny, -4 + sw, 64, -9 + sw, 76, -14 + sw, 66, -20 + sw, 80, -24 + sw, 62]);
  }

  drawLeg(ctx, -5, 0, bl, pal, true, th, look);
  drawArm(ctx, sx - 6, sy + 3, ba, pal, true, look.arms, th);

  // torso
  const w0 = 15 * th, w1 = 20 * th;
  const T = [-w0 * nx, -w0 * ny, w0 * nx, w0 * ny, sx + w1 * nx, sy + w1 * ny, sx - w1 * nx, sy - w1 * ny];
  const bx = ux * 8, by = uy * 8;
  switch (look.torso) {
    case 'bare':
      ctx.fillStyle = pal.skin; poly(ctx, T);
      seg(ctx, sx * 0.55 + 4 * nx, sy * 0.55 + 4 * ny, sx * 0.55 + 14 * nx, sy * 0.55 + 14 * ny, 2, pal.skin2);
      seg(ctx, ux * 3 - w0 * nx, uy * 3 - w0 * ny, ux * 3 + w0 * nx, uy * 3 + w0 * ny, 9, pal.pants);
      seg(ctx, bx - w0 * nx, by - w0 * ny, bx + w0 * nx, by + w0 * ny, 6, pal.main);
      break;
    case 'robe':
      ctx.fillStyle = pal.main; poly(ctx, T);
      seg(ctx, sx + 4 * nx, sy + 4 * ny, bx + 10 * nx, by + 10 * ny, 3, pal.dark);
      seg(ctx, bx - w0 * nx, by - w0 * ny, bx + w0 * nx, by + w0 * ny, 7, pal.dark);
      break;
    case 'warrior':
      // chaleco blindado negro, correas de cuero, grieta de lava y faja roja
      ctx.fillStyle = pal.armor; poly(ctx, T);
      seg(ctx, sx * 0.62 - 18 * nx, sy * 0.62 - 18 * ny, sx * 0.62 + 18 * nx, sy * 0.62 + 18 * ny, 2, pal.armor2);
      seg(ctx, sx * 0.38 - 16 * nx, sy * 0.38 - 16 * ny, sx * 0.38 + 16 * nx, sy * 0.38 + 16 * ny, 2, pal.armor2);
      seg(ctx, sx - 17 * nx, sy - 17 * ny, ux * 12 + 13 * nx, uy * 12 + 13 * ny, 4, pal.strap);
      lavaLine(ctx, pal, [ux * 14 + 3 * nx, uy * 14 + 3 * ny, sx * 0.45 + 6 * nx, sy * 0.45 + 6 * ny,
        sx * 0.62 + 2 * nx, sy * 0.62 + 2 * ny, sx * 0.85 + 5 * nx, sy * 0.85 + 5 * ny], 2.4);
      seg(ctx, bx - w0 * nx, by - w0 * ny, bx + w0 * nx, by + w0 * ny, 11, pal.main);
      seg(ctx, bx - w0 * nx + ux * 5, by - w0 * ny + uy * 5, bx + w0 * nx + ux * 5, by + w0 * ny + uy * 5, 3, pal.strap);
      ctx.fillStyle = pal.spike;
      circle(ctx, bx + 6 * nx, by + 6 * ny, 4);
      break;
    case 'armor':
      ctx.fillStyle = pal.metal; poly(ctx, T);
      seg(ctx, ux * 12, uy * 12, sx - ux * 6, sy - uy * 6, 6, pal.main);
      seg(ctx, sx * 0.7 - 18 * nx, sy * 0.7 - 18 * ny, sx * 0.7 + 18 * nx, sy * 0.7 + 18 * ny, 3, pal.metal2);
      seg(ctx, bx - w0 * nx, by - w0 * ny, bx + w0 * nx, by + w0 * ny, 8, '#2a2d33');
      break;
    default: {
      ctx.fillStyle = pal.pants; poly(ctx, T);
      const vx0 = ux * 10, vy0 = uy * 10, vx1 = sx - ux * 4, vy1 = sy - uy * 4;
      ctx.fillStyle = pal.main;
      poly(ctx, [vx0 - 13 * nx, vy0 - 13 * ny, vx0 + 13 * nx, vy0 + 13 * ny, vx1 + 17 * nx, vy1 + 17 * ny, vx1 - 17 * nx, vy1 - 17 * ny]);
      seg(ctx, bx - w0 * nx, by - w0 * ny, bx + w0 * nx, by + w0 * ny, 8, pal.pants2);
    }
  }

  // cuello y cabeza
  if (!o.headless) {
    seg(ctx, sx, sy, sx + ux * 10, sy + uy * 10, 13 * th, look.torso === 'bare' || look.head === 'bald' || look.head === 'mask' ? pal.skin : pal.pants);
    // bufanda roja enrollada al cuello
    if (look.collar) seg(ctx, sx - 11 * nx + ux * 4, sy - 11 * ny + uy * 4, sx + 11 * nx + ux * 7, sy + 11 * ny + uy * 7, 11, pal.main);
    const hx = sx + ux * 21 + nx * 2, hy = sy + uy * 21 + ny * 2;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(L);
    drawHead(ctx, ch, pal, o);
    ctx.restore();
  } else {
    ctx.fillStyle = '#8a0008';
    circle(ctx, sx + ux * 4, sy + uy * 4, 7);
  }

  drawLeg(ctx, 6, 0, fl, pal, false, th, look);

  // faldón / túnica
  if (look.tabard) {
    // faldón rojo desgarrado con el emblema en naranja
    const sw = clamp(p.ff[0] * 0.3, -6, 26);
    ctx.fillStyle = pal.main;
    poly(ctx, [bx, by, bx + 16 * nx, by + 16 * ny, 18 + sw, 62, 14 + sw, 78, 9 + sw, 66, 4 + sw, 82, 0 + sw, 64, -3 + sw, 72]);
    ctx.fillStyle = pal.flat ? pal.main : '#e0601c';
    poly(ctx, [6 + sw * 0.5, 30, 11 + sw * 0.55, 38, 6 + sw * 0.6, 46, 1 + sw * 0.55, 38]);
    ctx.fillStyle = pal.flat ? pal.main : pal.dark;
    poly(ctx, [6 + sw * 0.55, 34, 8 + sw * 0.55, 38, 6 + sw * 0.6, 42, 4 + sw * 0.55, 38]);
  } else if (look.torso === 'robe') {
    ctx.fillStyle = pal.main;
    poly(ctx, [bx - 16 * nx, by - 16 * ny, bx + 16 * nx, by + 16 * ny, fl[0] + 10, fl[1] + 12, bl[0] - 10, bl[1] + 12]);
    seg(ctx, fl[0] + 10, fl[1] + 12, bl[0] - 10, bl[1] + 12, 3, pal.dark);
  } else if (look.torso !== 'armor') {
    const sw = clamp(p.ff[0] * 0.25, -6, 22), fw = look.torso === 'bare' ? 9 : 14;
    ctx.fillStyle = pal.main;
    poly(ctx, [bx, by, bx + fw * nx, by + fw * ny, fw + sw, 36, 2 + sw, 38]);
  }

  drawArm(ctx, sx + 4, sy, fa, pal, false, look.arms, th);

  // hombrera con púas sobre el hombro delantero
  if (look.pauldron) {
    // un poco más abajo y hacia atrás del hombro, para no tapar la cara
    const px = sx + 1 - ux * 9, py = sy - uy * 9;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(L);
    ctx.fillStyle = pal.spike;
    poly(ctx, [-12, -2, -21, -10, -8, -7]);
    poly(ctx, [-6, -6, -11, -16, 0, -8]);
    poly(ctx, [1, -7, -1, -15, 6, -7]);
    ctx.fillStyle = pal.plate;
    ctx.beginPath(); ctx.ellipse(-2, 0, 12, 8, -0.15, 0, Math.PI * 2); ctx.fill();
    lavaLine(ctx, pal, [-10, 2, -3, 4, 4, 1], 1.5);
    ctx.restore();
  }

  // cadenas de fuego fijas (en retratos); en combate son dinámicas, ver Fighter.updateChains
  if (look.chains && o.staticChains) {
    for (const h of [fa, ba]) {
      const hx = h[2], hy = h[3], pts = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        pts.push(hx + Math.sin(t * 2.6) * 26, hy + t * 64);
      }
      drawFireChain(ctx, pal, pts, 0);
    }
  }
}

function drawCharAt(ctx, ch, pose, x, y, facing = 1, scale = 1, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * scale * (ch.look.bulk || 1), scale * (ch.look.bulk || 1));
  ctx.translate(0, -pose.h);
  drawFigure(ctx, ch, pose, Object.assign({ staticChains: true }, o));
  ctx.restore();
}

function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, rr = i % 2 ? r * 0.4 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

// =====================================================================
class Fighter {
  constructor(ch, idx) {
    this.ch = ch;
    this.idx = idx;
    this.attackId = 0;
    this.jumpId = 0;
    this.stance = STANCES[ch.stance] || STANCES.ninja;
    this.bulk = ch.look.bulk || 1;
    this.specials = ch.specials.slice().sort((a, b) => b.input.length - a.input.length);
    this._tmp = clonePose(POSES.idle);
    this.reset(STAGE_W / 2, 1);
  }

  reset(x, facing) {
    Object.assign(this, {
      x, y: GROUND_Y, vx: 0, vy: 0, facing, hp: 100, dispHp: 100,
      state: 'idle', move: null, moveT: 0, hasHit: false, active: false,
      stun: 0, bstun: 0, frozen: 0, flash: 0, buf: [], t: 0, comboCount: 0, projCount: 0,
      hidden: false, gone: false, airUsed: false, flipping: 0, airT: 0, walkPhase: 0,
      tint: null, pulled: 0, netted: 0, dizzyOnLand: false, running: false, chain: 0,
      floating: false, invis: 0, grab: null, heldMode: null, heldT: 0, bounced: false, hitLow: false, jumpDir: 0,
      trailOn: false, trailColor: null, trail: [], scarf: null, headless: false, melt: 0, fxScale: 1, spinT: 0,
      headPos: [x, GROUND_Y - 170], eruptX: 0, spName: '', spNameT: 0, lastBtn: null, seqShown: [], seqShownT: -999, chains: null,
    });
    this.pose = clonePose(this.stance.idle);
  }

  get grounded() { return this.y >= GROUND_Y - 0.01 && this.vy >= 0 && !this.floating; }

  isCrouching() {
    if (this.state === 'crouch' || this.state === 'cblock') return true;
    if (this.state === 'attack' && this.move) {
      return !!(this.move.crouch || (this.move.crouchStart && this.moveT < this.move.startup));
    }
    return false;
  }

  hurtbox() {
    if (this.hidden || this.gone || NO_HURT.has(this.state)) return null;
    if (this.state === 'launched' || this.state === 'lifted') return { x: this.x - 40, y: this.y - 110, w: 80, h: 90 };
    if (this.y < GROUND_Y - 1) return { x: this.x - 24, y: this.y - 170, w: 48, h: 150 };
    if (this.state === 'attack' && this.move && this.move.pose === 'slide' && this.moveT >= this.move.startup) {
      return { x: this.x - 45, y: this.y - 50, w: 90, h: 50 };
    }
    const h = (this.isCrouching() ? 112 : 182) * this.bulk, w = 50 * this.bulk;
    return { x: this.x - w / 2, y: this.y - h, w, h };
  }

  hitbox() {
    const m = this.move;
    if (!m || !m.hit) return null;
    const b = this.bulk, hb = m.hit, w = hb.w * b;
    const x = this.facing === 1 ? this.x + hb.x * b : this.x - hb.x * b - w;
    return { x, y: this.y + hb.y * b, w, h: hb.h * b };
  }

  faceOpp(opp) {
    if (Math.abs(opp.x - this.x) > 4) this.facing = opp.x > this.x ? 1 : -1;
  }

  // ¿Las últimas direcciones pulsadas coinciden con el patrón?
  // gap = máximo de frames permitido entre cada paso (y entre el último paso y el botón).
  seq(pattern, gap) {
    const n = pattern.length, b = this.buf;
    if (b.length < n) return false;
    const tail = b.slice(-n);
    if (this.t - tail[n - 1][1] > gap) return false;
    for (let i = 0; i < n; i++) {
      if (tail[i][0] !== pattern[i]) return false;
      if (i > 0 && tail[i][1] - tail[i - 1][1] > gap) return false;
    }
    return true;
  }

  // ---------------- UPDATE ----------------
  update(inp, opp, game) {
    this.t++;
    if (this.flash > 0) this.flash--;
    if (this.invis > 0) this.invis--;
    if (this.netted > 0) this.netted--;
    if (this.grounded && CONTROL_STATES.has(this.state)) this.faceOpp(opp);

    const fk = this.facing === 1 ? 'right' : 'left', bk = this.facing === 1 ? 'left' : 'right';
    if (inp.pressed[fk]) this.buf.push(['F', this.t, this.facing]);
    if (inp.pressed[bk]) this.buf.push(['B', this.t, this.facing]);
    if (inp.pressed.down) this.buf.push(['D', this.t, this.facing]);
    if (this.buf.length > 12) this.buf.shift();
    if (this.spNameT > 0) this.spNameT--;

    if (this.frozen > 0) {
      this.frozen--;
      this.vx *= 0.85;
      this.physics(game);
      this.updateExtras();
      return;
    }

    const fwd = inp[fk], back = inp[bk];
    switch (this.state) {
      case 'idle': case 'walk': case 'run': case 'crouch': case 'block': case 'cblock':
        this.control(inp, fwd, back, !!inp.pressed[fk], opp, game);
        break;
      case 'prejump': if (--this.stun <= 0) this.launchJump(); break;
      case 'land': case 'recover': if (--this.stun <= 0) this.state = 'idle'; break;
      case 'jump':
        if (!this.airUsed) {
          if (inp.pressed.hp || inp.pressed.lp) this.startMove('jp');
          else if (inp.pressed.hk || inp.pressed.lk) this.startMove('jk');
        }
        break;
      case 'attack':
        if (this.canCancel() && this.tryAttack(inp, fwd, back, opp, game, true)) break;
        this.updateAttack(opp, game);
        break;
      case 'grab': this.updateGrab(game); break;
      case 'held': this.heldT++; break;
      case 'hit': if (--this.stun <= 0) { this.state = 'idle'; this.pulled = 0; this.netted = 0; } break;
      case 'lifted':
        this.vx = 0;
        this.y = lerp(this.y, GROUND_Y - 120, 0.08);
        if (--this.stun <= 0) { this.state = 'launched'; this.floating = false; this.vy = 1; }
        break;
      case 'down': if (--this.stun <= 0) { this.state = 'getup'; this.stun = 24; } break;
      case 'getup': if (--this.stun <= 0) this.state = 'idle'; break;
    }
    if (this.state !== 'attack') this.chain = 0;
    if (CONTROL_STATES.has(this.state) || this.state === 'down') this.comboCount = 0;

    // brasas que se desprenden del cuerpo
    if (this.ch.look.embers && this.t % 5 === 0 && !this.hidden && !this.gone && this.invis <= 0) {
      game.fx.add({ x: this.x + rand(-22, 22), y: this.y - rand(30, 170) * this.bulk, vx: rand(-0.4, 0.4), vy: rand(-1.6, -0.6),
        g: -0.01, life: rand(20, 40), size: rand(1.2, 2.6), color: chance(0.5) ? '#ff8a1a' : '#ffcc40', kind: 'glow' });
    }

    this.physics(game);
    this.animate();
    this.updateExtras();
  }

  control(inp, fwd, back, fwdTap, opp, game) {
    this.trailOn = false;
    if (this.bstun > 0) { this.bstun--; return; }
    if (this.tryAttack(inp, fwd, back, opp, game, false)) return;
    if (inp.bl) { this.state = inp.down ? 'cblock' : 'block'; this.vx = 0; this.running = false; return; }
    if (inp.up) {
      this.state = 'prejump'; this.stun = 3; this.jumpDir = fwd ? 1 : back ? -1 : 0;
      this.vx = 0; this.running = false;
      return;
    }
    if (inp.down) { this.state = 'crouch'; this.vx = 0; this.running = false; return; }
    if (fwdTap && this.seq(['F', 'F'], 16)) this.running = true;
    if (fwd) {
      this.state = this.running ? 'run' : 'walk';
      this.vx = (this.running ? 6.4 : 3.4) * this.facing;
    } else if (back) {
      this.running = false; this.state = 'walk'; this.vx = -2.8 * this.facing;
    } else {
      this.running = false; this.state = 'idle'; this.vx = 0;
    }
    this.trailOn = this.state === 'run';
    this.trailColor = this.ch.color;
  }

  launchJump() {
    this.state = 'jump';
    this.vy = -16.5;
    this.vx = this.jumpDir * 4.6 * this.facing;
    this.flipping = this.jumpDir;
    this.airT = 0;
    this.airUsed = false;
    this.jumpId++;
    Sound.jump();
  }

  // Intenta iniciar un ataque según los botones pulsados. cancel = encadenando desde otro golpe.
  tryAttack(inp, fwd, back, opp, game, cancel) {
    const atk = inp.pressed.hp ? 'hp' : inp.pressed.lp ? 'lp' : inp.pressed.hk ? 'hk' : inp.pressed.lk ? 'lk' : null;
    if (!atk) return false;
    this.lastBtn = { b: atk, t: this.t };
    const dist = Math.abs(opp.x - this.x), gap = game.inputGap || 26;
    const fat = this.ch.fatal;
    if (game.state === 'finish' && game.winner === this && atk === fat.btn && this.seq(fat.input, gap + 10) && dist < 170) {
      game.startFatality(this, opp);
      return true;
    }
    for (const sp of this.specials) {
      if (sp.btn !== atk || !this.seq(sp.input, gap)) continue;
      if ((sp.kind === 'proj' || sp.kind === 'erupt') && this.projCount > 0) continue;
      if (sp.kind === 'invis' && this.invis > 0) continue;
      this.seqShown = this.buf.slice(-sp.input.length);
      this.seqShownT = this.t;
      this.buf.length = 0;
      this.spName = sp.name;
      this.spNameT = 70;
      this.startMove(this.buildSpecial(sp));
      return true;
    }
    if (cancel) {
      if (this.chain >= 2) return false;
      this.chain++;
    } else if (atk === 'lp' && fwd && dist < 85 * this.bulk && opp.grounded && THROWABLE.has(opp.state) && opp.state !== 'hit') {
      this.startMove(MOVES.throw);
      return true;
    }
    if (inp.down) this.startMove({ hp: 'upper', lp: 'clp', hk: 'sweep', lk: 'clk' }[atk]);
    else if (atk === 'hk' && back) this.startMove('rh');
    else this.startMove(atk);
    return true;
  }

  canCancel() {
    const m = this.move;
    return !!(m && !m.sp && !m.air && !m.kind && this.hasHit && this.moveT >= m.startup
      && this.moveT < m.startup + m.active + m.recovery - 2);
  }

  startMove(name) {
    const m = typeof name === 'string' ? MOVES[name] : name;
    this.move = m;
    this.moveT = 0;
    this.hasHit = false;
    this.active = false;
    this.state = 'attack';
    this.attackId++;
    this.running = false;
    this.spinT = 0;
    this.trailOn = false;
    if (m.trail) this.trailColor = typeof m.trail === 'string' ? m.trail : this.ch.color;
    if (m.air) {
      this.airUsed = true;
      this.flipping = 0;
      let r = ((this.pose.rot % 360) + 360) % 360;
      if (r > 180) r -= 360;
      this.pose.rot = r;
    } else {
      this.vx = 0;
    }
  }

  buildSpecial(sp) {
    switch (sp.kind) {
      case 'proj': {
        const P = PROJ[sp.proj];
        return { sp, kind: 'proj', startup: P.startup || 12, active: 0, recovery: P.recovery || 22,
          pose: P.pose || 'special', wind: P.wind, hold: 10 };
      }
      case 'tele': {
        const a = sp.attack ? MOVES[sp.attack] : null;
        return { sp, kind: 'tele', startup: 22, active: a ? 6 : 0, recovery: a ? 16 : 8, pose: a ? a.pose : 'idle',
          hit: a && a.hit, dmg: a ? a.dmg + 3 : 0, kb: 6, stun: 0, level: 'mid', knock: !!a && !a.launch,
          launch: !!(a && a.launch), heavy: true };
      }
      case 'dash': {
        const D = DASH[sp.dash];
        return Object.assign({ sp, kind: 'dash', active: D.dur, recovery: 14, kb: 5, stun: 16 }, D,
          { trail: sp.trail || D.trail });
      }
      case 'grab': return { sp, kind: 'grab', mode: sp.mode, range: 105, startup: 6, active: 1, recovery: 22, pose: 'throw', hold: 4 };
      case 'erupt': return { sp, kind: 'erupt', startup: 14, active: 0, recovery: 24, pose: 'castUp', hold: 12 };
      case 'invis': return { sp, kind: 'invis', startup: 10, active: 0, recovery: 12, pose: 'castUp', hold: 6 };
    }
    return MOVES.hp;
  }

  updateAttack(opp, game) {
    const m = this.move;
    this.moveT++;
    const t = this.moveT, end = m.startup + m.active;
    switch (m.kind) {
      case 'proj': if (t === m.startup) game.spawnProjectile(this, m.sp.proj); break;
      case 'erupt':
        if (t === 1) this.eruptX = opp.x;
        if (t === m.startup) game.spawnErupt(this, this.eruptX);
        break;
      case 'invis':
        if (t === m.startup) { this.invis = 420; game.fx.smoke(this.x, this.y - 90, this.ch.color); Sound.special('sombra'); }
        break;
      case 'tele': this.updateTele(opp, game, t); break;
      case 'grab': case 'throw':
        if (t === m.startup) this.tryGrab(opp, game);
        if (this.state !== 'attack') return;
        break;
      case 'dash':
        this.updateDash(t, end);
        if (this.state !== 'attack') return;
        break;
      default:
        if (t === m.startup - 1) Sound.whoosh(m.heavy);
    }
    this.active = !!m.hit && t >= m.startup && t < end;
    if (m.multi && this.active && (t - m.startup) % m.every === 0) this.hasHit = false;
    if (!m.air && t >= end + m.recovery) {
      this.state = m.crouch ? 'crouch' : 'idle';
      this.move = null;
      this.active = false;
      this.trailOn = false;
    }
  }

  updateTele(opp, game, t) {
    if (t === 3) {
      this.hidden = true;
      game.fx.smoke(this.x, this.y - 90, this.ch.color);
      Sound.special('sombra');
    }
    if (t === 15) {
      const side = opp.x > this.x ? 1 : -1;
      let nx = opp.x + side * 72;
      if (nx < game.camX + 40 || nx > game.camX + W - 40 || nx < 50 || nx > STAGE_W - 50) nx = opp.x - side * 72;
      this.x = nx;
      this.facing = opp.x > this.x ? 1 : -1;
      this.hidden = false;
      this.scarf = null;
      game.fx.smoke(this.x, this.y - 90, this.ch.color);
    }
  }

  updateDash(t, end) {
    const m = this.move;
    if (t === m.startup) { Sound.whoosh(true); this.trailOn = !!m.trail; }
    if (t >= m.startup && t < end) {
      if (this.hasHit && !m.multi) { this.endDash(); return; }
      this.vx = this.facing * m.speed;
      if (m.air) { this.floating = true; this.vy = 0; this.y = lerp(this.y, GROUND_Y - m.air, 0.3); }
      if (m.spin) this.spinT += 0.45;
    } else if (t === end) {
      this.endDash();
    }
  }

  endDash() {
    const m = this.move;
    this.floating = false;
    this.trailOn = false;
    this.spinT = 0;
    if (m.air || this.y < GROUND_Y - 1) {
      this.state = 'jump';
      this.airUsed = true;
      this.flipping = 0;
      this.move = null;
      this.active = false;
      this.vx = this.facing * 1.5;
      this.vy = 0;
    } else {
      this.vx = this.facing * m.speed * 0.3;
      this.moveT = m.startup + m.active;
      this.active = false;
    }
  }

  // ---------------- AGARRES ----------------
  tryGrab(opp, game) {
    const m = this.move;
    const ok = Math.abs(opp.x - this.x) < m.range * this.bulk && opp.grounded && THROWABLE.has(opp.state)
      && !opp.hidden && !(opp.state === 'attack' && opp.move && (opp.move.kind === 'grab' || opp.move.kind === 'throw'));
    if (!ok) return;
    this.state = 'grab';
    this.grab = { opp, mode: m.mode, t: 0 };
    this.move = null;
    this.active = false;
    this.vx = 0;
    Object.assign(opp, { state: 'held', heldMode: m.mode, heldT: 0, vx: 0, vy: 0, move: null, active: false,
      floating: true, frozen: 0, running: false, trailOn: false });
    Sound.hit(false);
  }

  updateGrab(game) {
    const g = this.grab;
    if (!g) { this.state = 'idle'; return; }
    const o = g.opp, f = this.facing;
    g.t++;
    if (o.state !== 'held') { this.endGrab(); return; }
    switch (g.mode) {
      case 'throw': {
        const a = Math.min(1, g.t / 20) * Math.PI;
        o.x = this.x + f * Math.cos(a) * 55;
        o.y = GROUND_Y - Math.sin(a) * 120 - 10;
        if (g.t === 20) this.release(o, { dmg: 12, knock: true, kb: 6, level: 'mid', heavy: true }, -f, game);
        break;
      }
      case 'slam': {
        if (g.t <= 16) { o.x = this.x + f * 22; o.y = GROUND_Y - (g.t / 16) * 170; }
        else {
          const k = Math.min(1, (g.t - 16) / 6);
          o.x = this.x + f * (22 + k * 55);
          o.y = GROUND_Y - 170 * (1 - k);
        }
        if (g.t === 22) {
          this.release(o, { dmg: 16, knock: true, kb: 3, level: 'mid', heavy: true }, f, game);
          game.shake = 14;
          Sound.land();
        }
        break;
      }
      case 'drain': {
        o.y = GROUND_Y;
        if (g.t % 5 === 0 && o.hp > 2) { o.hp -= 1; this.hp = Math.min(100, this.hp + 1); }
        for (let i = 0; i < 2; i++) {
          const sx = o.x + rand(-15, 15), sy = o.y - rand(60, 160);
          game.fx.add({ x: sx, y: sy, vx: (this.x - sx) / 22, vy: (this.y - 130 - sy) / 22, g: 0, life: 22,
            size: rand(3, 6), color: '#7dff9a', kind: 'glow' });
        }
        if (g.t === 50) this.release(o, { dmg: 4, knock: true, kb: 4, level: 'mid' }, f, game);
        break;
      }
    }
    if (this.grab && g.t > 60) this.endGrab();
  }

  release(o, m, dir, game) {
    o.floating = false;
    const res = o.takeHit(Object.assign({ unblockable: true }, m), dir, game);
    if (res !== 'none') game.impact(res, o.x, o.y - 100, dir, m, o);
    this.grab = null;
    if (this.state === 'grab') { this.state = 'recover'; this.stun = 14; }
  }

  endGrab() {
    this.grab = null;
    if (this.state === 'grab') { this.state = 'recover'; this.stun = 10; }
  }

  // ---------------- FÍSICA ----------------
  physics(game) {
    if (this.floating) { this.x += this.vx; return; }
    if (this.y < GROUND_Y || this.vy < 0) {
      this.vy += GRAV;
      this.y += this.vy;
      this.x += this.vx;
      if (this.y >= GROUND_Y) { this.y = GROUND_Y; this.land(game); }
    } else {
      this.x += this.vx;
      if (this.state !== 'walk' && this.state !== 'run') this.vx *= 0.8;
      if (Math.abs(this.vx) < 0.05) this.vx = 0;
    }
  }

  land(game) {
    const impactV = this.vy;
    this.vy = 0;
    if (this.state === 'launched') {
      if (!this.bounced && impactV > 8 && !this.dizzyOnLand) {
        this.bounced = true;
        this.vy = -impactV * 0.35;
        this.y = GROUND_Y - 1;
        game.onLand(this);
        return;
      }
      game.onLand(this);
      if (this.dizzyOnLand) {
        this.state = 'dizzy'; this.dizzyOnLand = false; this.vx = 0;
      } else if (this.hp <= 0) {
        this.state = 'dead'; this.vx *= 0.3;
      } else {
        this.state = 'down'; this.stun = 34; this.vx *= 0.3;
      }
    } else if (this.state === 'jump' || this.state === 'attack' || this.state === 'hit') {
      const fromJump = this.state === 'jump' || (this.move && this.move.air);
      this.state = fromJump ? 'land' : 'idle';
      this.stun = 4;
      this.move = null; this.active = false; this.vx = 0; this.airUsed = false;
    }
    this.flipping = 0;
    let r = ((this.pose.rot % 360) + 360) % 360;
    if (r > 180) r -= 360;
    this.pose.rot = r;
  }

  // Devuelve 'none' | 'block' | 'hit'
  takeHit(m, dir, game) {
    if (this.hidden || this.gone || this.state === 'down' || this.state === 'getup' || this.state === 'dead') return 'none';
    if (this.state === 'held' && !m.unblockable) return 'none';
    const prev = this.state;
    const blocking = !m.unblockable && this.grounded &&
      ((prev === 'block' && m.level !== 'low') || (prev === 'cblock' && m.level !== 'overhead'));
    if (blocking) {
      this.hp = Math.max(1, this.hp - Math.max(1, Math.round(m.dmg * 0.15)));
      this.bstun = m.heavy ? 12 : 9;
      this.vx = dir * (m.kb || 4) * 0.9;
      return 'block';
    }
    // si me golpean mientras agarro a alguien, lo suelto
    if (this.grab) {
      const o = this.grab.opp;
      if (o.state === 'held') { o.state = 'launched'; o.floating = false; o.vy = -3; o.vx = 0; }
      this.grab = null;
    }
    const stunned = prev === 'hit' || prev === 'launched' || prev === 'lifted' || this.frozen > 0;
    this.comboCount = stunned ? this.comboCount + 1 : 1;
    const scale = Math.max(0.45, 1 - (this.comboCount - 1) * 0.12);
    this.hp = Math.max(0, this.hp - Math.max(1, Math.round(m.dmg * scale)));
    Object.assign(this, { flash: 4, frozen: 0, move: null, active: false, bstun: 0, flipping: 0, pulled: 0,
      floating: false, trailOn: false, spinT: 0, running: false, hidden: false, bounced: false });
    this.hitLow = m.level === 'low' || !!(m.hit && m.hit.y > -120);

    if (prev !== 'dizzy' && game.onDamage(this, dir)) return 'hit';

    const air = this.y < GROUND_Y - 1 || prev === 'launched' || prev === 'lifted';
    if (this.hp <= 0 || m.launch || m.knock || air || prev === 'dizzy') {
      this.state = 'launched';
      this.vy = m.launch ? -16 : -8.5;
      this.vx = dir * (m.launch ? 2.2 : 5);
      if (this.hp <= 0) { this.vy = Math.min(this.vy, -12); this.vx = dir * 5.5; }
    } else {
      this.state = 'hit';
      this.stun = m.stun || 15;
      this.vx = dir * (m.kb || 4);
    }
    return 'hit';
  }

  // ---------------- ANIMACIÓN ----------------
  animate() {
    const P = POSES, s = this.state, tmp = this._tmp, idle = this.stance.idle;
    let tgt = idle, k = 0.28;
    switch (s) {
      case 'idle': case 'recover': {
        copyPose(tmp, idle);
        const st = this.stance, b = Math.sin(this.t * st.speed) * st.bob;
        tmp.h += b; tmp.ff[1] += b; tmp.bf[1] += b;
        tmp.fh[1] += b * 1.3; tmp.bh[1] += b * 1.3;
        tgt = tmp;
        break;
      }
      case 'walk': {
        this.walkPhase += 0.2 * (this.vx * this.facing >= 0 ? 1 : -1);
        const ph = this.walkPhase, sn = Math.sin(ph);
        copyPose(tmp, idle);
        const hh = idle.h + Math.abs(Math.cos(ph)) * 2;
        tmp.h = hh;
        tmp.ff[0] = 18 + sn * 16; tmp.ff[1] = hh - Math.max(0, Math.cos(ph)) * 9;
        tmp.bf[0] = -22 - sn * 16; tmp.bf[1] = hh - Math.max(0, -Math.cos(ph)) * 9;
        tmp.fh[0] -= sn * 6; tmp.bh[0] += sn * 6;
        tgt = tmp; k = 0.5;
        break;
      }
      case 'run': {
        this.walkPhase += 0.34;
        const ph = this.walkPhase, sn = Math.sin(ph);
        copyPose(tmp, idle);
        const hh = idle.h - 6 + Math.abs(Math.cos(ph)) * 4;
        tmp.h = hh; tmp.lean = 24;
        tmp.ff[0] = 6 + sn * 32; tmp.ff[1] = hh - Math.max(0, Math.cos(ph)) * 22;
        tmp.bf[0] = -6 - sn * 32; tmp.bf[1] = hh - Math.max(0, -Math.cos(ph)) * 22;
        tmp.fh[0] = 16 - sn * 26; tmp.fh[1] = -6;
        tmp.bh[0] = 6 + sn * 26; tmp.bh[1] = 4;
        tgt = tmp; k = 0.55;
        break;
      }
      case 'crouch': tgt = P.crouch; k = 0.4; break;
      case 'block': tgt = P.block; k = 0.5; break;
      case 'cblock': tgt = P.cblock; k = 0.5; break;
      case 'prejump': case 'land': tgt = P.prejump; k = 0.55; break;
      case 'jump': tgt = P.jump; k = 0.25; break;
      case 'attack': {
        const m = this.move, end = m.startup + m.active, t = this.moveT;
        k = t < end ? 0.5 : 0.2;
        if (m.kind === 'tele') tgt = t < 15 ? P.castUp : (m.hit ? P[m.pose] : idle);
        else if (m.kind === 'dash') {
          if (t < m.startup) tgt = P.prejump;
          else if (m.pose === 'bike') {
            copyPose(tmp, P.flykick);
            const ph = t * 0.6;
            tmp.ff[0] = 70 + Math.sin(ph) * 26; tmp.ff[1] = 20 + Math.cos(ph) * 30;
            tmp.bf[0] = 70 - Math.sin(ph) * 26; tmp.bf[1] = 20 - Math.cos(ph) * 30;
            tgt = tmp; k = 0.6;
          } else tgt = P[m.pose];
          k = 0.45;
        } else if (m.wind && t < m.startup * 0.6) tgt = P[m.wind];
        else if (m.pose === 'upper' && t < m.startup - 2) tgt = P.upperWind;
        else if (t < end + (m.hold || 0) || m.air) tgt = P[m.pose];
        else tgt = m.crouch ? P.crouch : idle;
        break;
      }
      case 'grab': {
        const g = this.grab;
        if (!g) break;
        if (g.mode === 'throw') tgt = g.t < 8 ? P.throw : P.throwToss;
        else if (g.mode === 'slam') tgt = g.t < 16 ? P.castUp : P.quake;
        else tgt = P.cast;
        k = 0.4;
        break;
      }
      case 'held':
        if (this.heldMode === 'drain') tgt = P.dizzy;
        else { copyPose(tmp, P.launched); tmp.rot = -Math.min(160, this.heldT * 9); tgt = tmp; k = 0.4; }
        break;
      case 'lifted': {
        copyPose(tmp, P.hit);
        const w = Math.sin(this.t * 0.4);
        tmp.fh[0] += w * 20; tmp.bh[0] -= w * 20; tmp.ff[0] += w * 10;
        tgt = tmp; k = 0.3;
        break;
      }
      case 'hit': tgt = this.pulled ? P.dizzy : this.hitLow ? P.hitLow : P.hit; k = 0.5; break;
      case 'launched': tgt = P.launched; k = 0.2; break;
      case 'down': case 'dead': tgt = P.down; k = 0.22; break;
      case 'getup': tgt = this.stun > 12 ? P.crouch : P.prejump; k = 0.16; break;
      case 'dizzy': {
        copyPose(tmp, P.dizzy);
        const w = Math.sin(this.t * 0.09);
        tmp.lean += w * 12; tmp.fh[0] += w * 10; tmp.bh[0] += w * 8;
        tgt = tmp; k = 0.2;
        break;
      }
      case 'intro': tgt = P[this.ch.intro] || idle; k = 0.12; break;
      case 'win': tgt = P[this.ch.win] || P.win; k = 0.15; break;
      case 'fatal': tgt = P.cast; k = 0.3; break;
    }
    const flipping = s === 'jump' && this.flipping;
    blendPose(this.pose, tgt, k, !flipping);
    if (flipping) {
      this.airT++;
      this.pose.rot = this.flipping * Math.min(360, this.airT * 10.5);
    }
  }

  // Posición en el mundo de un punto del esqueleto (coordenadas locales de la cadera)
  toWorld(lx, ly) {
    const p = this.pose, rad = p.rot * Math.PI / 180, lying = LYING.has(this.state);
    const hipOff = lying ? p.h * Math.cos(rad) + 16 * Math.abs(Math.sin(rad)) : p.h;
    let x = lx, y = ly;
    if (!lying && p.rot) { [x, y] = rotPt(x, y + 30, rad); y -= 30; }
    else if (rad) [x, y] = rotPt(x, y, rad);
    y -= hipOff;
    const b = this.bulk * this.fxScale;
    return [this.x + x * this.facing * b, this.y + y * b];
  }

  updateExtras() {
    const p = this.pose, L = p.lean * Math.PI / 180;
    const ux = Math.sin(L), uy = -Math.cos(L), nx = Math.cos(L), ny = Math.sin(L);
    const hx = ux * (TORSO + 21) + nx * 2, hy = uy * (TORSO + 21) + ny * 2;
    this.headPos = this.toWorld(hx, hy);

    const tail = this.ch.look.tail;
    if (tail && !this.hidden && !this.gone) {
      const an = TAIL_ANCHOR[this.ch.look.head] || [-12, -2];
      const [wx, wy] = this.toWorld(hx + an[0] * nx - an[1] * ny, hy + an[0] * ny + an[1] * nx);
      this.updateTail(wx, wy, tail);
    }

    if (this.ch.look.chains) {
      if (this.hidden || this.gone) this.chains = null;
      else {
        const fa = ik(ux * TORSO + 4, uy * TORSO, ux * TORSO + p.fh[0], uy * TORSO + p.fh[1], UARM, FARM, 1);
        const ba = ik(ux * TORSO - 6, uy * TORSO + 3, ux * TORSO + p.bh[0], uy * TORSO + p.bh[1], UARM, FARM, 1);
        this.updateChains([this.toWorld(fa[2], fa[3]), this.toWorld(ba[2], ba[3])]);
      }
    }

    if (this.t % 2 === 0) {
      if (this.trailOn && !this.hidden) {
        this.trail.push({ x: this.x, y: this.y, facing: this.facing, pose: clonePose(this.pose),
          lying: LYING.has(this.state), spinT: this.spinT });
        if (this.trail.length > 5) this.trail.shift();
      } else if (this.trail.length) this.trail.shift();
    }
  }

  // Dos cadenas de fuego que cuelgan de las manos (cuerdas con física simple)
  updateChains(hands) {
    const n = 7, segL = 10;
    if (!this.chains || hands.some((h, k) => Math.hypot(this.chains[k][0].x - h[0], this.chains[k][0].y - h[1]) > 80)) {
      this.chains = hands.map(([hx, hy]) => Array.from({ length: n }, (_, i) =>
        ({ x: hx + this.facing * i * 3, y: hy + i * segL, px: hx + this.facing * i * 3, py: hy + i * segL })));
    }
    this.chains.forEach((c, k) => {
      const [hx, hy] = hands[k];
      c[0].x = c[0].px = hx;
      c[0].y = c[0].py = hy;
      for (let i = 1; i < n; i++) {
        const q = c[i];
        const vx = (q.x - q.px) * 0.9, vy = (q.y - q.py) * 0.9;
        q.px = q.x; q.py = q.y;
        q.x += vx + Math.sin(this.t * 0.06 + i * 0.7 + k * 2) * 0.25 * this.facing;
        q.y += vy + 0.55;
      }
      for (let it = 0; it < 3; it++) {
        for (let i = 1; i < n; i++) {
          const a = c[i - 1], b = c[i];
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, diff = (d - segL) / d;
          if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
          else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
        }
      }
      for (const q of c) if (q.y > GROUND_Y + 2) q.y = GROUND_Y + 2;
    });
  }

  drawChain(ctx, camX, k) {
    if (!this.chains) return;
    const pal = fighterPalette(this.ch, { flash: this.flash > 1, frozen: this.frozen > 0, tint: this.tint });
    const pts = [];
    for (const q of this.chains[k]) pts.push(q.x - camX, q.y);
    drawFireChain(ctx, pal, pts, this.t);
  }

  updateTail(ax, ay, tail) {
    const n = tail.len, segL = 8;
    let s = this.scarf;
    if (!s || Math.hypot(s[1].x - ax, s[1].y - ay) > 60) {
      s = this.scarf = [];
      for (let i = 0; i < n; i++) {
        const x = ax - this.facing * i * segL, y = ay + i * 2;
        s.push({ x, y, px: x, py: y });
      }
    }
    s[0].x = s[0].px = ax;
    s[0].y = s[0].py = ay;
    for (let i = 1; i < n; i++) {
      const q = s[i];
      const vx = (q.x - q.px) * 0.88, vy = (q.y - q.py) * 0.88;
      q.px = q.x; q.py = q.y;
      q.x += vx - this.facing * 0.35;
      q.y += vy + 0.45;
    }
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < n; i++) {
        const a = s[i - 1], b = s[i];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, diff = (d - segL) / d;
        if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
        else {
          a.x += dx * diff * 0.5; a.y += dy * diff * 0.5;
          b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5;
        }
      }
    }
    for (const q of s) if (q.y > GROUND_Y + 4) q.y = GROUND_Y + 4;
  }

  // ---------------- DIBUJO ----------------
  drawPose(ctx, camX, s, o) {
    const p = s.pose, rad = p.rot * Math.PI / 180;
    const hipOff = s.lying ? p.h * Math.cos(rad) + 16 * Math.abs(Math.sin(rad)) : p.h;
    const b = this.bulk * this.fxScale;
    ctx.save();
    ctx.translate(Math.round(s.x - camX), s.y);
    let sx = s.facing * b;
    if (s.spinT) {
      let c = Math.cos(s.spinT);
      if (Math.abs(c) < 0.08) c = c < 0 ? -0.08 : 0.08;
      sx *= c;
    }
    ctx.scale(sx, b);
    ctx.translate(0, -hipOff);
    if (!s.lying && p.rot) { ctx.translate(0, -30); ctx.rotate(rad); ctx.translate(0, 30); }
    else if (rad) ctx.rotate(rad);
    drawFigure(ctx, this.ch, p, o);
    ctx.restore();
  }

  draw(ctx, camX) {
    if (this.hidden || this.gone) return;
    let alpha = 1;
    if (this.invis > 0) alpha = this.flash > 0 ? 0.6 : 0.1 + 0.05 * Math.sin(this.t * 0.3);

    // estela de velocidad
    if (alpha === 1) {
      this.trail.forEach((s, i) => {
        ctx.globalAlpha = 0.1 + i * 0.06;
        this.drawPose(ctx, camX, s, { tint: this.trailColor || this.ch.color, headless: this.headless });
      });
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = alpha;
    if (this.scarf && !this.headless) this.drawTail(ctx, camX);
    if (this.chains) this.drawChain(ctx, camX, 1);

    const melting = this.melt > 0;
    if (melting) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-50, -50, W + 100, GROUND_Y + 52);
      ctx.clip();
      ctx.translate(0, this.melt * 200 * this.bulk);
    }
    this.drawPose(ctx, camX, { x: this.x, y: this.y, facing: this.facing, pose: this.pose,
      lying: LYING.has(this.state), spinT: this.spinT },
      { flash: this.flash > 1, frozen: this.frozen > 0, tint: this.tint, headless: this.headless });
    if (melting) ctx.restore();
    if (this.chains && !melting) this.drawChain(ctx, camX, 0);
    ctx.globalAlpha = 1;

    // red de captura
    if (this.netted > 0) {
      const x = this.x - camX, top = this.y - 190;
      ctx.strokeStyle = 'rgba(220,220,220,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = -3; i <= 3; i++) {
        ctx.moveTo(x - 40, top + 95 + i * 30); ctx.lineTo(x + 40, top + 95 + i * 30 - 50);
        ctx.moveTo(x - 40, top + 45 + i * 30); ctx.lineTo(x + 40, top + 45 + i * 30 + 50);
      }
      ctx.stroke();
    }
    // estrellas de mareo
    if (!this.headless && (this.state === 'dizzy' || (this.state === 'hit' && this.pulled))) {
      const [hx, hy] = this.headPos;
      ctx.fillStyle = '#ffe040';
      for (let i = 0; i < 3; i++) {
        const a = this.t * 0.12 + i * 2.09;
        drawStar(ctx, hx - camX + Math.cos(a) * 24, hy - 24 + Math.sin(a) * 6, 5);
      }
    }
  }

  drawTail(ctx, camX) {
    const s = this.scarf, tail = this.ch.look.tail;
    const col = this.frozen > 0 ? '#c8ecff' : this.flash > 1 ? '#fff' : this.tint || tail.color;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    for (let i = 1; i < s.length; i++) {
      ctx.lineWidth = tail.width * this.bulk * (1 - i / (s.length + 1)) + 1.5;
      ctx.beginPath();
      ctx.moveTo(s[i - 1].x - camX, s[i - 1].y);
      ctx.lineTo(s[i].x - camX, s[i].y);
      ctx.stroke();
    }
    // extremos deshilachados
    if (tail.tattered) {
      ctx.lineWidth = 2;
      for (const off of [-4, 3, 7]) {
        ctx.beginPath();
        ctx.moveTo(s[s.length - 3].x - camX, s[s.length - 3].y + off * 0.5);
        for (let i = s.length - 2; i < s.length; i++) ctx.lineTo(s[i].x - camX + off * 0.6, s[i].y + off);
        ctx.stroke();
      }
    }
  }

  drawShadow(ctx, camX) {
    if (this.hidden || this.gone) return;
    const s = Math.max(0.3, 1 - (GROUND_Y - this.y) / 300) * (this.invis > 0 ? 0.3 : 1);
    const lying = this.state === 'down' || this.state === 'dead';
    ctx.fillStyle = `rgba(0,0,0,${0.45 * s})`;
    ctx.beginPath();
    ctx.ellipse(this.x - camX + (lying ? -this.facing * 40 : 0), GROUND_Y + 3, (lying ? 80 : 42) * s * this.bulk, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
