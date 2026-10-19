/* Keep The Lights On - bianglala SVG: 12 gondola, baterai, lampu, tanda seru, gerak, blackout.
 *
 * Gondola fisik (p = 0..11) punya warna atap tetap. Indeks model (i) dipetakan ke gondola fisik lewat
 * offset: p = (i + off) mod 12. Offset dipilih saat blackout supaya gondola tutorial berhenti di kanan atas
 * dan gondola "sekarat" di kiri atas, berapa pun sudut putaran saat blackout terjadi.
 */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var N = 12, CX = 200, CY = 198, R = 165, RIN = 104, GS = 1.1;
  var SPIN = 7;                                   // derajat per detik saat berputar normal
  var CANOPY = ['#F76A9B', '#5089D0', '#66C7BD', '#FFB4DA', '#A5CCFA', '#FFCBBF'];
  var STRIPE = '#FFF8E9';
  var INK = '#1b2160';

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function mod(a, n) { return ((a % n) + n) % n; }
  function ease(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function shuffled(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function starPts(cx, cy, ro, ri) {
    var pts = [];
    for (var k = 0; k < 10; k++) {
      var r = k % 2 ? ri : ro, a = -Math.PI / 2 + k * Math.PI / 5;
      pts.push((cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2));
    }
    return pts.join(' ');
  }

  function create(svg, opts) {
    opts = opts || {};
    var onTap = opts.onTap || function () {};
    var Au = root.KTLO && root.KTLO.Audio;
    var w = { phi: 0, off: 0, mode: 'spin', omega: 0, t: 0, jolt: 0, G: [], anim: null, raf: 0, last: 0, alive: true, hl: -1 };

    svg.textContent = '';
    svg.setAttribute('class', 'powered');

    /* ---------- defs ---------- */
    var defs = el('defs', null, svg);
    var rg = el('radialGradient', { id: 'halo', cx: '50%', cy: '50%', r: '50%' }, defs);
    el('stop', { offset: '0', 'stop-color': '#FEF7C5', 'stop-opacity': '0.8' }, rg);
    el('stop', { offset: '0.5', 'stop-color': '#FEF7C5', 'stop-opacity': '0.26' }, rg);
    el('stop', { offset: '1', 'stop-color': '#FEF7C5', 'stop-opacity': '0' }, rg);
    var cp = el('clipPath', { id: 'roofClip' }, defs);
    el('path', { d: 'M-25,22 L-21,13 Q0,5 21,13 L25,22 Z' }, cp);

    /* ---------- kaki penyangga ---------- */
    var legs = el('g', { class: 'legs' }, svg);
    var FL = { x: 112, y: 452 }, FR = { x: 288, y: 452 };
    el('rect', { class: 'plate', x: 82, y: 448, width: 236, height: 18, rx: 9 }, legs);
    [[CX, CY, FL.x, FL.y], [CX, CY, FR.x, FR.y]].forEach(function (L) {
      el('line', { class: 'leg-out', x1: L[0], y1: L[1], x2: L[2], y2: L[3] }, legs);
      el('line', { class: 'leg-in', x1: L[0], y1: L[1], x2: L[2], y2: L[3] }, legs);
    });
    [300, 372].forEach(function (y) {
      var t = (y - CY) / (FL.y - CY);
      el('line', { class: 'brace', x1: CX - (CX - FL.x) * t, y1: y, x2: CX + (FR.x - CX) * t, y2: y }, legs);
    });
    for (var s = 0; s < 2; s++) {
      for (var k = 0; k < 8; k++) {
        var t2 = 0.2 + k * 0.105, F = s ? FR : FL;
        el('circle', { class: 'leg-bulb c' + (k % 3), cx: (CX + (F.x - CX) * t2).toFixed(1), cy: (CY + (F.y - CY) * t2).toFixed(1), r: 3.3 }, legs);
      }
    }

    /* ---------- roda (berputar) ---------- */
    var wheelG = el('g', { class: 'wheel-rot' }, svg);
    el('circle', { class: 'ring-out', cx: CX, cy: CY, r: R }, wheelG);
    el('circle', { class: 'ring-in', cx: CX, cy: CY, r: RIN }, wheelG);
    for (var q = 0; q < N; q++) {
      var a = q * 30 * Math.PI / 180;
      el('line', { class: 'spoke', x1: CX, y1: CY, x2: (CX + R * Math.sin(a)).toFixed(1), y2: (CY - R * Math.cos(a)).toFixed(1) }, wheelG);
      [-15, 15].forEach(function (da) {
        var b = (q * 30 + da) * Math.PI / 180;
        el('line', {
          class: 'strut',
          x1: (CX + R * Math.sin(a)).toFixed(1), y1: (CY - R * Math.cos(a)).toFixed(1),
          x2: (CX + RIN * Math.sin(b)).toFixed(1), y2: (CY - RIN * Math.cos(b)).toFixed(1)
        }, wheelG);
      });
    }
    for (var r2 = 0; r2 < 36; r2++) {
      var ra = r2 * 10 * Math.PI / 180;
      var cc = el('circle', { class: 'rim-bulb c' + (r2 % 3), cx: (CX + R * Math.sin(ra)).toFixed(1), cy: (CY - R * Math.cos(ra)).toFixed(1), r: 3.4 }, wheelG);
      cc.style.animationDelay = (r2 * 0.09).toFixed(2) + 's';
    }
    for (var pv = 0; pv < N; pv++) {
      var pa = pv * 30 * Math.PI / 180;
      el('circle', { class: 'pivot', cx: (CX + R * Math.sin(pa)).toFixed(1), cy: (CY - R * Math.cos(pa)).toFixed(1), r: 5.5 }, wheelG);
    }

    /* ---------- hub ---------- */
    var hub = el('g', { class: 'hub' }, svg);
    el('circle', { class: 'hub-out', cx: CX, cy: CY, r: 26 }, hub);
    el('circle', { class: 'hub-core', cx: CX, cy: CY, r: 17 }, hub);
    var star = el('polygon', { class: 'hub-star', points: starPts(CX, CY, 11, 4.6) }, hub);

    /* ---------- gondola ---------- */
    var gl = el('g', { class: 'gondolas' }, svg);

    function buildGondola(p) {
      var col = CANOPY[p % CANOPY.length];
      var g = el('g', { class: 'gond b-hi', 'data-p': p, tabindex: 0, role: 'button' }, gl);
      var pos = el('g', { class: 'gpos' }, g);
      el('circle', { class: 'halo', cx: 0, cy: 28, r: 54, fill: 'url(#halo)' }, pos);
      var sway = el('g', { class: 'gsway' }, pos);
      el('line', { class: 'hanger', x1: 0, y1: 0, x2: 0, y2: 9 }, sway);
      var roof = el('g', { 'clip-path': 'url(#roofClip)', class: 'roof' }, sway);
      for (var k = 0; k < 5; k++) {
        el('rect', { x: -25 + k * 10, y: 3, width: 10, height: 22, fill: k % 2 ? STRIPE : col }, roof);
      }
      el('path', { class: 'roof-line', d: 'M-25,22 L-21,13 Q0,5 21,13 L25,22 Z', fill: 'none' }, sway);
      for (var k2 = 0; k2 < 5; k2++) {
        el('circle', { class: 'scallop', cx: -20 + k2 * 10, cy: 22, r: 5, fill: k2 % 2 ? STRIPE : col }, sway);
      }
      el('circle', { class: 'finial', cx: 0, cy: 6, r: 2.4 }, sway);
      el('rect', { class: 'cabin', x: -18, y: 25, width: 36, height: 28, rx: 5 }, sway);
      el('rect', { class: 'win', x: -14, y: 29, width: 12, height: 10, rx: 2.5 }, sway);
      el('rect', { class: 'win', x: 2, y: 29, width: 12, height: 10, rx: 2.5 }, sway);
      el('circle', { class: 'bulb', cx: 0, cy: 25, r: 3.8 }, sway);
      el('rect', { class: 'bat-bg', x: -15, y: 43, width: 30, height: 7, rx: 3.5 }, sway);
      var fill = el('rect', { class: 'bat-fill', x: -13.5, y: 44.5, width: 27, height: 4, rx: 2 }, sway);
      el('circle', { class: 'hl', cx: 0, cy: 28, r: 37 }, sway);
      var badge = el('g', { class: 'badge', transform: 'translate(20,9)' }, sway);
      var bi = el('g', { class: 'badge-in' }, badge);
      el('circle', { class: 'badge-dot', r: 8.5 }, bi);
      el('rect', { class: 'badge-mark', x: -1.4, y: -5, width: 2.8, height: 6.2, rx: 1.4 }, bi);
      el('circle', { class: 'badge-mark', cx: 0, cy: 4.4, r: 1.6 }, bi);
      el('circle', { class: 'hit', cx: 0, cy: 28, r: 38, fill: 'transparent' }, pos);

      var G = { p: p, g: g, pos: pos, sway: sway, fill: fill, lit: false, b: 1, cls: 'b-hi' };
      g.addEventListener('click', function () { onTap(mod(p - w.off, N)); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(mod(p - w.off, N)); }
      });
      return G;
    }
    for (var p = 0; p < N; p++) w.G.push(buildGondola(p));

    /* ---------- helpers ---------- */
    function phys(i) { return mod(i + w.off, N); }
    function label(G) {
      var i = mod(G.p - w.off, N) + 1;
      var n = (i < 10 ? '0' : '') + i;
      G.g.setAttribute('aria-label', 'Gondola ' + n + (G.lit ? ', lampu menyala' : ', lampu mati, tap untuk memperbaiki'));
    }
    function setLitP(p, on, fx) {
      var G = w.G[p];
      if (G.lit === on) { return; }
      G.lit = on;
      G.g.classList.toggle('lit', on);
      if (!on && fx !== false) {
        G.g.classList.add('flick');
        setTimeout(function () { G.g.classList.remove('flick'); }, 700);
      }
      if (!on) setBatP(p, 0, 120);
      label(G);
    }
    function setBatP(p, b, ms) {
      var G = w.G[p];
      b = Math.max(0, Math.min(1, b));
      G.b = b;
      G.fill.style.transitionDuration = (ms == null ? 250 : ms) + 'ms';
      G.fill.style.transform = 'scaleX(' + Math.max(0.0001, b) + ')';
      var cls = !G.lit && b <= 0 ? 'b-off' : (b > 0.5 ? 'b-hi' : (b > 0.22 ? 'b-mid' : 'b-low'));
      if (cls !== G.cls) {
        G.g.classList.remove('b-hi', 'b-mid', 'b-low', 'b-off');
        G.g.classList.add(cls);
        G.cls = cls;
      }
    }

    /* ---------- API ---------- */
    w.phys = phys;
    w.setLit = function (i, on, fx) { setLitP(phys(i), on, fx); };
    w.setBattery = function (i, b, ms) { setBatP(phys(i), b, ms); };
    w.setMode = function (m) { w.mode = m; if (m !== 'spin') w.omega = 0; };
    w.setPower = function (on) { svg.classList.toggle('powered', !!on); };
    w.showBadges = function (on) { svg.classList.toggle('badges', !!on); };
    w.highlight = function (i) {
      w.hl = i;
      w.G.forEach(function (G) { G.g.classList.remove('hl-on'); });
      if (i >= 0) w.G[phys(i)].g.classList.add('hl-on');
    };
    w.moveTo = function (deg, ms) {
      return new Promise(function (res) { w.anim = { from: w.phi, to: deg, t0: w.t, dur: ms / 1000, res: res }; });
    };

    /** Semua gondola menyala dengan baterai acak (keadaan sebelum blackout). */
    w.resetAll = function () {
      w.off = 0;
      w.anim = null;
      w.G.forEach(function (G) {
        G.lit = false; G.g.classList.remove('flick');
        setLitP(G.p, true, false);
        setBatP(G.p, 0.55 + Math.random() * 0.45, 0);
        label(G);
      });
      w.showBadges(false);
      w.highlight(-1);
      w.setPower(true);
    };

    /** Samakan tampilan dengan model (lampu, baterai). */
    w.sync = function (m, ms) {
      for (var i = 0; i < N; i++) {
        var g = m.g[i];
        setLitP(phys(i), g.lit, true);
        setBatP(phys(i), g.lit ? g.b : 0, ms == null ? 300 : ms);
      }
    };

    /**
     * Urutan blackout: roda tersendat 3 kali lalu berhenti, lampu padam satu per satu dengan baterai
     * turun dari level berbeda-beda. Yang tersisa: gondola "sekarat" (ctx.dying) dengan baterai tipis.
     * ctx = { tut, dying, dyingLevel }. Mengembalikan offset yang dipakai.
     */
    w.blackout = async function (ctx) {
      w.setMode('stutter');
      var c0 = Math.ceil(w.phi / 30 - 1e-6);
      var phiStop = (c0 + 3) * 30;
      var pT = mod((60 - phiStop) / 30, N);
      w.off = mod(pT - ctx.tut, N);
      var pD = mod(ctx.dying + w.off, N);

      // baterai awal beda-beda tiap gondola
      w.G.forEach(function (G) {
        G.g.classList.remove('flick');
        setLitP(G.p, true, false);
        setBatP(G.p, G.p === pD ? 0.62 : 0.3 + Math.random() * 0.7, 0);
        label(G);
      });
      await wait(60);

      var motion = (async function () {
        var durs = [800, 1100, 1500];
        for (var k = 1; k <= 3; k++) {
          await wait(k === 1 ? 250 : 520);
          if (Au) Au.clunk();
          w.jolt = 7;
          await w.moveTo((c0 + k) * 30, durs[k - 1]);
          w.jolt = 7;
        }
      })();

      var lights = (async function () {
        await wait(900);
        svg.classList.add('pw-flicker');
        await wait(650);
        svg.classList.remove('pw-flicker');
        w.setPower(false);
        if (Au) Au.lightOff();
        var order = shuffled(w.G.map(function (G) { return G.p; }).filter(function (p) { return p !== pD; }));
        for (var n = 0; n < order.length; n++) {
          var p = order[n];
          await wait(240 + Math.random() * 160);
          setBatP(p, 0, 420);
          (function (pp) {
            setTimeout(function () { if (!w.alive) return; setLitP(pp, false, true); if (Au) Au.blip(); }, 440);
          })(p);
        }
        await wait(700);
        setBatP(pD, ctx.dyingLevel, 1600);
      })();

      await Promise.all([motion, lights]);
      await wait(500);
      w.phi = phiStop;
      w.setMode('stop');
      return w.off;
    };

    /* ---------- loop ---------- */
    function frame(ts) {
      if (!w.alive) return;
      var dt = w.last ? Math.min(0.1, (ts - w.last) / 1000) : 0.016;
      w.last = ts;
      w.t += dt;

      if (w.anim) {
        var a = w.anim, k = (w.t - a.t0) / a.dur;
        if (k >= 1) { w.phi = a.to; w.anim = null; a.res(); }
        else w.phi = a.from + (a.to - a.from) * ease(k);
      } else if (w.mode === 'spin') {
        w.omega += (SPIN - w.omega) * Math.min(1, dt * 0.9);
        w.phi += w.omega * dt;
      }
      w.jolt *= Math.max(0, 1 - dt * 2.4);

      wheelG.setAttribute('transform', 'rotate(' + w.phi.toFixed(2) + ' ' + CX + ' ' + CY + ')');
      star.setAttribute('transform', 'rotate(' + (-w.phi * 1.6).toFixed(2) + ' ' + CX + ' ' + CY + ')');

      var amp = w.mode === 'spin' ? 1.6 : 2.4;
      for (var p = 0; p < N; p++) {
        var G = w.G[p];
        var ang = (p * 30 + w.phi) * Math.PI / 180;
        var x = CX + R * Math.sin(ang), y = CY - R * Math.cos(ang);
        var sw = amp * Math.sin(w.t * 1.25 + p * 0.9) + w.jolt * Math.sin(w.t * 9 + p);
        G.pos.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(' + GS + ')');
        G.sway.setAttribute('transform', 'rotate(' + sw.toFixed(2) + ')');
      }
      w.raf = requestAnimationFrame(frame);
    }
    w.raf = requestAnimationFrame(frame);

    w.destroy = function () { w.alive = false; cancelAnimationFrame(w.raf); };
    w.resetAll();
    return w;
  }

  root.KTLO = root.KTLO || {};
  root.KTLO.Wheel = { create: create, N: N };
})(typeof window !== 'undefined' ? window : globalThis);
