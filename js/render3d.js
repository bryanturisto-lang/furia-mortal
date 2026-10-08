// ===== Luchadores en 3D =====
// Modelos hechos con Meshy (imagen → 3D → esqueleto → animaciones) y empaquetados con herramientas/empaquetar-3d.html.
// Si el modelo de un personaje está cargado, se dibuja en 3D; si no (o si falla la carga), con el dibujo 2D de siempre.
// El juego sigue mandando: estados, golpes, cajas de golpe y física son los mismos; aquí solo se elige qué
// animación mostrar y en qué instante, a partir del estado del luchador.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const MODELOS = {
  kaizen: { url: 'modelos/kaizen.glb', contraluz: '#ff9a50' },   // contraluz: color del brillo por detrás
  glaciar: { url: 'modelos/glaciar.glb', contraluz: '#8cc8ff' },
};

const PPM = 104;                               // píxeles del juego por metro (1,8 m ≈ 187 px, como el dibujo 2D)
const BOX_W = 400, BOX_H = 350, FOOT = 40;     // recuadro de cada luchador (px del juego) y margen bajo los pies
const MAX_ESCALA = 1.6, MAX_RES = 2;
const GIRO = 62 * Math.PI / 180;               // de perfil (90°), girado un poco hacia la cámara
const CABEZA_Y = 1.58;                         // altura de la cabeza en guardia (m): iguala la estatura de todos
// frames de transición entre animaciones: rápida al recibir un golpe, más lenta al volver a la guardia
const FADE = { golpe: 4, ataque: 5, guardia: 10, normal: 8 };
const VEL_MAX_PREP = 2;                        // la preparación de un golpe va, como mucho, al doble de su velocidad real
const VEL_GOLPE = 1.25;                        // el golpe y la recuperación, casi a velocidad real

// golpe del juego (move.pose) → animación
const ATAQUE = {
  hp: 'puno_alto', lp: 'puno_bajo', hk: 'patada_lateral', lk: 'patada_media', rh: 'patada_giro', upper: 'gancho',
  sweep: 'barrida_baja', clk: 'barrida_baja', clp: 'puno_bajo', jp: 'puno_alto', jk: 'patada_alta',
  throw: 'agarre', throwToss: 'agarre', cast: 'bola_fuego', castUp: 'bola_fuego', quake: 'bola_fuego',
  flypunch: 'puno_volador', flykick: 'puno_volador', torpedo: 'puno_volador', charge: 'puno_volador', bike: 'puno_volador',
  shadowkick: 'patada_giro', spin: 'patada_giro', slide: 'barrida_baja',
};
// animaciones de desplazamiento: se miden para que los pies no patinen sobre el suelo
const ANDAR = ['caminar_adelante', 'caminar_atras', 'correr'];
const GOLPEADO = new Set(['hit', 'launched', 'held', 'lifted']);
const AGACHADO = new Set(['clp']);   // golpes agachados: piernas en cuclillas, brazos del golpe
const EN_AIRE = new Set(['jp']);     // golpes en el aire: piernas del salto, brazos del golpe
const T_CUCLILLAS = 0.32;            // instante de 'saltar' en que está agachado tomando impulso
const T_BLOQUEO = 1.17;
// en estas animaciones la cadera no debe subir (el juego ya mueve al luchador por el aire)
const SIN_SUBIR = new Set(['caer']);

const PIERNAS = /^(Hips|(Left|Right)(UpLeg|Leg|Foot|ToeBase))$/;
// huesos que pueden tocar el suelo (pies de pie; espalda, cabeza o manos tumbado)
const CONTACTO = /^(Hips|Spine\d*|neck|Head|(Left|Right)(Arm|ForeArm|Hand|UpLeg|Leg|Foot|ToeBase))$/;
const HUNDIR = 0.04;   // m que se apoya la suela "dentro" del suelo, para que pise firme (la suela no es plana)
// estados en los que el luchador está apoyado en el suelo (se le ajusta la altura para que no flote)
const APOYADO = new Set(['idle', 'walk', 'run', 'crouch', 'block', 'cblock', 'prejump', 'land', 'recover', 'intro',
  'win', 'dizzy', 'hit', 'grab', 'fatal', 'attack', 'down', 'dead', 'getup']);

