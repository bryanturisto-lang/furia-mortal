// ===== Sonido sintetizado con WebAudio (sin archivos externos) + locutor con voz del sistema =====
const Sound = (() => {
  let ctx = null, master = null, sfx = null, music = null, bassFilter = null, noiseBuf = null;
  let muted = false, musicTimer = null, nextT = 0, step = 0, voice = null;

  function init() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(ctx.destination);
      sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
      music = ctx.createGain(); music.gain.value = 0.2; music.connect(master);
      bassFilter = ctx.createBiquadFilter(); bassFilter.type = 'lowpass'; bassFilter.frequency.value = 420;
      bassFilter.connect(music);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      pickVoice();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const set = () => {
      const vs = speechSynthesis.getVoices();
      voice = vs.find(v => /^es/i.test(v.lang) && /male|hombre|pablo|jorge|raul|diego/i.test(v.name))
        || vs.find(v => /^es/i.test(v.lang)) || null;
    };
    set();
    speechSynthesis.onvoiceschanged = set;
  }

  function noise(dur, freq, q, vol, type = 'bandpass', at, dest) {
    if (!ctx) return;
    const t = at || ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || sfx);
    src.start(t, Math.random() * 0.4);
    src.stop(t + dur + 0.05);
  }

  function tone(freq, dur, type, vol, slide, at, dest) {
    if (!ctx) return;
    const t = at || ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // Música: loop oscuro en La menor, 132 bpm
  const BASS = [55, 55, 0, 55, 65.4, 0, 55, 0, 49, 49, 0, 49, 58.3, 0, 61.7, 0];
  const LEAD = [440, 0, 0, 523, 0, 0, 494, 0, 440, 0, 392, 0, 415, 0, 0, 0];
  function sched() {
    const spb = 60 / 132 / 4;
    while (nextT < ctx.currentTime + 0.12) {
      const s = step % 16, bar = Math.floor(step / 16) % 4;
      const tr = bar === 3 ? 0.89 : 1;
      if (s % 4 === 0) tone(150, 0.2, 'sine', 0.9, 40, nextT, music);
      if (s % 2 === 1) noise(0.03, 8000, 1, 0.18, 'highpass', nextT, music);
      if (s === 4 || s === 12) noise(0.14, 1700, 0.8, 0.45, 'bandpass', nextT, music);
      if (BASS[s]) tone(BASS[s] * tr, 0.18, 'sawtooth', 0.55, null, nextT, bassFilter);
      if (bar % 2 === 1 && LEAD[s]) tone(LEAD[s] * tr, 0.28, 'square', 0.05, null, nextT, music);
      nextT += spb; step++;
    }
  }

  return {
    init,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.6;
      if (muted && 'speechSynthesis' in window) speechSynthesis.cancel();
      return muted;
    },
    startMusic() {
      if (!ctx || musicTimer) return;
      nextT = ctx.currentTime + 0.05; step = 0;
      musicTimer = setInterval(sched, 25);
    },
    hit(heavy) {
      noise(heavy ? 0.22 : 0.12, heavy ? 700 : 1100, 0.9, heavy ? 1 : 0.7, 'lowpass');
      tone(heavy ? 120 : 170, heavy ? 0.2 : 0.1, 'sine', 0.9, 40);
    },
    block() { tone(2200, 0.05, 'square', 0.1); noise(0.06, 3500, 3, 0.4); },
    whoosh(heavy) { noise(heavy ? 0.2 : 0.12, heavy ? 900 : 1400, 1.2, 0.35); },
    jump() { noise(0.08, 600, 1, 0.2); },
    land() { tone(90, 0.18, 'sine', 0.7, 35); noise(0.15, 400, 1, 0.5, 'lowpass'); },
    menu() { tone(880, 0.05, 'square', 0.1); },
    confirm() { tone(440, 0.1, 'square', 0.14, 880); },
    special(type) {
      switch (type) {
        case 'lanza': noise(0.3, 2500, 2, 0.4); tone(600, 0.3, 'sawtooth', 0.15, 200); break;
        case 'hielo': tone(1600, 0.35, 'sine', 0.25, 500); tone(2400, 0.2, 'triangle', 0.1, 1200); break;
        case 'acido': tone(200, 0.3, 'sawtooth', 0.25, 80); noise(0.3, 500, 3, 0.4); break;
        case 'rayo': noise(0.4, 5000, 0.5, 0.6, 'highpass'); tone(80, 0.4, 'square', 0.3, 40); break;
        case 'fuego': noise(0.5, 800, 0.6, 0.7, 'lowpass'); tone(150, 0.4, 'sawtooth', 0.2, 60); break;
        case 'sombra': tone(300, 0.3, 'sine', 0.3, 1200); noise(0.3, 2000, 2, 0.3); break;
        case 'freeze': tone(3000, 0.5, 'triangle', 0.15, 800); break;
        case 'onda': tone(60, 0.6, 'sawtooth', 0.4, 30); noise(0.6, 200, 0.7, 0.9, 'lowpass'); break;
        case 'misil': noise(0.6, 1200, 0.5, 0.5); tone(400, 0.6, 'sawtooth', 0.12, 900); break;
        case 'red': noise(0.2, 3000, 1, 0.3); tone(900, 0.15, 'square', 0.08, 500); break;
        case 'bomba': noise(0.7, 350, 0.6, 1.1, 'lowpass'); tone(90, 0.5, 'sawtooth', 0.35, 35); break;
        case 'abanico': noise(0.25, 4000, 2, 0.35); tone(1400, 0.2, 'triangle', 0.1, 2200); break;
        case 'viento': noise(0.7, 900, 0.4, 0.5); break;
      }
    },
    explode() { noise(1.2, 300, 0.7, 1.3, 'lowpass'); tone(80, 1, 'sawtooth', 0.5, 30); },
    ko() { tone(220, 0.9, 'sawtooth', 0.25, 55); },
    say(text, pitch = 0.3, rate = 0.85) {
      if (muted || !('speechSynthesis' in window)) return;
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'es-ES'; if (voice) u.voice = voice;
        u.pitch = pitch; u.rate = rate; u.volume = 1;
        speechSynthesis.speak(u);
      } catch (e) { /* sin voz disponible */ }
    },
  };
})();
