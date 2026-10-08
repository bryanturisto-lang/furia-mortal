// ===== Juego: bucle principal, estados, combate, HUD y pantallas =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let RES = 1;

function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
  RES = clamp(s * (devicePixelRatio || 1), 1, 2);
  canvas.width = Math.round(W * RES);
  canvas.height = Math.round(H * RES);
}

const EMPTY_IN = { up: false, down: false, left: false, right: false, hp: false, lp: false, hk: false, lk: false, bl: false, pressed: {} };
const MENU = ['1 JUGADOR  (TORNEO VS CPU)', '2 JUGADORES', 'DIFICULTAD', 'COMBOS', 'CONTROLES'];
// Tiempo máximo (en frames, 60 = 1 segundo) entre cada paso de un especial: ATRÁS ... ADELANTE ... GOLPE
const COMBO_MODES = [{ name: 'LENTOS', gap: 55 }, { name: 'RÁPIDOS', gap: 18 }];
const store = {
  get(k, d) { try { const v = localStorage.getItem('furia.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('furia.' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
};
// Erupciones bajo el rival: ácido (ALMA) o lava (KAIZEN)
const ERUPTS = {
  acido: { dmg: 11, w: 70, h: 220, color: '#7dff6a', effect: 'launch', style: 'erupt', erupt: true },
  lava:  { dmg: 12, w: 76, h: 230, color: '#ff7a1a', effect: 'launch', style: 'lava', erupt: true, life: 26 },
};
const LADDER_SIZE = 7;
const GRID_COLS = 4;
const HOOK_PULL = 16;     // frames que tarda la cadena de la Lanza Infernal en arrastrar al rival
const PROJ_SFX = { dragon: 'fuego', fuegoBajo: 'fuego', nube: 'acido', orbe: 'sombra', calavera: 'fuego' };

const Game = {
  state: 'title', st: 0, t: 0, paused: false,
  menuIdx: 0, difficulty: store.get('difficulty', 1), comboMode: store.get('comboMode', 0), mode: 1,
  get inputGap() { return COMBO_MODES[this.comboMode].gap; },
  camX: (STAGE_W - W) / 2, shake: 0, hitstop: 0, dark: 0,
  fx: new FX(), banners: [], projectiles: [],
  f: [], cpu: [false, false], ai: null,
  wins: [0, 0], round: 1, timer: 99, timerF: 0,
  winner: null, loser: null, fatal: null, fatalityDone: false, combo: null, ghost: null, fanFly: null, hooks: [],
  sel: [0, 1], locked: [false, false], lockT: 0, ladder: [], ladderIdx: 0,

  init() {
    resize();
    addEventListener('resize', resize);
    Stage.build();
    Input.init();
    this._pose = clonePose(POSES.idle);
    let last = performance.now(), acc = 0;
    const frame = now => {
      acc += Math.min(100, now - last);
      last = now;
      while (acc >= 1000 / 60) { this.update(); acc -= 1000 / 60; }
      this.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },

  setState(s) { this.state = s; this.st = 0; },

  banner(text, o = {}) {
    if (!o.keep) this.banners = this.banners.filter(b => b.y !== (o.y || H * 0.42));
    this.banners.push({ text, t: 0, life: o.life || 80, size: o.size || 84, y: o.y || H * 0.42,
      colors: o.colors || ['#fff6a8', '#ffc21e', '#d8320a'] });
  },

  // ---------------- UPDATE ----------------
  update() {
    Input.poll();
    this.t++;
    if (Input.sys.KeyM) Sound.toggleMute();
    const m = Input.menu;

    switch (this.state) {
      case 'title': this.updateTitle(m); break;
      case 'controls':
        if (m.confirm || m.back) { Sound.menu(); this.setState('title'); }
        break;
      case 'select': this.updateSelect(); break;
      case 'champion':
        this.st++;
        if (this.st > 60 && (m.confirm || m.back)) this.setState('title');
        break;
      default:
        if (Input.sys.Escape && this.state !== 'matchOver') { this.paused = !this.paused; Sound.menu(); }
        if (this.paused) {
          if (Input.sys.KeyQ || (Touch.active && Input.sys.Enter)) { this.paused = false; this.setState('title'); }
          break;
        }
        this.updateMatch(m);
    }
    for (const b of this.banners) b.t++;
    this.banners = this.banners.filter(b => b.t < b.life);
  },

  updateTitle(m) {
    this.st++;
    if (m.up) { this.menuIdx = (this.menuIdx + MENU.length - 1) % MENU.length; Sound.menu(); }
    if (m.down) { this.menuIdx = (this.menuIdx + 1) % MENU.length; Sound.menu(); }
    const cycleDiff = d => { this.difficulty = (this.difficulty + d + 3) % 3; store.set('difficulty', this.difficulty); };
    const cycleCombo = () => { this.comboMode = (this.comboMode + 1) % COMBO_MODES.length; store.set('comboMode', this.comboMode); };
    if (m.left || m.right) {
      if (this.menuIdx === 2) { cycleDiff(m.right ? 1 : -1); Sound.menu(); }
      if (this.menuIdx === 3) { cycleCombo(); Sound.menu(); }
    }
    if (m.confirm) {
      Sound.init();
      Sound.confirm();
      Sound.startMusic();
      if (this.menuIdx === 0) { this.mode = 1; this.toSelect(); }
      else if (this.menuIdx === 1) { this.mode = 2; this.toSelect(); }
      else if (this.menuIdx === 2) cycleDiff(1);
      else if (this.menuIdx === 3) cycleCombo();
      else this.setState('controls');
    }
  },

  toSelect() {
    this.setState('select');
    this.locked = [false, false];
    this.lockT = 0;
    if (this.mode === 2 && this.sel[1] === this.sel[0]) this.sel[1] = (this.sel[0] + 1) % CHARACTERS.length;
  },

  updateSelect() {
    this.st++;
    const P = Input.players, N = CHARACTERS.length, rows = Math.ceil(N / GRID_COLS);
    const players = this.mode === 2 ? [0, 1] : [0];
    for (const i of players) {
      if (this.locked[i]) continue;
      const src = this.mode === 1 ? Input.menu : P[i].pressed;
      const c = this.sel[i];
      let col = c % GRID_COLS, row = Math.floor(c / GRID_COLS);
      if (src.left) col = (col + GRID_COLS - 1) % GRID_COLS;
      if (src.right) col = (col + 1) % GRID_COLS;
      if (src.up) row = (row + rows - 1) % rows;
      if (src.down) row = (row + 1) % rows;
      const n = Math.min(N - 1, row * GRID_COLS + col);
      if (n !== c) { this.sel[i] = n; Sound.menu(); }
      const confirm = this.mode === 1 ? Input.menu.confirm
        : P[i].pressed.hp || ((Input.sys.Enter || Input.sys.NumpadEnter) && (i === 0 ? true : this.locked[0]));
      if (confirm) {
        this.locked[i] = true;
        Sound.confirm();
        Sound.say(CHARACTERS[this.sel[i]].name, 0.4, 0.9);
        if (i === 0 && this.mode === 2) Input.sys.Enter = Input.sys.NumpadEnter = false;
      }
    }
    if (Input.menu.back) {
      Sound.menu();
      if (this.locked[1]) this.locked[1] = false;
      else if (this.locked[0]) this.locked[0] = false;
      else { this.setState('title'); return; }
      this.lockT = 0;
    }
    if (players.every(i => this.locked[i]) && ++this.lockT > 50) {
      if (this.mode === 1) {
        this.ladder = shuffle(CHARACTERS.filter((_, i) => i !== this.sel[0])).slice(0, LADDER_SIZE);
        this.ladderIdx = 0;
      }
      this.startMatch();
    }
  },

  startMatch() {
    const c1 = CHARACTERS[this.sel[0]];
    let c2 = this.mode === 1 ? this.ladder[this.ladderIdx] : CHARACTERS[this.sel[1]];
    if (c2 === c1) c2 = Object.assign({}, c1, { color: c1.dark, dark: '#1c1c22', _pal: null }); // espejo: paleta alterna
    this.f = [new Fighter(c1, 0), new Fighter(c2, 1)];
    this.cpu = [false, this.mode === 1];
    const lvl = this.mode === 1 ? clamp(this.difficulty + (this.ladderIdx >= 4 ? 1 : 0), 0, 2) : this.difficulty;
    this.ai = new AI(lvl);
    this.wins = [0, 0];
    this.round = 1;
    this.fatalityDone = false;
    this.startRound();
  },

  startRound() {
    this.f[0].reset(STAGE_W / 2 - 170, 1);
    this.f[1].reset(STAGE_W / 2 + 170, -1);
    for (const f of this.f) f.state = 'intro';
    this.projectiles = [];
    this.hooks = [];
    this.fx.clear();
    this.banners = [];
    this.timer = 99;
    this.timerF = 0;
    this.dark = 0;
    this.shake = 0;
    this.hitstop = 0;
    this.combo = null;
    this.ghost = null;
    this.fanFly = null;
    this.winner = this.loser = null;
    this.updateCamera();
    this.setState('intro');
  },

  inputFor(i) {
    return this.cpu[i] ? this.ai.think(this.f[i], this.f[1 - i], this) : Input.players[i];
  },

  updateMatch(m) {
    const s = this.state;
    this.st++;
    if (s === 'intro') {
      if (this.st === 1) {
        this.banner(`RONDA ${this.round}`, { life: 80 });
        Sound.say(`Ronda ${this.round}`);
      }
      if (this.st === 85) {
        this.banner('¡PELEA!', { life: 50, size: 110 });
        Sound.say('¡Pelea!', 0.3, 1);
        for (const f of this.f) f.state = 'idle';
      }
      if (this.st >= 110) this.setState('fight');
    }
    if (s === 'fatality') this.updateFatality();

    this.step(s === 'fight' || s === 'finish');

    if (s === 'fight' && this.state === 'fight') {
      if (++this.timerF >= 60) {
        this.timerF = 0;
        if (--this.timer <= 0) this.timeUp();
      }
    }
    if (s === 'finish' && this.state === 'finish') {
      const L = this.loser;
      if (L.state !== 'dizzy' && L.state !== 'held' && !L.dizzyOnLand) this.finishRound();
      else if (this.st > 60 * 7 && L.state === 'dizzy') {
        L.state = 'launched'; L.vy = -5; L.vx = -L.facing * 2;
        this.finishRound();
      }
    }
    if (s === 'roundOver') {
      const w = this.winner;
      if (this.st >= 70 && w && w.state !== 'win' && CONTROL_STATES.has(w.state)) w.state = 'win';
      if (this.st === 75) {
        if (w) {
          this.banner(`${w.ch.name} GANA`, { life: 140 });
          if (w.hp >= 100) this.banner('VICTORIA IMPECABLE', { y: H * 0.56, size: 44, life: 140, keep: true });
          Sound.say(`${w.ch.name} gana`);
        } else {
          this.banner('EMPATE', { life: 120 });
          Sound.say('Empate');
        }
      }
      if (this.st === 220) {
        if (this.wins[0] >= 2 || this.wins[1] >= 2) this.endMatch();
        else { this.round++; this.startRound(); }
      }
    }
    if (s === 'matchOver' && this.st > 60) {
      if (m.confirm) {
        Sound.confirm();
        if (this.mode === 1) {
          if (this.winner === this.f[0]) {
            this.ladderIdx++;
            if (this.ladderIdx >= this.ladder.length) {
              this.setState('champion');
              Sound.say('¡Eres el campeón!');
            } else this.startMatch();
          } else this.startMatch();
        } else this.toSelect();
      } else if (m.back) this.toSelect();
    }
  },

  // Efecto al activar una ULTRA: pantalla oscura, letrero y sonido
  ultraStart(f) {
    this.dark = 0.7;
    this.hitstop = 10;
    const aura = f.ch.look.aura || ['#2f6fd8', '#bfefff'], fuego = f.ch.id === 'kaizen';
    this.banner(`¡${f.spName.toUpperCase()}!`, { life: 70, size: 54, y: H * 0.3, keep: true,
      colors: fuego ? ['#ffffff', '#ffcc40', '#ff5a10'] : ['#ffffff', aura[0], '#2f6fd8'] });
    Sound.special(fuego ? 'fuego' : 'freeze');
    Sound.special('viento');
    Sound.say(f.spName, 0.4, 0.9);
  },

  step(ctrl) {
    this.fx.update();
    if (this.state !== 'fatality' && this.dark > 0) this.dark = this.dark > 0.02 ? this.dark * 0.96 : 0;
    if (this.shake > 0) this.shake = this.shake > 0.5 ? this.shake * 0.86 : 0;
    if (this.combo && --this.combo.t <= 0) this.combo = null;
    if (this.hitstop > 0) { this.hitstop--; return; }
    const [a, b] = this.f;
    let ia = EMPTY_IN, ib = EMPTY_IN;
    if (ctrl) {
      ia = this.inputFor(0);
      ib = this.inputFor(1);
      if (this.state === 'finish') { if (this.loser === a) ia = EMPTY_IN; else ib = EMPTY_IN; }
    }
    a.update(ia, b, this);
    b.update(ib, a, this);
    this.checkHit(a, b);
    this.checkHit(b, a);
    this.updateProjectiles();
    this.updateHooks();
    this.separate();
    this.updateCamera();
    for (const f of this.f) f.dispHp = f.dispHp > f.hp ? Math.max(f.hp, f.dispHp - 0.35) : f.hp;
  },

  checkHit(att, def) {
    if (att.state !== 'attack' || !att.active || att.hasHit) return;
    const hb = att.hitbox(), hu = def.hurtbox();
    if (!overlap(hb, hu)) return;
    att.hasHit = true;
    const m = att.move;
    const res = def.takeHit(m, att.facing, this);
    if (res === 'none') return;
    const ix = (Math.max(hb.x, hu.x) + Math.min(hb.x + hb.w, hu.x + hu.w)) / 2;
    const iy = (Math.max(hb.y, hu.y) + Math.min(hb.y + hb.h, hu.y + hu.h)) / 2;
    this.impact(res, ix, iy, att.facing, m, def);
    if (res === 'hit' && m.effect) this.applyEffect(att, def, m.effect);
    if (def.x <= this.camX + 45 || def.x >= this.camX + W - 45) att.vx = -att.facing * 4;
  },

  impact(res, x, y, dir, m, def) {
    if (res === 'block') {
      this.fx.sparks(x, y, -dir);
      Sound.block();
      this.hitstop = 3;
      return;
    }
    this.fx.blood(x, y, dir, m.heavy ? 22 : 12);
    Sound.hit(m.heavy);
    this.hitstop = m.heavy ? 7 : 4;
    this.shake = Math.max(this.shake, m.heavy ? 9 : 4);
    if (def.comboCount >= 2) this.combo = { n: def.comboCount, side: def === this.f[0] ? 1 : 0, t: 90 };
  },

  applyEffect(att, def, eff) {
    if (!eff || def.hp <= 0 || def.state !== 'hit') return;
    switch (eff) {
      case 'freeze': def.frozen = 100; Sound.special('freeze'); break;
      case 'pull':
        // el gancho queda clavado y la cadena arrastra al rival hasta KAIZEN (ver updateHooks)
        def.stun = 60 + HOOK_PULL; def.pulled = 1; def.vx = 0;
        this.hooks.push({ owner: att, def, t: 0, dur: HOOK_PULL, x0: def.x, x1: att.x + att.facing * 85 });
        this.shake = Math.max(this.shake, 6);
        Sound.say('¡Ven aquí!', 0.5, 1.1);
        break;
      case 'daze': def.stun = Math.max(def.stun, 55); def.pulled = 1; break;
      case 'net': def.stun = 85; def.netted = 85; def.pulled = 1; def.vx = 0; break;
      case 'lift': def.state = 'lifted'; def.stun = 50; def.floating = true; def.vx = 0; break;
    }
  },

  // Llamado cuando un luchador recibe daño. true = el juego tomó el control (¡ACÁBALO!).
  onDamage(def, dir) {
    if (def.hp > 0 || this.state !== 'fight') return false;
    const wi = def === this.f[0] ? 1 : 0;
    const win = this.f[wi];
    this.winner = win;
    this.loser = def;
    if (this.wins[wi] + 1 >= 2) {
      this.setState('finish');
      this.projectiles.forEach(p => { p.dead = true; });
      this.banner('¡ACÁBALO!', { life: 120, size: 96, colors: ['#ffb0a0', '#ff3a1a', '#7a0000'] });
      Sound.say('¡Acábalo!', 0.2, 0.8);
      this.hitstop = 12;
      if (def.grounded) {
        def.state = 'dizzy';
        def.vx = dir * 4;
        return true;
      }
      def.dizzyOnLand = true;
      return false;
    }
    this.wins[wi]++;
    this.setState('roundOver');
    this.hitstop = 20;
    Sound.ko();
    return false;
  },

  finishRound() {
    this.wins[this.winner === this.f[0] ? 0 : 1]++;
    this.setState('roundOver');
    Sound.ko();
  },

  timeUp() {
    const [a, b] = this.f;
    this.banner('¡TIEMPO!', { life: 70 });
    if (a.hp === b.hp) {
      this.winner = this.loser = null;
    } else {
      const wi = a.hp > b.hp ? 0 : 1;
      this.winner = this.f[wi];
      this.loser = this.f[1 - wi];
      this.wins[wi]++;
    }
    this.setState('roundOver');
  },

  endMatch() {
    this.setState('matchOver');
    const w = this.winner;
    if (!w) return;
    const youWin = this.mode === 2 || w === this.f[0];
    if (this.mode === 1) {
      this.banner(youWin ? '¡VICTORIA!' : 'FIN DEL JUEGO', { life: 99999, size: 88,
        colors: youWin ? undefined : ['#ffb0a0', '#ff3a1a', '#7a0000'] });
    } else {
      this.banner(`¡${w.ch.name} GANA EL COMBATE!`, { life: 99999, size: 60 });
    }
  },

  onLand(f) {
    Sound.land();
    this.shake = Math.max(this.shake, 6);
    this.fx.burst(f.x - f.facing * 30, GROUND_Y - 4, '#6a4a3a', 10, 3);
  },

  // ---------------- FATALITY ----------------
  startFatality(w, l) {
    this.setState('fatality');
    this.winner = w;
    this.loser = l;
    this.fatal = FATAL_FX[w.ch.fatal.fx];
    w.state = 'fatal';
    w.vx = 0;
    w.trailOn = false;
    l.vx = 0;
    l.state = 'dizzy';
    this.projectiles = [];
    this.hooks = [];
    this.banners = [];
    this.ghost = null;
    this.fanFly = null;
    this.fatalChain = null;
    this.fatalPull = null;
    Sound.special(w.ch.specials[0].proj || 'sombra');
  },

  updateFatality() {
    const st = this.st, w = this.winner, l = this.loser, F = this.fatal, mode = F.mode;
    this.dark = Math.min(mode === 'cadenas' ? 0.45 : 0.75, st / 40);   // con fuego, menos oscuro para verlo
    if (st > 12 && st < 80) {
      const p = (st - 12) / 68;
      if (mode === 'shatter') l.frozen = 999;
      else if (mode === 'soul') { l.tint = st % 10 < 5 ? F.tint : null; this.ghost = { p: clamp((st - 20) / 60, 0, 1) }; }
      else if (F.tint) l.tint = st % 8 < 4 ? F.tint : null;
      if (mode === 'melt') l.melt = p * 0.9;
      if (mode === 'implode') l.fxScale = Math.max(0.1, 1 - p) * (1 + Math.sin(st * 0.8) * 0.06);
      if (mode === 'shatter') {
        // el hielo lo va cubriendo: vaho frío y destellos
        this.fx.frost(l.x + rand(-30, 30), l.y - rand(10, 180), 18, -0.4);
        if (st % 3 === 0) this.fx.glint(l.x + rand(-35, 35), l.y - rand(10, 190), 9);
        if (st % 10 === 0) Sound.special('freeze');
      } else if (mode !== 'decap' && mode !== 'cadenas') {
        for (let i = 0; i < (mode === 'burn' ? 5 : 3); i++) {
          this.fx.add({ x: l.x + rand(-28, 28), y: l.y - rand(10, 175) * (1 - l.melt), vx: rand(-1, 1),
            vy: mode === 'burn' ? rand(-4, -1.5) : rand(-3, -0.5), g: mode === 'melt' ? 0.2 : -0.02,
            life: rand(20, 40), size: rand(3, 8), color: F.color, kind: 'glow' });
        }
        if (st % 10 === 0) Sound.special(mode === 'shatter' ? 'freeze' : mode === 'burn' ? 'fuego' : 'rayo');
      }
    }
    if (mode === 'cadenas') this.updateCadenas(st, w, l);
    if (mode === 'decap' && st > 20 && st <= 80) this.fanFly = (st - 20) / 60;
    if (st === 80) this.fatalClimax();
    if (mode === 'decap' && st > 80 && st < 170 && l.state !== 'dead') {
      const [hx, hy] = l.headPos;
      for (let i = 0; i < 3; i++) {
        this.fx.add({ x: hx, y: hy + 10, vx: rand(-2, 2), vy: rand(-9, -4), g: 0.45, life: 60, size: rand(2, 5),
          color: chance(0.5) ? '#c0000f' : '#8a0008', kind: 'blood' });
      }
    }
    if (mode === 'decap' && st === 115) { l.state = 'launched'; l.vy = -2; l.vx = -l.facing * 1.5; }
    if (st === 125) {
      this.banner('EJECUCIÓN', { life: 99999, size: 110, y: H * 0.34, colors: ['#ff8a8a', '#e01010', '#5a0000'] });
      this.banner(F.name, { life: 99999, size: 30, y: H * 0.47, keep: true, colors: ['#ffffff', '#ffd0c0', '#ff9a8a'] });
      Sound.say('Ejecución', 0.1, 0.6);
    }
    if (st === 250) {
      w.state = 'win';
      this.banner(`${w.ch.name} GANA`, { life: 99999, size: 56, y: H * 0.6, keep: true });
      Sound.say(`${w.ch.name} gana`);
    }
    if (st === 340) {
      this.wins[w === this.f[0] ? 0 : 1]++;
      this.fatalityDone = true;
      this.setState('matchOver');
    }
  },

  // INFIERNO ENCADENADO (KAIZEN): la cadena se clava en el pecho del rival, lo arrastra,
  // el fuego lo envuelve desde los pies, se carboniza y se deshace en cenizas.
  updateCadenas(st, w, l) {
    const chest = () => [l.x - w.facing * 4, l.y - 125];
    if (st === 8) { this.fatalChain = { k: 0, out: true }; Sound.special('lanza'); }
    const c = this.fatalChain;
    if (c && c.out && st <= 16) c.k = (st - 8) / 8;
    if (st === 16) {
      const [cx, cy] = chest();
      this.fx.blood(cx, cy, -w.facing, 26);
      this.fx.sparks(cx, cy, -w.facing, '#ffd060');
      this.shake = Math.max(this.shake, 10);
      Sound.hit(true);
      Sound.say('¡Ven aquí!', 0.5, 1.1);
      this.fatalPull = { x0: l.x, x1: w.x + w.facing * 95 };
    }
    if (st > 16 && st <= 30 && this.fatalPull) {
      const k = (st - 16) / 14;
      l.x = lerp(this.fatalPull.x0, this.fatalPull.x1, k * k);
    }
    if (st >= 26 && st < 80) {
      // el fuego sube desde los pies y lo cubre entero
      // (pocas llamas y por los bordes del cuerpo, para que se vea cómo se quema la silueta)
      const p = (st - 26) / 54, top = 30 + p * 170;
      for (let i = 0; i < 2 + p * 2; i++) {
        const side = chance(0.5) ? -1 : 1;
        this.fx.flame(l.x + side * rand(10, 30), l.y - rand(0, top), 11 + p * 7, -2.4 - p * 1.6, 1.1);
      }
      if (st % 3 === 0) this.fx.flame(l.x + rand(-12, 12), l.y - top + rand(-10, 10), 14 + p * 8, -3, 1);
      if (st % 2 === 0) this.fx.smokePuff(l.x + rand(-30, 30), l.y - top - rand(10, 50), 22 + p * 14, 0.5 + p * 0.3);
      if (st % 8 === 0) Sound.special('fuego');
      // la piel y la ropa se ennegrecen
      const char = ['#ff7a30', '#c04a1a', '#7a2a12', '#3a2018', '#1c1210', '#120c0a'];
      l.tint = st < 40 && st % 6 < 3 ? '#ffd080' : char[Math.min(char.length - 1, Math.floor(p * char.length))];
      this.shake = Math.max(this.shake, 2);
    }
    if (st > 80 && c) { c.out = false; c.k = Math.max(0, 1 - (st - 80) / 12); if (c.k <= 0) this.fatalChain = null; }
  },

  fatalClimax() {
    const l = this.loser, w = this.winner, F = this.fatal, cx = l.x, cy = l.y - 100;
    l.tint = null;
    l.frozen = 0;
    this.shake = 22;
    const bones = () => this.fx.skeletons.push({ x: l.x, dir: l.facing });
    const gore = () => { this.fx.blood(cx, cy, 1, 45); this.fx.blood(cx, cy, -1, 45); };
    switch (F.mode) {
      case 'decap': {
        l.headless = true;
        this.fanFly = null;
        const dir = Math.sign(l.x - w.x) || 1;
        const [hx, hy] = l.headPos;
        this.fx.add({ kind: 'head', x: hx, y: hy, vx: dir * 4, vy: -12, g: 0.5, life: 600, size: 13,
          color: l.ch.color, skin: l.ch.skin, rot: 0, vr: dir * 0.25 });
        this.fx.blood(hx, hy, dir, 30);
        Sound.hit(true);
        break;
      }
      case 'soul':
        l.gone = true;
        bones();
        this.ghost = null;
        this.fx.burst(w.x, w.y - 120, F.color, 50, 8);
        Sound.special('sombra');
        break;
      case 'shatter':
        // el cuerpo congelado estalla en cientos de esquirlas de hielo con trozos rojos congelados
        l.gone = true;
        this.fx.shatter(cx, cy, 80, 12, 90);
        this.fx.shatter(cx, cy - 50, 30, 8, 40);
        for (let i = 0; i < 12; i++) {
          this.fx.add({ x: cx + rand(-30, 30), y: cy + rand(-60, 60), vx: rand(-7, 7), vy: rand(-12, -3), g: 0.5, life: 420,
            size: rand(5, 10), color: chance(0.5) ? '#7a1a24' : '#a8c8e0', kind: 'gib', rot: rand(0, 6), vr: rand(-0.3, 0.3) });
        }
        for (let i = 0; i < 16; i++) this.fx.frost(cx + rand(-60, 60), cy + rand(-80, 80), 34, -0.6);
        Sound.explode();
        Sound.special('freeze');
        break;
      case 'melt':
        l.gone = true;
        bones();
        this.fx.splat(l.x, '#3f8a1c', 26);
        Sound.special('acido');
        break;
      case 'cadenas': {
        // se deshace en cenizas: quedan los huesos carbonizados humeando
        l.gone = true;
        this.fx.skeletons.push({ x: l.x, dir: l.facing, burnt: true });
        this.fx.ash(l.x, l.y, 140);
        for (let i = 0; i < 14; i++) this.fx.smokePuff(l.x + rand(-40, 40), l.y - rand(20, 170), 30, 0.75);
        for (let i = 0; i < 20; i++) this.fx.flame(l.x + rand(-40, 40), l.y - rand(0, 160), 24, -3, 2);
        this.fx.burst(l.x, l.y - 100, '#ffb030', 40, 7);
        Sound.explode();
        Sound.special('fuego');
        break;
      }
      case 'burn':
        l.gone = true;
        bones();
        this.fx.smoke(cx, cy, '#2a2a2a');
        this.fx.burst(cx, cy, F.color, 50, 7);
        Sound.special('fuego');
        break;
      case 'implode':
        l.gone = true;
        this.fx.burst(cx, cy, F.color, 70, 11);
        gore();
        Sound.explode();
        break;
      default:
        l.gone = true;
        this.fx.gibs(cx, cy, F.metal
          ? ['#aab3be', '#6c7680', l.ch.color, '#3a3e46', '#ffb030']
          : [l.ch.color, l.ch.dark, '#24232c', '#8a0008', '#b0000c', F.color]);
        this.fx.burst(cx, cy, F.color, 60, 10);
        if (!F.metal) gore();
        if (F.skeleton) bones();
        Sound.explode();
    }
  },

  // ---------------- PROYECTILES ----------------
  spawnProjectile(owner, type) {
    const sp = PROJ[type], n = sp.count || 1;
    const opp = this.f[owner === this.f[0] ? 1 : 0];
    let x = owner.x + owner.facing * 58;
    if (sp.offset) x = owner.x + owner.facing * sp.offset;  // aparece a cierta distancia (pared)
    if (sp.atTarget) x = opp.x;                              // aparece sobre el rival (tormenta)
    for (let i = 0; i < n; i++) {
      const yOff = sp.offsets ? sp.offsets[i] : (sp.y || -120);
      const y = sp.offset || sp.atTarget ? GROUND_Y + yOff : owner.y + yOff;
      this.projectiles.push({ owner, type, spec: sp, x, x0: owner.x, y, hits: 0, lastHit: -99,
        dir: owner.facing, speed: sp.speed, vx: owner.facing * sp.speed, vy: sp.vy || 0, t: 0,
        delay: i * (sp.gap || 0), dead: false });
      owner.projCount++;
    }
    Sound.special(PROJ_SFX[type] || type);
  },

  spawnErupt(owner, x, type = 'acido') {
    this.projectiles.push({ owner, type: 'erupt', spec: ERUPTS[type], x, x0: x, y: GROUND_Y - 110, dir: owner.facing,
      speed: 0, vx: 0, vy: 0, t: 0, delay: 22, dead: false, noClash: true });
    owner.projCount++;
    Sound.special(type === 'lava' ? 'fuego' : 'acido');
  },

  projBox(p) { return { x: p.x - p.spec.w / 2, y: p.y - p.spec.h / 2, w: p.spec.w, h: p.spec.h }; },

  updateProjectiles() {
    const ps = this.projectiles;
    for (const p of ps) {
      if (p.dead) continue;
      const sp = p.spec;
      if (p.delay > 0) {
        if (--p.delay === 0) {
          if (sp.erupt) { Sound.special('fuego'); this.shake = Math.max(this.shake, sp.style === 'lava' ? 12 : 8); }
          else { p.x = p.owner.x + p.dir * 58; Sound.special('fuego'); }
        }
        continue;
      }
      p.t++;
      if (sp.life && p.t > sp.life) {
        // al terminar la tormenta, el rival queda congelado
        const opp = this.f[p.owner === this.f[0] ? 1 : 0];
        if (sp.finalFreeze && p.hits > 0 && opp.state === 'hit' && opp.hp > 0) { opp.frozen = 90; Sound.special('freeze'); }
        // al terminar la llamarada, el rival sale despedido envuelto en humo
        if (sp.finalLaunch && p.hits > 0 && opp.state === 'hit' && opp.hp > 0) {
          Object.assign(opp, { state: 'launched', vy: -11, vx: p.dir * 4, pulled: 0 });
          this.fx.burst(opp.x, opp.y - 100, '#ffb030', 30, 8);
          this.shake = Math.max(this.shake, 12);
          Sound.explode();
        }
        p.dead = true;
        continue;
      }
      if (sp.style === 'lava') {
        // columna de lava: llamas, humo y piedras que saltan
        for (let i = 0; i < 5; i++) this.fx.flame(p.x + rand(-26, 26), GROUND_Y - rand(0, 200) * Math.min(1, p.t / 5), 20, -4.5, 1.2);
        if (p.t % 2 === 0) this.fx.smokePuff(p.x + rand(-30, 30), GROUND_Y - rand(150, 240), 26, 0.6);
        if (p.t < 6) {
          this.fx.add({ x: p.x + rand(-20, 20), y: GROUND_Y - 10, vx: rand(-5, 5), vy: rand(-13, -7), g: 0.5, life: 60,
            size: rand(4, 8), color: chance(0.5) ? '#2a201c' : '#4a3a30', kind: 'gib', rot: rand(0, 6), vr: rand(-0.3, 0.3) });
        }
      } else if (sp.style === 'erupt') {
        if (p.t > 14) { p.dead = true; continue; }
        for (let i = 0; i < 4; i++) {
          this.fx.add({ x: p.x + rand(-30, 30), y: GROUND_Y - rand(0, 40), vx: rand(-0.5, 0.5), vy: rand(-12, -6), g: 0.1,
            life: rand(16, 30), size: rand(4, 9), color: chance(0.5) ? '#7dff6a' : '#e0ffb0', kind: 'glow' });
        }
      } else {
        if (sp.accel) { p.speed = Math.min(sp.max, p.speed + sp.accel); p.vx = p.dir * p.speed; }
        p.x += p.vx;
        if (sp.g) { p.vy += sp.g; p.y += p.vy; }
        this.projTrail(p);
      }
      if (sp.explode && p.y >= GROUND_Y - 10) { this.explode(p); continue; }
      if (p.x < this.camX - 80 || p.x > this.camX + W + 80 || (sp.range && Math.abs(p.x - p.x0) > sp.range)) {
        p.dead = true;
        continue;
      }
      const box = this.projBox(p);
      if (!p.noClash) {
        for (const q of ps) {
          if (q !== p && !q.dead && !q.noClash && q.delay <= 0 && q.owner !== p.owner && overlap(box, this.projBox(q))) {
            // la pared de hielo resiste: solo se destruye lo que choca contra ella
            if (!sp.wall) p.dead = true;
            if (!q.spec.wall) q.dead = true;
            if (sp.wall && q.spec.wall) p.dead = q.dead = true;
            this.fx.burst(p.x, p.y, sp.color, 20);
            this.fx.burst(q.x, q.y, q.spec.color, 20);
            Sound.block();
          }
        }
        if (p.dead) continue;
      }
      const opp = this.f[p.owner === this.f[0] ? 1 : 0];
      if (!overlap(box, opp.hurtbox())) continue;
      if (sp.explode) { this.explode(p); continue; }
      if (sp.multi) {
        // golpea varias veces mientras dure
        if (p.t - p.lastHit >= sp.multi) { p.lastHit = p.t; p.hits++; this.projHit(p, opp, opp.x, opp.y - 100); }
        continue;
      }
      if (sp.wall || sp.style === 'lava') {
        // golpea una sola vez pero sigue a la vista hasta apagarse
        if (!p.hits) { p.hits = 1; this.projHit(p, opp, opp.x, opp.y - 60); }
        continue;
      }
      p.dead = true;
      this.projHit(p, opp, p.x, p.y);
    }
    for (const p of ps) {
      if (p.dead && !p.counted) {
        p.counted = true; p.owner.projCount = Math.max(0, p.owner.projCount - 1);
        // si la cadena no enganchó a nadie, vuelve a la mano
        if (p.spec.style === 'lanza' && !p.hooked) this.hooks.push({ owner: p.owner, def: null, t: 0, dur: 10, x: p.x, y: p.y });
      }
    }
    this.projectiles = ps.filter(p => !p.dead);
  },

  projTrail(p) {
    const sp = p.spec;
    switch (sp.style) {
      case 'lanza':
        // brasas que deja el gancho al volar
        if (p.t % 2 === 0) {
          this.fx.add({ x: p.x - p.dir * rand(0, 20), y: p.y + rand(-8, 8), vx: -p.dir * rand(0.5, 2), vy: rand(-1.5, 0.3), g: -0.02,
            life: rand(12, 22), size: rand(1.5, 3), color: chance(0.5) ? '#ffcc40' : '#ff7a1a', kind: 'glow' });
        }
        break;
      case 'fireball':
        // llamas que se quedan atrás y humo
        for (let i = 0; i < 3; i++) this.fx.flame(p.x - p.dir * rand(4, 30), p.y + rand(-10, 10), 15, -1, 0.8);
        if (p.t % 3 === 0) this.fx.smokePuff(p.x - p.dir * 40, p.y - 6, 12, 0.35);
        break;
      case 'firestorm':
        // remolino de fuego sobre el rival
        for (let i = 0; i < 7; i++) {
          const a = p.t * 0.35 + i * 0.9, r = 30 + (i % 3) * 18;
          this.fx.flame(p.x + Math.cos(a) * r, GROUND_Y - rand(0, 250), 22, -3.5, 1.4);
        }
        if (p.t % 2 === 0) this.fx.smokePuff(p.x + rand(-60, 60), GROUND_Y - rand(200, 300), 32, 0.55);
        break;
      case 'bolt': case 'net': break;
      case 'missile':
        this.fx.add({ x: p.x - p.dir * 26, y: p.y + rand(-3, 3), vx: -p.dir * rand(0.5, 2), vy: rand(-0.6, 0.2), g: 0,
          life: rand(14, 26), size: rand(5, 10), color: '#666', kind: 'puff' });
        this.fx.trail(p.x - p.dir * 24, p.y, '#ffb030');
        break;
      case 'quake':
        if (p.t % 2) this.fx.add({ x: p.x + rand(-20, 20), y: GROUND_Y - 4, vx: rand(-1, 1), vy: rand(-6, -2), g: 0.4,
          life: 24, size: rand(4, 8), color: '#7a5a3a', kind: 'gib', rot: 0, vr: rand(-0.3, 0.3) });
        break;
      case 'wind':
        this.fx.add({ x: p.x + rand(-20, 20), y: p.y + rand(-50, 50), vx: p.vx * 0.3, vy: rand(-2, -0.5), g: 0,
          life: 14, size: rand(2, 4), color: '#ffffff', kind: 'glow' });
        break;
      case 'ice':
        // estela de vaho helado, destellos y alguna esquirla que cae
        this.fx.frost(p.x - p.dir * rand(20, 50), p.y + rand(-8, 8), 12, -0.2);
        if (p.t % 2 === 0) this.fx.glint(p.x - p.dir * rand(0, 60), p.y + rand(-14, 14), 6);
        if (p.t % 5 === 0) this.fx.add({ x: p.x - p.dir * 30, y: p.y, vx: -p.dir * rand(0.5, 2), vy: rand(-1, 1), g: 0.3, life: 40,
          size: rand(3, 6), kind: 'shard', rot: rand(0, 6), vr: rand(-0.3, 0.3) });
        break;
      case 'icewall':
        // vaho frío a ras de suelo y destellos sobre los cristales
        if (p.t < 8) for (let i = 0; i < 3; i++) this.fx.frost(p.x + rand(-50, 50), GROUND_Y - rand(0, 20), 22, -0.4);
        if (p.t % 3 === 0) this.fx.glint(p.x + rand(-30, 30), GROUND_Y - rand(20, 180), 8);
        if (p.t === (p.spec.life || 50) - 6) this.fx.shatter(p.x, GROUND_Y - 80, 26, 7, 50);   // se rompe al desaparecer
        break;
      case 'storm':
        // remolino de vaho y nieve alrededor del rival
        for (let i = 0; i < 3; i++) {
          const a = p.t * 0.3 + i * 2.1, r = rand(40, 90);
          this.fx.frost(p.x + Math.cos(a) * r, GROUND_Y - rand(10, 240), 26, -1.2);
          this.fx.add({ x: p.x + Math.cos(a) * r, y: GROUND_Y - rand(0, 250), vx: -Math.sin(a) * 4, vy: rand(-2, 0), g: 0,
            life: rand(14, 24), size: rand(1.2, 2.4), color: '#ffffff', kind: 'glow' });
        }
        if (p.t % 2 === 0) this.fx.glint(p.x + rand(-60, 60), GROUND_Y - rand(20, 240), 9);
        break;
      default:
        this.fx.trail(p.x - p.vx, p.y, sp.color);
    }
  },

  projHit(p, opp, x, y) {
    const sp = p.spec, dir = p.dir;
    const m = { dmg: sp.dmg, level: sp.level || 'mid', kb: sp.multi ? 0.5 : 5, stun: sp.stun || 18,
      knock: sp.effect === 'knock', launch: sp.effect === 'launch', heavy: true, unblockable: !!sp.unblockable };
    const res = opp.takeHit(m, dir, this);
    if (res === 'none') return;
    this.impact(res, x, y, dir, m, opp);
    if (sp.style === 'ice') this.fx.shatter(x, y, 16, 6, 24);   // el cristal estalla al chocar
    else this.fx.burst(x, y, sp.color, 22);
    if (res === 'hit') {
      const before = this.hooks.length;
      this.applyEffect(p.owner, opp, sp.effect);
      if (sp.style === 'lanza' && this.hooks.length > before) {
        p.hooked = true;
        this.fx.burst(x, y, '#ffd060', 26, 7);
      }
    }
  },

  // Cadenas de la Lanza Infernal después del lanzamiento: arrastrando al rival enganchado o volviendo a la mano
  hookHand(f) {
    return f.manos3d && window.R3D && R3D.has(f.ch) ? f.manos3d[0] : [f.x + f.facing * 50, f.y - 140];
  },

  updateHooks() {
    for (const h of this.hooks) {
      h.t++;
      if (h.def) {
        const d = h.def;
        if (d.state !== 'hit' || h.owner.state === 'hit' || h.owner.state === 'launched') { h.t = h.dur; continue; }
        const k = h.t / h.dur, e = k * k;   // arranca lento y llega de golpe
        d.x = lerp(h.x0, h.x1, e);
        if (h.t % 2 === 0) {
          this.fx.add({ x: d.x + rand(-10, 10), y: GROUND_Y - 2, vx: -h.owner.facing * rand(0.5, 2), vy: rand(-2, -0.5), g: 0.15,
            life: rand(14, 24), size: rand(3, 6), color: '#6a5040', kind: 'puff' });
        }
        if (h.t === h.dur) { this.fx.burst(d.x, d.y - 120, '#ffb030', 18); this.shake = Math.max(this.shake, 5); }
      }
    }
    this.hooks = this.hooks.filter(h => h.t < h.dur);
  },

  drawHooks(camX) {
    for (const h of this.hooks) {
      const o = h.owner, [hx, hy] = this.hookHand(o);
      let ex, ey;
      if (h.def) { ex = h.def.x + o.facing * 6; ey = h.def.y - 128; }
      else { const k = h.t / h.dur; ex = lerp(h.x, hx, k * k); ey = lerp(h.y, hy, k * k); }
      const pts = [];
      const tense = h.def ? 2 : 8 * (1 - h.t / h.dur);
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        pts.push(lerp(hx, ex, t) - camX, lerp(hy, ey, t) + Math.sin(t * Math.PI) * tense * Math.sin(this.t * 0.9 + t * 8));
      }
      this.drawLanza(pts);
    }
  },

  // Cadena de la Lanza Infernal: de metal en 3D (si está disponible) con un resplandor de calor y chispas
  drawLanza(pts, ang) {
    const n = pts.length;
    if (ang == null) ang = Math.atan2(pts[n - 1] - pts[n - 3], pts[n - 2] - pts[n - 4]);
    if (!(window.R3D && R3D.drawChain)) { drawHookChain(ctx, pts, this.t * 3, ang); return; }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [w, a] of [[14, 0.05], [6, 0.08]]) {
      ctx.strokeStyle = `rgba(255,90,20,${a})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < n; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.stroke();
    }
    ctx.restore();
    R3D.drawChain(ctx, pts, ang);
    // chispas que se desprenden del metal caliente
    if (this.t % 4 === 0) {
      const i = 2 * Math.floor(Math.random() * (n / 2));
      this.fx.add({ x: pts[i] + this.camX, y: pts[i + 1], vx: rand(-1, 1), vy: rand(-2, 0.5), g: 0.12,
        life: rand(10, 22), size: rand(1, 2.2), color: chance(0.5) ? '#ffd27a' : '#ff8a2a', kind: 'glow' });
    }
  },

  explode(p) {
    p.dead = true;
    const y = Math.min(p.y, GROUND_Y - 20);
    this.fx.burst(p.x, y, '#ffb030', 40, 9);
    this.fx.burst(p.x, y, '#ff3020', 24, 6);
    this.fx.smoke(p.x, y - 20, '#333');
    this.shake = Math.max(this.shake, 10);
    Sound.special('bomba');
    const opp = this.f[p.owner === this.f[0] ? 1 : 0];
    if (overlap({ x: p.x - 65, y: y - 90, w: 130, h: 120 }, opp.hurtbox())) this.projHit(p, opp, opp.x, y - 40);
  },

  separate() {
    const [a, b] = this.f;
    if (a.hidden || b.hidden || a.gone || b.gone) return;
    if (a.state === 'dead' || b.state === 'dead' || a.state === 'held' || b.state === 'held') return;
    const dx = b.x - a.x, min = 26 * (a.bulk + b.bulk);
    if (Math.abs(dx) < min && Math.abs(a.y - b.y) < 110) {
      const sign = dx !== 0 ? Math.sign(dx) : a.facing;
      const push = (min - Math.abs(dx)) / 2 * sign;
      a.x -= push;
      b.x += push;
    }
  },

  updateCamera() {
    const [a, b] = this.f;
    for (const f of this.f) f.x = clamp(f.x, 40, STAGE_W - 40);
    this.camX = clamp((a.x + b.x) / 2 - W / 2, 0, STAGE_W - W);
    for (const f of this.f) f.x = clamp(f.x, this.camX + 36, this.camX + W - 36);
  },

  // ---------------- RENDER ----------------
  render() {
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    ctx.imageSmoothingEnabled = true;
    switch (this.state) {
      case 'title': this.renderTitle(); break;
      case 'controls': this.renderControls(); break;
      case 'select': this.renderSelect(); break;
      case 'champion': this.renderChampion(); break;
      default: this.renderMatch();
    }
  },

  renderMatch() {
    const camX = this.camX;
    ctx.save();
    if (this.shake > 0.5) ctx.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake * 0.6);
    Stage.draw(ctx, camX, this.t);
    if (this.dark > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.dark})`;
      ctx.fillRect(-30, -30, W + 60, H + 60);
    }
    this.drawEruptWarnings(camX);
    this.fx.drawFloor(ctx, camX);
    for (const f of this.f) f.drawShadow(ctx, camX);
    const order = this.f[0].state === 'attack' || this.f[0].state === 'grab' ? [this.f[1], this.f[0]] : [this.f[0], this.f[1]];
    for (const f of order) f.draw(ctx, camX);
    this.drawProjectiles(camX);
    this.drawHooks(camX);
    if (this.state === 'fatality') this.drawFatalityFx(camX);
    this.fx.draw(ctx, camX);
    this.drawSpecialNames(camX);
    ctx.restore();

    this.drawHUD();
    this.drawBanners();
    if (this.state === 'matchOver' && this.st > 60 && Math.floor(this.t / 30) % 2 === 0) {
      const E = keyName('ENTER'), X = keyName('ESC');
      let msg = `${E}: ELEGIR LUCHADOR`;
      if (this.mode === 1) msg = this.winner === this.f[0] ? `${E}: SIGUIENTE RIVAL` : `${E}: CONTINUAR   ·   ${X}: ELEGIR LUCHADOR`;
      drawText(ctx, msg, W / 2, H - 40, 26, '#fff');
    }
    if (this.paused) this.drawPause();
  },

  drawEruptWarnings(camX) {
    for (const p of this.projectiles) {
      if (!p.spec.erupt || p.delay <= 0) continue;
      const a = 0.3 + 0.3 * Math.sin(this.t * 0.6);
      if (p.spec.style === 'lava') {
        // el suelo se agrieta y brilla al rojo antes de reventar
        const k = 1 - p.delay / 22, x = p.x - camX;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, GROUND_Y + 4, 2, x, GROUND_Y + 4, 50);
        g.addColorStop(0, `rgba(255,200,90,${0.5 * k + a * 0.3})`);
        g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, GROUND_Y + 4, 50, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(255,150,40,${0.4 + 0.6 * k})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const ang = i * 1.05 + 0.3, r = 14 + 30 * k;
          ctx.moveTo(x, GROUND_Y + 4);
          ctx.lineTo(x + Math.cos(ang) * r * 0.6, GROUND_Y + 4 + Math.sin(ang) * r * 0.12);
          ctx.lineTo(x + Math.cos(ang + 0.3) * r, GROUND_Y + 4 + Math.sin(ang + 0.3) * r * 0.22);
        }
        ctx.stroke();
        ctx.restore();
        if (p.delay % 3 === 0) this.fx.smokePuff(p.x + rand(-20, 20), GROUND_Y - 6, 10, 0.4);
        continue;
      }
      ctx.fillStyle = `rgba(125,255,106,${a})`;
      ctx.beginPath();
      ctx.ellipse(p.x - camX, GROUND_Y + 4, 40, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawFatalityFx(camX) {
    const w = this.winner, l = this.loser, F = this.fatal, st = this.st;
    if (this.fatalChain) {
      // cadena de KAIZEN: sale de su mano y se clava en el pecho del rival
      const [hx, hy] = this.hookHand(w), ex = l.x - w.facing * 4, ey = l.y - 125, k = this.fatalChain.k;
      const tx = lerp(hx, ex, k), ty = lerp(hy, ey, k), pts = [];
      const slack = this.fatalChain.out && k < 1 ? 14 : 3;
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        pts.push(lerp(hx, tx, t) - camX, lerp(hy, ty, t) + Math.sin(t * Math.PI) * slack * Math.sin(this.t * 0.8 + t * 7));
      }
      this.drawLanza(pts, w.facing > 0 ? 0 : Math.PI);
    }
    if (st > 8 && st < 80 && F.mode !== 'decap' && F.mode !== 'soul' && F.mode !== 'cadenas') {
      const x1 = w.x - camX + w.facing * 62, y1 = w.y - 140, x2 = l.x - camX, y2 = l.y - 110;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = F.color;
      ctx.shadowColor = F.color;
      ctx.shadowBlur = 20;
      for (let k = 0; k < 2; k++) {
        ctx.lineWidth = k ? 2 : 7;
        ctx.globalAlpha = k ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        for (let i = 1; i < 10; i++) ctx.lineTo(lerp(x1, x2, i / 10) + rand(-6, 6), lerp(y1, y2, i / 10) + rand(-12, 12));
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (this.ghost) {
      const p = this.ghost.p;
      ctx.save();
      ctx.globalAlpha = 0.55 * (1 - p * 0.4);
      drawCharAt(ctx, l.ch, l.pose, lerp(l.x, w.x, p) - camX, l.y - p * 60, l.facing, 1, { tint: '#b0ffd0' });
      ctx.restore();
    }
    if (this.fanFly != null) {
      const p = this.fanFly, [hx, hy] = l.headPos;
      this.drawFan(lerp(w.x + w.facing * 50, hx, p) - camX, lerp(w.y - 140, hy + 10, p), this.t * 0.6, w.ch.color);
    }
  },

  drawFan(x, y, rot, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 20, -1.2, 1.2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2a0a18'; ctx.lineWidth = 1.5;
    for (let a = -1.2; a <= 1.21; a += 0.4) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 20, Math.sin(a) * 20); ctx.stroke(); }
    ctx.strokeStyle = '#e8e8f0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 20, -1.2, 1.2); ctx.stroke();
    ctx.restore();
  },

  drawProjectiles(camX) {
    for (const p of this.projectiles) {
      if (p.delay > 0) continue;
      const x = p.x - camX, y = p.y, d = p.dir, c = p.spec.color;
      ctx.save();
      ctx.shadowColor = c;
      ctx.shadowBlur = 18;
      switch (p.spec.style) {
        case 'lanza': {
          // cadena de fuego que sale de la mano de KAIZEN como un látigo y termina en un gancho
          ctx.shadowBlur = 0;
          const [hx, hy] = this.hookHand(p.owner);
          const pts = [], amp = 16 * Math.max(0.25, 1 - p.t / 18);
          for (let i = 0; i <= 14; i++) {
            const t = i / 14;
            pts.push(lerp(hx - camX, x, t), lerp(hy, y, t) + Math.sin(t * Math.PI) * amp * Math.sin(p.t * 0.7 - t * 9));
          }
          this.drawLanza(pts, d > 0 ? 0 : Math.PI);
          break;
        }
        case 'ice': {
          // lanza de cristal de hielo: un cristal grande y dos menores, con halo frío
          ctx.shadowBlur = 0;
          const halo = ctx.createRadialGradient(x, y, 4, x, y, 50);
          halo.addColorStop(0, 'rgba(190,235,255,0.35)');
          halo.addColorStop(1, 'rgba(120,200,255,0)');
          ctx.fillStyle = halo;
          ctx.fillRect(x - 50, y - 50, 100, 100);
          const ang = d > 0 ? Math.PI / 2 : -Math.PI / 2, wob = Math.sin(p.t * 0.6) * 0.03;
          drawCrystal(ctx, x - d * 40, y, 22, 76, ang + wob);
          drawCrystal(ctx, x - d * 34, y - 7, 12, 44, ang - 0.25 * d);
          drawCrystal(ctx, x - d * 34, y + 7, 12, 44, ang + 0.25 * d);
          break;
        }
        case 'icewall': {
          // cristales facetados que brotan del suelo, uno tras otro, inclinados hacia el rival
          ctx.shadowBlur = 0;
          const fade = Math.max(0, Math.min(1, (p.spec.life - p.t) / 8));
          ctx.globalAlpha = fade;
          const shards = [[-34, 0.45, -0.35, 26], [-24, 0.7, -0.22, 30], [-12, 0.92, -0.1, 34], [0, 1, 0.02, 40],
            [12, 0.85, 0.14, 34], [24, 0.62, 0.26, 28], [34, 0.4, 0.38, 24], [-6, 0.55, -0.05, 22], [8, 0.5, 0.2, 20]];
          shards.forEach(([ox, hgt, ang, wd], i) => {
            const grow = Math.min(1, Math.max(0, (p.t - i * 0.6) / 5));
            const g = 1 - Math.pow(1 - grow, 3);   // crece rápido y frena
            drawCrystal(ctx, x + ox * d, GROUND_Y + 4, wd, 200 * hgt * g, ang * d);
          });
          ctx.globalAlpha = 1;
          break;
        }
        case 'storm': {
          // tornado de hielo: resplandor frío y cristales que giran alrededor del rival (el vaho son partículas)
          ctx.shadowBlur = 0;
          const fade = Math.max(0, Math.min(1, p.t / 6, (p.spec.life - p.t) / 8));
          ctx.globalAlpha = fade;
          const g = ctx.createRadialGradient(x, GROUND_Y - 120, 10, x, GROUND_Y - 120, 170);
          g.addColorStop(0, 'rgba(200,240,255,0.28)');
          g.addColorStop(1, 'rgba(120,190,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 170, GROUND_Y - 290, 340, 300);
          for (let i = 0; i < 16; i++) {
            const a = p.t * (0.22 + (i % 3) * 0.05) + i * 0.39, yy = GROUND_Y - 20 - (i * 37) % 240;
            const r = 36 + (yy < GROUND_Y - 150 ? 30 : 0) + (i % 4) * 10;
            const delante = Math.sin(a) > 0;   // los de detrás, más pequeños y tenues
            ctx.globalAlpha = fade * (delante ? 1 : 0.5);
            const s = (delante ? 1 : 0.7) * (10 + (i % 3) * 5);
            drawCrystal(ctx, x + Math.cos(a) * r, yy, s * 0.6, s * 2, a * 1.7);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'acid':
          ctx.fillStyle = '#5fd030';
          ctx.beginPath(); ctx.ellipse(x, y, 17, 12 + Math.sin(p.t * 0.5) * 3, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#c8ff8a'; circle(ctx, x + d * 5, y - 4, 4);
          break;
        case 'bolt':
          ctx.strokeStyle = '#e8fcff'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(x - d * 34, y);
          for (let i = 1; i <= 6; i++) ctx.lineTo(x - d * 34 + d * i * 11, y + rand(-10, 10));
          ctx.stroke();
          break;
        case 'fire': case 'dragon': {
          const big = p.spec.style === 'dragon';
          const g = ctx.createRadialGradient(x, y, 2, x, y, big ? 28 : 22);
          g.addColorStop(0, '#fff6c0'); g.addColorStop(0.4, '#ffb21e'); g.addColorStop(1, 'rgba(220,40,10,0.1)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.ellipse(x, y, big ? 30 : 24, big ? 17 : 18, 0, 0, Math.PI * 2); ctx.fill();
          if (big) {
            ctx.fillStyle = '#fff2a0';
            poly(ctx, [x + d * 30, y - 4, x + d * 16, y - 16, x + d * 20, y - 2, x + d * 16, y + 10]);
            ctx.fillStyle = '#1a0a00'; circle(ctx, x + d * 18, y - 6, 2.5);
          }
          break;
        }
        case 'cloud':
          ctx.shadowBlur = 0;
          for (let i = 0; i < 6; i++) {
            ctx.fillStyle = `rgba(${170 + i * 8},${180 + i * 6},${160},0.45)`;
            circle(ctx, x + Math.sin(p.t * 0.1 + i) * 16, y + Math.cos(p.t * 0.13 + i * 2) * 12, 16 + (i % 3) * 4);
          }
          break;
        case 'orb': {
          const g = ctx.createRadialGradient(x, y, 2, x, y, 20);
          g.addColorStop(0, '#ffd0ff'); g.addColorStop(0.4, '#9a40e0'); g.addColorStop(1, 'rgba(40,0,80,0.2)');
          ctx.fillStyle = g; circle(ctx, x, y, 20);
          ctx.strokeStyle = '#ff80ff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, 14, p.t * 0.3, p.t * 0.3 + 2); ctx.stroke();
          break;
        }
        case 'quake':
          ctx.fillStyle = '#d8b070';
          for (let i = 0; i < 4; i++) {
            const bx = x - d * i * 12, hgt = 26 - i * 5 + Math.sin(p.t + i) * 4;
            poly(ctx, [bx - 10, GROUND_Y, bx, GROUND_Y - hgt, bx + 10, GROUND_Y]);
          }
          break;
        case 'missile':
          ctx.fillStyle = '#c8ccd2';
          ctx.fillRect(x - 20, y - 6, 40, 12);
          ctx.fillStyle = '#ff3a1a';
          poly(ctx, [x + d * 20, y - 6, x + d * 32, y, x + d * 20, y + 6]);
          poly(ctx, [x - d * 20, y - 6, x - d * 28, y - 13, x - d * 14, y - 6]);
          poly(ctx, [x - d * 20, y + 6, x - d * 28, y + 13, x - d * 14, y + 6]);
          break;
        case 'net': {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 2;
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.t * 0.15);
          ctx.beginPath();
          for (let i = -2; i <= 2; i++) {
            ctx.moveTo(-26, i * 12); ctx.lineTo(26, i * 12);
            ctx.moveTo(i * 12, -26); ctx.lineTo(i * 12, 26);
          }
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'bomb':
          ctx.fillStyle = '#2a2a2e'; circle(ctx, x, y, 10);
          ctx.fillStyle = p.t % 8 < 4 ? '#ff3020' : '#ffd040'; circle(ctx, x + 4, y - 4, 3);
          break;
        case 'fan':
          ctx.shadowBlur = 8;
          this.drawFan(x, y, p.t * 0.6, '#e0458c');
          break;
        case 'wind':
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(232,244,255,0.7)';
          ctx.lineWidth = 3;
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.arc(x - d * i * 8, y - 40 + i * 26, 18, p.t * 0.4 + i, p.t * 0.4 + i + 4);
            ctx.stroke();
          }
          break;
        case 'skull':
          ctx.fillStyle = '#7dff6a';
          ctx.beginPath(); ctx.ellipse(x - d * 14, y, 18, 9, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e8f8d8'; circle(ctx, x, y - 2, 11); ctx.fillRect(x - 6, y + 4, 12, 7);
          ctx.fillStyle = '#103008'; circle(ctx, x + d * 4, y - 3, 3); circle(ctx, x - d * 3, y - 3, 3);
          break;
        case 'fireball': {
          // núcleo incandescente; las llamas y el humo son partículas (projTrail)
          ctx.shadowBlur = 0;
          ctx.globalCompositeOperation = 'lighter';
          const fl = FLAME_SPRITES();
          for (let i = 0; i < 4; i++) {
            const s = 22 - i * 3 + Math.sin(p.t * 0.9 + i * 2) * 3;
            ctx.drawImage(fl[i ? 1 : 0], x - d * i * 6 - s, y - s * 1.1 + Math.sin(p.t * 0.7 + i) * 2, s * 2, s * 2.2);
          }
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'firestorm': case 'lava': {
          // resplandor de la columna de fuego (el fuego en sí son partículas)
          ctx.shadowBlur = 0;
          const life = p.spec.life || 20, fade = Math.min(1, p.t / 5, (life - p.t) / 8);
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(x, GROUND_Y - 110, 10, x, GROUND_Y - 110, 170);
          g.addColorStop(0, `rgba(255,160,60,${0.35 * fade})`);
          g.addColorStop(1, 'rgba(255,60,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 170, GROUND_Y - 280, 340, 300);
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'erupt': {
          const a = 1 - p.t / 15;
          const g = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y - 230);
          g.addColorStop(0, `rgba(200,255,150,${a})`);
          g.addColorStop(0.5, `rgba(125,255,106,${a * 0.7})`);
          g.addColorStop(1, 'rgba(60,160,40,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x - 34, GROUND_Y);
          for (let i = 0; i <= 8; i++) ctx.lineTo(x - 34 + i * 8.5, GROUND_Y - 200 - Math.sin(p.t + i) * 25 * (i % 2));
          ctx.lineTo(x + 34, GROUND_Y);
          ctx.closePath();
          ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
  },

  drawHUD() {
    const [a, b] = this.f;
    this.drawBar(28, 22, 380, 24, a, false, this.wins[0]);
    this.drawBar(W - 28 - 380, 22, 380, 24, b, true, this.wins[1]);
    drawText(ctx, String(Math.max(0, this.timer)).padStart(2, '0'), W / 2, 36, 46, fireGradient(ctx, 36, 46));
    if (this.mode === 1) drawText(ctx, `RIVAL ${this.ladderIdx + 1}/${this.ladder.length}`, W / 2, 68, 16, '#ccc');
    if (this.combo) {
      const x = this.combo.side === 0 ? 60 : W - 60;
      drawText(ctx, `${this.combo.n} GOLPES`, x, 130, 34, fireGradient(ctx, 130, 34), this.combo.side === 0 ? 'left' : 'right');
    }
    this.f.forEach((f, i) => {
      if (!this.cpu[i]) this.drawInputTrail(f, i === 0 ? 28 : W - 28, i === 1);
      if (f.ultraReady && (this.state === 'fight' || this.state === 'intro')) {
        const pulse = 0.6 + 0.4 * Math.sin(this.t * 0.2);
        ctx.globalAlpha = pulse;
        drawText(ctx, 'ULTRA LISTO', i === 0 ? 408 : W - 408, 92, 18, '#bfefff', i === 0 ? 'right' : 'left');
        ctx.globalAlpha = 1;
      }
    });
  },

  // Muestra las flechas que el jugador va pulsando (ayuda a aprender los especiales)
  drawInputTrail(f, x, right) {
    const gap = this.inputGap, items = [];
    // tras un especial se sigue mostrando la secuencia que lo activó
    const shown = f.t - f.seqShownT < 45, buf = shown ? f.seqShown : f.buf;
    for (let i = buf.length - 1; i >= 0 && items.length < 3; i--) {
      const e = buf[i], next = items.length ? items[0].t : shown ? f.seqShownT : f.t;
      if (next - e[1] > gap) break;
      const fwdRight = e[2] === 1;
      const arrow = e[0] === 'D' ? '▼' : (e[0] === 'F') === fwdRight ? '►' : '◄';
      items.unshift({ txt: arrow, t: e[1] });
    }
    if (f.lastBtn && f.t - f.lastBtn.t < 30 && (!items.length || f.lastBtn.t >= items[items.length - 1].t)) {
      items.push({ txt: BTN_NAMES[f.lastBtn.b], t: f.lastBtn.t, btn: true });
    }
    if (!items.length) return;
    let cx = right ? x - items.length * 40 + 20 : x + 16;
    for (const it of items) {
      const age = f.t - it.t, a = clamp(1 - (age - gap * 0.6) / (gap * 0.6), 0.25, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = it.btn ? 'rgba(216,38,44,0.8)' : 'rgba(0,0,0,0.6)';
      ctx.fillRect(cx - 17, 86, 34, 26);
      ctx.strokeStyle = '#d8b04a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 17, 86, 34, 26);
      drawText(ctx, it.txt, cx, 100, it.btn ? 16 : 18, '#fff', 'center', null);
      cx += 40;
    }
    ctx.globalAlpha = 1;
  },

  // Nombre del especial sobre el luchador que lo ejecuta
  drawSpecialNames(camX) {
    for (const f of this.f) {
      if (f.spNameT <= 0 || f.hidden) continue;
      const a = Math.min(1, f.spNameT / 15), rise = (70 - f.spNameT) * 0.4;
      ctx.globalAlpha = a;
      drawText(ctx, f.spName.toUpperCase() + '!', f.x - camX, f.y - 230 * f.bulk - rise, 20,
        f.ch.color === '#eef2f8' ? '#dfe8ff' : f.ch.color, 'center', '#000', 4);
      ctx.globalAlpha = 1;
    }
  },

  drawBar(x, y, w, h, f, right, wins) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = '#7a0000';
    ctx.fillRect(x, y, w, h);
    const dw = w * f.dispHp / 100, hw = w * f.hp / 100;
    ctx.fillStyle = '#ffcc33';
    ctx.fillRect(right ? x + w - dw : x, y, dw, h);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#8dff7a');
    g.addColorStop(0.5, '#22c322');
    g.addColorStop(1, '#0c6e0c');
    ctx.fillStyle = g;
    ctx.fillRect(right ? x + w - hw : x, y, hw, h);
    ctx.strokeStyle = '#d8b04a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
    drawText(ctx, f.ch.name + (this.cpu[f.idx] ? '  (CPU)' : ''), right ? x + w : x, y + h + 18, 22, '#fff', right ? 'right' : 'left');
    for (let i = 0; i < wins; i++) {
      const cx = right ? x + 12 + i * 28 : x + w - 12 - i * 28, cy = y + h + 18;
      ctx.fillStyle = '#000'; circle(ctx, cx, cy, 11);
      ctx.fillStyle = '#d8a22a'; circle(ctx, cx, cy, 9);
      ctx.fillStyle = '#7a0000'; circle(ctx, cx, cy, 4);
    }
  },

  drawBanners() {
    for (const b of this.banners) {
      const p = b.t;
      const sc = p < 10 ? 1 + (1 - p / 10) * 1.6 : 1;
      const alpha = b.life - p < 15 ? (b.life - p) / 15 : Math.min(1, p / 4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(W / 2, b.y);
      ctx.scale(sc, sc);
      drawText(ctx, b.text, 0, 0, b.size, fireGradient(ctx, 0, b.size, ...b.colors), 'center', '#000', b.size / 7);
      ctx.restore();
    }
  },

  drawPause() {
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'PAUSA', W / 2, 70, 70, fireGradient(ctx, 70, 70));
    this.drawControlsList(130);
    // especiales del jugador 1
    const ch = this.f[0].ch, items = ch.specials.map(s => `${s.name} (${inputLabel(s).replace(/  \(ULTRA.*\)/, '')})`);
    if (items.length > 3) {
      // en dos líneas si son muchos
      drawText(ctx, `${ch.name}: ` + items.slice(0, 3).join('  ·  '), W / 2, H - 76, 12, ch.color, 'center', null);
      drawText(ctx, items.slice(3).join('  ·  '), W / 2, H - 58, 12, ch.color, 'center', null);
    } else drawText(ctx, `${ch.name}: ` + items.join('  ·  '), W / 2, H - 62, 14, ch.color, 'center', null);
    drawText(ctx, Touch.active ? '❚❚: CONTINUAR   ·   START: SALIR AL MENÚ'
      : 'ESC: CONTINUAR   ·   Q: SALIR AL MENÚ   ·   M: SONIDO', W / 2, H - 28, 22, '#ffd84a');
  },

  // ---------------- PANTALLAS ----------------
  renderTitle() {
    const cam = (Math.sin(this.t * 0.003) * 0.5 + 0.5) * (STAGE_W - W);
    Stage.draw(ctx, cam, this.t);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);

    const ex = W / 2, ey = 130;
    ctx.save();
    ctx.shadowColor = '#ff4a1a';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#2a0606';
    circle(ctx, ex, ey, 66);
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#c8961e';
    ctx.beginPath(); ctx.arc(ex, ey, 66, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#d8241a';
    for (let i = -1; i <= 1; i++) {
      poly(ctx, [ex - 34 + i * 22, ey - 44, ex - 22 + i * 22, ey - 44, ex + 30 + i * 22, ey + 44, ex + 18 + i * 22, ey + 44]);
    }

    drawText(ctx, 'FURIA MORTAL', W / 2, 262, 104, fireGradient(ctx, 262, 104), 'center', '#000', 12);
    drawText(ctx, `EL TORNEO DE LAS SOMBRAS  ·  ${CHARACTERS.length} GUERREROS`, W / 2, 322, 24, '#d8b04a');

    MENU.forEach((item, i) => {
      const y = 362 + i * 33;
      const sel = i === this.menuIdx;
      let label = item;
      if (i === 2) label = `DIFICULTAD:  ◄ ${AI_LEVELS[this.difficulty].name} ►`;
      if (i === 3) label = `COMBOS:  ◄ ${COMBO_MODES[this.comboMode].name} ►`;
      const pulse = sel ? 1 + Math.sin(this.t * 0.15) * 0.04 : 1;
      ctx.save();
      ctx.translate(W / 2, y);
      ctx.scale(pulse, pulse);
      drawText(ctx, (sel ? '►  ' : '') + label + (sel ? '  ◄' : ''), 0, 0, sel ? 28 : 24, sel ? '#ffd84a' : '#9a8a8a');
      ctx.restore();
    });
    if (this.menuIdx === 3) {
      drawText(ctx, this.comboMode === 0
        ? 'LENTOS: pulsa ATRÁS, luego ADELANTE y luego el golpe, sin prisa'
        : 'RÁPIDOS: la secuencia debe hacerse de corrido, como en el arcade', W / 2, H - 40, 16, '#ffb070', 'center', null);
    }
    drawText(ctx, Touch.active
      ? 'Cruceta para elegir · GA o START para confirmar'
      : 'W/S o ↑/↓ para elegir · ENTER o F para confirmar · M: sonido', W / 2, H - 16, 16, '#888', 'center', null);
  },

  drawControlsList(y0) {
    const L = [
      ['', 'JUGADOR 1', 'JUGADOR 2'],
      ['Moverse / saltar / agacharse', 'W A S D', 'FLECHAS'],
      ['Golpe Alto (GA)', 'F', 'I  ·  Num 4'],
      ['Golpe Bajo (GB)', 'V', 'K  ·  Num 1'],
      ['Patada Alta (PA)', 'G', 'O  ·  Num 5'],
      ['Patada Baja (PB)', 'B', 'L  ·  Num 2'],
      ['Bloqueo', 'H  ·  ESPACIO', 'P  ·  Num 0'],
    ];
    L.forEach((r, i) => {
      const y = y0 + i * 28, c = i === 0 ? '#ffd84a' : '#fff';
      drawText(ctx, r[0], 300, y, 20, i === 0 ? c : '#d8b04a', 'right');
      drawText(ctx, r[1], 470, y, 20, c);
      drawText(ctx, r[2], 700, y, 20, c);
    });
    const M = [
      'CORRER: ADELANTE, ADELANTE (mantener)      AGARRE: cerca + ADELANTE + GB',
      'GANCHO: ↓ + GA     BARRIDA: ↓ + PA     GIRATORIA: ATRÁS + PA     AÉREOS: salto + golpe',
      `ESPECIALES (${COMBO_MODES[this.comboMode].name}): pulsa ATRÁS, luego ADELANTE, luego el golpe`,
      'Cada guerrero tiene sus ESPECIALES y su propia EJECUCIÓN (ver pantalla de selección)',
      Touch.active ? 'TÁCTIL: cruceta a la izquierda · GA PA GB PB y BLOQUEO a la derecha · ❚❚ pausa'
        : 'MANDO: cruceta/stick · Y=GA  X=GB  B=PA  A=PB · gatillos=bloqueo · START=confirmar',
    ];
    M.forEach((t, i) => drawText(ctx, t, W / 2, y0 + 212 + i * 26, 17, i === 3 ? '#ff6a4a' : i === 2 ? '#ffd84a' : '#ddd'));
  },

  renderControls() {
    Stage.draw(ctx, 300, this.t);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'CONTROLES', W / 2, 56, 60, fireGradient(ctx, 56, 60));
    this.drawControlsList(112);
    drawText(ctx, `${keyName('ENTER')} / ${keyName('ESC')}: VOLVER`, W / 2, H - 22, 22, '#ffd84a');
  },

  renderSelect() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a0204');
    g.addColorStop(1, '#050002');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,20,20,0.18)';
    ctx.lineWidth = 2;
    for (let i = -H; i < W; i += 28) { ctx.beginPath(); ctx.moveTo(i, H); ctx.lineTo(i + H, 0); ctx.stroke(); }

    drawText(ctx, 'ELIGE A TU GUERRERO', W / 2, 36, 44, fireGradient(ctx, 36, 44));

    const cw = 96, chh = 96, gap = 8;
    const x0 = W / 2 - (cw * GRID_COLS + gap * (GRID_COLS - 1)) / 2, y0 = 66;
    const cell = i => [x0 + (i % GRID_COLS) * (cw + gap), y0 + Math.floor(i / GRID_COLS) * (chh + gap)];

    CHARACTERS.forEach((ch, i) => {
      const [cx, cy] = cell(i);
      ctx.fillStyle = '#140608';
      ctx.fillRect(cx, cy, cw, chh);
      ctx.save();
      ctx.beginPath(); ctx.rect(cx, cy, cw, chh); ctx.clip();
      const rg = ctx.createRadialGradient(cx + cw / 2, cy + 40, 5, cx + cw / 2, cy + 40, 70);
      rg.addColorStop(0, ch.dark);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(cx, cy, cw, chh);
      drawCharAt(ctx, ch, STANCES[ch.stance].idle, cx + cw / 2 - 6, cy + 172 - ((ch.look.bulk || 1) - 1) * 170, 1, 0.92);
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(cx, cy + chh - 20, cw, 20);
      drawText(ctx, ch.name, cx + cw / 2, cy + chh - 10, 16, '#fff', 'center', null);
      ctx.strokeStyle = '#5a3a1a';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cw, chh);
    });

    const cursors = this.mode === 2 ? [0, 1] : [0];
    for (const i of cursors) {
      const [cx, cy] = cell(this.sel[i]);
      const col = i === 0 ? '#ff3a2a' : '#3a8aff';
      if (!this.locked[i] && Math.floor(this.t / 8) % 2 !== 0) continue;
      const inset = this.mode === 2 && this.sel[0] === this.sel[1] && i === 1 ? 5 : 0;
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      ctx.strokeRect(cx - 2 + inset, cy - 2 + inset, cw + 4 - inset * 2, chh + 4 - inset * 2);
      drawText(ctx, `${i + 1}P`, i === 0 ? cx + 15 : cx + cw - 15, cy + 13, 17, col);
    }

    // vistas grandes animadas
    const show = (ch, x, facing, label, col, locked) => {
      const rg = ctx.createRadialGradient(x, 360, 10, x, 360, 170);
      rg.addColorStop(0, ch ? ch.dark + 'aa' : '#333');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(x - 170, 190, 340, 340);
      if (ch) {
        const st = STANCES[ch.stance], pose = this._pose;
        copyPose(pose, locked ? (POSES[ch.win] || POSES.win) : st.idle);
        if (!locked) {
          const b = Math.sin(this.t * st.speed) * st.bob;
          pose.h += b; pose.ff[1] += b; pose.bf[1] += b; pose.fh[1] += b * 1.3; pose.bh[1] += b * 1.3;
        }
        drawCharAt(ctx, ch, pose, x, 468, facing, 1.15, { anim3d: locked ? 'victoria' : 'guardia', slot: label });
        drawText(ctx, ch.name, x, 496, 36, locked ? '#ffd84a' : '#fff');
        const bio = ch.bio.toUpperCase(), cut = bio.indexOf(' ', Math.floor(bio.length / 2));
        if (bio.length > 26 && cut > 0) {
          drawText(ctx, bio.slice(0, cut), x, 518, 12, '#bbb', 'center', null);
          drawText(ctx, bio.slice(cut + 1), x, 532, 12, '#bbb', 'center', null);
        } else drawText(ctx, bio, x, 524, 12, '#bbb', 'center', null);
      } else {
        drawText(ctx, '?', x, 380, 140, '#555');
        drawText(ctx, 'RIVAL CPU', x, 496, 32, '#888');
      }
      drawText(ctx, label, x, 206, 24, col);
    };
    show(CHARACTERS[this.sel[0]], 132, 1, 'JUGADOR 1', '#ff3a2a', this.locked[0]);
    if (this.mode === 2) show(CHARACTERS[this.sel[1]], W - 132, -1, 'JUGADOR 2', '#3a8aff', this.locked[1]);
    else show(null, W - 132, -1, 'CPU', '#3a8aff', false);

    // lista de movimientos del personaje resaltado
    const ch = CHARACTERS[this.sel[this.mode === 2 && this.locked[0] && !this.locked[1] ? 1 : 0]];
    const by = 384, bw = 470;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(W / 2 - bw / 2, by, bw, 146);
    ctx.strokeStyle = '#5a3a1a';
    ctx.strokeRect(W / 2 - bw / 2, by, bw, 146);
    drawText(ctx, `MOVIMIENTOS DE ${ch.name}`, W / 2, by + 16, 18, '#ffd84a', 'center', null);
    // la lista se compacta si el guerrero tiene muchos especiales
    const n = ch.specials.length, lay = n > 4 ? [34, 13.5, 13] : n > 3 ? [38, 17, 14] : [42, 22, 16];
    ch.specials.forEach((s, i) => {
      const col = s.kind === 'ultra' ? (ch.id === 'kaizen' ? '#ffcc60' : '#bfefff') : ch.color === '#eef2f8' ? '#dfe8ff' : ch.color;
      drawText(ctx, `${s.name.toUpperCase()}:  ${inputLabel(s)}`, W / 2, by + lay[0] + i * lay[1], lay[2], col);
    });
    drawText(ctx, `EJECUCIÓN (${FATAL_FX[ch.fatal.fx].name}):  ${inputLabel(ch.fatal)}`, W / 2, by + 115, 15, '#ff4a3a');
    const help = Touch.active ? 'GA o START: confirmar · ❚❚: volver'
      : this.mode === 2 ? 'P1: F confirma · P2: I confirma · ESC: volver' : 'ENTER o F: confirmar · ESC: volver';
    drawText(ctx, `${help}   ·   Combos ${COMBO_MODES[this.comboMode].name.toLowerCase()}`, W / 2, by + 134, 13, '#999', 'center', null);
  },

  renderChampion() {
    Stage.draw(ctx, (STAGE_W - W) / 2, this.t);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, H);
    const ch = CHARACTERS[this.sel[0]];
    drawCharAt(ctx, ch, POSES[ch.win] || POSES.win, W / 2, GROUND_Y, 1, 1.5, { anim3d: 'victoria' });
    drawText(ctx, '¡CAMPEÓN DEL TORNEO!', W / 2, 90, 72, fireGradient(ctx, 90, 72));
    drawText(ctx, `${ch.name} HA VENCIDO A TODOS LOS GUERREROS`, W / 2, 150, 26, '#fff');
    if (this.st > 60 && Math.floor(this.t / 30) % 2 === 0) drawText(ctx, `${keyName('ENTER')}: VOLVER AL MENÚ`, W / 2, H - 30, 24, '#ffd84a');
  },
};

Game.init();
