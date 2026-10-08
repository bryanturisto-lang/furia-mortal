// ===== Personajes, golpes, especiales, proyectiles, poses y niveles de IA =====
//
// Entradas de especiales: 'B' = atrás, 'F' = adelante, 'D' = abajo (relativas a hacia dónde mira el luchador).
// Botones: hp = golpe alto, lp = golpe bajo, hk = patada alta, lk = patada baja.
// ai: 'far' (a distancia), 'mid' (media), 'close' (cuerpo a cuerpo), 'buff' (mejora propia).

const NINJA = (tail) => ({ head: 'hood', torso: 'vest', arms: 'sleeve', tail: { color: tail, len: 4, width: 4 } });

const CHARACTERS = [
  { id: 'kaizen', name: 'KAIZEN', color: '#b81f18', dark: '#5e0f0b', skin: '#c98a62', eyes: '#ffb030', glow: true,
    look: { head: 'mask', torso: 'warrior', arms: 'warrior', pants: '#1c1a1f', boots: '#2a2326', hair: '#151214',
      lava: '#ff7a1a', mask: '#2b2629', armor: '#211d22', knee: true, pauldron: true, collar: true, tabard: 'tattered',
      aura: ['#ff8a1a', '#ffcc40'], bulk: 1.04, tail: { color: '#a81c14', len: 7, width: 9, tattered: true } },
    stance: 'ninja', intro: 'taunt', win: 'winPoint',
    bio: 'Espectro vengativo del inframundo.',
    specials: [
      { name: 'Lanza Infernal', input: ['B', 'F'], btn: 'hp', kind: 'proj', proj: 'lanza', ai: 'far' },
      { name: 'Teletransporte', input: ['D', 'B'], btn: 'hp', kind: 'tele', attack: 'hp', ai: 'mid' },
    ],
    fatal: { input: ['D', 'D'], btn: 'hp', fx: 'fire' } },

  { id: 'glaciar', name: 'GLACIAR', color: '#2f6fd8', dark: '#13305e', skin: '#d9a982', eyes: '#cfe8ff', glow: true,
    look: { head: 'ponytail', torso: 'gi', arms: 'warrior', pants: '#141418', boots: '#22262e', hair: '#0e0e12',
      lava: '#9fe0ff', armor: '#18181d', knee: true, crystal: true, tabard: 'clean', collar: false,
      plate: '#8c97a8', spike: '#c8d2de', bracer: '#7d889a', bracer2: '#5a6474', strap: '#c8ccd4', tattoo: '#13305e',
      aura: ['#cfefff', '#ffffff'], bulk: 1.03, tail: { color: '#2f6fd8', len: 7, width: 6 } },
    stance: 'ninja', intro: 'bow', win: 'winCross',
    bio: 'Guerrero del clan del frío.',
    specials: [
      { name: 'Proyectil de Hielo', input: ['D', 'F'], btn: 'lp', kind: 'proj', proj: 'hielo', ai: 'far' },
      { name: 'Pared de Hielo', input: ['D', 'D'], btn: 'hp', kind: 'proj', proj: 'pared', ai: 'mid' },
      { name: 'Deslizamiento de Hielo', input: ['B', 'F'], btn: 'lk', kind: 'dash', dash: 'slide', trail: '#9fe0ff', ai: 'mid' },
      { name: 'Tormenta de Hielo', input: ['D', 'B', 'F'], btn: 'hk', kind: 'ultra', proj: 'tormenta', ai: 'ultra' },
    ],
    fatal: { input: ['F', 'F'], btn: 'lk', fx: 'ice' } },

  { id: 'veneno', name: 'VENENO', color: '#38c040', dark: '#16601c', skin: '#9fc48a', eyes: '#ff3b3b', glow: true,
    look: NINJA('#16601c'), stance: 'ninja', intro: 'taunt', win: 'win',
    bio: 'Criatura reptil. Su ácido lo corroe todo.',
    specials: [
      { name: 'Escupitajo Ácido', input: ['B', 'F'], btn: 'hp', kind: 'proj', proj: 'acido', ai: 'far' },
      { name: 'Deslizamiento', input: ['B', 'F'], btn: 'lk', kind: 'dash', dash: 'slide', ai: 'mid' },
      { name: 'Invisibilidad', input: ['D', 'B'], btn: 'hk', kind: 'invis', ai: 'buff' },
    ],
    fatal: { input: ['B', 'B'], btn: 'lp', fx: 'acid' } },

  { id: 'humo', name: 'HUMO', color: '#9aa2ac', dark: '#4a5058', skin: '#d8a27c', eyes: '#ffffff', glow: true,
    look: NINJA('#4a5058'), stance: 'ninja', intro: 'bow', win: 'winCross',
    bio: 'Ninja de humo. Nadie lo ve llegar.',
    specials: [
      { name: 'Nube Tóxica', input: ['B', 'F'], btn: 'hp', kind: 'proj', proj: 'nube', ai: 'far' },
      { name: 'Paso de Humo', input: ['D', 'B'], btn: 'lk', kind: 'tele', attack: 'upper', ai: 'mid' },
    ],
    fatal: { input: ['D', 'D'], btn: 'lk', fx: 'smoke' } },

  { id: 'sombra', name: 'SOMBRA', color: '#8a3cc8', dark: '#3a1658', skin: '#c79a7a', eyes: '#ff60ff', glow: true,
    look: NINJA('#3a1658'), stance: 'ninja', intro: 'taunt', win: 'winPoint',
    bio: 'Asesino del vacío. Aparece a tus espaldas.',
    specials: [
      { name: 'Orbe Oscuro', input: ['B', 'F'], btn: 'hp', kind: 'proj', proj: 'orbe', ai: 'far' },
      { name: 'Paso Sombrío', input: ['D', 'B'], btn: 'hp', kind: 'tele', attack: 'hp', ai: 'mid' },
      { name: 'Patada Sombra', input: ['B', 'F'], btn: 'lk', kind: 'dash', dash: 'shadow', trail: '#c060ff', ai: 'mid' },
    ],
    fatal: { input: ['F', 'F'], btn: 'hk', fx: 'void' } },

  { id: 'carmesi', name: 'CARMESÍ', color: '#d8262c', dark: '#6e0d10', skin: '#d8a27c', eyes: '#101010', glow: false,
    look: NINJA('#6e0d10'), stance: 'ninja', intro: 'bow', win: 'win',
    bio: 'Heredero del dragón rojo. Domina las llamas.',
    specials: [
      { name: 'Bola de Fuego', input: ['B', 'F'], btn: 'hp', kind: 'proj', proj: 'fuego', ai: 'far' },
      { name: 'Fuego Rastrero', input: ['B', 'F'], btn: 'lp', kind: 'proj', proj: 'fuegoBajo', ai: 'far' },
      { name: 'Torbellino', input: ['B', 'F'], btn: 'hk', kind: 'dash', dash: 'spin', ai: 'mid' },
    ],
    fatal: { input: ['D', 'F'], btn: 'hk', fx: 'fire2' } },

  { id: 'dragon', name: 'DRAGÓN', color: '#d42020', dark: '#7a0c0c', skin: '#d8a27c', eyes: '#1a1a1a', glow: false,
    look: { head: 'hair', torso: 'bare', arms: 'bare', pants: '#16151a', boots: '#16151a', hair: '#0e0e0e', band: '#d42020',
      tail: { color: '#d42020', len: 5, width: 3 } },
    stance: 'monk', intro: 'bow', win: 'win',
    bio: 'Monje shaolin, campeón del torneo anterior.',
    specials: [
      { name: 'Dragón de Fuego', input: ['F', 'F'], btn: 'hp', kind: 'proj', proj: 'dragon', ai: 'far' },
      { name: 'Patada Voladora', input: ['F', 'F'], btn: 'hk', kind: 'dash', dash: 'flykick', trail: '#ff6a3a', ai: 'mid' },
      { name: 'Patada Bicicleta', input: ['B', 'F'], btn: 'lk', kind: 'dash', dash: 'bike', ai: 'mid' },
    ],
    fatal: { input: ['B', 'B'], btn: 'hk', fx: 'dragon' } },

  { id: 'titan', name: 'TITÁN', color: '#3a8a3a', dark: '#1e4a1e', skin: '#8a5a3a', eyes: '#1a1a1a', glow: false,
    look: { head: 'bald', torso: 'bare', arms: 'metal', pants: '#2e5a2e', boots: '#1a1a1a', bulk: 1.14, thick: 1.15 },
    stance: 'boxer', intro: 'flex', win: 'flex',
    bio: 'Mayor de las fuerzas especiales. Brazos de acero.',
    specials: [
      { name: 'Onda Sísmica', input: ['D', 'F'], btn: 'hk', kind: 'proj', proj: 'onda', ai: 'far' },
      { name: 'Embestida', input: ['F', 'F'], btn: 'lk', kind: 'dash', dash: 'charge', ai: 'mid' },
      { name: 'Agarre Titánico', input: ['B', 'F'], btn: 'lp', kind: 'grab', mode: 'slam', ai: 'close' },
    ],
    fatal: { input: ['F', 'F'], btn: 'hp', fx: 'crush' } },

  { id: 'trueno', name: 'TRUENO', color: '#eef2f8', dark: '#3a6ab8', skin: '#d8b090', eyes: '#9ff0ff', glow: true,
    look: { head: 'hat', torso: 'robe', arms: 'robe', pants: '#3a6ab8', boots: '#20304a', hair: '#e8e8e8' },
    stance: 'monk', intro: 'cast', win: 'winCross',
    bio: 'Dios del trueno, protector del reino.',
    specials: [
      { name: 'Descarga Celestial', input: ['D', 'F'], btn: 'lp', kind: 'proj', proj: 'rayo', ai: 'far' },
      { name: 'Torpedo', input: ['B', 'F'], btn: 'hk', kind: 'dash', dash: 'torpedo', trail: '#bff4ff', ai: 'mid' },
      { name: 'Teletransporte', input: ['D', 'B'], btn: 'hk', kind: 'tele', ai: 'mid' },
    ],
    fatal: { input: ['D', 'B'], btn: 'hp', fx: 'bolt' } },

  { id: 'ciborg', name: 'CIBORG', color: '#d83a2a', dark: '#6a1a14', skin: '#9aa4b0', eyes: '#ff2a1a', glow: true,
    look: { head: 'helmet', torso: 'armor', arms: 'metal', pants: '#3a3e46', boots: '#d83a2a', bulk: 1.04 },
    stance: 'boxer', intro: 'cast', win: 'winCross',
    bio: 'Asesino cibernético. Programado para destruir.',
    specials: [
      { name: 'Misil Buscador', input: ['B', 'F'], btn: 'hp', kind: 'proj', proj: 'misil', ai: 'far' },
      { name: 'Red de Captura', input: ['B', 'B'], btn: 'lk', kind: 'proj', proj: 'red', ai: 'far' },
      { name: 'Granada', input: ['D', 'B'], btn: 'hp', kind: 'proj', proj: 'bomba', ai: 'mid' },
    ],
    fatal: { input: ['D', 'D'], btn: 'lp', fx: 'cyber' } },

  { id: 'abanico', name: 'ABANICO', color: '#e0458c', dark: '#7a1848', skin: '#e0b090', eyes: '#1a1a1a', glow: false,
    look: { head: 'bun', torso: 'vest', arms: 'bare', pants: '#7a1848', boots: '#e0458c', hair: '#141014', bulk: 0.95,
      tail: { color: '#141014', len: 5, width: 6 } },
    stance: 'mystic', intro: 'bow', win: 'win',
    bio: 'Princesa guerrera de diez mil años.',
    specials: [
      { name: 'Abanico Cortante', input: ['B', 'F'], btn: 'hp', kind: 'proj', proj: 'abanico', ai: 'far' },
      { name: 'Levitación', input: ['B', 'B'], btn: 'hp', kind: 'proj', proj: 'viento', ai: 'mid' },
      { name: 'Vuelo del Fénix', input: ['D', 'F'], btn: 'hp', kind: 'dash', dash: 'flypunch', trail: '#ff7ab8', ai: 'mid' },
    ],
    fatal: { input: ['B', 'F'], btn: 'lk', fx: 'decap' } },

  { id: 'alma', name: 'ALMA', color: '#c8962a', dark: '#5a1a10', skin: '#d0a888', eyes: '#7dff6a', glow: true,
    look: { head: 'long', torso: 'robe', arms: 'robe', pants: '#5a1a10', boots: '#2a0a06', hair: '#101010',
      tail: { color: '#101010', len: 6, width: 9 } },
    stance: 'mystic', intro: 'cast', win: 'winPoint',
    bio: 'Hechicero que roba las almas de los vencidos.',
    specials: [
      { name: 'Calaveras de Fuego', input: ['B', 'F'], btn: 'hp', kind: 'proj', proj: 'calavera', ai: 'far' },
      { name: 'Robo de Alma', input: ['B', 'F'], btn: 'lp', kind: 'grab', mode: 'drain', ai: 'close' },
      { name: 'Erupción', input: ['D', 'B'], btn: 'hk', kind: 'erupt', ai: 'mid' },
    ],
    fatal: { input: ['F', 'F'], btn: 'lp', fx: 'soul' } },
];

