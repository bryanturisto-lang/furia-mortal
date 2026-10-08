// ===== Luchadores en 3D =====
// Modelos hechos con Meshy (imagen → 3D → esqueleto → animaciones) y empaquetados con herramientas/empaquetar-3d.html.
// Si el modelo de un personaje está cargado, se dibuja en 3D; si no (o si falla la carga), con el dibujo 2D de siempre.
// El juego sigue mandando: estados, golpes, cajas de golpe y física son los mismos; aquí solo se elige qué
// animación mostrar y en qué instante, a partir del estado del luchador.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const MODELOS = {
  kaizen: { url: 'modelos/kaizen.glb' },
};

const PPM = 104;                               // píxeles del juego por metro (1,8 m ≈ 187 px, como el dibujo 2D)
const BOX_W = 400, BOX_H = 350, FOOT = 40;     // recuadro de cada luchador (px del juego) y margen bajo los pies
const MAX_ESCALA = 1.6, MAX_RES = 2;
const GIRO = 62 * Math.PI / 180;               // de perfil (90°), girado un poco hacia la cámara
const FADE = 7;                                // frames de transición entre animaciones

// golpe del juego (move.pose) → animación
const ATAQUE = {
  hp: 'puno_alto', lp: 'puno_bajo', hk: 'patada_alta', lk: 'patada_alta', rh: 'patada_giro', upper: 'gancho',
  sweep: 'barrida', clk: 'barrida', clp: 'puno_bajo', jp: 'puno_alto', jk: 'patada_alta',
  throw: 'agarre', throwToss: 'agarre', cast: 'bola_fuego', castUp: 'bola_fuego', quake: 'bola_fuego',
  flypunch: 'puno_volador', flykick: 'puno_volador', torpedo: 'puno_volador', charge: 'puno_volador', bike: 'puno_volador',
  shadowkick: 'patada_giro', spin: 'patada_giro', slide: 'barrida',
};
const AGACHADO = new Set(['clp']);   // golpes agachados: piernas en cuclillas, brazos del golpe
const EN_AIRE = new Set(['jp']);     // golpes en el aire: piernas del salto, brazos del golpe
const T_CUCLILLAS = 0.32;            // instante de 'saltar' en que está agachado tomando impulso
const T_BLOQUEO = 1.17;
// en estas animaciones la cadera no debe subir (el juego ya mueve al luchador por el aire)
const SIN_SUBIR = new Set(['caer']);

const PIERNAS = /^(Hips|(Left|Right)(UpLeg|Leg|Foot|ToeBase))$/;

const loader = new GLTFLoader();
const bases = {};          // id → { scene, clips: {nombre: clip}, info: {nombre: {dur, impacto}}, caderaY }
const instancias = new Map();

let renderer = null, camera = null, scene = null;

