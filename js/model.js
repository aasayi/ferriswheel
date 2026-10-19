/* Keep The Lights On - model game murni (tanpa DOM, bisa dites di Node).
 *
 * Aturan:
 *  - 12 gondola, tiap gondola punya baterai sendiri dengan umur (detik penuh -> habis) yang beda-beda.
 *  - Baterai habis = lampu mati. Semua lampu mati bersamaan = bianglala rusak (kalah).
 *  - Semua 12 menyala bersamaan = menang.
 *  - Ada "rubber band": kalau pemain lambat menyelesaikan puzzle, baterai berikutnya bertahan
 *    lebih lama (maks 1.8x), supaya pemain santai tetap bisa menang. Tidak terlihat oleh pemain.
 */
(function (root) {
  'use strict';

  var N = 12;
  var TUT = 2;     // gondola yang dinyalakan saat tutorial (kanan atas)
  var DYING = 10;  // gondola yang masih menyala tapi baterainya sekarat (kiri atas)
  var DYING_START = 0.16;
  var DYING_LIFE = 420;
  var BAND_REF = 38; // detik per puzzle yang dianggap "normal" (termasuk jeda tap)
  var BAND_MAX = 1.8;
  var LIFE_SCALE = 0.8; // skala global umur baterai (disetel dari simulasi: pemain normal ~7 menit di fase main)

  // Umur baterai (detik, penuh -> habis). Diacak penempatannya tiap run.
  var BASE_LIVES = [330, 380, 430, 480, 520, 570, 620, 680, 740, 800, 880, 960];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function create(opts) {
    opts = opts || {};
    var seed = opts.seed != null ? opts.seed : (Math.random() * 4294967296) >>> 0;
    var rnd = mulberry32(seed);

    // Tutorial gondola dapat umur panjang supaya aman; sisanya acak.
    var pool = shuffle(BASE_LIVES, rnd);
    var longOnes = pool.filter(function (v) { return v >= 740; });
    var tutLife = longOnes[Math.floor(rnd() * longOnes.length)];
    pool.splice(pool.indexOf(tutLife), 1);
    // satu nilai dibuang karena DYING memakai umur tetap
    pool.pop();

    var sc = opts.lifeScale != null ? opts.lifeScale : LIFE_SCALE;
    var lives = [];
    for (var i = 0; i < N; i++) {
      if (i === TUT) lives.push(tutLife * sc);
      else if (i === DYING) lives.push(DYING_LIFE);
      else lives.push(pool.pop() * sc);
    }

    var g = [];
    for (var k = 0; k < N; k++) {
      g.push({ lit: false, b: 0, life: lives[k], relights: 0, diedAt: -1 });
    }

    return {
      seed: seed,
      rnd: rnd,
      t: 0,
      g: g,
      ema: null,
      bag: [],
      solved: 0,
      relights: 0,
      lastType: null
    };
  }

  /** Keadaan setelah intro + tutorial: DYING sekarat, TUT sudah dinyalakan. */
  function setupAfterTutorial(s) {
    for (var i = 0; i < N; i++) { s.g[i].lit = false; s.g[i].b = 0; }
    s.g[DYING].lit = true; s.g[DYING].b = DYING_START;
    s.g[TUT].lit = true; s.g[TUT].b = 1;
    return s;
  }

  function band(s) {
    if (s.ema == null) return 1;
    return Math.max(1, Math.min(BAND_MAX, s.ema / BAND_REF));
  }

  /** Majukan waktu dt detik. Mengembalikan daftar event {type:'died', i}. */
  function tick(s, dt) {
    var ev = [];
    var f = band(s);
    s.t += dt;
    for (var i = 0; i < N; i++) {
      var x = s.g[i];
      if (!x.lit) continue;
      x.b -= dt / (x.life * f);
      if (x.b <= 0) {
        x.b = 0; x.lit = false; x.diedAt = s.t;
        ev.push({ type: 'died', i: i });
      }
    }
    return ev;
  }

  function light(s, i) {
    var x = s.g[i];
    if (x.diedAt >= 0 || x.relights > 0) { x.relights++; s.relights++; }
    x.lit = true; x.b = 1;
    s.solved++;
  }

  function reportSolve(s, seconds) {
    s.ema = s.ema == null ? seconds : (0.6 * s.ema + 0.4 * seconds);
  }

  function litCount(s) {
    var c = 0;
    for (var i = 0; i < N; i++) if (s.g[i].lit) c++;
    return c;
  }
  function allLit(s) { return litCount(s) === N; }
  function allDark(s) { return litCount(s) === 0; }

  /** Jenis puzzle bergiliran dari "kantong" acak: pemerataan, tidak pernah 3x sama berturut-turut. */
  function pickType(s) {
    if (!s.bag.length) {
      var b = shuffle(['cable', 'simon', 'maze'], s.rnd);
      if (b[0] === s.lastType && b[1] !== s.lastType) { var t = b[0]; b[0] = b[1]; b[1] = t; }
      s.bag = b;
    }
    s.lastType = s.bag.shift();
    return s.lastType;
  }

  var api = {
    N: N, TUT: TUT, DYING: DYING, DYING_START: DYING_START, BAND_REF: BAND_REF,
    mulberry32: mulberry32, shuffle: shuffle,
    create: create, setupAfterTutorial: setupAfterTutorial, tick: tick, light: light,
    reportSolve: reportSolve, litCount: litCount, allLit: allLit, allDark: allDark,
    pickType: pickType, band: band
  };

  root.KTLO = root.KTLO || {};
  root.KTLO.Model = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