// Golpes normales (frames a 60 fps). hit = caja de golpe relativa a los pies, mirando a la derecha.
// level: high (se esquiva agachado), mid, low (solo se bloquea agachado), overhead (solo se bloquea de pie)
const MOVES = {
  hp:    { startup: 5,  active: 4,  recovery: 11, dmg: 6,  hit: { x: 26, y: -176, w: 70, h: 34 },  kb: 5, stun: 16, level: 'high', pose: 'hp', wind: 'hpWind' },
  lp:    { startup: 4,  active: 4,  recovery: 8,  dmg: 4,  hit: { x: 26, y: -134, w: 64, h: 34 },  kb: 4, stun: 14, level: 'mid',  pose: 'lp' },
  hk:    { startup: 8,  active: 5,  recovery: 15, dmg: 9,  hit: { x: 26, y: -184, w: 90, h: 48 },  kb: 8, stun: 20, level: 'high', pose: 'hk', wind: 'hkChamber', heavy: true },
  lk:    { startup: 7,  active: 5,  recovery: 12, dmg: 7,  hit: { x: 26, y: -112, w: 84, h: 50 },  kb: 6, stun: 17, level: 'mid',  pose: 'lk', wind: 'lkChamber' },
  rh:    { startup: 11, active: 6,  recovery: 18, dmg: 12, hit: { x: 20, y: -190, w: 92, h: 64 },  kb: 9, stun: 0,  level: 'high', pose: 'rh', wind: 'rhWind', heavy: true, knock: true },
  clp:   { startup: 4,  active: 4,  recovery: 8,  dmg: 3,  hit: { x: 24, y: -100, w: 64, h: 28 },  kb: 3, stun: 12, level: 'mid',  pose: 'clp', crouch: true },
  clk:   { startup: 5,  active: 4,  recovery: 10, dmg: 4,  hit: { x: 22, y: -42,  w: 90, h: 34 },  kb: 3, stun: 12, level: 'low',  pose: 'clk', crouch: true },
  sweep: { startup: 8,  active: 6,  recovery: 20, dmg: 8,  hit: { x: 18, y: -36,  w: 108, h: 36 }, kb: 3, stun: 0,  level: 'low',  pose: 'sweep', wind: 'sweepWind', crouch: true, knock: true, heavy: true },
  upper: { startup: 7,  active: 6,  recovery: 24, dmg: 15, hit: { x: 12, y: -215, w: 62, h: 125 }, kb: 3, stun: 0,  level: 'mid',  pose: 'upper', launch: true, heavy: true, crouchStart: true },
  jp:    { startup: 3,  active: 14, recovery: 0,  dmg: 8,  hit: { x: 6,  y: -130, w: 74, h: 52 },  kb: 5, stun: 16, level: 'overhead', pose: 'jp', air: true },
  jk:    { startup: 4,  active: 14, recovery: 0,  dmg: 10, hit: { x: 6,  y: -104, w: 86, h: 64 },  kb: 6, stun: 18, level: 'overhead', pose: 'jk', air: true, heavy: true },
  throw: { kind: 'throw', mode: 'throw', range: 85, startup: 4, active: 1, recovery: 20, pose: 'throw' },
};