function iniciarRender() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(Math.ceil(BOX_W * MAX_ESCALA * MAX_RES), Math.ceil(BOX_H * MAX_ESCALA * MAX_RES), false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.setScissorTest(true);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff4ea', '#3a2a30', 2.1));
  const key = new THREE.DirectionalLight('#ffffff', 2.3);
  key.position.set(-1.5, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ff9a50', 1.4);
  rim.position.set(2, 2, -3);
  scene.add(rim);
  camera = new THREE.OrthographicCamera(-BOX_W / 2 / PPM, BOX_W / 2 / PPM, (BOX_H - FOOT) / PPM, -FOOT / PPM, 0.1, 20);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
}

// Momento de impacto de cada animación: cuando una mano o un pie llega más lejos hacia delante.
function analizar(base) {
  const root = base.scene, mixer = new THREE.AnimationMixer(root);
  const huesos = {};
  root.traverse(o => { if (o.isBone) huesos[o.name] = o; });
  const ext = ['LeftHand', 'RightHand', 'LeftFoot', 'RightFoot'].map(n => huesos[n]).filter(Boolean);
  const hips = huesos.Hips, v = new THREE.Vector3(), h = new THREE.Vector3();
  root.updateMatrixWorld(true);
  base.caderaY = hips.getWorldPosition(h).y;
  for (const [nombre, clip] of Object.entries(base.clips)) {
    if (nombre.includes(':')) continue;
    const act = mixer.clipAction(clip).play();
    let mejor = -1e9, impacto = clip.duration * 0.4;
    const N = 48;
    for (let i = 0; i <= N; i++) {
      const t = clip.duration * 0.78 * i / N;
      act.time = t;
      mixer.update(0);
      root.updateMatrixWorld(true);
      hips.getWorldPosition(h);
      for (const b of ext) {
        const d = b.getWorldPosition(v).z - h.z;
        if (d > mejor) { mejor = d; impacto = t; }
      }
    }
    act.stop();
    base.info[nombre] = { dur: clip.duration, impacto };
  }
  mixer.stopAllAction();
  root.traverse(o => { if (o.isSkinnedMesh) o.skeleton.pose(); });
}

async function cargar(id, { url }) {
  const g = await loader.loadAsync(url);
  const clips = {};
  for (const c of g.animations) {
    clips[c.name] = c;
    // versiones parciales para combinar: piernas de una animación + brazos de otra
    const inf = c.clone(), sup = c.clone();
    inf.name = c.name + ':inf'; sup.name = c.name + ':sup';
    inf.tracks = c.tracks.filter(t => PIERNAS.test(t.name.split('.')[0]));
    sup.tracks = c.tracks.filter(t => !PIERNAS.test(t.name.split('.')[0]));
    clips[inf.name] = inf; clips[sup.name] = sup;
  }
  g.scene.traverse(o => {
    if (o.isMesh) {
      o.frustumCulled = false;
      const m = o.material;
      o.material = new THREE.MeshLambertMaterial({ map: m.map });   // más barato que el material estándar
    }
  });
  const base = { scene: g.scene, clips, info: {}, caderaY: 1 };
  analizar(base);
  if (!renderer) iniciarRender();
  bases[id] = base;
}

function instancia(key, id) {
  let it = instancias.get(key);
  if (it) return it;
  const base = bases[id];
  const root = SkeletonUtils.clone(base.scene);
  const mats = [];
  const huesos = {};
  root.traverse(o => {
    if (o.isMesh) { o.material = o.material.clone(); mats.push(o.material); o.frustumCulled = false; }
    if (o.isBone) huesos[o.name] = o;
  });
  const mixer = new THREE.AnimationMixer(root);
  const acciones = {};
  for (const [n, clip] of Object.entries(base.clips)) {
    const a = mixer.clipAction(clip);
    a.play(); a.paused = true; a.enabled = false;
    acciones[n] = a;
  }
  it = { base, root, mixer, acciones, mats, huesos, actual: null, previa: null, mezcla: 1, clave: '',
    estado: null, ataque: -1, t0: 0, desdeSuelo: false, tinte: '' };
  instancias.set(key, it);
  return it;
}

const ciclo = (it, n, t) => { const d = it.base.info[n].dur; return ((t % d) + d) % d; };
const tope = (it, n, t) => Math.max(0, Math.min(it.base.info[n].dur - 0.001, t));
const lerp3 = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));

// Instante de una animación de golpe según los frames del golpe en el juego
function tiempoGolpe(it, nombre, m, t) {
  const inf = it.base.info[nombre], imp = inf.impacto;
  const t0 = Math.max(0, imp - 0.42), t1 = Math.min(inf.dur, imp + 0.6);
  const su = m.startup || 6, ac = m.active || 6, rc = m.recovery || 14;
  if (t < su) return lerp3(t0, imp, t / su);
  if (m.air || m.kind === 'dash') return imp + Math.min(0.06, (t - su) * 0.01);
  if (t < su + ac) return imp + (t - su) / ac * 0.06;
  return lerp3(imp + 0.06, t1, (t - su - ac) / rc);
}

