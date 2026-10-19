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
  var BAND_REF = 32; // detik per puzzle yang dianggap "normal" (termasuk jeda tap); disetel dari simulasi pemain bersama MID_LIVES di bawah
  var BAND_MAX = 1.8;
  var LIFE_SCALE = 1;   // skala global umur baterai (angka di bawah sudah dalam detik)

  // Umur baterai (detik, penuh -> habis) untuk 10 gondola biasa. Diacak penempatannya tiap run.
  // Sengaja lebar: 3 gondola "mepet" (~2-3 menit), 4 sedang, 3 awet. Yang mepet harus dinyalakan belakangan atau dinyalakan ulang.
  var MID_LIVES = [130, 160, 200, 250, 310, 380, 460, 550, 650, 770];
  // Gondola tutorial dapat umur panjang supaya aman.
  var TUT_LIVES = [560, 620, 700];

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

    // Tutorial gondola dapat umur panjang supaya aman; DYING memakai umur tetap; 10 gondola sisanya memakai MID_LIVES (acak).
    var pool = shuffle(MID_LIVES, rnd);
    var tutLife = TUT_LIVES[Math.floor(rnd() * TUT_LIVES.length)];

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

  /** Ringkas keadaan game jadi objek JSON kecil (dikirim ke server supaya game bisa dilanjutkan). */
  function snapshot(s) {
    function r(v, d) { var k = Math.pow(10, d); return Math.round(v * k) / k; }
    return {
      v: 1, t: r(s.t, 1), ema: s.ema == null ? null : r(s.ema, 2),
      bag: s.bag.slice(), last: s.lastType, solved: s.solved, relights: s.relights,
      // per gondola: [menyala 1/0, baterai 0-1, umur penuh (dtk), jumlah relight, waktu padam terakhir]
      g: s.g.map(function (x) { return [x.lit ? 1 : 0, r(x.b, 4), r(x.life, 2), x.relights, r(x.diedAt, 1)]; })
    };
  }

  /** Kebalikan snapshot(). Mengembalikan null kalau datanya tidak valid. */
  function restore(o) {
    if (!o || o.v !== 1 || !Array.isArray(o.g) || o.g.length !== N) return null;
    var g = [];
    for (var i = 0; i < N; i++) {
      var a = o.g[i];
      if (!Array.isArray(a)) return null;
      var b = +a[1], life = +a[2];
      if (!isFinite(b) || !isFinite(life) || life <= 0) return null;
      g.push({ lit: a[0] === 1, b: Math.max(0, Math.min(1, b)), life: life, relights: a[3] | 0, diedAt: isFinite(+a[4]) ? +a[4] : -1 });
    }
    var ema = o.ema == null ? null : +o.ema;
    return {
      seed: 0, rnd: mulberry32((Math.random() * 4294967296) >>> 0),
      t: +o.t || 0, g: g, ema: ema != null && isFinite(ema) ? ema : null,
      bag: Array.isArray(o.bag) ? o.bag.slice(0, 3) : [], solved: o.solved | 0, relights: o.relights | 0,
      lastType: o.last || null
    };
  }

  var api = {
    N: N, TUT: TUT, DYING: DYING, DYING_START: DYING_START, BAND_REF: BAND_REF,
    mulberry32: mulberry32, shuffle: shuffle,
    create: create, setupAfterTutorial: setupAfterTutorial, tick: tick, light: light,
    reportSolve: reportSolve, litCount: litCount, allLit: allLit, allDark: allDark,
    pickType: pickType, band: band, snapshot: snapshot, restore: restore
  };

  root.KTLO = root.KTLO || {};
  root.KTLO.Model = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);