const loader = new GLTFLoader();
const bases = {};          // id → { scene, clips: {nombre: clip}, info: {nombre: {dur, impacto}}, caderaY }
const instancias = new Map();

let renderer = null, camera = null, scene = null, rim = null;

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
  rim = new THREE.DirectionalLight('#ff9a50', 1.4);
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
  // para apoyar en el suelo: altura de cada pie en reposo (el grosor de la suela) y,
  // para el resto del cuerpo, un pequeño margen (la carne alrededor del hueso)
  base.contacto = [];
  for (const [n, b] of Object.entries(huesos)) {
    if (!CONTACTO.test(n)) continue;
    const pie = /(Foot|ToeBase)$/.test(n);
    base.contacto.push([n, pie ? b.getWorldPosition(v).y : 0.07]);
  }
  // todos los modelos a la misma estatura en guardia (así se ven casi toda la pelea):
  // la cabeza a CABEZA_Y metros del suelo
  base.escala = 1;
  if (huesos.Head && base.clips.guardia) {
    const g = mixer.clipAction(base.clips.guardia).play();
    g.time = 0;
    mixer.update(0);
    root.updateMatrixWorld(true);
    base.escala = CABEZA_Y / huesos.Head.getWorldPosition(v).y;
    g.stop();
  }
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
    // velocidad a la que avanza el cuerpo: es la velocidad con que se desliza hacia atrás el pie apoyado
    let paso = 0;
    if (ANDAR.includes(nombre)) {
      const pies = [huesos.LeftFoot, huesos.RightFoot], M = 60, dt = clip.duration / M;
      let dist = 0, tiempo = 0, prev = null;
      for (let i = 0; i <= M; i++) {
        act.time = Math.min(clip.duration - 0.001, i * dt);
        mixer.update(0);
        root.updateMatrixWorld(true);
        const p = pies.map(b => b.getWorldPosition(new THREE.Vector3()));
        const abajo = p[0].y <= p[1].y ? 0 : 1;
        if (prev && prev.pie === abajo) { dist += Math.abs(p[abajo].z - prev.z); tiempo += dt; }
        prev = { pie: abajo, z: p[abajo].z };
      }
      paso = tiempo > 0 ? dist / tiempo : 0;
    }
    act.stop();
    base.info[nombre] = { dur: clip.duration, impacto, paso };
  }
  mixer.stopAllAction();
  root.traverse(o => { if (o.isSkinnedMesh) o.skeleton.pose(); });
}

async function cargar(id, { url, contraluz }) {
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
  const base = { scene: g.scene, clips, info: {}, caderaY: 1, contraluz: new THREE.Color(contraluz || '#ff9a50') };
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
  it = { base, root, mixer, acciones, mats, huesos, actual: null, previa: null, mezcla: 1, clave: '', fade: FADE.normal,
    estado: null, ataque: -1, t0: 0, desdeSuelo: false, tinte: '', ultT: null, dtf: 1, giro: null, fase: {} };
  instancias.set(key, it);
  return it;
}

const ciclo = (it, n, t) => { const d = it.base.info[n].dur; return ((t % d) + d) % d; };
const tope = (it, n, t) => Math.max(0, Math.min(it.base.info[n].dur - 0.001, t));
const lerp3 = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));

// Instante de una animación de golpe según los frames del golpe en el juego.
// La preparación se acelera solo lo justo para llegar al impacto a tiempo (como mucho x2) y,
// desde el impacto, la animación sigue casi a velocidad real: así no se ve robótico.
function tiempoGolpe(it, nombre, m, t) {
  const inf = it.base.info[nombre], imp = inf.impacto, fin = inf.dur - 0.001;
  const su = (m.startup || 6) / 60, s = t / 60;
  const prep = Math.min(imp, Math.max(0.12, su * VEL_MAX_PREP));
  if (s < su) return imp - prep + prep * (s / su);
  if (m.air || m.kind === 'dash') return Math.min(fin, imp + (s - su) * 0.25);   // mantiene el golpe extendido
  return Math.min(fin, imp + (s - su) * VEL_GOLPE);
}