// Especiales tipo embestida / ataque en movimiento
const DASH = {
  slide:    { pose: 'slide', speed: 9.5, dur: 16, startup: 5, dmg: 9, hit: { x: 0, y: -44, w: 96, h: 44 }, level: 'low', knock: true },
  shadow:   { pose: 'shadowkick', speed: 11, dur: 14, startup: 6, dmg: 10, hit: { x: 10, y: -150, w: 96, h: 80 }, level: 'mid', knock: true, trail: true },
  flykick:  { pose: 'flykick', speed: 11, dur: 22, startup: 5, dmg: 11, hit: { x: 10, y: -120, w: 92, h: 60 }, level: 'mid', knock: true, air: 70, trail: true },
  bike:     { pose: 'bike', speed: 4.5, dur: 44, startup: 6, dmg: 3, hit: { x: 10, y: -140, w: 92, h: 92 }, level: 'mid', air: 60, multi: true, every: 8, kb: 2, stun: 14 },
  charge:   { pose: 'charge', speed: 10, dur: 18, startup: 6, dmg: 11, hit: { x: 10, y: -150, w: 62, h: 110 }, level: 'mid', knock: true, heavy: true, trail: true },
  torpedo:  { pose: 'torpedo', speed: 13, dur: 30, startup: 8, dmg: 12, hit: { x: 0, y: -150, w: 104, h: 70 }, level: 'mid', knock: true, air: 70, trail: true, heavy: true },
  flypunch: { pose: 'flypunch', speed: 10, dur: 22, startup: 8, dmg: 10, hit: { x: 10, y: -140, w: 82, h: 72 }, level: 'overhead', knock: true, air: 100, trail: true },
  spin:     { pose: 'spin', speed: 6, dur: 36, startup: 6, dmg: 4, hit: { x: -20, y: -170, w: 112, h: 120 }, level: 'mid', multi: true, every: 12, effect: 'daze', spin: true },
};

