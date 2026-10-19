/* Konfigurasi frontend. Kosongkan supabaseUrl/supabaseAnonKey = MODE DEMO (tanpa backend).
 *
 * Isi dua baris di bawah dengan data project Supabase kamu
 * (Project Settings > API: "Project URL" dan kunci "anon public").
 * Anon key memang publik; yang melindungi data adalah fungsi SQL dan RLS di ktlo_backend.sql.
 * JANGAN PERNAH menaruh service_role key di sini.
 */
window.KTLO_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  rpcLogin: "ktlo_login",
  rpcStart: "ktlo_start_run",
  rpcFinish: "ktlo_finish_run"
};