// Avanza una animación de desplazamiento al ritmo real del luchador (sin que los pies patinen)
function andar(it, n, f) {
  const inf = it.base.info[n], v = Math.abs(f.vx) * 60 / PPM;                 // m/s en el juego
  const escala = it.root.scale.x || 1;
  const ritmo = inf.paso > 0.05 ? v / (inf.paso * escala) : 1.1;
  it.fase[n] = ((it.fase[n] || 0) + it.dtf / 60 * Math.min(2.6, Math.max(0.6, ritmo))) % inf.dur;
  return it.fase[n];
}

// Qué animación (o combinación) mostrar para un luchador. Devuelve [[nombre, segundos], ...]
function elegir(f, it) {
  const s = f.state, el = (f.t - it.t0) / 60, reloj = f.t / 60;
  switch (s) {
    case 'idle': case 'recover': case 'intro': return [['guardia', ciclo(it, 'guardia', reloj)]];
    case 'walk': {
      const n = f.vx * f.facing >= 0 ? 'caminar_adelante' : 'caminar_atras';
      return [[n, andar(it, n, f)]];
    }
    case 'run': return [['correr', andar(it, 'correr', f)]];
    case 'crouch': return [['saltar:inf', T_CUCLILLAS], ['guardia:sup', ciclo(it, 'guardia', reloj)]];
    // en guardia alta o baja se respira un poco (no queda congelado)
    case 'cblock': return [['saltar:inf', T_CUCLILLAS], ['bloqueo:sup', T_BLOQUEO + Math.sin(reloj * 2.2) * 0.12]];
    case 'block': return [['bloqueo', T_BLOQUEO + Math.sin(reloj * 2.2) * 0.12]];
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

// Aplica la animación elegida, con una transición suave (acelera y frena) desde la anterior
function aplicar(it, spec, fade = FADE.normal, apoyado = false) {
  const clave = spec.map(s => s[0]).join('+');
  if (clave !== it.clave) {
    // si la transición anterior iba por la mitad, se parte de la pose de origen para no dar saltos
    if (it.mezcla >= 0.5 || !it.previa) it.previa = it.actual;
    it.mezcla = 0;
    it.clave = clave;
    it.fade = fade;
  }
  it.actual = spec;
  it.mezcla = Math.min(1, it.mezcla + it.dtf / it.fade);
  const w = it.mezcla * it.mezcla * (3 - 2 * it.mezcla);
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
  poner(w < 1 ? it.previa : null, 1 - w);
  poner(spec, w);
  for (const [a, p] of pesos) { a.enabled = true; a.setEffectiveWeight(p.w); a.time = p.t; }
  it.mixer.update(0);
  it.root.position.y = 0;
  it.root.updateMatrixWorld(true);
  if (apoyado) {
    // la parte del cuerpo más baja queda justo sobre el suelo (ni flotando ni hundida)
    const s = it.root.scale.y;
    let min = Infinity;
    for (const [n, h0] of it.base.contacto) {
      const y = it.huesos[n].getWorldPosition(tmpV).y - h0 * s;
      if (y < min) min = y;
    }
    const obj = -min - HUNDIR;
    it.ajusteY = it.ajusteY == null ? obj : it.ajusteY + (obj - it.ajusteY) * Math.min(1, 0.5 * it.dtf);
    it.root.position.y = it.ajusteY;
  } else {
    it.ajusteY = null;
    // que la cadera no suba en las animaciones de caída (la altura la pone el juego)
    if (spec.some(sp => SIN_SUBIR.has(sp[0]))) {
      const y = it.huesos.Hips.getWorldPosition(tmpV).y;
      it.root.position.y = -Math.max(0, y - it.base.caderaY * it.root.scale.y);
    }
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
  rim.color.copy(it.base.contraluz);
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

// ---------- Escenario: suelo de piedra en perspectiva real + efectos 3D (cadena de la Lanza Infernal) ----------
// Un segundo renderizador del tamaño de la pantalla. El suelo se mueve 1:1 con los luchadores (a su profundidad,
// 1 m = PPM px) y se funde con el fondo pintado hacia el horizonte.
const SUELO_TOP = 380, HORIZONTE = 370, FOCAL = 624, CAM_H = 0.96, CAM_D = FOCAL / PPM;
let esc = null;

function iniciarEscena() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
  r.setPixelRatio(1);
  r.setSize(W * MAX_RES, H * MAX_RES, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.setClearColor(0x000000, 0);
  r.setScissorTest(true);
  esc = { r, suelo: null, cadena: null };

  // suelo
  const tex = new THREE.TextureLoader().load('modelos/suelo.jpg', () => { esc.suelo.listo = true; });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = r.capabilities.getMaxAnisotropy();
  const LADO = 3.4, ANCHO = 120, Z0 = 6, Z1 = -40;
  tex.repeat.set(ANCHO / LADO, (Z0 - Z1) / LADO);
  const geo = new THREE.PlaneGeometry(ANCHO, Z0 - Z1, 1, 46);
  geo.rotateX(-Math.PI / 2);
  geo.translate(STAGE_W / 2 / PPM, 0, (Z0 + Z1) / 2);
  // se desvanece hacia el fondo para fundirse con la pintura
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i), a = Math.max(0, Math.min(1, (z + 22) / 13));
    col.set([1, 1, 1, a * a * (3 - 2 * a)], i * 4);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, transparent: true });
  const sc = new THREE.Scene();
  sc.add(new THREE.Mesh(geo, mat));
  sc.add(new THREE.AmbientLight('#c8c0d0', 1.25));
  // luz de los braseros (cálida, titila) y de la luna (fría, rasante)
  const calido = new THREE.PointLight('#ff9a50', 22, 16, 1.4);
  calido.position.set(STAGE_W / 2 / PPM, 2.2, -3);
  sc.add(calido);
  const luna = new THREE.DirectionalLight('#aab4ff', 0.9);
  luna.position.set(-2, 3, -6);
  sc.add(luna);
  const cam = new THREE.PerspectiveCamera(2 * Math.atan(HORIZONTE / FOCAL) * 180 / Math.PI, W / (HORIZONTE * 2), 0.1, 80);
  cam.setViewOffset(W, HORIZONTE * 2, 0, SUELO_TOP, W, H - SUELO_TOP);
  esc.suelo = { sc, cam, calido, listo: false };
}

// Cadena y gancho de metal (modelados aquí, sin archivos): eslabones de hierro y un kunai con lengüetas y argolla
function crearCadena() {
  const env = new THREE.PMREMGenerator(esc.r);
  const sc = new THREE.Scene();
  sc.environment = env.fromScene(new RoomEnvironment(), 0.04).texture;
  // hierro oscuro apenas al rojo, acero pulido con brillos
  const hierro = new THREE.MeshStandardMaterial({ color: '#4a4440', metalness: 0.9, roughness: 0.42,
    emissive: '#ff3a00', emissiveIntensity: 0.07, envMapIntensity: 1.3 });
  const acero = new THREE.MeshStandardMaterial({ color: '#9a9aa4', metalness: 0.9, roughness: 0.3, envMapIntensity: 1.6 });
  const MAX = 90;
  const eslabon = new THREE.TorusGeometry(4.2, 1.3, 8, 14);
  eslabon.scale(1.45, 1, 1);
  const links = new THREE.InstancedMesh(eslabon, hierro, MAX);
  links.frustumCulled = false;
  sc.add(links);

  // kunai: hoja en forma de hoja con dos lengüetas hacia atrás, mango y argolla (apunta a +X, unos 64 px)
  const s = new THREE.Shape();
  s.moveTo(64, 0);
  s.quadraticCurveTo(44, 11, 26, 13);
  s.lineTo(14, 22); s.lineTo(18, 8);           // lengüeta superior
  s.lineTo(12, 5); s.lineTo(12, -5);
  s.lineTo(18, -8); s.lineTo(14, -22);         // lengüeta inferior
  s.lineTo(26, -13);
  s.quadraticCurveTo(44, -11, 64, 0);
  const hoja = new THREE.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: true, bevelThickness: 2.4, bevelSize: 2, bevelSegments: 3 });
  hoja.translate(0, 0, -1);
  const gancho = new THREE.Group();
  gancho.add(new THREE.Mesh(hoja, acero));
  const mango = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 14, 10), new THREE.MeshStandardMaterial({ color: '#2a1a14', roughness: 0.8 }));
  mango.rotation.z = Math.PI / 2; mango.position.x = 5;
  gancho.add(mango);
  const argolla = new THREE.Mesh(new THREE.TorusGeometry(5, 1.6, 8, 16), hierro);
  argolla.position.x = -6;
  gancho.add(argolla);
  sc.add(gancho);

  sc.add(new THREE.AmbientLight('#ffffff', 0.25));
  const key = new THREE.DirectionalLight('#fff4ea', 2.6);
  key.position.set(-0.4, 1, 1);
  sc.add(key);
  const fuego = new THREE.DirectionalLight('#ff7a30', 1.4);   // reflejo cálido de los braseros desde abajo
  fuego.position.set(0.3, -1, 0.6);
  sc.add(fuego);
  const cam = new THREE.OrthographicCamera(0, W, 0, -H, -200, 200);
  esc.cadena = { sc, cam, links, gancho, MAX, m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), sz: new THREE.Vector3(1, 1, 1) };
}

