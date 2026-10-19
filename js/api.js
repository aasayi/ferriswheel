/* Keep The Lights On - klien backend Supabase (fetch murni, tanpa library).
 *
 * Tidak memakai Supabase Auth dan tidak ada email. Login = username (one-name) + password (DDMMYYYY),
 * dicek oleh fungsi SQL, yang membalas token sesi. Token dikirim di setiap panggilan berikutnya.
 * Kontrak lengkap ada di ktlo-backend/README.md. Ringkasnya (semua lewat POST {url}/rest/v1/rpc/{fungsi}):
 *   login   -> ktlo_login        { p_name, p_pass }                       => { token, onename, result, ticket_no, finished_at, is_admin }
 *              (result = 'win' / 'lose' kalau username ini sudah pernah menamatkan game, selain itu null;
 *               is_admin = true kalau akun ini admin)
 *   mulai   -> ktlo_start_run    { p_token }                              => { run_id }
 *   selesai -> ktlo_finish_run   { p_token, p_run_id, p_result, p_stats } => { ticket_no, status, onename }
 *   papan   -> ktlo_leaderboard  { p_token }                              => [{ onename, result, elapsed_ms, finished_at }]   (HANYA admin)
 *
 * Kalau supabaseUrl/supabaseAnonKey kosong di config.js, semuanya jalan sebagai MODE DEMO (lokal).
 */
