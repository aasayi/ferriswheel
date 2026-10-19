/* Mini game 2: Urutan Tombol (simon says, 9 ronde).
 *
 * Papan 3x3. Satu permutasi acak dari 9 posisi dipakai sebagai urutan; ronde r menampilkan r posisi pertama.
 * Jadi tiap ronde urutan yang sama bertambah satu posisi baru, tidak ada posisi ganda, dan di ronde 9
 * semua tombol terpakai. Pola berbeda tiap main.
 * Tiap ronde diawali "hint": pola dimainkan dulu di panel kiri, baru pemain mengulangi di panel kanan.
 * Salah tekan = ronde yang sama diulang (hint dimainkan lagi), tidak kembali ke ronde 1.
 */
(function (root) {
  'use strict';

  var ROUNDS = 9;
  var ON = 200;        // ms satu kedipan menyala
  var GAP = 70;        // ms jeda antar kedipan
  var LEAD = 320;      // ms jeda sebelum pola dimainkan tiap ronde
  var AFTER = 260;     // ms jeda setelah ronde berhasil
  var RETRY = 850;     // ms jeda sebelum ronde diulang setelah salah

  function shuffle(a, rnd) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function makeSequence(rnd) { return shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8], rnd); }
  function roundSeq(seq, r) { return seq.slice(0, r); }

  /** Estimasi durasi (detik) untuk pemain dengan waktu ketuk rata-rata tapMs, tanpa kesalahan. */
  function estimate(tapMs, mistakesPerRun) {
    var show = 0, input = 0;
    for (var r = 1; r <= ROUNDS; r++) { show += r * (ON + GAP); input += r * tapMs; }
    var pauses = ROUNDS * (LEAD + AFTER) + 600;
    var redo = (mistakesPerRun || 0) * (RETRY + LEAD + 5 * (ON + GAP) + 5 * tapMs);
    return (show + input + pauses + redo) / 1000;
  }

  function mount(host, opts) {
    opts = opts || {};
    var rnd = opts.rnd || Math.random;
    var seq = makeSequence(rnd);
    var round = 1, idx = 0, phase = 'idle', alive = true, timers = [];
    var mistakes = 0, replays = 0, t0 = performance.now();
    function later(fn, ms) { var id = setTimeout(function () { if (alive) fn(); }, ms); timers.push(id); return id; }
    var A = root.KTLO && root.KTLO.Audio;

    host.textContent = '';
    var help = document.createElement('p');
    help.className = 'help';
    help.textContent = 'Perhatikan pola di kiri, lalu ulangi urutannya di kanan.';
    host.appendChild(help);

    var wrap = document.createElement('div'); wrap.className = 'simon';
    var status = document.createElement('div'); status.className = 'simon-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    var panels = document.createElement('div'); panels.className = 'simon-panels';

    function panel(kind) {
      var p = document.createElement('div'); p.className = 'spanel ' + kind;
      var lamps = document.createElement('div'); lamps.className = 'lamps';
      var lampEls = [];
      for (var i = 0; i < ROUNDS; i++) { var l = document.createElement('i'); lamps.appendChild(l); lampEls.push(l); }
      var grid = document.createElement('div'); grid.className = 'sgrid';
      var cells = [];
      for (var k = 0; k < 9; k++) {
        var c = document.createElement(kind === 'inp' ? 'button' : 'div');
        c.className = kind === 'inp' ? 'sbtn' : 'scell';
        if (kind === 'inp') { c.type = 'button'; c.setAttribute('aria-label', 'Tombol ' + (k + 1)); }
        grid.appendChild(c); cells.push(c);
      }
      p.appendChild(lamps); p.appendChild(grid);
      return { el: p, lamps: lampEls, cells: cells };
    }
    var disp = panel('disp'), inp = panel('inp');
    panels.appendChild(disp.el); panels.appendChild(inp.el);
    var replay = document.createElement('button');
    replay.type = 'button'; replay.className = 'btn small ghost simon-replay'; replay.textContent = 'Lihat pola lagi';
    wrap.appendChild(status); wrap.appendChild(panels); wrap.appendChild(replay);
    host.appendChild(wrap);

    function setStatus(t) { status.textContent = t; }
    function lampsRound() {
      disp.lamps.forEach(function (l, i) { l.className = i < round - 1 ? 'on' : (i === round - 1 ? 'cur' : ''); });
    }
    function lampsInput() {
      inp.lamps.forEach(function (l, i) { l.className = i < round ? (i < idx ? 'on' : 'slot') : ''; });
    }
    function flash(pos) {
      var c = disp.cells[pos];
      c.classList.add('on');
      if (A) A.note(pos);
      later(function () { c.classList.remove('on'); }, ON);
    }
    function playback(then) {
      phase = 'show';
      replay.disabled = true;
      var cur = roundSeq(seq, round);
      var t = 0;
      cur.forEach(function (pos) { later(function () { flash(pos); }, t); t += ON + GAP; });
      later(function () { phase = 'input'; idx = 0; lampsInput(); replay.disabled = false; setStatus('Giliranmu! Ulangi ' + round + ' tombol.'); if (then) then(); }, t + 120);
    }
    function startRound() {
      idx = 0; phase = 'show';
      lampsRound(); lampsInput();
      setStatus('Ronde ' + round + ' / ' + ROUNDS + ': perhatikan pola');
      later(playback, LEAD);
    }
    function success() {
      phase = 'wait'; replay.disabled = true;
      if (round >= ROUNDS) {
        round = ROUNDS + 1; lampsRound(); lampsInput();
        setStatus('Semua ronde selesai!');
        later(function () { if (opts.onSolved) opts.onSolved({ ms: performance.now() - t0, mistakes: mistakes, replays: replays }); }, 700);
        return;
      }
      setStatus('Bagus!');
      if (A) A.pair();
      round++;
      later(startRound, AFTER);
    }
    function wrong(btn) {
      mistakes++; phase = 'wait'; replay.disabled = true;
      btn.classList.add('bad');
      later(function () { btn.classList.remove('bad'); }, 450);
      if (A) A.bad();
      setStatus('Salah! Perhatikan lagi.');
      idx = 0; lampsInput();
      later(function () { setStatus('Ronde ' + round + ' / ' + ROUNDS + ': perhatikan pola'); playback(); }, RETRY);
    }
    function press(pos) {
      if (!alive || phase !== 'input') return;
      var btn = inp.cells[pos];
      if (pos === roundSeq(seq, round)[idx]) {
        btn.classList.add('hit'); later(function () { btn.classList.remove('hit'); }, 160);
        if (A) A.note(pos);
        idx++; lampsInput();
        if (idx >= round) success();
      } else {
        wrong(btn);
      }
    }
    inp.cells.forEach(function (b, k) {
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); press(k); });
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(k); } });
    });
    replay.addEventListener('click', function () {
      if (phase !== 'input') return;
      replays++; idx = 0; lampsInput();
      setStatus('Ronde ' + round + ' / ' + ROUNDS + ': perhatikan pola');
      playback();
    });

    startRound();
    return {
      destroy: function () { alive = false; timers.forEach(clearTimeout); host.textContent = ''; },
      debug: function () { return { seq: seq, round: round, phase: phase, press: press }; }
    };
  }

  root.KTLO = root.KTLO || {};
  root.KTLO.Simon = {
    mount: mount, makeSequence: makeSequence, roundSeq: roundSeq, estimate: estimate,
    ROUNDS: ROUNDS, ON: ON, GAP: GAP, LEAD: LEAD, AFTER: AFTER, RETRY: RETRY
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.KTLO.Simon;
})(typeof window !== 'undefined' ? window : globalThis);