// dibuja el último render de la escena (región x,y,w,h en px del juego) sobre el contexto del juego
function volcar(ctx, x, y, w, h, res) {
  const c = esc.r.domElement;
  ctx.drawImage(c, 0, c.height - Math.round(h * res), Math.round(w * res), Math.round(h * res), x, y, w, h);
}

const R3D = {
  has(ch) { return !!(ch && bases[ch.id]); },

  // Suelo en perspectiva (true si se dibujó; si no, el escenario usa su suelo 2D)
  drawFloor(ctx, camX) {
    if (!esc) iniciarEscena();
    const S = esc.suelo;
    if (!S.listo) return false;
    const res = Math.min(MAX_RES, Math.max(1, typeof RES === 'number' ? RES : 1));
    const h = H - SUELO_TOP;
    S.cam.position.set((camX + W / 2) / PPM, CAM_H, CAM_D);
    S.calido.intensity = 21 + Math.sin(performance.now() * 0.011) * 2.5 + Math.random() * 2;
    esc.r.setViewport(0, 0, W * res, h * res);
    esc.r.setScissor(0, 0, W * res, h * res);
    esc.r.clear();
    esc.r.render(S.sc, S.cam);
    volcar(ctx, 0, SUELO_TOP, W, h, res);
    return true;
  },

  // Cadena de metal de la mano al gancho. pts = [x0,y0,x1,y1,...] en px de pantalla; ang = dirección del gancho
  drawChain(ctx, pts, ang) {
    if (!esc) iniciarEscena();
    if (!esc.cadena) crearCadena();
    const C = esc.cadena, n = pts.length;
    // recuadro que ocupa la cadena (solo se dibuja esa zona)
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < n; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
    x0 = Math.floor(x0 - 80); y0 = Math.floor(y0 - 80); x1 = Math.ceil(x1 + 80); y1 = Math.ceil(y1 + 80);
    const w = x1 - x0, h = y1 - y0;
    // eslabones cada 9 px, girados 90° uno sí y otro no
    let k = 0, acc = 0;
    for (let i = 2; i < n && k < C.MAX; i += 2) {
      const ax = pts[i - 2], ay = pts[i - 1], bx = pts[i], by = pts[i + 1];
      const len = Math.hypot(bx - ax, by - ay), a = -Math.atan2(by - ay, bx - ax);
      for (; acc < len && k < C.MAX; acc += 9, k++) {
        const t = acc / len;
        C.v.set(ax + (bx - ax) * t, -(ay + (by - ay) * t), 0);
        C.e.set(k % 2 ? Math.PI / 2 : 0.3, 0, a, 'ZYX');   // primero el giro sobre su eje, luego la dirección
        C.q.setFromEuler(C.e);
        C.m.compose(C.v, C.q, C.sz);
        C.links.setMatrixAt(k, C.m);
      }
      acc -= len;
    }
    C.links.count = k;
    C.links.instanceMatrix.needsUpdate = true;
    const hx = pts[n - 2], hy = pts[n - 1];
    C.gancho.position.set(hx, -hy, 0);
    // el kunai es simétrico: basta con girarlo; además gira sobre su eje para que el acero destelle
    C.gancho.rotation.set(0.9 + Math.sin(performance.now() * 0.012) * 0.35, 0, -ang, 'ZYX');
    C.cam.left = x0; C.cam.right = x1; C.cam.top = -y0; C.cam.bottom = -y1;
    C.cam.updateProjectionMatrix();
    const res = Math.min(MAX_RES, Math.max(1, typeof RES === 'number' ? RES : 1));
    esc.r.setViewport(0, 0, w * res, h * res);
    esc.r.setScissor(0, 0, w * res, h * res);
    esc.r.clear();
    esc.r.render(C.sc, C.cam);
    volcar(ctx, x0, y0, w, h, res);
  },

  // Luchador en combate
  drawFighter(ctx, f, camX, o = {}) {
    const it = instancia('f' + f.idx + ':' + f.ch.id, f.ch.id);
    // frames de juego desde el último dibujo (las transiciones van al ritmo del juego, no de la pantalla)
    it.dtf = it.ultT == null ? 1 : Math.max(0, Math.min(4, f.t - it.ultT));
    it.ultT = f.t;
    const atk = f.state === 'attack' ? f.attackId : -1;
    let fade = FADE.normal;
    if (f.state !== it.estado || atk !== it.ataque) {
      it.desdeSuelo = f.state === 'dead' && (it.estado === 'launched' || it.estado === 'down');
      if (GOLPEADO.has(f.state)) fade = FADE.golpe;
      else if (f.state === 'attack') fade = FADE.ataque;
      else if (it.estado === 'attack' || it.estado === 'block' || it.estado === 'land') fade = FADE.guardia;
      it.estado = f.state; it.ataque = atk; it.t0 = f.t;
    }
    const b = f.bulk * f.fxScale;
    it.root.scale.setScalar(b * it.base.escala);
    // al cambiar de lado se gira poco a poco en vez de dar la vuelta de golpe
    const objetivo = f.facing * GIRO;
    if (it.giro == null) it.giro = objetivo;
    it.giro += (objetivo - it.giro) * (1 - Math.pow(0.72, it.dtf));
    it.root.rotation.set(0, it.giro + (f.spinT || 0), 0);
    if (it.huesos.Head) it.huesos.Head.scale.setScalar(o.headless ? 0.001 : 1);
    pintar(it, o);
    const apoyado = APOYADO.has(f.state) && f.y >= GROUND_Y - 1 && !f.floating && !(f.move && f.move.air && f.state === 'attack');
    aplicar(it, elegir(f, it), fade, apoyado);
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
    it.dtf = it.ultT == null ? 1 : Math.max(0, Math.min(4, (ahora - it.ultT) * 60));
    it.ultT = ahora;
    if (it.estado !== anim) { it.estado = anim; it.t0 = ahora; }
    const el = ahora - it.t0;
    it.root.scale.setScalar((ch.look.bulk || 1) * it.base.escala);
    it.root.rotation.set(0, facing * GIRO, 0);
    pintar(it, o);
    aplicar(it, [[anim, anim === 'victoria' ? tope(it, anim, el) : ciclo(it, anim, el)]], FADE.normal, true);
    dibujar(ctx, it, x, y, Math.min(MAX_ESCALA, escala), 0);
  },
};

window.R3D = R3D;
for (const [id, cfg] of Object.entries(MODELOS)) {
  cargar(id, cfg).catch(e => console.warn('Modelo 3D no disponible (' + id + '); se usa el dibujo 2D.', e));
}