(function (root) {
  'use strict';

  var cfg = root.KTLO_CONFIG || {};
  var enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  var base = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
  var session = null;       // { token, name, demo }
  var creds = null;         // disimpan di memori saja, untuk login ulang diam-diam kalau sesi habis

  // Pesan error dari SQL (RAISE EXCEPTION '<kode>') -> pesan untuk pemain
  var MSG = {
    login_gagal: 'Username atau password belum cocok.',
    terlalu_banyak_percobaan: 'Terlalu banyak percobaan salah. Tunggu beberapa menit lalu coba lagi.',
    terlalu_sering: 'Terlalu sering mulai. Tunggu sebentar lalu coba lagi.',
    terlalu_cepat: 'Hasil ditolak server karena selesainya terlalu cepat.',
    run_tidak_ditemukan: 'Data permainan tidak ditemukan. Coba main lagi dari awal.',
    hasil_tidak_valid: 'Hasil permainan tidak valid.',
    sudah_selesai: 'Kamu sudah menyelesaikan permainan ini.',
    bukan_admin: 'Hanya akun admin yang bisa melihat leaderboard.'
  };
  var DEMO_ADMINS = ['asayi'];   // mode demo saja: akun yang dianggap admin

  function validName(s) { return /^[A-Za-z0-9_.\-]{2,24}$/.test(String(s || '').trim()); }

  function validDob(s) {
    s = String(s || '').trim();
    if (!/^\d{8}$/.test(s)) return false;
    var d = +s.slice(0, 2), m = +s.slice(2, 4), y = +s.slice(4, 8);
    if (y < 1900 || y > new Date().getFullYear()) return false;
    var dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  function timeout(ms) {
    var c = new AbortController();
    var id = setTimeout(function () { c.abort(); }, ms);
    return { signal: c.signal, done: function () { clearTimeout(id); } };
  }

  function fail(code, message) { var e = new Error(message); e.code = code; return e; }

  async function http(path, body) {
    var t = timeout(12000), res, text;
    try {
      res = await fetch(base + path, {
        method: 'POST',
        headers: {
          'apikey': cfg.supabaseAnonKey,
          'Authorization': 'Bearer ' + cfg.supabaseAnonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body || {}),
        signal: t.signal
      });
      text = await res.text();
    } catch (e) {
      throw fail('network', 'Tidak bisa terhubung ke server. Cek koneksimu.');
    } finally { t.done(); }
    var json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
    if (!res.ok) {
      var key = json && json.message ? String(json.message) : '';
      if (key === 'sesi_habis') throw fail('session', 'Sesi habis.');
      if (key === 'login_gagal' || key === 'terlalu_banyak_percobaan') throw fail('auth', MSG[key]);
      if (key === 'sudah_selesai') throw fail('finished', MSG[key]);
      if (key === 'bukan_admin') throw fail('forbidden', MSG[key]);
      if (MSG[key]) throw fail('rejected', MSG[key]);
      throw fail('server', 'Server bermasalah (' + res.status + '). Coba lagi sebentar lagi.');
    }
    return json;
  }

  async function signIn(name, dob) {
    var r = await http('/rest/v1/rpc/' + (cfg.rpcLogin || 'ktlo_login'), { p_name: name, p_pass: dob });
    var row = Array.isArray(r) ? r[0] : r;
    if (!row || !row.token) throw fail('auth', MSG.login_gagal);
    return row;
  }

  function finalFrom(row) {
    if (!row || !row.result) return null;
    return { result: row.result, ticketNo: row.ticket_no || null, finishedAt: row.finished_at || null };
  }

  async function login(name, dob) {
    name = String(name || '').trim();
    dob = String(dob || '').trim();
    if (!validName(name)) throw fail('input', 'Username hanya boleh huruf, angka, titik, strip, atau garis bawah (2-24 karakter).');
    if (!validDob(dob)) throw fail('input', 'Password harus format DDMMYYYY, contoh 07091999.');
    if (!enabled) {
      var da = DEMO_ADMINS.indexOf(name.toLowerCase()) >= 0;
      session = { name: name, demo: true, admin: da };
      return { name: name, demo: true, admin: da };
    }
    var row = await signIn(name, dob);
    creds = { name: name, dob: dob };
    session = { name: row.onename || name, token: row.token, demo: false, admin: row.is_admin === true };
    return { name: session.name, demo: false, admin: session.admin, final: finalFrom(row) };
  }

  /** Login ulang diam-diam untuk menanyakan status akhir (dipakai kalau server menolak mulai karena sudah selesai). */
  async function refreshFinal() {
    if (!session || session.demo || !creds) return null;
    var row = await signIn(creds.name, creds.dob);
    session.token = row.token;
    session.admin = row.is_admin === true;
    return finalFrom(row);
  }

  function logout() { session = null; creds = null; }

  async function rpc(fn, args) {
    if (!session) throw fail('auth', 'Belum login.');
    args.p_token = session.token;
    try {
      return await http('/rest/v1/rpc/' + fn, args);
    } catch (e) {
      if (e.code === 'session' && creds) {          // sesi habis: login ulang sekali, lalu ulangi
        session.token = (await signIn(creds.name, creds.dob)).token;
        args.p_token = session.token;
        return await http('/rest/v1/rpc/' + fn, args);
      }
      if (e.code === 'session') throw fail('auth', 'Sesi habis. Silakan masuk lagi.');
      throw e;
    }
  }

  function demoTicket() {
    var n = Math.floor(Math.random() * 9000 + 1000);
    return 'KTLO-' + n;
  }

  /** Mulai satu run (di server: catat waktu mulai, batasi frekuensi). */
  async function startRun() {
    if (!session) throw fail('auth', 'Belum login.');
    if (session.demo) return { runId: 'demo-' + Date.now(), ticketNo: demoTicket(), demo: true };
    var r = await rpc(cfg.rpcStart || 'ktlo_start_run', {});
    var row = Array.isArray(r) ? r[0] : r;
    if (!row || !row.run_id) throw fail('server', 'Server tidak mengembalikan run_id.');
    return { runId: row.run_id, ticketNo: null, demo: false };
  }

  /** Akhiri run. result: 'win' | 'lose' | 'abandon'. stats dikirim apa adanya. */
  async function finishRun(run, result, stats) {
    if (!run) return { demo: true };
    if (run.demo || !session || session.demo) return { demo: true, ticketNo: run.ticketNo };
    var r = await rpc(cfg.rpcFinish || 'ktlo_finish_run', { p_run_id: run.runId, p_result: result, p_stats: stats || {} });
    var row = Array.isArray(r) ? r[0] : r;
    return { demo: false, ticketNo: (row && row.ticket_no) || run.ticketNo, raw: row };
  }

  /**
   * Leaderboard (khusus admin; server menolak non-admin dengan 'bukan_admin').
   * Mengembalikan { demo, rows: [{ name, result: 'win'|'lose', ms, at }] }, sudah terurut dari server:
   * yang menang (durasi tercepat dulu), lalu yang gagal.
   */
  async function leaderboard() {
    if (!session) throw fail('auth', 'Belum login.');
    if (!session.admin) throw fail('forbidden', MSG.bukan_admin);
    if (session.demo) {
      return {
        demo: true,
        rows: [
          { name: 'Asayi', result: 'win', ms: 171000 }, { name: 'Contoh', result: 'win', ms: 204000 },
          { name: 'Demo', result: 'win', ms: 365000 }, { name: 'Tester', result: 'lose', ms: 240000 }
        ]
      };
    }
    var r = await rpc(cfg.rpcLeaderboard || 'ktlo_leaderboard', {});
    var list = Array.isArray(r) ? r : [];
    return {
      demo: false,
      rows: list.map(function (x) {
        return { name: x.onename, result: x.result === 'win' ? 'win' : 'lose', ms: x.elapsed_ms, at: x.finished_at || null };
      })
    };
  }

  root.KTLO = root.KTLO || {};
  root.KTLO.Api = {
    enabled: enabled, login: login, logout: logout, refreshFinal: refreshFinal, startRun: startRun, finishRun: finishRun,
    leaderboard: leaderboard,
    validName: validName, validDob: validDob,
    get name() { return session ? session.name : null; },
    get isAdmin() { return !!(session && session.admin); },
    get demo() { return !enabled; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