// Proyectiles. y = altura relativa a los pies (por defecto -120). effect: qué le pasa al rival al recibirlo.
const PROJ = {
  lanza:     { speed: 15, dmg: 5,  w: 34, h: 16, color: '#ff7a1a', range: 560, effect: 'pull', style: 'lanza' },
  hielo:     { speed: 9,  dmg: 4,  w: 44, h: 22, color: '#9fe0ff', effect: 'freeze', style: 'ice', pose: 'cast' },
  // Pared de hielo: brota frente a GLACIAR, lanza al rival y frena proyectiles enemigos
  pared:     { speed: 0,  dmg: 9,  w: 62, h: 190, color: '#a8e6ff', effect: 'launch', style: 'icewall', offset: 105,
               y: -95, life: 50, wall: true, pose: 'quake', wind: 'castUp', startup: 14, recovery: 30 },
  // ULTRA: tornado de hielo sobre el rival, varios golpes imbloqueables y congelación final
  tormenta:  { speed: 0,  dmg: 4,  w: 150, h: 260, color: '#bfefff', effect: 'stun', stun: 22, style: 'storm', atTarget: true,
               y: -130, life: 50, multi: 8, unblockable: true, finalFreeze: true, noClash: true },
  acido:     { speed: 7,  dmg: 12, w: 34, h: 28, color: '#7dff4a', effect: 'stun', stun: 26, style: 'acid' },
  rayo:      { speed: 17, dmg: 9,  w: 60, h: 22, color: '#bff4ff', effect: 'knock', style: 'bolt', pose: 'cast' },
  fuego:     { speed: 10, dmg: 10, w: 42, h: 36, color: '#ff8a1e', effect: 'knock', style: 'fire' },
  fuegoBajo: { speed: 9,  dmg: 8,  w: 40, h: 28, color: '#ff6a1e', effect: 'stun', stun: 18, style: 'fire', y: -34, pose: 'clp' },
  dragon:    { speed: 11, dmg: 9,  w: 58, h: 34, color: '#ff9a2a', effect: 'knock', style: 'dragon', y: -150 },
  nube:      { speed: 4.5, dmg: 6, w: 64, h: 54, color: '#b8c0b0', effect: 'daze', style: 'cloud', range: 440, pose: 'cast' },
  orbe:      { speed: 7,  dmg: 8,  w: 36, h: 36, color: '#c060ff', effect: 'stun', stun: 30, style: 'orb', pose: 'cast' },
  onda:      { speed: 9,  dmg: 10, w: 52, h: 30, color: '#d8b070', effect: 'knock', style: 'quake', y: -15, level: 'low',
               pose: 'quake', wind: 'castUp', startup: 16 },
  misil:     { speed: 2,  accel: 0.45, max: 14, dmg: 12, w: 50, h: 20, color: '#ff5030', effect: 'knock', style: 'missile', pose: 'cast' },
  red:       { speed: 8,  dmg: 2,  w: 54, h: 54, color: '#d0d0d0', effect: 'net', style: 'net', pose: 'cast' },
  bomba:     { speed: 6,  vy: -11, g: 0.5, dmg: 11, w: 22, h: 22, color: '#ff3020', effect: 'knock', style: 'bomb', explode: true, y: -150, pose: 'throwToss' },
  abanico:   { speed: 12, dmg: 7,  w: 42, h: 30, color: '#ff7ab8', effect: 'stun', stun: 20, style: 'fan', pose: 'hp' },
  viento:    { speed: 9,  dmg: 3,  w: 60, h: 120, color: '#e8f4ff', effect: 'lift', style: 'wind', range: 380, pose: 'cast', y: -95 },
  calavera:  { speed: 8,  dmg: 5,  w: 30, h: 30, color: '#7dff6a', effect: 'stun', stun: 14, style: 'skull', count: 3, gap: 9,
               offsets: [-125, -95, -155], pose: 'cast', recovery: 34 },
};

