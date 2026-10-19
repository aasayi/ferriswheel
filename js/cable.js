/* Mini game 1: Sambung Kabel (versi tebak pasangan).
 *
 * 8 kabel kiri + 8 kabel kanan, semuanya abu-abu. Pemain pilih satu kabel kiri lalu satu kabel kanan.
 * Kalau cocok, warna + simbol terbuka dan kabel tersambung. Kalau tidak, tetap abu-abu.
 * Pasangan DIACAK tiap main (permutasi acak), identitas warna/simbol juga diacak.
 * Mode tutorial: 4 kabel + teks pemandu dari Asayi.
 */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = ['#F76A9B', '#5089D0', '#66C7BD', '#FEF7C5', '#B79BF0', '#FFA27E', '#9BE58F', '#FFFFFF'];
  var NAMES = ['pink', 'biru', 'tosca', 'kuning', 'ungu', 'oranye', 'hijau', 'putih'];
  var SYMS = ['circle', 'x', 'tri', 'star', 'square', 'diamond', 'heart', 'plus'];
  var FAIL_LOCK = 450;   // ms input terkunci setelah salah pasang (ikut menentukan durasi total)
  var INK = '#1b2160';

  function shuffle(a, rnd) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function range(n) { var r = []; for (var i = 0; i < n; i++) r.push(i); return r; }

  /** perm[kiri] = baris kanan pasangannya; ids[pasangan] = indeks warna/simbol. */
  function makeLayout(rnd, n) {
    return { n: n, perm: shuffle(range(n), rnd), ids: shuffle(range(8), rnd).slice(0, n) };
  }

  /** Logika murni (tanpa DOM), dipakai UI dan tes. */
  function createLogic(layout) {
    var n = layout.n, matched = [], taken = [], tried = [], sel = -1, attempts = 0, fails = 0;
    for (var i = 0; i < n; i++) { matched.push(false); taken.push(false); tried.push({}); }
    return {
      layout: layout, matched: matched, taken: taken, tried: tried,
      get sel() { return sel; },
      get attempts() { return attempts; },
      get fails() { return fails; },
      select: function (i) {
        if (matched[i]) return false;
        sel = sel === i ? -1 : i;
        return true;
      },
      tryRight: function (j) {
        if (sel < 0) return { type: 'none' };
        if (taken[j]) return { type: 'ignore' };
        if (tried[sel][j]) return { type: 'known', i: sel, j: j };
        attempts++;
        var i = sel;
        if (layout.perm[i] === j) { matched[i] = true; taken[j] = true; sel = -1; return { type: 'match', i: i, j: j }; }
        tried[i][j] = true; fails++; sel = -1;
        return { type: 'fail', i: i, j: j };
      },
      done: function () { return matched.every(Boolean); }
    };
  }

  /* ---------------- DOM ---------------- */
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function starPts(r, ri) {
    var pts = [];
    for (var k = 0; k < 10; k++) { var rr = k % 2 ? ri : r, a = -Math.PI / 2 + k * Math.PI / 5; pts.push((rr * Math.cos(a)).toFixed(2) + ',' + (rr * Math.sin(a)).toFixed(2)); }
    return pts.join(' ');
  }
  function drawSym(g, kind) {
    g.textContent = '';
    var a = { class: 'sym-line' };
    function add(tag, extra) { var o = {}; for (var k in a) o[k] = a[k]; for (var k2 in extra) o[k2] = extra[k2]; return el(tag, o, g); }
    if (kind === 'circle') add('circle', { r: 5 });
    else if (kind === 'x') add('path', { d: 'M-4.5,-4.5 L4.5,4.5 M4.5,-4.5 L-4.5,4.5' });
    else if (kind === 'tri') add('path', { d: 'M0,-6 L6,4.5 L-6,4.5 Z' });
    else if (kind === 'star') add('polygon', { points: starPts(6.5, 2.8) });
    else if (kind === 'square') add('rect', { x: -4.5, y: -4.5, width: 9, height: 9 });
    else if (kind === 'diamond') add('path', { d: 'M0,-6.5 L6.5,0 L0,6.5 L-6.5,0 Z' });
    else if (kind === 'heart') add('path', { d: 'M0,5.5 C-8,0 -6,-6 0,-2.5 C6,-6 8,0 0,5.5 Z' });
    else add('path', { d: 'M0,-5.5 L0,5.5 M-5.5,0 L5.5,0' });
  }

  var COACH = {
    start: 'Tap salah satu kabel di KIRI dulu.',
    left: 'Sekarang tap kabel di KANAN yang menurutmu pasangannya.',
    fail: 'Belum cocok, warnanya masih abu-abu. Pilih kabel kiri itu lagi, lalu coba kabel kanan yang lain. Tanda silang mengingatkan yang sudah kamu coba.',
    match: 'Cocok! Warna dan simbolnya terbuka. Terus begitu sampai semua kabel tersambung.',
    right: 'Pilih kabel di kiri dulu, baru kabel di kanan.'
  };

  function mount(host, opts) {
    opts = opts || {};
    var rnd = opts.rnd || Math.random;
    var n = opts.tutorial ? 4 : 8;
    var layout = makeLayout(rnd, n);
    var L = createLogic(layout);
    var alive = true, locked = false, timers = [], t0 = performance.now(), firstFail = false, firstMatch = false;
    function later(fn, ms) { var id = setTimeout(function () { if (alive) fn(); }, ms); timers.push(id); return id; }
    function coach(k) { if (opts.tutorial && opts.setCoach) opts.setCoach(COACH[k]); }

    var P = n === 8 ? 44 : 68, TOP = 26, W = 340, H = TOP * 2 + (n - 1) * P;
    host.textContent = '';
    var help = document.createElement('p');
    help.className = 'help';
    help.textContent = opts.tutorial ? 'Latihan: sambungkan 4 kabel.' : 'Tap kabel kiri, lalu kabel kanan pasangannya. Warna baru terbuka kalau cocok.';
    host.appendChild(help);

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'cable-svg', role: 'group', 'aria-label': 'Papan kabel' });
    host.appendChild(svg);
    var wires = el('g', { class: 'wires' }, svg);
    var terms = el('g', { class: 'terms' }, svg);

    function rowY(r) { return TOP + r * P; }
    var left = [], right = [];

    function makeTerm(side, row) {
      var y = rowY(row), isL = side === 'L';
      var g = el('g', { class: 'term ' + (isL ? 'left' : 'right'), tabindex: 0, role: 'button', 'aria-label': (isL ? 'Kabel kiri ' : 'Kabel kanan ') + (row + 1) }, terms);
      var xs = isL ? 6 : W - 46;
      var xc = isL ? 46 : W - 56;
      el('rect', { class: 'copper', x: xc, y: y - 7, width: 10, height: 14, rx: 3 }, g);
      for (var s = -1; s <= 1; s++) el('line', { class: 'strand', x1: xc + (isL ? 3 : 2), y1: y + s * 3.2, x2: xc + (isL ? 10 : 7), y2: y + s * 3.2 }, g);
      el('rect', { class: 'stub', x: xs, y: y - 12, width: 40, height: 24, rx: 7 }, g);
      el('circle', { class: 'qdot', cx: xs + 20, cy: y, r: 3.2 }, g);
      var sym = el('g', { class: 'sym', transform: 'translate(' + (xs + 20) + ',' + y + ')' }, g);
      var xm = el('g', { class: 'xmark', transform: 'translate(' + (xs + 20) + ',' + y + ')' }, g);
      el('path', { d: 'M-5,-5 L5,5 M5,-5 L-5,5' }, xm);
      el('rect', { class: 'hitbox', x: isL ? 0 : W / 2 + 10, y: y - P / 2 + 1, width: W / 2 - 10, height: P - 2, fill: 'transparent' }, g);
      return { g: g, stub: g.querySelector('.stub'), sym: sym, row: row, y: y };
    }
    for (var r = 0; r < n; r++) { left.push(makeTerm('L', r)); right.push(makeTerm('R', r)); }

    function refresh() {
      for (var i = 0; i < n; i++) {
        left[i].g.classList.toggle('sel', L.sel === i);
        var showX = L.sel >= 0 && L.tried[L.sel][i] && !L.taken[i];
        right[i].g.classList.toggle('x-on', !!showX);
      }
    }
    function reveal(t, id) {
      t.stub.style.fill = COLORS[id];
      t.g.classList.add('open');
      drawSym(t.sym, SYMS[id]);
      t.g.setAttribute('aria-label', t.g.getAttribute('aria-label') + ', terhubung warna ' + NAMES[id]);
    }
    function drawWire(i, j, id) {
      var y1 = left[i].y, y2 = right[j].y;
      var d = 'M56,' + y1 + ' C140,' + y1 + ' 200,' + y2 + ' ' + (W - 56) + ',' + y2;
      var under = el('path', { class: 'wire-ink', d: d }, wires);
      var top = el('path', { class: 'wire-col', d: d, stroke: COLORS[id] }, wires);
      var len = 300;
      try { len = Math.ceil(top.getTotalLength()) + 2; } catch (e) { /* jsdom */ }
      [under, top].forEach(function (p) { p.style.strokeDasharray = len; p.style.strokeDashoffset = len; });
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { [under, top].forEach(function (p) { p.style.strokeDashoffset = 0; }); });
      });
    }

    function onLeft(i) {
      if (!alive || locked) return;
      if (L.matched[i]) return;
      if (L.select(i)) {
        if (root.KTLO && root.KTLO.Audio) root.KTLO.Audio.select();
        if (L.sel === i) coach('left'); else coach('start');
        refresh();
      }
    }
    function bump(g) { g.classList.remove('bump'); void g.getBoundingClientRect(); g.classList.add('bump'); }
    function onRight(j) {
      if (!alive || locked) return;
      var A = root.KTLO && root.KTLO.Audio;
      var res = L.tryRight(j);
      if (res.type === 'none') { coach('right'); bump(right[j].g); if (A) A.tap(); return; }
      if (res.type === 'ignore') return;
      if (res.type === 'known') { bump(right[j].g); if (A) A.tap(); return; }
      if (res.type === 'match') {
        var id = layout.ids[res.i];
        reveal(left[res.i], id); reveal(right[res.j], id); drawWire(res.i, res.j, id);
        if (A) A.pair();
        if (opts.tutorial && !firstMatch) { firstMatch = true; coach('match'); }
        refresh();
        if (L.done()) {
          locked = true;
          later(function () {
            if (opts.onSolved) opts.onSolved({ ms: performance.now() - t0, attempts: L.attempts, fails: L.fails });
          }, 750);
        }
      } else {
        locked = true;
        left[res.i].g.classList.add('fail'); right[res.j].g.classList.add('fail');
        if (A) A.bad();
        if (opts.tutorial && !firstFail) { firstFail = true; coach('fail'); }
        refresh();
        later(function () {
          left[res.i].g.classList.remove('fail', 'sel'); right[res.j].g.classList.remove('fail');
          locked = false; refresh();
        }, FAIL_LOCK);
      }
    }

    function bind(t, fn) {
      t.g.addEventListener('pointerdown', function (e) { e.preventDefault(); fn(t.row); });
      t.g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(t.row); } });
    }
    left.forEach(function (t) { bind(t, onLeft); });
    right.forEach(function (t) { bind(t, onRight); });
    coach('start');
    refresh();

    return {
      destroy: function () { alive = false; timers.forEach(clearTimeout); host.textContent = ''; },
      debug: function () { return { layout: layout, logic: L, onLeft: onLeft, onRight: onRight }; }
    };
  }

  root.KTLO = root.KTLO || {};
  root.KTLO.Cable = { mount: mount, makeLayout: makeLayout, createLogic: createLogic, FAIL_LOCK: FAIL_LOCK };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.KTLO.Cable;
})(typeof window !== 'undefined' ? window : globalThis);
