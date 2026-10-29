/* Copyright (c) 2026 qgdr. Project interim noncommercial LICENSE applies. */
(function (root) {
  'use strict';

  function q(s) {
    if (!(s > 0) || !Number.isFinite(s)) return NaN;
    const u = s - 1;
    return Math.abs(u) < .5 ? u - Math.log1p(u) : s - 1 - Math.log(s);
  }

  function qN(n, t) {
    if (!(n > 0) || !Number.isFinite(n) || !Number.isFinite(t)) return NaN;
    const u = t / Math.sqrt(n);
    // The exponent has no graph outside its logarithm's domain.
    if (!(u > -1)) return NaN;
    return n * (u - Math.log1p(u));
  }

  function h(n, t) {
    if (!(n > 0) || !Number.isFinite(n) || !Number.isFinite(t)) return NaN;
    if (t <= -Math.sqrt(n)) return 0;
    return Math.exp(-qN(n, t));
  }

  function control(t) {
    const u = Math.abs(t);
    return u === Infinity ? 0 : (1 + u) * Math.exp(-u);
  }

  root.GammaModel = Object.freeze({id: 'gamma-factorial-v1', q, qN, h, control});
})(typeof window === 'undefined' ? globalThis : window);
