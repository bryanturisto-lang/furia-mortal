// ===== IA del CPU: genera "pulsaciones" virtuales igual que un jugador humano =====
const AI_DIR = { F: { fwd: 1 }, B: { back: 1 }, D: { down: 1 } };

// Convierte una secuencia (p. ej. ATRÁS, ADELANTE + GA) en pasos de entrada
function motionSteps(m) {
  const steps = [];
  m.input.forEach((d, i) => {
    steps.push([AI_DIR[d], 3]);
    if (i < m.input.length - 1) steps.push([{}, 1]);
  });
  steps.push([Object.assign({}, AI_DIR[m.input[m.input.length - 1]], { [m.btn]: 1 }), 2], [{}, 6]);
  return steps;
}

class AI {
  constructor(level) {
    this.p = AI_LEVELS[level];
    this.queue = [];
    this.prev = {};
    this.cd = 30;
    this.hold = null;
    this.holdN = 0;
    this.seenAtk = -1;
    this.seenJump = -1;
    this.blockPlan = null;
    this.seenProj = new WeakSet();
  }

  // r usa direcciones relativas (fwd/back); se traducen a izquierda/derecha según hacia dónde mira
  emit(me, r) {
    const o = { up: !!r.up, down: !!r.down, left: false, right: false,
      hp: !!r.hp, lp: !!r.lp, hk: !!r.hk, lk: !!r.lk, bl: !!r.bl, pressed: {} };
    if (r.fwd) o[me.facing === 1 ? 'right' : 'left'] = true;
    if (r.back) o[me.facing === 1 ? 'left' : 'right'] = true;
    for (const k of ACTIONS) o.pressed[k] = o[k] && !this.prev[k];
    this.prev = o;
    return o;
  }

  plan(steps) {
    this.queue = steps.map(s => ({ i: s[0], n: s[1] }));
    this.hold = null;
    this.holdN = 0;
  }

  pickSpecial(me, kinds, dist) {
    const list = me.ch.specials.filter(s => kinds.includes(s.ai)
      && !((s.kind === 'proj' || s.kind === 'erupt') && me.projCount > 0)
      && !(s.kind === 'invis' && me.invis > 0)
      && !(s.kind === 'grab' && dist > 95));
    return list.length ? pick(list) : null;
  }

  think(me, opp, game) {
    if (this.queue.length) {
      const s = this.queue[0];
      if (--s.n <= 0) this.queue.shift();
      return this.emit(me, s.i);
    }
    const P = this.p, dist = Math.abs(opp.x - me.x);

    if (game.state === 'finish') {
      if (game.winner !== me) return this.emit(me, {});
      if (dist > 140) return this.emit(me, { fwd: 1 });
      if (chance(0.05)) {
        if (chance(0.8)) this.plan(motionSteps(me.ch.fatal).concat([[{}, 20]]));
        else this.plan([[{ down: 1, hp: 1 }, 3], [{}, 30]]);
      }
      return this.emit(me, {});
    }

    const free = CONTROL_STATES.has(me.state);

    // Bloqueo planificado (con tiempo de reacción)
    if (this.blockPlan) {
      const b = this.blockPlan;
      if (b.delay > 0) b.delay--;
      else {
        if (--b.hold <= 0) this.blockPlan = null;
        return this.emit(me, { bl: 1, down: b.low });
      }
    }

    // Reaccionar a un ataque nuevo del rival
    if (opp.state === 'attack' && opp.attackId !== this.seenAtk) {
      this.seenAtk = opp.attackId;
      const m = opp.move;
      const reach = m && m.kind === 'dash' ? 320 : 190;
      if (dist < reach && free && m && m.kind !== 'throw' && m.kind !== 'grab' && chance(P.block)) {
        this.blockPlan = { delay: P.reaction, hold: m.kind === 'dash' ? 30 : 16, low: m.level === 'low' };
      }
    }

    // Proyectiles que vienen hacia mí
    for (const pr of game.projectiles) {
      if (pr.owner === me || this.seenProj.has(pr) || pr.delay > 0 || pr.spec.style === 'erupt') continue;
      const d = (me.x - pr.x) * Math.sign(pr.vx || 1);
      if (d > 0 && d < 340) {
        this.seenProj.add(pr);
        if (free && chance(P.block + 0.1)) {
          const eta = d / Math.max(1, Math.abs(pr.vx));
          const low = pr.spec.level === 'low';
          if ((low || chance(0.35)) && eta > 14) this.plan([[{ up: 1, fwd: 1 }, 3], [{ fwd: 1 }, 14], [{ hk: 1 }, 2], [{}, 8]]);
          else this.blockPlan = { delay: Math.max(Math.floor(P.reaction / 2), Math.floor(eta) - 10), hold: 24, low };
        }
      }
    }

    // Antiaéreo: gancho cuando el rival salta hacia mí
    if (opp.y < GROUND_Y - 30 && opp.jumpId !== this.seenJump && dist < 260 && !opp.floating) {
      this.seenJump = opp.jumpId;
      const approaching = (me.x - opp.x) * opp.vx > 0;
      if (free && approaching && chance(P.antiAir)) {
        const wait = clamp(Math.round((dist - 95) / Math.max(1, Math.abs(opp.vx))), 1, 30);
        this.plan([[{}, wait], [{ down: 1 }, 2], [{ down: 1, hp: 1 }, 2], [{}, 14]]);
        return this.emit(me, {});
      }
    }

    // Castigar a un rival vulnerable (mareado, congelado, atrapado o levitando)
    if (free && (opp.frozen > 0 || opp.state === 'lifted' || (opp.state === 'hit' && opp.pulled)) && chance(0.15)) {
      if (dist < 110) { this.plan([[{ down: 1 }, 2], [{ down: 1, hp: 1 }, 2], [{}, 6]]); return this.emit(me, {}); }
      if (dist < 300) { this.hold = { fwd: 1 }; this.holdN = 10; }
    }

    if (!free) return this.emit(me, {});
    if (this.holdN > 0) { this.holdN--; return this.emit(me, this.hold); }
    if (--this.cd > 0) return this.emit(me, {});
    this.cd = P.think + Math.floor(rand(0, P.think));
    this.decide(me, opp, dist);
    if (this.queue.length) return this.think(me, opp, game);
    return this.emit(me, this.hold || {});
  }

