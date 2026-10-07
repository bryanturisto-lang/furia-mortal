// ===== Entrada: teclado (2 jugadores) + mandos (Gamepad API) =====
const ACTIONS = ['up', 'down', 'left', 'right', 'hp', 'lp', 'hk', 'lk', 'bl'];

// hp = golpe alto, lp = golpe bajo, hk = patada alta, lk = patada baja, bl = bloqueo
const KEYMAP = [
  { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    hp: ['KeyF'], hk: ['KeyG'], lp: ['KeyV'], lk: ['KeyB'], bl: ['KeyH', 'Space'] },
  { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    hp: ['KeyI', 'Numpad4'], hk: ['KeyO', 'Numpad5'], lp: ['KeyK', 'Numpad1'], lk: ['KeyL', 'Numpad2'],
    bl: ['KeyP', 'Numpad0', 'Numpad6'] },
];

function padAction(p, a) {
  const b = i => p.buttons[i] && p.buttons[i].pressed;
  const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
  switch (a) {
    case 'up': return b(12) || ay < -0.5;
    case 'down': return b(13) || ay > 0.5;
    case 'left': return b(14) || ax < -0.5;
    case 'right': return b(15) || ax > 0.5;
    case 'hp': return b(3);
    case 'lp': return b(2);
    case 'hk': return b(1);
    case 'lk': return b(0);
    case 'bl': return b(4) || b(5) || b(6) || b(7);
  }
  return false;
}

// ===== Controles táctiles (jugador 1): cruceta de 8 direcciones + botones, con multitoque =====
const Touch = {
  active: false,
  held: new Set(),
  tapped: new Set(),
  sysTapped: new Set(),

  init() {
    const root = document.getElementById('touch');
    if (!root) return;
    const show = () => {
      if (this.active) return;
      this.active = true;
      root.hidden = false;
      document.body.classList.add('touch');
    };
    if (matchMedia('(pointer: coarse)').matches) show();
    addEventListener('touchstart', show, { passive: true });

    // Botones de golpe y bloqueo
    root.querySelectorAll('[data-a]').forEach(btn => {
      const a = btn.dataset.a, ids = new Set();
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        Sound.init();
        ids.add(e.pointerId);
        this.held.add(a);
        this.tapped.add(a);
        btn.classList.add('down');
      });
      const up = e => {
        ids.delete(e.pointerId);
        if (!ids.size) { this.held.delete(a); btn.classList.remove('down'); }
      };
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => btn.addEventListener(t, up));
    });

    // Pausa / START
    root.querySelectorAll('[data-sys]').forEach(btn => btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      Sound.init();
      this.sysTapped.add(btn.dataset.sys);
    }));

    // Pantalla completa (y orientación horizontal si el navegador lo permite)
    const fs = document.getElementById('fs');
    if (!document.fullscreenEnabled) fs.style.display = 'none';
    fs.addEventListener('pointerdown', e => {
      e.preventDefault();
      const done = document.fullscreenElement ? document.exitFullscreen()
        : document.documentElement.requestFullscreen().then(() => {
          if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape');
        });
      Promise.resolve(done).catch(() => {});
    });

    // Cruceta: el dedo puede deslizarse; se calculan 8 direcciones
    const pad = document.getElementById('dpad'), knob = document.getElementById('knob');
    const arrows = {};
    for (const d of ['up', 'down', 'left', 'right']) arrows[d] = pad.querySelector('.' + d);
    let pid = null;
    const setDirs = dirs => {
      for (const d of ['up', 'down', 'left', 'right']) {
        const on = dirs.includes(d);
        if (on && !this.held.has(d)) this.tapped.add(d);
        if (on) this.held.add(d); else this.held.delete(d);
        arrows[d].classList.toggle('on', on);
      }
    };
    const move = e => {
      const r = pad.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const rad = r.width / 2, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / rad) * rad * 0.45;
      knob.style.transform = `translate(${dx / d * k}px, ${dy / d * k}px)`;
      const dirs = [];
      if (d > rad * 0.22) {
        const c = dx / d, s = dy / d;
        if (c > 0.38) dirs.push('right');
        if (c < -0.38) dirs.push('left');
        if (s > 0.38) dirs.push('down');
        if (s < -0.38) dirs.push('up');
      }
      setDirs(dirs);
    };
    pad.addEventListener('pointerdown', e => {
      e.preventDefault();
      Sound.init();
      pid = e.pointerId;
      try { pad.setPointerCapture(pid); } catch (err) { /* algunos navegadores no lo permiten */ }
      move(e);
    });
    pad.addEventListener('pointermove', e => { if (e.pointerId === pid) move(e); });
    const end = e => {
      if (e.pointerId !== pid) return;
      pid = null;
      setDirs([]);
      knob.style.transform = '';
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
  },
};

// Etiquetas de teclas según el dispositivo
const keyName = k => (Touch.active ? { ENTER: 'START', ESC: '❚❚' }[k] : k) || k;

function makePlayerInput() {
  const o = { pressed: {}, prev: {} };
  for (const a of ACTIONS) { o[a] = false; o.pressed[a] = false; o.prev[a] = false; }
  return o;
}

const Input = {
  down: new Set(),
  tapped: new Set(),
  players: [makePlayerInput(), makePlayerInput()],
  sys: {},
  menu: {},
  padStart: [false, false],

  init() {
    addEventListener('keydown', e => {
      Sound.init();
      if (!e.repeat) this.tapped.add(e.code);
      this.down.add(e.code);
      if (/^(Arrow|Numpad|Space|Tab)/.test(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
    addEventListener('pointerdown', () => Sound.init());
    addEventListener('touchend', () => Sound.init(), { passive: true });
    Touch.init();
  },

  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let padConfirm = false;
    for (let i = 0; i < 2; i++) {
      const pl = this.players[i], map = KEYMAP[i];
      const pad = pads && pads[i];
      for (const a of ACTIONS) {
        let v = map[a].some(c => this.down.has(c));
        let tap = map[a].some(c => this.tapped.has(c));
        if (pad && pad.connected) v = v || padAction(pad, a);
        if (i === 0 && Touch.active) { v = v || Touch.held.has(a); tap = tap || Touch.tapped.has(a); }
        pl.pressed[a] = (v && !pl.prev[a]) || tap;
        pl.prev[a] = v;
        pl[a] = v || tap;
      }
      const start = !!(pad && pad.connected && pad.buttons[9] && pad.buttons[9].pressed);
      if (start && !this.padStart[i]) padConfirm = true;
      this.padStart[i] = start;
    }
    this.sys = {};
    for (const c of this.tapped) this.sys[c] = true;
    for (const c of Touch.sysTapped) this.sys[c] = true;
    this.tapped.clear();
    Touch.tapped.clear();
    Touch.sysTapped.clear();

    const P = this.players;
    this.menu = {
      up: P[0].pressed.up || P[1].pressed.up,
      down: P[0].pressed.down || P[1].pressed.down,
      left: P[0].pressed.left || P[1].pressed.left,
      right: P[0].pressed.right || P[1].pressed.right,
      confirm: !!(this.sys.Enter || this.sys.NumpadEnter || P[0].pressed.hp || P[1].pressed.hp || padConfirm),
      back: !!(this.sys.Escape || this.sys.Backspace),
    };
  },
};