// Qué animación (o combinación) mostrar para un luchador. Devuelve [[nombre, segundos], ...]
function elegir(f, it) {
  const s = f.state, el = (f.t - it.t0) / 60, reloj = f.t / 60;
  switch (s) {
    case 'idle': case 'recover': case 'intro': return [['guardia', ciclo(it, 'guardia', reloj)]];
    case 'walk': {
      const n = f.vx * f.facing >= 0 ? 'caminar_adelante' : 'caminar_atras';
      return [[n, ciclo(it, n, reloj * 1.15)]];
    }
    case 'run': return [['correr', ciclo(it, 'correr', reloj)]];
    case 'crouch': return [['saltar:inf', T_CUCLILLAS], ['guardia:sup', ciclo(it, 'guardia', reloj)]];
    case 'cblock': return [['saltar:inf', T_CUCLILLAS], ['bloqueo:sup', T_BLOQUEO]];
    case 'block': return [['bloqueo', T_BLOQUEO]];
    case 'prejump': return [['saltar', Math.min(0.43, 0.15 + el * 2)]];
    case 'jump': return [['saltar', lerp3(0.6, 1.1, (f.vy + 16.5) / 33)]];
    case 'land': return [['saltar', tope(it, 'saltar', 1.3 + el * 1.5)]];
    case 'attack': {
      const m = f.move;
      if (!m) return [['guardia', 0]];
      if (m.kind === 'tele') {
        if (f.moveT < 15) return [['bola_fuego', tope(it, 'bola_fuego', 0.3 + f.moveT / 15)]];
        return [['puno_alto', tiempoGolpe(it, 'puno_alto', m, f.moveT - 15)]];
      }
      const n = m.kind === 'proj' || m.kind === 'ultra' ? 'bola_fuego' : ATAQUE[m.pose] || 'puno_alto';
      const t = tiempoGolpe(it, n, m, f.moveT);
      if (AGACHADO.has(m.pose)) return [['saltar:inf', T_CUCLILLAS], [n + ':sup', t]];
      if (EN_AIRE.has(m.pose) || (m.air && f.y < GROUND_Y - 2 && n !== 'patada_alta')) {
        return [['saltar:inf', lerp3(0.6, 1.1, (f.vy + 16.5) / 33)], [n + ':sup', t]];
      }
      return [[n, t]];
    }
    case 'grab': return [['agarre', tope(it, 'agarre', 0.6 + el * 1.8)]];
    case 'held': return [['golpe_cuerpo', 0.6]];
    case 'lifted': return [['golpe_cara', 0.9 + Math.sin(f.t * 0.2) * 0.15]];
    case 'hit':
      if (f.pulled) return [['mareado', ciclo(it, 'mareado', reloj)]];
      return [[f.hitLow ? 'golpe_cuerpo' : 'golpe_cara', Math.min(0.85, 0.05 + el * 1.6)]];
    case 'launched': return [['caer', lerp3(0.3, 1.75, el / 1.1)]];
    case 'down': return [['caer', tope(it, 'caer', 1.75 + el * 1.4)]];
    case 'dead':
      if (it.desdeSuelo) return [['caer', tope(it, 'caer', 1.75 + el * 1.4)]];
      return [['muerte', tope(it, 'muerte', el * 1.2)]];
    case 'getup': return [['levantarse', lerp3(3.9, 6.3, 1 - f.stun / 24)]];
    case 'dizzy': return [['mareado', ciclo(it, 'mareado', reloj)]];
    case 'win': return [['victoria', tope(it, 'victoria', el)]];
    case 'fatal': return [['bola_fuego', tope(it, 'bola_fuego', el * 1.3)]];
  }
  return [['guardia', ciclo(it, 'guardia', reloj)]];
}

// Aplica la animación elegida, con una transición suave desde la anterior
function aplicar(it, spec) {
  const clave = spec.map(s => s[0]).join('+');
  if (clave !== it.clave) {
    it.previa = it.actual;
    it.mezcla = 0;
    it.clave = clave;
  }
  it.actual = spec;
  it.mezcla = Math.min(1, it.mezcla + 1 / FADE);
  for (const a of Object.values(it.acciones)) a.enabled = false;
  const pesos = new Map();
  const poner = (lista, w) => {
    if (!lista || w <= 0) return;
    for (const [n, t] of lista) {
      const a = it.acciones[n];
      if (!a) continue;
      const p = pesos.get(a) || { w: 0, t };
      p.w += w; p.t = t;
      pesos.set(a, p);
    }
  };
  poner(it.mezcla < 1 ? it.previa : null, 1 - it.mezcla);
  poner(spec, it.mezcla);
  for (const [a, p] of pesos) { a.enabled = true; a.setEffectiveWeight(p.w); a.time = p.t; }
  it.mixer.update(0);
  // que la cadera no suba en las animaciones de caída (la altura la pone el juego)
  it.root.position.y = 0;
  if (spec.some(s => SIN_SUBIR.has(s[0]))) {
    it.root.updateMatrixWorld(true);
    const y = it.huesos.Hips.getWorldPosition(new THREE.Vector3()).y;
    it.root.position.y = -Math.max(0, y - it.base.caderaY * it.root.scale.y);
  }
}

function pintar(it, o) {
  const k = [o.flash ? 'f' : '', o.frozen ? 'z' : '', o.tint || ''].join('|');
  if (k === it.tinte) return;
  it.tinte = k;
  for (const m of it.mats) {
    m.color.set(o.frozen ? '#a8dcff' : '#ffffff');
    if (o.flash) { m.emissive.set('#ffffff'); m.emissiveIntensity = 0.75; }
    else if (o.tint) { m.emissive.set(o.tint); m.emissiveIntensity = 0.6; m.color.set(o.tint); }
    else if (o.frozen) { m.emissive.set('#3070b0'); m.emissiveIntensity = 0.5; }
    else { m.emissive.set('#000000'); m.emissiveIntensity = 0; }
  }
}