// Fatalities: mode define la animación final.
const FATAL_FX = {
  fire:   { name: 'ALIENTO INFERNAL',  color: '#ff7a1a', tint: '#ff5a00', mode: 'burn' },
  ice:    { name: 'CONGELACIÓN TOTAL', color: '#a8e6ff', tint: '#bfefff', mode: 'shatter' },
  acid:   { name: 'BAÑO DE ÁCIDO',     color: '#7dff4a', tint: '#5fd030', mode: 'melt' },
  smoke:  { name: 'ASFIXIA',           color: '#c8ccd0', tint: '#8a9098', mode: 'burn' },
  void:   { name: 'VACÍO ETERNO',      color: '#c060ff', tint: '#40105a', mode: 'implode' },
  fire2:  { name: 'EXPLOSIÓN CARMESÍ', color: '#ff3a1a', tint: '#ff2000', mode: 'explode', skeleton: true },
  dragon: { name: 'FURIA DEL DRAGÓN',  color: '#ffa020', tint: '#ff7a00', mode: 'burn' },
  crush:  { name: 'APLASTAMIENTO',     color: '#d8b070', tint: '#8a6a40', mode: 'explode' },
  bolt:   { name: 'ELECTROCUCIÓN',     color: '#c8f6ff', tint: '#ffffff', mode: 'explode', skeleton: true },
  cyber:  { name: 'DEMOLICIÓN',        color: '#ff5030', tint: '#ff8060', mode: 'explode', metal: true },
  decap:  { name: 'DECAPITACIÓN',      color: '#ff7ab8', tint: null,      mode: 'decap' },
  soul:   { name: 'ROBO DEL ALMA',     color: '#7dff9a', tint: '#c0ffd0', mode: 'soul' },
};

