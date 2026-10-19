/* Keep The Lights On - alur game: login, intro, blackout, tutorial, main, game over, finale, naik gondola, tiket. */
(function (root) {
  'use strict';

  var K = root.KTLO, UI = K.UI, Model = K.Model, Api = K.Api, Au = K.Audio, Wheel = K.Wheel;
  var $ = UI.$;
  var N = Model.N;

  var PUZ = {
    cable: { mod: K.Cable, title: 'Sambung Kabel' },
    simon: { mod: K.Simon, title: 'Urutan Tombol' },
    maze: { mod: K.Maze, title: 'Alirkan Cahaya' }
  };

  /* Naskah Asayi. {name} diganti username pemain. Tidak ada poin, hadiah, atau bayaran dalam cerita. */
  var LINES = {
    welcome: [
      'Halo, {name}! Selamat datang di bianglala kami!',
      'Kamu sudah masuk antrian, kan? Sebentar lagi giliranmu naik gondola. Lihat deh, lampunya cantik banget malam ini.'
    ],
    welcomeAgain: [
      'Halo lagi, {name}! Mau naik bianglala sekali lagi? Ayo, masuk antrian dulu.'
    ],
    blackout: [
      'Eh? Kok pelan banget... Kok semua lampunya mati?!',
      'Waduh, listrik bianglalanya drop. Aku harus lari ke Powerhouse sekarang juga!',
      'Lihat, cuma satu gondola yang masih menyala, itu pun baterainya sekarat. Kalau semua lampu gondola sampai mati, bianglala ini rusak total!',
      'Aku butuh bantuanmu. Mau jadi petugas sementara dan jaga lampunya tetap menyala?'
    ],
    blackoutShort: [
      'Eh, lampunya mati lagi! Aku ke Powerhouse dulu, ya.',
      'Kamu masih ingat caranya, kan? Nyalakan semua lampu gondola selama aku pergi.'
    ],
    teach: [
      'Makasih banyak! Caranya gampang: tap gondola yang lampunya mati. Tandanya ada tanda seru kecil di atasnya.',
      'Coba satu dulu, ya. Gondola yang kusorot itu.'
    ],
    afterTutorial: [
      'Nah, gitu caranya! Lampunya nyala lagi dan baterainya terisi penuh.',
      'Tiap gondola punya baterai sendiri, jadi pantau terus. Nanti puzzle-nya ada beberapa jenis.',
      'Selama aku nyalain listrik dari Powerhouse, kamu harus bisa menyalakan semua lampu gondolanya. Semangat, {name}!'
    ],
    finale: [
      'Aku balik! Listriknya sudah nyala lagi... eh, tunggu. Semua lampu gondolanya menyala?!',
      'Hebat banget, {name}! Bianglalanya selamat berkat kamu. Makasih ya!',
      'Ini tiket spesial buat kamu. Sekarang waktunya naik gondola dan nikmati pemandangannya!'
    ]
  };

  var S = {
    phase: 'login', token: 0, m: null, wheel: null, run: null, puzzle: null, closeCb: null, open: -1,
    assigned: {}, puzzleLog: [], tapWait: null, t0: 0, playStart: 0, acc: 0, lastTs: 0, finish: null, seenTutorial: false
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function setText(id, t) { var e = $(id); if (e) e.textContent = t || ''; }

  /* ---------------- puzzle ---------------- */
  function assignType(i) {
    if (!S.assigned[i]) S.assigned[i] = Model.pickType(S.m);
    return S.assigned[i];
  }

  function openPuzzle(i, o) {
    return new Promise(function (resolve) {
      var type = o.type || assignType(i), def = PUZ[type];
      var host = UI.modal.open({ tag: 'Gondola ' + pad(i + 1), title: def.title, coach: !!o.tutorial, noOverview: !!o.tutorial });
      S.open = i;
      var t0 = performance.now(), ended = false;
      function end(ok, stats) {
        if (ended) return;
        ended = true;
        if (S.puzzle) { S.puzzle.destroy(); S.puzzle = null; }
        UI.modal.close();
        S.open = -1; S.closeCb = null;
        resolve({ ok: ok, ms: performance.now() - t0, type: type, stats: stats || null });
      }
      S.closeCb = function () { end(false); };
      S.puzzle = def.mod.mount(host, {
        rnd: Model.mulberry32((Math.random() * 4294967296) >>> 0),
        tutorial: !!o.tutorial,
        setCoach: UI.modal.setCoach,
        onSolved: function (st) { end(true, st); }
      });
      if (S.m) UI.modal.overview(S.m, i);
    });
  }

  function onTap(i) {
    Au.unlock();
    if (S.phase === 'tutorial') {
      if (S.tapWait && i === S.tapWait.i) { var res = S.tapWait.res; S.tapWait = null; res(); }
      else UI.toast('Coba gondola yang disorot dulu, ya.');
      return;
    }
    if (S.phase !== 'play' || UI.modal.isOpen() || !S.m) return;
    if (S.m.g[i].lit) { UI.toast('Lampu gondola ' + pad(i + 1) + ' masih menyala.'); return; }
    Au.tap();
    openPuzzle(i, {}).then(function (res) { onPlayResult(i, res); });
  }

  function onPlayResult(i, res) {
    if (S.phase !== 'play') return;
    if (!res.ok) { UI.toast('Puzzle ditutup. Baterai tetap turun, lho!'); return; }
    var secs = res.ms / 1000;
    S.puzzleLog.push({ t: res.type, s: Math.round(secs) });
    Model.reportSolve(S.m, secs + 3);   // +3 dtk = ketuk gondola + transisi, sama seperti di simulasi
    Model.light(S.m, i);
    S.wheel.setLit(i, true);
    S.wheel.setBattery(i, 1, 600);
    Au.lightOn();
    UI.hud.setLit(Model.litCount(S.m), N);
    if (Model.allLit(S.m)) win();
  }

  /* ---------------- loop utama ---------------- */
  function loop(ts) {
    var dt = S.lastTs ? Math.min(0.25, (ts - S.lastTs) / 1000) : 0;
    S.lastTs = ts;
    if (S.phase === 'play' && S.m) {
      var ev = Model.tick(S.m, dt);
      for (var k = 0; k < ev.length; k++) {
        var i = ev[k].i;
        S.wheel.setLit(i, false);
        Au.lightOff();
        if (UI.modal.isOpen()) UI.toast('Lampu gondola ' + pad(i + 1) + ' padam!', 2200);
      }
      S.acc += dt;
      if (S.acc >= 0.25) {
        S.acc = 0;
        S.wheel.sync(S.m, 300);
        UI.hud.setLit(Model.litCount(S.m), N);
        if (UI.modal.isOpen()) UI.modal.overview(S.m, S.open);
      }
      if (Model.allDark(S.m)) gameOver();
    }
    requestAnimationFrame(loop);
  }

  /* ---------------- statistik run ---------------- */
  function runStats() {
    var now = performance.now();
    return {
      v: 1,
      elapsed_s: Math.round((now - S.t0) / 1000),
      play_s: S.playStart ? Math.round((now - S.playStart) / 1000) : 0,
      solves: S.m ? S.m.solved : 0,
      relights: S.m ? S.m.relights : 0,
      lit: S.m ? Model.litCount(S.m) : 0,
      puzzles: S.puzzleLog.slice(0, 60)
    };
  }

  /* ---------------- layar ---------------- */
  function showTitle(err) {
    S.token++;
    UI.dialog.cancel();
    UI.showScreen('title');
    UI.setPhase('title');
    UI.hud.show('sound');
    UI.hint(null);
    setText('titleErr', err || '');
    S.wheel.resetAll(); S.wheel.setMode('spin');
  }

  /* ---------------- leaderboard (hanya admin) ---------------- */
  var boardTok = 0;
  function paintAdmin() {
    var on = Api.isAdmin;
    Array.prototype.forEach.call(document.querySelectorAll('.admin-lb'), function (b) { b.classList.toggle('hidden', !on); });
    if (!on) { boardTok++; UI.board.close(); }
  }
  async function loadBoard() {
    var tok = ++boardTok;
    UI.board.loading();
    try {
      var res = await Api.leaderboard();
      if (tok !== boardTok || !UI.board.isOpen()) return;
      UI.board.render(res.rows, res.demo);
    } catch (e) {
      if (tok !== boardTok || !UI.board.isOpen()) return;
      UI.board.error((e && e.message) || 'Gagal memuat leaderboard.');
    }
  }
  function openBoard() { if (!Api.isAdmin) return; Au.unlock(); Au.tap(); UI.board.open(); loadBoard(); }
  function closeBoard() { boardTok++; Au.tap(); UI.board.close(); }

  function toLogin() {
    S.token++;
    UI.dialog.cancel();
    Api.logout();
    paintAdmin();
    S.phase = 'login';
    UI.ride.stop();
    UI.showScreen('login');
    UI.setPhase('login');
    UI.hud.show('sound');
    S.wheel.resetAll(); S.wheel.setMode('spin');
    $('inDob').value = '';
    setText('loginErr', '');
  }

  /* Halaman akhir untuk username yang sudah menamatkan game (menang = tiket, kalah = lampu padam). */
  function showEnding(f) {
    S.token++;
    UI.dialog.cancel(); UI.ride.stop(); UI.hint(null);
    UI.hud.show('sound');
    S.wheel.resetAll();
    S.m = Model.create({}); Model.setupAfterTutorial(S.m);
    var win = f.result === 'win';
    for (var i = 0; i < N; i++) { S.m.g[i].lit = win; S.m.g[i].b = win ? 1 : 0; S.wheel.setLit(i, win); }
    S.wheel.sync(S.m, 0);
    S.wheel.setPower(win);
    S.wheel.setMode(win ? 'spin' : 'stop');
    if (win) {
      UI.ticket.fill({ name: Api.name || 'player', no: f.ticketNo || 'KTLO-0000', at: f.finishedAt, state: 'ok', note: 'Kamu sudah menyelesaikan permainan ini.' });
      S.phase = 'ticket'; UI.setPhase('ticket'); UI.showScreen('ticket');
    } else {
      S.phase = 'over'; UI.setPhase('over'); UI.showScreen('over');
    }
  }

  /* ---------------- cerita ---------------- */
  async function startStory(replay) {
    var tok = ++S.token;
    function alive() { return tok === S.token; }
    UI.dialog.cancel();
    UI.ride.stop();
    UI.showScreen(null);
    UI.hud.show('sound');
    UI.hint(null);
    setText('titleErr', '');
    try { S.run = await Api.startRun(); }
    catch (e) {
      if (!alive()) return;
      if (e.code === 'finished') {
        Api.refreshFinal().then(function (f) { if (f) showEnding(f); else showTitle(e.message); }, function () { showTitle(e.message); });
        return;
      }
      showTitle(e.message || 'Belum bisa masuk antrian. Coba lagi.'); return;
    }
    if (!alive()) return;

    S.phase = 'intro'; UI.setPhase('intro');
    S.t0 = performance.now(); S.playStart = 0; S.puzzleLog = []; S.assigned = {}; S.m = null;
    S.wheel.resetAll(); S.wheel.setMode('spin');
    await sleep(1400); if (!alive()) return;

    await UI.dialog.say(replay ? LINES.welcomeAgain : LINES.welcome); if (!alive()) return;
    await UI.dialog.hide(); if (!alive()) return;

    Au.alert();
    await S.wheel.blackout({ tut: Model.TUT, dying: Model.DYING, dyingLevel: Model.DYING_START });
    if (!alive()) return;

    S.m = Model.create({});
    Model.setupAfterTutorial(S.m);
    S.m.g[Model.TUT].lit = false; S.m.g[Model.TUT].b = 0;     // gondola tutorial masih mati
    S.wheel.sync(S.m, 0);
    S.wheel.showBadges(true);
    S.phase = 'tutorial'; UI.setPhase('tutorial');

    if (replay || S.seenTutorial) {
      await UI.dialog.say(LINES.blackoutShort, { last: 'Siap!' }); if (!alive()) return;
      Model.setupAfterTutorial(S.m);
      S.wheel.sync(S.m, 400);
    } else {
      await UI.dialog.say(LINES.blackout, { last: 'Siap bantu!' }); if (!alive()) return;
      await UI.dialog.say(LINES.teach); if (!alive()) return;
      await UI.dialog.hide(); if (!alive()) return;

      S.wheel.highlight(Model.TUT);
      UI.hint('Tap gondola yang disorot');
      var ok = false;
      while (!ok) {
        await new Promise(function (res) { S.tapWait = { i: Model.TUT, res: res }; });
        if (!alive()) return;
        var r = await openPuzzle(Model.TUT, { tutorial: true, type: 'cable' });
        if (!alive()) return;
        ok = r.ok;
        if (!ok) UI.toast('Belum selesai. Tap gondola yang disorot lagi, ya.');
      }
      UI.hint(null);
      S.wheel.highlight(-1);
      Model.setupAfterTutorial(S.m);
      S.wheel.sync(S.m, 500);
      Au.lightOn();
      await sleep(1000); if (!alive()) return;
      await UI.dialog.say(LINES.afterTutorial, { last: 'Siap!' }); if (!alive()) return;
      S.seenTutorial = true;
    }
    await UI.dialog.hide(); if (!alive()) return;
    startPlay();
  }

  function startPlay() {
    S.phase = 'play'; UI.setPhase('play');
    S.playStart = performance.now(); S.acc = 0;
    S.wheel.showBadges(true);
    UI.hud.show('full');
    UI.hud.setLit(Model.litCount(S.m), N);
    UI.toast('Nyalakan semua 12 lampu gondola!', 3400);
  }

  function gameOver() {
    if (S.phase !== 'play') return;
    S.phase = 'over'; UI.setPhase('over');
    if (S.closeCb) S.closeCb();
    UI.hint(null);
    Au.lose();
    S.wheel.setPower(false);
    // kalah = hasil akhir (tidak bisa main lagi), jadi coba kirim sekali lagi kalau gagal
    Api.finishRun(S.run, 'lose', runStats()).catch(function () {
      return sleep(2500).then(function () { return Api.finishRun(S.run, 'lose', runStats()); });
    }).catch(function () { /* menyerah, run tetap tercatat mulai */ });
    UI.hud.show('sound');
    setTimeout(function () { if (S.phase === 'over') UI.showScreen('over'); }, 900);
  }

  async function retry() {
    var tok = ++S.token;
    UI.showScreen(null);
    try { S.run = await Api.startRun(); }
    catch (e) { if (tok === S.token) { UI.showScreen('over'); UI.toast(e.message || 'Belum bisa mulai lagi.'); } return; }
    if (tok !== S.token) return;
    S.t0 = performance.now(); S.puzzleLog = []; S.assigned = {};
    S.m = Model.create({});
    Model.setupAfterTutorial(S.m);
    S.wheel.setPower(false);
    S.wheel.sync(S.m, 0);
    startPlay();
  }

  async function win() {
    if (S.phase !== 'play') return;
    var tok = ++S.token;
    function alive() { return tok === S.token; }
    S.phase = 'finale'; UI.setPhase('finale');
    if (S.closeCb) S.closeCb();
    UI.hud.show('sound');
    S.wheel.showBadges(false);
    S.wheel.setPower(true);
    S.wheel.setMode('spin');
    Au.win();
    S.finish = Api.finishRun(S.run, 'win', runStats()).then(function (r) { return { ok: true, r: r }; }, function (e) { return { ok: false, e: e }; });
    await sleep(1900); if (!alive()) return;
    await UI.dialog.say(LINES.finale, { last: 'Naik gondola!' }); if (!alive()) return;
    await UI.dialog.hide(); if (!alive()) return;
    rideScene(tok);
  }

  async function rideScene(tok) {
    function alive() { return tok === S.token; }
    S.phase = 'ride'; UI.setPhase('ride');
    UI.showScreen('ride');
    UI.ride.start();
    var skip = false, t0 = performance.now();
    function onClick() { if (performance.now() - t0 > 4500) skip = true; }
    $('screen-ride').addEventListener('click', onClick);
    while (alive() && !skip && performance.now() - t0 < 12500) await sleep(150);
    $('screen-ride').removeEventListener('click', onClick);
    if (!alive()) return;
    await showTicket(tok);
  }

  function ticketNote(res) {
    if (Api.demo) return { state: 'demo', note: 'Mode demo: hasil tidak disimpan.' };
    if (res && res.ok) return { state: 'ok', note: 'Hasil tersimpan.' };
    if (res && res.e && (res.e.code === 'rejected' || res.e.code === 'finished')) return { state: 'rejected', note: res.e.message };
    return { state: 'bad', note: 'Hasil belum tersimpan. Cek koneksimu lalu kirim ulang.' };
  }

  async function showTicket(tok) {
    var res = await Promise.race([S.finish, sleep(5000).then(function () { return { ok: false, timeout: true }; })]);
    if (tok !== S.token) return;
    var no = (res && res.ok && res.r && res.r.ticketNo) || (S.run && S.run.ticketNo) || 'KTLO-0000';
    var n = ticketNote(res);
    UI.ticket.fill({ name: Api.name || 'player', no: no, state: n.state, note: n.note });
    S.phase = 'ticket'; UI.setPhase('ticket');
    UI.showScreen('ticket', 'ride');
    Au.win();
  }

  /* ---------------- pasang event ---------------- */
  function bind() {
    var form = $('loginForm'), inName = $('inName'), inDob = $('inDob'), btn = $('loginBtn');
    inDob.addEventListener('input', function () { inDob.value = inDob.value.replace(/\D/g, '').slice(0, 8); });
    $('pwToggle').addEventListener('click', function () {
      var show = inDob.type === 'password';
      inDob.type = show ? 'text' : 'password';
      $('pwToggle').setAttribute('aria-pressed', show ? 'true' : 'false');
      $('pwToggle').classList.toggle('on', show);
    });
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      Au.unlock();
      setText('loginErr', '');
      btn.disabled = true; btn.textContent = 'Memeriksa...';
      try {
        var u = await Api.login(inName.value, inDob.value);
        UI.setName(u.name);
        paintAdmin();
        if (u.final) showEnding(u.final); else showTitle();
      } catch (ex) {
        setText('loginErr', ex.message || 'Login gagal.');
        var card = $('loginForm'); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
      } finally { btn.disabled = false; btn.textContent = 'Masuk'; }
    });
    if (!Api.enabled) $('demoNote').classList.remove('hidden');

    // Dengan backend, satu username hanya main sekali: tombol main lagi disembunyikan (mode demo tetap ada untuk tes)
    $('retryBtn').classList.toggle('hidden', Api.enabled);
    $('againBtn').classList.toggle('hidden', Api.enabled);

    $('playBtn').addEventListener('click', function () { Au.unlock(); startStory(false); });
    $('logoutBtn').addEventListener('click', toLogin);
    $('retryBtn').addEventListener('click', function () { Au.unlock(); retry(); });
    $('overExitBtn').addEventListener('click', toLogin);
    $('againBtn').addEventListener('click', function () { Au.unlock(); UI.ride.stop(); startStory(true); });
    $('ticketExitBtn').addEventListener('click', toLogin);
    $('retrySave').addEventListener('click', async function () {
      var b = $('retrySave'); b.disabled = true;
      var r = await Api.finishRun(S.run, 'win', runStats()).then(function (x) { return { ok: true, r: x }; }, function (e) { return { ok: false, e: e }; });
      b.disabled = false;
      var n = ticketNote(r);
      $('saveNote').textContent = n.note; $('saveNote').className = 'save-note ' + n.state;
      b.classList.toggle('hidden', n.state !== 'bad');
    });
    $('puzClose').addEventListener('click', function () { if (S.closeCb) S.closeCb(); });
    Array.prototype.forEach.call(document.querySelectorAll('.admin-lb'), function (b) { b.addEventListener('click', openBoard); });
    $('lbClose').addEventListener('click', closeBoard);
    $('lbBack').addEventListener('click', closeBoard);
    $('lbRefresh').addEventListener('click', function () { Au.tap(); loadBoard(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (UI.board.isOpen()) { closeBoard(); return; }
      if (S.closeCb) S.closeCb();
    });

    var sb = $('btnSound');
    function paintSound() { var m = Au.isMuted(); sb.setAttribute('aria-pressed', m ? 'false' : 'true'); sb.classList.toggle('muted', m); }
    sb.addEventListener('click', function () { Au.setMuted(!Au.isMuted()); paintSound(); if (!Au.isMuted()) { Au.unlock(); Au.pop(); } });
    paintSound();
    document.addEventListener('pointerdown', function () { Au.unlock(); }, { once: true });

    // Enter di field username pindah ke field password
    inName.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inDob.focus(); } });
  }

  /* ---------------- dev tools (hanya mode demo + ?dev=1) ---------------- */
  function devTools() {
    var q = '';
    try { q = location.search; } catch (e) { /* abaikan */ }
    if (Api.enabled || !/[?&]dev=1/.test(q)) return;
    root.KTLO_DEV = {
      S: S, Model: Model, openPuzzle: openPuzzle, win: win, gameOver: gameOver,
      lightAll: function () { for (var i = 0; i < N; i++) { Model.light(S.m, i); S.wheel.setLit(i, true); } S.wheel.sync(S.m, 0); if (S.phase === 'play') win(); },
      killAll: function () { for (var i = 0; i < N; i++) { S.m.g[i].lit = false; S.m.g[i].b = 0; } },
      solve: function () { if (S.puzzle && S.puzzle.debug) return S.puzzle.debug(); return null; },
      skipToPlay: function () {
        S.token++; UI.dialog.cancel(); UI.showScreen(null); UI.ride.stop();
        S.run = { runId: 'dev', demo: true, ticketNo: 'KTLO-0000' };
        S.t0 = performance.now(); S.puzzleLog = []; S.assigned = {};
        S.wheel.resetAll(); S.wheel.setMode('stop'); S.wheel.setPower(false);
        S.m = Model.create({}); Model.setupAfterTutorial(S.m); S.wheel.sync(S.m, 0);
        S.wheel.showBadges(true); S.seenTutorial = true; startPlay();
      }
    };
    var p = $('devPanel'); p.classList.remove('hidden'); p.textContent = '';
    [['Nyalakan semua', function () { root.KTLO_DEV.lightAll(); }], ['Matikan semua', function () { root.KTLO_DEV.killAll(); }]].forEach(function (b) {
      var e = document.createElement('button'); e.type = 'button'; e.textContent = b[0]; e.addEventListener('click', b[1]); p.appendChild(e);
    });
  }

  function boot() {
    UI.init();
    S.wheel = Wheel.create($('wheel'), { onTap: onTap });
    S.wheel.setMode('spin');
    UI.setPhase('login');
    UI.showScreen('login');
    UI.hud.show('sound');
    bind();
    devTools();
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