// Dibuja la instancia en el contexto 2D del juego, con los pies en (x, y)
const tmpV = new THREE.Vector3();
function dibujar(ctx, it, x, y, escala, angulo) {
  const res = Math.min(MAX_RES, Math.max(1, typeof RES === 'number' ? RES : 1));
  const vw = Math.round(BOX_W * escala * res), vh = Math.round(BOX_H * escala * res);
  const ch = renderer.domElement.height;
  renderer.setViewport(0, 0, vw, vh);
  renderer.setScissor(0, 0, vw, vh);
  renderer.clear();
  scene.add(it.root);
  renderer.render(scene, camera);
  scene.remove(it.root);
  const dx = x - BOX_W * escala / 2, dy = y - (BOX_H - FOOT) * escala;
  if (angulo) {
    const px = x, py = y - 110 * escala;
    ctx.save();
    ctx.translate(px, py); ctx.rotate(angulo); ctx.translate(-px, -py);
  }
  ctx.drawImage(renderer.domElement, 0, ch - vh, vw, vh, dx, dy, BOX_W * escala, BOX_H * escala);
  if (angulo) ctx.restore();
  // de un punto del esqueleto (mundo 3D) a coordenadas de la pantalla del juego
  return nombre => {
    const b = it.huesos[nombre];
    if (!b) return null;
    b.getWorldPosition(tmpV);
    const z = tmpV.z;
    tmpV.project(camera);
    return [dx + (tmpV.x + 1) / 2 * BOX_W * escala, dy + (1 - tmpV.y) / 2 * BOX_H * escala, z];
  };
}

const R3D = {
  has(ch) { return !!(ch && bases[ch.id]); },

  // Luchador en combate
  drawFighter(ctx, f, camX, o = {}) {
    const it = instancia('f' + f.idx + ':' + f.ch.id, f.ch.id);
    const atk = f.state === 'attack' ? f.attackId : -1;
    if (f.state !== it.estado || atk !== it.ataque) {
      it.desdeSuelo = f.state === 'dead' && (it.estado === 'launched' || it.estado === 'down');
      it.estado = f.state; it.ataque = atk; it.t0 = f.t;
    }
    const b = f.bulk * f.fxScale;
    it.root.scale.setScalar(b);
    it.root.rotation.set(0, f.facing * GIRO + (f.spinT || 0), 0);
    if (it.huesos.Head) it.huesos.Head.scale.setScalar(o.headless ? 0.001 : 1);
    pintar(it, o);
    aplicar(it, elegir(f, it));
    const rot = (f.state === 'held' && f.heldMode !== 'drain') || (f.state === 'jump' && f.flipping)
      ? f.pose.rot * Math.PI / 180 * f.facing : 0;
    const punto = dibujar(ctx, it, Math.round(f.x - camX), f.y, 1, rot);
    // manos (para las cadenas de fuego) y cabeza (estrellas de mareo), en coordenadas del escenario
    const L = punto('LeftHand'), R = punto('RightHand'), H = punto('Head');
    if (L && R) {
      const [del, tras] = L[2] >= R[2] ? [L, R] : [R, L];
      f.manos3d = [[del[0] + camX, del[1]], [tras[0] + camX, tras[1]]];
    }
    if (H) f.cabeza3d = [H[0] + camX, H[1]];
  },

  // Personaje suelto (pantalla de selección, campeón): anim = 'guardia' o 'victoria'
  drawAt(ctx, ch, x, y, facing = 1, escala = 1, o = {}) {
    const anim = o.anim3d || 'guardia';
    const it = instancia('v' + (o.slot || '') + ':' + ch.id + ':' + escala, ch.id);
    const ahora = performance.now() / 1000;
    if (it.estado !== anim) { it.estado = anim; it.t0 = ahora; }
    const el = ahora - it.t0;
    it.root.scale.setScalar(ch.look.bulk || 1);
    it.root.rotation.set(0, facing * GIRO, 0);
    pintar(it, o);
    aplicar(it, [[anim, anim === 'victoria' ? tope(it, anim, el) : ciclo(it, anim, el)]]);
    dibujar(ctx, it, x, y, Math.min(MAX_ESCALA, escala), 0);
  },
};

window.R3D = R3D;
for (const [id, cfg] of Object.entries(MODELOS)) {
  cargar(id, cfg).catch(e => console.warn('Modelo 3D no disponible (' + id + '); se usa el dibujo 2D.', e));
}