// Posturas de guardia según el estilo de pelea
const STANCES = {
  ninja:  { idle: { h: 86, lean: 8,  ff: [20, 86], bf: [-26, 86], fh: [30, -30], bh: [22, -14] }, bob: 1.5, speed: 0.07 },
  boxer:  { idle: { h: 82, lean: 12, ff: [24, 82], bf: [-24, 82], fh: [34, -36], bh: [24, -30] }, bob: 3.2, speed: 0.15 },
  monk:   { idle: { h: 78, lean: 4,  ff: [34, 78], bf: [-34, 78], fh: [46, -20], bh: [-8, 10] },  bob: 1.2, speed: 0.05 },
  mystic: { idle: { h: 88, lean: 2,  ff: [14, 88], bf: [-20, 88], fh: [38, -6],  bh: [-14, 30] }, bob: 1,   speed: 0.04 },
};

// Poses: h = altura de cadera; lean = inclinación del torso (grados); rot = rotación del cuerpo.
// ff/bf = pie delantero/trasero relativo a la cadera; fh/bh = mano delantera/trasera relativa al hombro.
const POSES = {
  idle:       { h: 86, lean: 8,   ff: [20, 86],  bf: [-26, 86], fh: [30, -30], bh: [22, -14] },
  crouch:     { h: 52, lean: 24,  ff: [34, 52],  bf: [-28, 52], fh: [30, -24], bh: [22, -10] },
  block:      { h: 86, lean: -4,  ff: [18, 86],  bf: [-26, 86], fh: [20, -44], bh: [26, -30] },
  cblock:     { h: 52, lean: 10,  ff: [34, 52],  bf: [-28, 52], fh: [22, -40], bh: [26, -26] },
  prejump:    { h: 66, lean: 16,  ff: [26, 66],  bf: [-24, 66], fh: [26, -16], bh: [18, -4] },
  jump:       { h: 86, lean: 10,  ff: [26, 46],  bf: [-10, 56], fh: [30, -30], bh: [22, -14] },
  hpWind:     { h: 86, lean: 2,   ff: [22, 86],  bf: [-30, 86], fh: [10, -24], bh: [28, -14] },
  hp:         { h: 86, lean: 16,  ff: [26, 86],  bf: [-34, 86], fh: [66, -14], bh: [10, 0] },
  lp:         { h: 86, lean: 12,  ff: [26, 86],  bf: [-30, 86], fh: [64, 14],  bh: [16, -12] },
  hkChamber:  { h: 88, lean: -8,  ff: [40, 28],  bf: [-12, 88], fh: [22, -30], bh: [-14, 4] },
  hk:         { h: 90, lean: -24, ff: [92, -52], bf: [-8, 90],  fh: [10, -24], bh: [-26, 10] },
  lkChamber:  { h: 88, lean: -4,  ff: [34, 50],  bf: [-12, 88], fh: [24, -28], bh: [-10, 6] },
  lk:         { h: 88, lean: -12, ff: [86, 24],  bf: [-10, 88], fh: [24, -28], bh: [-10, 10] },
  rhWind:     { h: 88, lean: 6,   ff: [-30, 70], bf: [-6, 88],  fh: [-24, -10], bh: [30, -24] },
  rh:         { h: 90, lean: -34, ff: [90, -60], bf: [-4, 90],  fh: [-20, -10], bh: [-30, 20] },
  clp:        { h: 52, lean: 26,  ff: [34, 52],  bf: [-28, 52], fh: [62, 4],   bh: [18, -10] },
  clk:        { h: 44, lean: 18,  ff: [92, 44],  bf: [-24, 44], fh: [28, -20], bh: [16, -8] },
  sweepWind:  { h: 44, lean: 30,  ff: [30, 44],  bf: [-30, 44], fh: [20, 20],  bh: [0, 30] },
  sweep:      { h: 36, lean: 40,  ff: [100, 36], bf: [-30, 36], fh: [20, 30],  bh: [-10, 30] },
  upperWind:  { h: 56, lean: 20,  ff: [34, 56],  bf: [-28, 56], fh: [14, 30],  bh: [22, -10] },
  upper:      { h: 92, lean: 4,   ff: [16, 92],  bf: [-30, 92], fh: [16, -70], bh: [-10, 8] },
  jp:         { h: 86, lean: 20,  ff: [24, 50],  bf: [-12, 60], fh: [60, 30],  bh: [10, -10] },
  jk:         { h: 86, lean: -14, ff: [80, 40],  bf: [-14, 52], fh: [14, -30], bh: [-20, 0] },
  special:    { h: 86, lean: 14,  ff: [28, 86],  bf: [-34, 86], fh: [66, -6],  bh: [56, 4] },
  cast:       { h: 86, lean: 6,   ff: [22, 86],  bf: [-28, 86], fh: [60, -30], bh: [54, -20] },
  castUp:     { h: 90, lean: -6,  ff: [18, 90],  bf: [-22, 90], fh: [22, -72], bh: [-6, -72] },
  quake:      { h: 58, lean: 44,  ff: [34, 58],  bf: [-30, 58], fh: [46, 66],  bh: [38, 64] },
  throw:      { h: 84, lean: 18,  ff: [26, 84],  bf: [-34, 84], fh: [52, -2],  bh: [44, 6] },
  throwToss:  { h: 86, lean: -26, ff: [22, 86],  bf: [-30, 86], fh: [-24, -66], bh: [-32, -56] },
  slide:      { h: 26, lean: -62, ff: [96, 24],  bf: [44, 26],  fh: [-34, 14], bh: [-24, 30] },
  shadowkick: { h: 84, lean: -34, ff: [98, -12], bf: [-22, 84], fh: [-12, -22], bh: [-32, 2] },
  flykick:    { h: 86, lean: -30, ff: [98, 10],  bf: [8, 50],   fh: [0, -30],  bh: [-30, -10] },
  charge:     { h: 78, lean: 42,  ff: [44, 78],  bf: [-52, 78], fh: [24, 24],  bh: [30, 12] },
  torpedo:    { h: 86, lean: 0, rot: 80, ff: [-4, 90], bf: [4, 90], fh: [4, -64], bh: [10, -62] },
  flypunch:   { h: 86, lean: 32,  ff: [12, 70],  bf: [-30, 60], fh: [64, 12],  bh: [-20, 22] },
  spin:       { h: 86, lean: 0,   ff: [24, 86],  bf: [-24, 86], fh: [60, -12], bh: [-58, -12] },
  hit:        { h: 84, lean: -22, ff: [20, 84],  bf: [-26, 84], fh: [10, -10], bh: [-10, 10] },
  hitLow:     { h: 78, lean: 34,  ff: [22, 78],  bf: [-26, 78], fh: [16, 40],  bh: [6, 44] },
  launched:   { h: 86, lean: -30, rot: -35, ff: [40, 70], bf: [20, 84], fh: [-30, -30], bh: [-40, -10] },
  down:       { h: 86, lean: 0,   rot: -90, ff: [-12, 86], bf: [-8, 80], fh: [-20, -50], bh: [-10, -58] },
  dizzy:      { h: 84, lean: -6,  ff: [16, 84],  bf: [-22, 84], fh: [16, 50],  bh: [-4, 52] },
  taunt:      { h: 86, lean: 4,   ff: [20, 86],  bf: [-26, 86], fh: [54, -12], bh: [20, -12] },
  bow:        { h: 86, lean: 34,  ff: [14, 86],  bf: [-20, 86], fh: [26, 26],  bh: [24, 30] },
  flex:       { h: 84, lean: 0,   ff: [28, 84],  bf: [-30, 84], fh: [30, -44], bh: [-30, -44] },
  win:        { h: 86, lean: 2,   ff: [20, 86],  bf: [-26, 86], fh: [10, -82], bh: [24, -14] },
  winCross:   { h: 86, lean: -4,  ff: [20, 86],  bf: [-26, 86], fh: [16, 24],  bh: [30, 20] },
  winPoint:   { h: 86, lean: 6,   ff: [22, 86],  bf: [-26, 86], fh: [62, 34],  bh: [-12, 30] },
};

const AI_LEVELS = [
  { name: 'FÁCIL',   reaction: 20, block: 0.15, antiAir: 0.15, aggro: 0.45, think: 30, proj: 0.25 },
  { name: 'NORMAL',  reaction: 12, block: 0.40, antiAir: 0.45, aggro: 0.65, think: 18, proj: 0.35 },
  { name: 'DIFÍCIL', reaction: 6,  block: 0.70, antiAir: 0.75, aggro: 0.80, think: 10, proj: 0.4 },
];

const DIR_NAMES = { B: 'ATRÁS', F: 'ADELANTE', D: 'ABAJO' };
const BTN_NAMES = { hp: 'GA', lp: 'GB', hk: 'PA', lk: 'PB' };
const ULTRA_HP = 40; // la ULTRA se habilita con esta vida o menos, una vez por ronda
function inputLabel(m) {
  return m.input.map(d => DIR_NAMES[d]).join(', ') + ' + ' + BTN_NAMES[m.btn] + (m.kind === 'ultra' ? `  (ULTRA: vida ${ULTRA_HP}% o menos)` : '');
}