  decide(me, opp, dist) {
    const P = this.p, r = Math.random();
    const special = kinds => {
      const s = this.pickSpecial(me, kinds, dist);
      if (s) { this.plan(motionSteps(s)); return true; }
      return false;
    };
    const walk = (dir, n) => { this.hold = dir > 0 ? { fwd: 1 } : { back: 1 }; this.holdN = n; };
    const run = n => this.plan([[{ fwd: 1 }, 2], [{}, 2], [{ fwd: 1 }, n]]);
    const jumpKick = () => this.plan([[{ up: 1, fwd: 1 }, 5], [{ fwd: 1 }, 12], [{ hk: 1 }, 2], [{}, 8]]);

    if (opp.state === 'down' || opp.state === 'getup') {
      if (dist > 140) walk(1, 12);
      return;
    }
    if (chance(0.04) && special(['buff'])) return;

    if (dist > 330) {
      if (r < P.proj && special(['far'])) return;
      if (r < 0.55) walk(1, 20 + Math.floor(rand(0, 25)));
      else if (r < 0.8) run(24);
      else jumpKick();
    } else if (dist > 125) {
      if (r < P.proj && special(['mid', 'far'])) return;
      if (r < 0.55) walk(1, 10 + Math.floor(rand(0, 18)));
      else if (r < 0.7) jumpKick();
      else if (r < 0.8) walk(-1, 12);
      else { this.hold = { down: 1 }; this.holdN = 10; }
    } else if (r < P.aggro) {
      if (dist < 90 && chance(0.18)) {
        if (!special(['close'])) this.plan([[{ fwd: 1, lp: 1 }, 2], [{}, 10]]);
        return;
      }
      if (chance(0.15) && special(['mid'])) return;
      const map = { hp: { hp: 1 }, lp: { lp: 1 }, hk: { hk: 1 }, lk: { lk: 1 }, sweep: { down: 1, hk: 1 },
        upper: { down: 1, hp: 1 }, rh: { back: 1, hk: 1 }, clp: { down: 1, lp: 1 } };
      const atk = pick(['hp', 'hp', 'lp', 'hk', 'lk', 'sweep', 'upper', 'rh', 'clp']);
      const steps = [[map[atk], 2], [{}, 3]];
      // combo: golpes encadenados rematados con un especial
      if ((atk === 'hp' || atk === 'lp') && chance(0.5)) {
        steps.push([map[atk], 2], [{}, 3], [{ hk: 1 }, 2], [{}, 3]);
        const s = this.pickSpecial(me, ['mid', 'far'], dist);
        if (s && chance(0.4)) steps.push(...motionSteps(s));
      }
      this.plan(steps);
    } else if (r < P.aggro + 0.15) {
      walk(-1, 14);
    } else {
      this.hold = { bl: 1 }; this.holdN = 14;
    }
  }
}
