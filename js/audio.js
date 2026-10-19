/* Keep The Lights On - efek suara kecil lewat WebAudio (tanpa file audio). */
(function (root) {
  'use strict';

  var ctx = null, master = null, muted = false;
  try { muted = localStorage.getItem('ktlo.muted') === '1'; } catch (e) { /* storage bisa diblok */ }

  // 9 nada pentatonik untuk 9 tombol simon
  var NOTES = [262, 294, 330, 392, 440, 523, 587, 659, 784];

  function ensure() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.28;   // sengaja pelan: hanya efek kecil, tanpa musik
        master.connect(ctx.destination);
      } catch (e) { ctx = null; return null; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* abaikan */ } }
    return ctx;
  }

  function tone(freq, dur, o) {
    if (muted) return;
    var c = ensure(); if (!c) return;
    o = o || {};
    var t0 = c.currentTime + (o.delay || 0);
    var osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    var v = o.vol == null ? 0.22 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.04);
  }

  function noise(dur, o) {
    if (muted) return;
    var c = ensure(); if (!c) return;
    o = o || {};
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.value = o.freq || 900;
    var g = c.createGain(); g.gain.value = o.vol == null ? 0.25 : o.vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(c.currentTime + (o.delay || 0));
  }

  var A = {
    unlock: ensure,
    isMuted: function () { return muted; },
    setMuted: function (m) {
      muted = !!m;
      try { localStorage.setItem('ktlo.muted', muted ? '1' : '0'); } catch (e) { /* abaikan */ }
    },
    tap: function () { tone(520, 0.07, { type: 'sine', vol: 0.16 }); },
    select: function () { tone(660, 0.09, { type: 'triangle', vol: 0.18 }); },
    bad: function () { tone(220, 0.22, { type: 'sawtooth', to: 140, vol: 0.12 }); noise(0.12, { freq: 1400, vol: 0.12 }); },
    pair: function () { tone(660, 0.08, { vol: 0.14, type: 'sine' }); tone(880, 0.1, { vol: 0.14, type: 'sine', delay: 0.07 }); },
    note: function (i) { tone(NOTES[i % 9], 0.16, { type: 'sine', vol: 0.18 }); },
    lightOn: function () { tone(659, 0.1, { vol: 0.16, type: 'sine' }); tone(988, 0.14, { vol: 0.16, type: 'sine', delay: 0.07 }); },
    lightOff: function () { tone(330, 0.22, { type: 'triangle', to: 150, vol: 0.14 }); },
    clunk: function () { tone(110, 0.18, { type: 'square', to: 60, vol: 0.12 }); noise(0.1, { freq: 500, vol: 0.18 }); },
    blip: function () { tone(740, 0.06, { type: 'square', vol: 0.06 }); },
    alert: function () { tone(880, 0.1, { type: 'square', vol: 0.07 }); tone(660, 0.12, { type: 'square', vol: 0.07, delay: 0.1 }); },
    win: function () { [659, 784, 1047].forEach(function (f, i) { tone(f, 0.16, { type: 'sine', vol: 0.16, delay: i * 0.09 }); }); },
    lose: function () { [330, 247].forEach(function (f, i) { tone(f, 0.22, { type: 'sine', vol: 0.12, delay: i * 0.16 }); }); },
    pop: function () { tone(880, 0.05, { type: 'sine', vol: 0.12 }); }
  };

  root.KTLO = root.KTLO || {};
  root.KTLO.Audio = A;
})(typeof window !== 'undefined' ? window : globalThis);
