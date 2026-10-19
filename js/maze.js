/* Mini game 3: Alirkan Cahaya (maze cahaya).
 *
 * Grid kecil berisi lorong. Colokan di sisi atas (awal) dan bawah (tujuan). Pemain menggeser jari dari
 * awal ke tujuan lewat lorong yang benar. Cahaya mengalir mengikuti jari dengan kecepatan terbatas
 * (SPEED sel/detik), jadi ada batas bawah durasi tanpa terasa lag. Cahaya tetap menyala kalau jari
 * diangkat; sentuh kepala cahaya (atau bagian jalur mana pun) untuk lanjut / mundur.
 *
 * Maze dibangkitkan dengan DFS yang condong lurus (lorong panjang), lalu dipilih yang jalur solusinya
 * panjang dan punya banyak cabang buntu, supaya ada yang perlu dicoba-coba. Beda tiap main.
 */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var COLS = 10, ROWS = 8;
  var STRAIGHT = 0.62;            // peluang lanjut lurus saat membangkitkan lorong
  var MIN_LEN = 40, MAX_LEN = 54; // panjang jalur solusi (jumlah sel)
  var MIN_BRANCH = 5;             // minimal simpang di jalur solusi
  var SPEED = 4.8;                // sel/detik, kecepatan cahaya maju
  var BACK_SPEED = 24;            // sel/detik, kecepatan cahaya mundur
  var CAP = 0.6;                  // radius tangkap (dalam satuan P) agar jari tidak mudah keluar jalur

  var DIRS = [
    { dx: 0, dy: -1, bit: 1, opp: 4 },
    { dx: 1, dy: 0, bit: 2, opp: 8 },
    { dx: 0, dy: 1, bit: 4, opp: 1 },
    { dx: -1, dy: 0, bit: 8, opp: 2 }
  ];

  function carve(rnd, cols, rows, straight) {
    var links = new Uint8Array(cols * rows), seen = new Uint8Array(cols * rows);
    var stack = [{ i: 0, dir: -1 }];
    seen[0] = 1;
    while (stack.length) {
      var top = stack[stack.length - 1];
      var c = top.i % cols, r = (top.i / cols) | 0, opts = [];
      for (var d = 0; d < 4; d++) {
        var nx = c + DIRS[d].dx, ny = r + DIRS[d].dy;
        if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[ny * cols + nx]) opts.push(d);
      }
      if (!opts.length) { stack.pop(); continue; }
      var dd = (top.dir >= 0 && opts.indexOf(top.dir) >= 0 && rnd() < straight) ? top.dir : opts[(rnd() * opts.length) | 0];
      var n = (r + DIRS[dd].dy) * cols + (c + DIRS[dd].dx);
      links[top.i] |= DIRS[dd].bit; links[n] |= DIRS[dd].opp; seen[n] = 1;
      stack.push({ i: n, dir: dd });
    }
    return links;
  }

  function neighbors(links, cols, i) {
    var out = [], c = i % cols, r = (i / cols) | 0;
    for (var d = 0; d < 4; d++) if (links[i] & DIRS[d].bit) out.push((r + DIRS[d].dy) * cols + (c + DIRS[d].dx));
    return out;
  }

  /** Jalur (daftar indeks sel) dari a ke b; di perfect maze jalurnya unik. */
  function pathBetween(links, cols, rows, a, b) {
    var prev = new Int32Array(cols * rows).fill(-2), q = [a]; prev[a] = -1;
    for (var h = 0; h < q.length; h++) {
      var cur = q[h];
      if (cur === b) break;
      var nb = neighbors(links, cols, cur);
      for (var k = 0; k < nb.length; k++) if (prev[nb[k]] === -2) { prev[nb[k]] = cur; q.push(nb[k]); }
    }
    if (prev[b] === -2) return null;
    var p = [];
    for (var x = b; x !== -1; x = prev[x]) p.push(x);
    return p.reverse();
  }

  function analyze(links, cols, path) {
    var dead = 0, branch = 0, i;
    for (i = 0; i < links.length; i++) { if (neighbors(links, cols, i).length === 1) dead++; }
    for (i = 1; i < path.length - 1; i++) if (neighbors(links, cols, path[i]).length >= 3) branch++;
    return { len: path.length, dead: dead, branch: branch };
  }

  function generate(rnd, cols, rows, o) {
    o = o || {};
    cols = cols || COLS; rows = rows || ROWS;
    var minLen = o.minLen || MIN_LEN, maxLen = o.maxLen || MAX_LEN, minBranch = o.minBranch || MIN_BRANCH;
    var best = null, bestScore = -1e9;
    for (var t = 0; t < 600; t++) {
      var links = carve(rnd, cols, rows, o.straight != null ? o.straight : STRAIGHT);
      var flip = rnd() < 0.5;
      var start = flip ? cols - 1 : 0, end = flip ? (rows - 1) * cols : rows * cols - 1;
      var path = pathBetween(links, cols, rows, start, end);
      if (!path) continue;
      var a = analyze(links, cols, path);
      var ok = a.len >= minLen && a.len <= maxLen && a.branch >= minBranch;
      var score = -Math.abs(a.len - (minLen + maxLen) / 2) + a.branch * 1.5;
      if (ok) return { cols: cols, rows: rows, links: links, start: start, end: end, solution: path, info: a, tries: t + 1 };
      if (score > bestScore) { bestScore = score; best = { cols: cols, rows: rows, links: links, start: start, end: end, solution: path, info: a, tries: t + 1 }; }
    }
    return best;
  }

  /* ---------------- DOM ---------------- */
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function mount(host, opts) {
    opts = opts || {};
    var rnd = opts.rnd || Math.random;
    var M = generate(rnd, COLS, ROWS);
    var cols = M.cols, rows = M.rows, links = M.links;
    var P = 30, MX = 14, TOPM = 30, BOTM = 30;
    var W = cols * P + MX * 2, H = rows * P + TOPM + BOTM;
    var alive = true, dragging = false, done = false, dirty = true, t0 = performance.now(), backtracks = 0;
    var A = root.KTLO && root.KTLO.Audio;
    var timers = [];
    function later(fn, ms) { var id = setTimeout(function () { if (alive) fn(); }, ms); timers.push(id); return id; }

    host.textContent = '';
    var help = document.createElement('p'); help.className = 'help';
    help.textContent = 'Geser jarimu dari colokan atas sampai colokan bawah lewat lorong yang benar.';
    host.appendChild(help);
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'maze-svg', role: 'img', 'aria-label': 'Maze cahaya: geser dari colokan atas ke colokan bawah' });
    host.appendChild(svg);

    function cx(i) { return MX + (i % cols) * P + P / 2; }
    function cy(i) { return TOPM + ((i / cols) | 0) * P + P / 2; }

    var linkG = el('g', { class: 'm-links' }, svg), nodeG = el('g', { class: 'm-nodes' }, svg);
    var linkEl = {}, nodeEl = [];
    function key(a, b) { return a < b ? a + '-' + b : b + '-' + a; }
    for (var i = 0; i < cols * rows; i++) {
      var nb = neighbors(links, cols, i);
      for (var k = 0; k < nb.length; k++) {
        var j = nb[k];
        if (j < i) continue;
        var horizontal = j === i + 1;
        linkEl[key(i, j)] = el('rect', {
          class: 'm-link',
          x: horizontal ? cx(i) : cx(i) - 4, y: horizontal ? cy(i) - 4 : cy(i),
          width: horizontal ? P : 8, height: horizontal ? 8 : P, rx: 3
        }, linkG);
      }
    }
    for (i = 0; i < cols * rows; i++) nodeEl.push(el('rect', { class: 'm-node', x: cx(i) - 10, y: cy(i) - 10, width: 20, height: 20, rx: 6 }, nodeG));

    // colokan awal (atas) dan tujuan (bawah)
    var sx = cx(M.start), sy = cy(M.start), ex = cx(M.end), ey = cy(M.end);
    var plugS = el('g', { class: 'plug start' }, svg);
    el('line', { class: 'plug-wire', x1: sx, y1: sy - 10, x2: sx, y2: TOPM - 10 }, plugS);
    el('rect', { class: 'plug-body', x: sx - 11, y: 2, width: 22, height: 17, rx: 5 }, plugS);
    el('rect', { class: 'plug-prong', x: sx - 6, y: TOPM - 14, width: 3.5, height: 6, rx: 1 }, plugS);
    el('rect', { class: 'plug-prong', x: sx + 2.5, y: TOPM - 14, width: 3.5, height: 6, rx: 1 }, plugS);
    var plugE = el('g', { class: 'plug end' }, svg);
    el('line', { class: 'plug-wire', x1: ex, y1: ey + 10, x2: ex, y2: H - BOTM + 12 }, plugE);
    el('circle', { class: 'plug-ring', cx: ex, cy: H - 14, r: 13 }, plugE);
    el('circle', { class: 'plug-core', cx: ex, cy: H - 14, r: 6 }, plugE);
    var spark = el('circle', { class: 'm-spark', r: 7, cx: sx, cy: sy }, svg);

    // keadaan jalur
    var path = [M.start], L = 0;
    var nodeOn = new Uint8Array(cols * rows), linkOn = {};

    function pt(e) {
      var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
      return p.matrixTransform(svg.getScreenCTM().inverse());
    }
    function dist(q, i) { var dx = q.x - cx(i), dy = q.y - cy(i); return Math.sqrt(dx * dx + dy * dy); }

    function advance(q) {
      var guard = 0, changed = true;
      while (changed && guard++ < 8) {
        changed = false;
        var head = path[path.length - 1];
        if (path.length > 1) {
          var prev = path[path.length - 2];
          if (dist(q, prev) < CAP * P && dist(q, prev) < dist(q, head)) { path.pop(); backtracks++; dirty = true; changed = true; continue; }
        }
        var nb = neighbors(links, cols, head), prv = path.length > 1 ? path[path.length - 2] : -1;
        for (var k = 0; k < nb.length; k++) {
          if (nb[k] !== prv && dist(q, nb[k]) < CAP * P) { path.push(nb[k]); dirty = true; changed = true; if (A) A.blip(); break; }
        }
      }
    }

    var last = null;
    svg.addEventListener('pointerdown', function (e) {
      if (done) return;
      var q = pt(e), hit = -1, k;
      for (k = path.length - 1; k >= 0; k--) if (dist(q, path[k]) < 0.8 * P) { hit = k; break; }
      if (hit < 0 && path.length === 1) {
        var dx = q.x - sx, dy = q.y - (TOPM / 2);
        if (Math.sqrt(dx * dx + dy * dy) < P) hit = 0;
      }
      if (hit < 0) return;
      if (hit < path.length - 1) { path.length = hit + 1; backtracks++; dirty = true; }
      dragging = true; last = q;
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* abaikan */ }
      e.preventDefault();
    });
    svg.addEventListener('pointermove', function (e) {
      if (!dragging || done) return;
      var q = pt(e);
      var steps = Math.max(1, Math.ceil(Math.hypot(q.x - last.x, q.y - last.y) / (P * 0.25)));
      for (var s = 1; s <= steps; s++) advance({ x: last.x + (q.x - last.x) * s / steps, y: last.y + (q.y - last.y) * s / steps });
      last = q;
      e.preventDefault();
    });
    function up() { dragging = false; }
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('lostpointercapture', up);

    /* ---- loop: cahaya mengalir ---- */
    var raf = 0, lastTs = 0;
    function render() {
      var target = path.length - 1;
      var lit = Math.floor(L + 1e-6), halfLit = Math.floor(L + 0.5);
      var i2, k2;
      var want = new Uint8Array(cols * rows);
      for (i2 = 0; i2 <= lit && i2 < path.length; i2++) want[path[i2]] = 1;
      for (i2 = 0; i2 < nodeOn.length; i2++) {
        if (want[i2] !== nodeOn[i2]) { nodeOn[i2] = want[i2]; nodeEl[i2].classList.toggle('on', !!want[i2]); }
      }
      var wantL = {};
      for (k2 = 0; k2 < halfLit && k2 < path.length - 1; k2++) wantL[key(path[k2], path[k2 + 1])] = 1;
      for (var kk in linkEl) {
        var w2 = wantL[kk] ? 1 : 0;
        if ((linkOn[kk] || 0) !== w2) { linkOn[kk] = w2; linkEl[kk].classList.toggle('on', !!w2); }
      }
      // percikan di ujung cahaya
      var ix = Math.min(Math.floor(L), path.length - 1), fr = Math.min(1, L - ix), a = path[ix], b = path[Math.min(ix + 1, path.length - 1)];
      spark.setAttribute('cx', (cx(a) + (cx(b) - cx(a)) * fr).toFixed(1));
      spark.setAttribute('cy', (cy(a) + (cy(b) - cy(a)) * fr).toFixed(1));
      plugS.classList.toggle('on', true);
      plugE.classList.toggle('on', path[path.length - 1] === M.end && L >= target - 0.01);
    }
    function frame(ts) {
      if (!alive) return;
      var dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0.016; lastTs = ts;
      var target = path.length - 1;
      var nl = L;
      if (L < target) nl = Math.min(target, L + SPEED * dt);
      else if (L > target) nl = Math.max(target, L - BACK_SPEED * dt);
      if (nl !== L || dirty) { L = nl; dirty = false; render(); }
      if (!done && path[path.length - 1] === M.end && L >= target - 1e-6) {
        done = true; dragging = false;
        svg.classList.add('won');
        if (A) A.pair();
        later(function () {
          if (opts.onSolved) opts.onSolved({ ms: performance.now() - t0, backtracks: backtracks, len: M.info.len });
        }, 800);
      }
      raf = requestAnimationFrame(frame);
    }
    render();
    raf = requestAnimationFrame(frame);

    return {
      destroy: function () { alive = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); host.textContent = ''; },
      debug: function () { return { maze: M, path: path, setPath: function (p) { path = p.slice(); dirty = true; }, get L() { return L; } }; }
    };
  }

  root.KTLO = root.KTLO || {};
  root.KTLO.Maze = {
    mount: mount, generate: generate, pathBetween: pathBetween, neighbors: neighbors, analyze: analyze,
    carve: carve, SPEED: SPEED, COLS: COLS, ROWS: ROWS, DIRS: DIRS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.KTLO.Maze;
})(typeof window !== 'undefined' ? window : globalThis);
