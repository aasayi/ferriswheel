/* Keep The Lights On - lapisan UI: layar, dialog Asayi, toast, modal puzzle, latar langit, pemandangan ending, tiket. */
(function (root) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var SVGNS = 'http://www.w3.org/2000/svg';
  var userName = '';
  var app = null;

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------------- layar & fase ---------------- */
  var SCREENS = ['login', 'title', 'over', 'ride', 'ticket'];
  function showScreen(name, keep) {
    SCREENS.forEach(function (s) {
      var e = $('screen-' + s);
      if (!e) return;
      var show = s === name || (keep && s === keep);
      e.classList.toggle('hidden', !show);
      if (show && !e.dataset.shown) { e.dataset.shown = '1'; }
      if (show) { e.classList.remove('enter'); void e.offsetWidth; e.classList.add('enter'); }
    });
  }
  function setPhase(p) { app.dataset.phase = p; }
  function setName(n) { userName = n; var h = $('helloName'); if (h) h.textContent = n; }

  /* ---------------- dialog ---------------- */
  var dlgPending = null;
  function fmt(s) { return String(s).replace(/\{name\}/g, userName || 'kamu'); }

  function dialogShow() {
    var d = $('dialog');
    d.classList.remove('hidden');
    app.dataset.dialog = 'open';
    void d.offsetWidth;
    d.classList.add('in');
  }
  function dialogHide() {
    return new Promise(function (res) {
      var d = $('dialog');
      d.classList.remove('in');
      app.dataset.dialog = 'closed';
      setTimeout(function () { d.classList.add('hidden'); res(); }, 420);
    });
  }
  function say(lines, o) {
    o = o || {};
    if (dlgPending) dlgPending.cancel();
    return new Promise(function (resolve) {
      var box = $('dlgBox'), text = $('dlgText'), btn = $('dlgBtn');
      var i = 0, typing = false, timer = null, full = '', done = false, started = false;
      var Au = root.KTLO && root.KTLO.Audio;
      box.classList.remove('ready'); text.style.minHeight = ''; text.textContent = ''; btn.textContent = '...';
      dialogShow();

      function label() { btn.textContent = i === lines.length - 1 ? (o.last || 'Oke') : 'Lanjut'; }
      function finishTyping() {
        clearInterval(timer); typing = false; text.textContent = full; box.classList.add('ready'); label();
      }
      function showLine() {
        started = true;
        full = fmt(lines[i]);
        text.style.minHeight = '';
        text.textContent = full;
        text.style.minHeight = text.offsetHeight + 'px';
        text.textContent = '';
        typing = true; box.classList.remove('ready');
        btn.textContent = '...';
        var k = 0;
        clearInterval(timer);
        timer = setInterval(function () {
          k += 1;
          text.textContent = full.slice(0, k);
          if (k % 3 === 0 && Au) Au.pop();
          if (k >= full.length) finishTyping();
        }, 20);
      }
      function cleanup() {
        done = true; clearInterval(timer);
        box.removeEventListener('click', advance);
        document.removeEventListener('keydown', onKey);
        dlgPending = null;
      }
      function advance(e) {
        if (e) e.preventDefault();
        if (done || !started) return;
        if (Au) Au.tap();
        if (typing) { finishTyping(); return; }
        i++;
        if (i >= lines.length) { cleanup(); resolve(); return; }
        showLine();
      }
      function onKey(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          if ($('modal') && !$('modal').classList.contains('hidden')) return;
          advance(e);
        }
      }
      dlgPending = { cancel: function () { if (!done) { cleanup(); resolve(); } } };
      box.addEventListener('click', advance);
      document.addEventListener('keydown', onKey);
      setTimeout(showLine, o.delay == null ? 380 : o.delay);
    });
  }

  /* ---------------- hint, toast ---------------- */
  function hint(text) {
    var h = $('hint');
    if (!h) return;
    if (!text) { h.classList.add('hidden'); return; }
    h.textContent = text;
    h.classList.remove('hidden');
  }
  function toast(text, ms) {
    var box = $('toasts');
    if (!box) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    box.appendChild(t);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320); }, ms || 2400);
  }

  /* ---------------- HUD ---------------- */
  var hud = {
    show: function (mode) { var h = $('hud'); h.classList.toggle('hidden', mode === 'off'); h.classList.toggle('only-sound', mode === 'sound'); },
    setLit: function (n, total) {
      var t = $('litText'); if (!t) return;
      var s = n + '/' + total;
      if (t.textContent !== s) {
        t.textContent = s;
        var p = $('litPill'); p.classList.remove('pulse'); void p.offsetWidth; p.classList.add('pulse');
      }
    }
  };

  /* ---------------- modal puzzle ---------------- */
  var chips = [];
  var modal = {
    open: function (o) {
      $('puzTag').textContent = o.tag;
      $('puzTitle').textContent = o.title;
      var c = $('coach');
      c.classList.toggle('hidden', !o.coach);
      $('coachText').textContent = '';
      var ov = $('overview');
      ov.classList.toggle('hidden', !!o.noOverview);
      ov.textContent = '';
      chips = [];
      for (var i = 0; i < 12; i++) {
        var ch = document.createElement('span'); ch.className = 'chip';
        var f = document.createElement('i'); ch.appendChild(f);
        ov.appendChild(ch); chips.push({ el: ch, fill: f });
      }
      var host = $('puzzleHost'); host.textContent = '';
      $('modal').classList.remove('hidden');
      app.dataset.modal = 'open';
      return host;
    },
    close: function () {
      $('modal').classList.add('hidden');
      $('puzzleHost').textContent = '';
      app.dataset.modal = 'closed';
    },
    isOpen: function () { return !$('modal').classList.contains('hidden'); },
    setCoach: function (t) {
      var el = $('coachText'); if (!el) return;
      el.textContent = t || '';
      var c = $('coach'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
    },
    overview: function (m, active) {
      if (!chips.length || !m) return;
      for (var i = 0; i < 12; i++) {
        var g = m.g[i], c = chips[i];
        c.el.classList.toggle('lit', g.lit);
        c.el.classList.toggle('dark', !g.lit);
        c.el.classList.toggle('low', g.lit && g.b < 0.22);
        c.el.classList.toggle('act', i === active);
        c.fill.style.transform = 'scaleX(' + Math.max(0, g.lit ? g.b : 0) + ')';
      }
    }
  };

  /* ---------------- langit malam + taman ---------------- */
  function buildSky() {
    var sky = $('sky'); sky.textContent = '';
    var r = rng(7);
    var i, s;
    for (i = 0; i < 52; i++) {
      s = document.createElement('span');
      s.className = 'star s' + (i % 3);
      var size = 4 + r() * 8;
      s.style.cssText = 'left:' + (r() * 100).toFixed(1) + '%;top:' + (r() * 58).toFixed(1) + '%;width:' + size.toFixed(1) + 'px;height:' + size.toFixed(1) + 'px;animation-delay:' + (r() * 5).toFixed(2) + 's;animation-duration:' + (2.6 + r() * 3).toFixed(1) + 's';
      sky.appendChild(s);
    }
    var moon = document.createElement('div'); moon.className = 'moon'; moon.innerHTML = '<i></i>';
    sky.appendChild(moon);
    [['12%', 1.1, 90], ['58%', 0.8, 120], ['34%', 0.6, 150]].forEach(function (c, k) {
      var cl = document.createElement('div'); cl.className = 'cloud';
      cl.style.cssText = 'top:' + c[0] + ';transform:scale(' + c[1] + ');animation-duration:' + c[2] + 's;animation-delay:-' + (k * 37) + 's';
      sky.appendChild(cl);
    });
    sky.insertAdjacentHTML('beforeend', PARK);
  }

  var PARK = (function () {
    var r = rng(11), o = '';
    o += '<svg class="park" viewBox="0 0 800 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true">';
    o += '<path d="M0,128 Q130,78 280,118 T560,106 T800,122 V220 H0Z" fill="#24358f"/>';
    o += '<g fill="none" stroke="#3447a8" stroke-width="3" stroke-linecap="round"><path d="M470,138 Q505,52 545,122 T620,100 T700,132 T770,92"/>';
    o += '<path d="M492,96 V138 M545,122 V142 M583,112 V140 M620,100 V138 M668,118 V140 M722,116 V140" stroke-width="2"/></g>';
    o += '<path d="M0,158 Q110,126 230,154 T450,148 T650,158 T800,144 V220 H0Z" fill="#1b2780"/>';
    var tents = [[70, '#F76A9B'], [170, '#66C7BD'], [338, '#FFB4DA'], [612, '#A5CCFA'], [736, '#F76A9B']];
    tents.forEach(function (t) {
      var x = t[0], y = 164;
      o += '<g opacity=".7"><path d="M' + (x - 30) + ',' + y + ' L' + x + ',' + (y - 36) + ' L' + (x + 30) + ',' + y + ' Z" fill="' + t[1] + '"/>';
      o += '<path d="M' + (x - 10) + ',' + y + ' L' + x + ',' + (y - 36) + ' L' + (x + 10) + ',' + y + ' Z" fill="#FFF8E9" opacity=".8"/>';
      o += '<line x1="' + x + '" y1="' + (y - 36) + '" x2="' + x + '" y2="' + (y - 46) + '" stroke="#FFF8E9" stroke-width="2"/>';
      o += '<path d="M' + x + ',' + (y - 46) + ' l11,4 l-11,4Z" fill="' + t[1] + '"/></g>';
    });
    // pohon
    [30, 120, 250, 300, 410, 440, 560, 660, 700, 780].forEach(function (x) {
      var y = 170 + r() * 12, s = 12 + r() * 8;
      o += '<g fill="#1f3a8a" opacity=".95"><rect x="' + (x - 2) + '" y="' + y + '" width="4" height="12"/><circle cx="' + x + '" cy="' + (y - 2) + '" r="' + s + '"/><circle cx="' + (x + s * 0.7) + '" cy="' + (y + 4) + '" r="' + (s * 0.7) + '"/></g>';
    });
    // lampu jalan + tali lampu
    o += '<path d="M0,112 Q100,146 200,112 T400,112 T600,112 T800,112" fill="none" stroke="#3a4cae" stroke-width="1.6"/>';
    for (var i = 0; i <= 16; i++) {
      var x2 = i * 50, y2 = 112 + (i % 2 ? 17 : 1) * 0 + Math.sin(i * Math.PI) * 0;
      var yy = 112 + 17 * Math.sin(((x2 % 200) / 200) * Math.PI);
      o += '<circle class="park-bulb c' + (i % 3) + '" cx="' + x2 + '" cy="' + yy.toFixed(1) + '" r="3.4" style="animation-delay:' + (i * 0.23).toFixed(2) + 's"/>';
    }
    o += '<rect x="0" y="196" width="800" height="24" fill="#131c63"/>';
    [90, 380, 700].forEach(function (x) {
      o += '<rect x="' + (x - 1.5) + '" y="160" width="3" height="38" fill="#131c63"/><circle class="park-bulb c0" cx="' + x + '" cy="158" r="5"/>';
    });
    o += '</svg>';
    return o;
  })();


  /* Taman hiburan dilihat dari atas (bidang 1000x1000, sisi atas = jauh). Komposisi utama ada di kolom tengah x=200..800
   * supaya terlihat di layar HP yang sempit. Posisi tetap (bukan acak penuh) agar tampak dirancang. */
  function groundSVG() {
    var r = rng(2026), o = '', i, k, t;
    var LIGHT = ['#FEF7C5', '#FFB4DA', '#A5CCFA', '#D5FFC9'];
    function px(y) { return 500 + 30 * Math.sin(y / 170); }
    function wedge(cx, cy, rad, n, c1, c2, op) {
      var d = '';
      for (var q = 0; q < n; q++) {
        var a0 = q / n * Math.PI * 2, a1 = (q + 1) / n * Math.PI * 2;
        d += '<path d="M' + cx + ',' + cy + ' L' + (cx + rad * Math.sin(a0)).toFixed(1) + ',' + (cy - rad * Math.cos(a0)).toFixed(1) +
          ' A' + rad + ',' + rad + ' 0 0 1 ' + (cx + rad * Math.sin(a1)).toFixed(1) + ',' + (cy - rad * Math.cos(a1)).toFixed(1) +
          ' Z" fill="' + (q % 2 ? c2 : c1) + '" opacity="' + op + '"/>';
      }
      return d;
    }
    function dot(x, y, rad, c, glow) {
      return (glow ? '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + (rad * 4.5).toFixed(0) + '" fill="url(#rg)" opacity=".5"/>' : '') +
        '<circle class="bokeh" cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + rad + '" fill="' + c + '" style="animation-delay:' + (r() * 4).toFixed(1) + 's"/>';
    }
    var CAR = [330, 570, 100];                       // komidi putar
    var TENTS = [[660, 440, '#66C7BD'], [670, 660, '#FFB4DA'], [330, 330, '#A5CCFA'], [610, 230, '#F76A9B'], [350, 860, '#FFCBBF']];
    var POND = [680, 830, 118, 68];
    var zones = [[CAR[0], CAR[1], 170], [POND[0], POND[1], 140]].concat(TENTS.map(function (q) { return [q[0], q[1], 70]; }));
    function free(x, y) {
      if (Math.abs(x - px(y)) < 95) return false;
      for (var z = 0; z < zones.length; z++) { var dx = x - zones[z][0], dy = y - zones[z][1]; if (dx * dx + dy * dy < zones[z][2] * zones[z][2]) return false; }
      if (x > 600 && y < 360) return false;          // area roller coaster
      return true;
    }

    o += '<svg viewBox="0 0 1000 1000" aria-hidden="true"><defs><radialGradient id="rg"><stop offset="0" stop-color="#FEF7C5" stop-opacity=".85"/><stop offset="1" stop-color="#FEF7C5" stop-opacity="0"/></radialGradient></defs>';
    o += '<rect width="1000" height="1000" fill="#18267a"/>';
    for (i = 0; i < 26; i++) o += '<ellipse cx="' + (r() * 1000).toFixed(0) + '" cy="' + (r() * 1000).toFixed(0) + '" rx="' + (50 + r() * 100).toFixed(0) + '" ry="' + (25 + r() * 55).toFixed(0) + '" fill="#213796" opacity=".55"/>';

    // jalan utama + cabang
    var pts = ''; for (t = -40; t <= 1040; t += 40) pts += (pts ? ' L' : 'M') + px(t).toFixed(0) + ',' + t;
    o += '<path d="' + pts + '" stroke="#F5D1EF" stroke-opacity=".24" stroke-width="84" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    [['M500,650 C440,660 400,640 340,600', 54], ['M505,440 C560,430 610,440 660,440', 48], ['M500,830 C570,840 620,820 680,820', 46], ['M500,330 C440,330 390,330 330,330', 42], ['M500,230 C540,230 580,230 610,230', 40], ['M500,880 C440,870 400,870 350,860', 42]].forEach(function (b) {
      o += '<path d="' + b[0] + '" stroke="#F5D1EF" stroke-opacity=".22" stroke-width="' + b[1] + '" fill="none" stroke-linecap="round"/>';
    });
    o += '<circle cx="' + CAR[0] + '" cy="' + CAR[1] + '" r="150" fill="#F5D1EF" opacity=".1"/>';

    // tali lampu di tepi jalan utama
    for (t = 0; t <= 1000; t += 32) {
      var n = (t / 32) | 0;
      o += dot(px(t) - 48, t, 3.6, LIGHT[n % 4], n % 4 === 0);
      o += dot(px(t) + 48, t + 16, 3.6, LIGHT[(n + 2) % 4], false);
    }

    // kolam + perahu
    o += '<ellipse cx="' + POND[0] + '" cy="' + POND[1] + '" rx="' + POND[2] + '" ry="' + POND[3] + '" fill="#66C7BD" opacity=".45"/><ellipse cx="' + POND[0] + '" cy="' + POND[1] + '" rx="' + (POND[2] - 32) + '" ry="' + (POND[3] - 24) + '" fill="none" stroke="#FFF8E9" stroke-opacity=".3" stroke-width="3"/>';
    [[640, 822, '#FFB4DA'], [715, 850, '#FEF7C5'], [685, 805, '#F76A9B']].forEach(function (bt) {
      o += '<ellipse cx="' + bt[0] + '" cy="' + bt[1] + '" rx="20" ry="10" fill="' + bt[2] + '" stroke="#1b2160" stroke-width="2.6"/><circle cx="' + bt[0] + '" cy="' + bt[1] + '" r="3.4" fill="#1b2160"/>';
    });

    // komidi putar
    o += wedge(CAR[0], CAR[1], CAR[2], 12, '#F76A9B', '#FFF8E9', 0.96);
    o += '<circle cx="' + CAR[0] + '" cy="' + CAR[1] + '" r="' + CAR[2] + '" fill="none" stroke="#1b2160" stroke-width="3.4"/><circle cx="' + CAR[0] + '" cy="' + CAR[1] + '" r="24" fill="#FEF7C5" stroke="#1b2160" stroke-width="3.4"/><circle cx="' + CAR[0] + '" cy="' + CAR[1] + '" r="10" fill="#F76A9B"/>';
    for (k = 0; k < 14; k++) { var ak = k / 14 * Math.PI * 2; o += dot(CAR[0] + (CAR[2] + 22) * Math.sin(ak), CAR[1] - (CAR[2] + 22) * Math.cos(ak), 4.6, LIGHT[k % 4], true); }
    for (k = 0; k < 8; k++) { var ah = (k + 0.5) / 8 * Math.PI * 2; o += '<circle cx="' + (CAR[0] + 62 * Math.sin(ah)).toFixed(1) + '" cy="' + (CAR[1] - 62 * Math.cos(ah)).toFixed(1) + '" r="8.5" fill="' + ['#A5CCFA', '#FFCBBF', '#D5FFC9', '#FEF7C5'][k % 4] + '" stroke="#1b2160" stroke-width="2.4"/>'; }

    // tenda
    TENTS.forEach(function (tt) {
      o += wedge(tt[0], tt[1], 50, 10, tt[2], '#FFF8E9', 0.96);
      o += '<circle cx="' + tt[0] + '" cy="' + tt[1] + '" r="50" fill="none" stroke="#1b2160" stroke-width="3.2"/><circle cx="' + tt[0] + '" cy="' + tt[1] + '" r="5" fill="#1b2160"/>';
      for (k = 0; k < 10; k++) { var at = k / 10 * Math.PI * 2; o += dot(tt[0] + 62 * Math.sin(at), tt[1] - 62 * Math.cos(at), 3, LIGHT[(k + 1) % 4], false); }
    });

    // roller coaster dari atas
    var tr = '', tie = '';
    for (t = 0; t <= 1.001; t += 0.02) {
      var cxx = 740 + 110 * Math.sin(t * Math.PI * 4.4), cyy = 50 + t * 300;
      tr += (tr ? ' L' : 'M') + cxx.toFixed(0) + ',' + cyy.toFixed(0);
      if (Math.round(t * 50) % 2 === 0) tie += '<line x1="' + (cxx - 10).toFixed(0) + '" y1="' + cyy.toFixed(0) + '" x2="' + (cxx + 10).toFixed(0) + '" y2="' + cyy.toFixed(0) + '" stroke="#1b2160" stroke-width="3.4" opacity=".7"/>';
    }
    o += '<path d="' + tr + '" fill="none" stroke="#1b2160" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><path d="' + tr + '" fill="none" stroke="#A5CCFA" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' + tie;
    o += '<circle cx="740" cy="200" r="34" fill="none" stroke="#1b2160" stroke-width="15"/><circle cx="740" cy="200" r="34" fill="none" stroke="#F76A9B" stroke-width="8"/>';

    // kios jajanan
    [[420, 760, '#F76A9B'], [585, 560, '#66C7BD'], [420, 440, '#FFB4DA'], [590, 770, '#A5CCFA'], [420, 960, '#FEF7C5']].forEach(function (bo) {
      for (k = 0; k < 4; k++) o += '<rect x="' + (bo[0] - 32 + k * 16) + '" y="' + (bo[1] - 20) + '" width="16" height="40" fill="' + (k % 2 ? '#FFF8E9' : bo[2]) + '"/>';
      o += '<rect x="' + (bo[0] - 32) + '" y="' + (bo[1] - 20) + '" width="64" height="40" rx="6" fill="none" stroke="#1b2160" stroke-width="3.2"/>';
    });

    // pohon
    for (i = 0; i < 360; i++) {
      var tx = 40 + r() * 920, ty = r() * 1000, sz = 8 + r() * 11;
      if (!free(tx, ty)) continue;
      o += '<circle cx="' + tx.toFixed(0) + '" cy="' + ty.toFixed(0) + '" r="' + sz.toFixed(0) + '" fill="' + (i % 3 ? '#173f7c' : '#1f5a94') + '" opacity=".95"/><circle cx="' + (tx - sz * 0.25).toFixed(0) + '" cy="' + (ty - sz * 0.25).toFixed(0) + '" r="' + (sz * 0.45).toFixed(0) + '" fill="#3c86b8" opacity=".5"/>';
    }
    for (i = 0; i < 80; i++) o += dot(100 + r() * 800, r() * 1000, 1.8 + r() * 1.6, LIGHT[i % 4], false);
    return o + '</svg>';
  }

  /* ---------------- pemandangan ending (dari gondola) ---------------- */
  function buildRide() {
    var w = $('rideWorld'); w.textContent = '';
    var r = rng(2026), i, s;
    var sky = document.createElement('div'); sky.className = 'r-sky';
    for (i = 0; i < 60; i++) {
      s = document.createElement('span'); s.className = 'star s' + (i % 3);
      var size = 3 + r() * 7;
      s.style.cssText = 'left:' + (r() * 100).toFixed(1) + '%;top:' + (r() * 100).toFixed(1) + '%;width:' + size.toFixed(1) + 'px;height:' + size.toFixed(1) + 'px;animation-delay:' + (r() * 5).toFixed(2) + 's;animation-duration:' + (2.4 + r() * 3).toFixed(1) + 's';
      sky.appendChild(s);
    }
    var moon = document.createElement('div'); moon.className = 'moon big'; moon.innerHTML = '<i></i>'; sky.appendChild(moon);
    var fw = document.createElement('div'); fw.className = 'fireworks'; fw.id = 'fireworks'; sky.appendChild(fw);
    w.appendChild(sky);

    var far = document.createElement('div'); far.className = 'r-far';
    var f = '<svg viewBox="0 0 600 160" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><path d="M0,90 Q90,40 190,84 T380,70 T600,92 V160 H0Z" fill="#2a3a99"/><path d="M0,120 Q140,80 270,118 T520,106 T600,118 V160 H0Z" fill="#202e88"/>';
    for (i = 0; i < 70; i++) {
      var x = r() * 600, y = 96 + r() * 56, c = ['#FEF7C5', '#FFB4DA', '#A5CCFA', '#D5FFC9'][i % 4];
      f += '<circle class="bokeh" cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + (1 + r() * 2.2).toFixed(1) + '" fill="' + c + '" style="animation-delay:' + (r() * 4).toFixed(1) + 's"/>';
    }
    far.innerHTML = f + '</svg>';
    w.appendChild(far);

    var wrap = document.createElement('div'); wrap.className = 'r-ground-wrap';
    var ground = document.createElement('div'); ground.className = 'r-ground';
    ground.innerHTML = groundSVG();
    wrap.appendChild(ground);
    w.appendChild(wrap);
  }

  function fireworks() {
    var box = $('fireworks'); if (!box) return;
    var cols = ['#FEF7C5', '#F76A9B', '#66C7BD', '#A5CCFA', '#FFB4DA'];
    var spots = [[22, 24], [70, 16], [48, 32], [84, 36], [14, 44]];
    spots.forEach(function (sp, n) {
      setTimeout(function () {
        if (!box.isConnected) return;
        var col = cols[n % cols.length];
        for (var k = 0; k < 14; k++) {
          var p = document.createElement('i'); p.className = 'fw';
          var a = k / 14 * Math.PI * 2, d = 38 + Math.random() * 26;
          p.style.cssText = 'left:' + sp[0] + '%;top:' + sp[1] + '%;background:' + col + ';--dx:' + (Math.cos(a) * d).toFixed(0) + 'px;--dy:' + (Math.sin(a) * d).toFixed(0) + 'px';
          box.appendChild(p);
          (function (pp) { setTimeout(function () { if (pp.parentNode) pp.parentNode.removeChild(pp); }, 1500); })(p);
        }
      }, 400 + n * 1100);
    });
  }

  var ride = {
    start: function () {
      var r = $('screen-ride'), g = r.querySelector('.r-ground');
      if (g) {
        var k = Math.min(root.innerWidth / 650, root.innerHeight / 720), px = Math.round(1000 * k);
        g.style.width = px + 'px'; g.style.height = px + 'px'; g.style.marginLeft = (-px / 2) + 'px';
      }
      r.classList.remove('go'); void r.offsetWidth; r.classList.add('go');
      $('rideCaption').textContent = '';
      setTimeout(function () { $('rideCaption').textContent = 'Pemandangan taman hiburan dari puncak bianglala'; }, 6800);
      setTimeout(fireworks, 5200);
    },
    stop: function () { $('screen-ride').classList.remove('go'); }
  };

  /* ---------------- tiket ---------------- */
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var ticket = {
    fill: function (o) {
      var d = o.at ? new Date(o.at) : new Date();
      if (isNaN(d.getTime())) d = new Date();
      $('tkName').textContent = o.name;
      $('tkNo').textContent = o.no || 'KTLO-0000';
      $('tkDate').textContent = d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
      $('tkTime').textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      var r = rng(hash(o.name + (o.no || '')));
      var bars = $('tkBars'); bars.textContent = '';
      for (var i = 0; i < 38; i++) {
        var b = document.createElement('i'); b.style.width = (1 + Math.floor(r() * 4)) + 'px'; b.style.marginRight = (1 + Math.floor(r() * 3)) + 'px'; bars.appendChild(b);
      }
      var note = $('saveNote'), retry = $('retrySave');
      note.textContent = o.note || ''; note.className = 'save-note ' + (o.state || '');
      retry.classList.toggle('hidden', o.state !== 'bad');
    }
  };

  function init() {
    app = $('app');
    buildSky();
    buildRide();
  }

  root.KTLO = root.KTLO || {};
  root.KTLO.UI = {
    $: $, init: init, showScreen: showScreen, setPhase: setPhase, setName: setName,
    dialog: { say: say, show: dialogShow, hide: dialogHide, cancel: function () { if (dlgPending) dlgPending.cancel(); } },
    hint: hint, toast: toast, hud: hud, modal: modal, ride: ride, ticket: ticket, buildRide: buildRide
  };
})(typeof window !== 'undefined' ? window : globalThis);
