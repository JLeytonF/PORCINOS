/**
 * token-gate.js — Porcicultura Demo 1
 *
 * Valida el parámetro ?t= en la URL antes de renderizar cualquier contenido.
 * Si el token no coincide, redirige al sitio principal silenciosamente.
 *
 * USO: Cargar como primer <script> síncrono en <head>, ANTES del CSS.
 *
 * Token de acceso: definido en DEMO_ACCESS_TOKEN.
 * URL de acceso:   https://tu-demo.vercel.app/?t=porc2026-EvalDemo-x7K9mQz
 */

(function () {
  /* ── Token de acceso (cambiar aquí si se rota) ─────────────────────────── */
  var DEMO_ACCESS_TOKEN = "porc2026-EvalDemo-x7K9mQz";
  var REDIRECT_ON_FAIL  = "https://poultryia.com";
  /* ─────────────────────────────────────────────────────────────────────── */

  var params = new URLSearchParams(window.location.search);
  var supplied = params.get("t") || "";

  if (supplied !== DEMO_ACCESS_TOKEN) {
    /* Oculta el cuerpo inmediatamente para no mostrar flash de contenido */
    var style = document.createElement("style");
    style.textContent = "body,html{visibility:hidden!important;pointer-events:none}";
    document.head.appendChild(style);

    /* Redirige antes de que el parser termine de cargar los recursos */
    window.location.replace(REDIRECT_ON_FAIL);
  } else {
    /* Token válido → exponer bandera global para módulos que la necesiten */
    window.__DEMO1_AUTHORIZED = true;
  }
})();
