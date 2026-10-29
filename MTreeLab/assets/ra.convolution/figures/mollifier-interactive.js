/* Compact mollifier, no dependencies. Numerical integration splits at every
   corner of f, then uses 48-point Gauss–Legendre quadrature on each smooth part.
   Public inspection API: window.mollifierDemo.{getState,setState,math}.
   math contains f, rho, rhoEpsilon, convolve, kernelArea, knots, and normalizer.
   setState accepts {x, epsilon, playing}; it returns the resulting state. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const plot = { left: 64, right: 844, min: -3.8, max: 3.8 };
  const limits = { x: [-2.8, 2.8], epsilon: [0.22, 1] };
  const knots = [
    [-2.45, 0], [-1.65, 1.46], [-0.8, 0.43],
    [-0.16, 1.06], [0.42, 0.5], [1.23, 1.53], [2.45, 0]
  ];
  const state = { x: -0.7, epsilon: 0.65, playing: false };
  let direction = 1;
  let previousTime = null;
  let frame = 0;
  let curveEpsilon = NaN;

  const clamp = (value, [min, max]) => Math.max(min, Math.min(max, value));
  const px = x => plot.left + (x - plot.min) / (plot.max - plot.min) * (plot.right - plot.left);
  const inputY = y => 168 - 57 * y;
  const kernelY = y => 343 - 35 * y;
  const outputY = y => 526 - 57 * y;
  const number = value => (Math.abs(value) < 0.0005 ? 0 : value).toFixed(2).replace('-', '−');

  function gaussLegendre(n) {
    const nodes = new Float64Array(n);
    const weights = new Float64Array(n);
    for (let i = 0; i < Math.ceil(n / 2); i++) {
      let z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5));
      let slope = 0;
      for (let iteration = 0; iteration < 30; iteration++) {
        let p0 = 1, p1 = z;
        for (let j = 2; j <= n; j++) {
          const p2 = ((2 * j - 1) * z * p1 - (j - 1) * p0) / j;
          p0 = p1; p1 = p2;
        }
        slope = n * (z * p1 - p0) / (z * z - 1);
        const next = z - p1 / slope;
        if (Math.abs(next - z) < 3e-15) { z = next; break; }
        z = next;
      }
      // Re-evaluate the derivative at the converged root for the weight.
      let p0 = 1, p1 = z;
      for (let j = 2; j <= n; j++) {
        const p2 = ((2 * j - 1) * z * p1 - (j - 1) * p0) / j;
        p0 = p1; p1 = p2;
      }
      slope = n * (z * p1 - p0) / (z * z - 1);
      const weight = 2 / ((1 - z * z) * slope * slope);
      nodes[i] = -z; nodes[n - 1 - i] = z;
      weights[i] = weight; weights[n - 1 - i] = weight;
    }
    return { nodes, weights };
  }

  const quadrature = gaussLegendre(48);
  const normalizationQuadrature = gaussLegendre(128);

  function integrate(fn, a, b, rule = quadrature) {
    if (b <= a) return 0;
    const middle = (a + b) / 2;
    const half = (b - a) / 2;
    let sum = 0;
    for (let j = 0; j < rule.nodes.length; j++) {
      sum += rule.weights[j] * fn(middle + half * rule.nodes[j]);
    }
    return half * sum;
  }

  function rawRho(u) {
    return Math.abs(u) < 1 ? Math.exp(-1 / (1 - u * u)) : 0;
  }

  const normalizer = 1 / integrate(rawRho, -1, 1, normalizationQuadrature);
  const rho = u => normalizer * rawRho(u);
  const rhoEpsilon = (t, epsilon = state.epsilon) => {
    if (!(epsilon > 0)) throw new RangeError('epsilon must be positive');
    return rho(t / epsilon) / epsilon;
  };

  function f(t) {
    if (t <= knots[0][0] || t >= knots[knots.length - 1][0]) return 0;
    for (let i = 1; i < knots.length; i++) {
      if (t <= knots[i][0]) {
        const [a, fa] = knots[i - 1];
        const [b, fb] = knots[i];
        return fa + (fb - fa) * (t - a) / (b - a);
      }
    }
    return 0;
  }

  function convolve(x, epsilon = state.epsilon) {
    if (!(epsilon > 0)) throw new RangeError('epsilon must be positive');
    if (x + epsilon <= knots[0][0] || x - epsilon >= knots[knots.length - 1][0]) return 0;
    // u=(x-t)/epsilon removes the 1/epsilon factor and keeps a fixed [-1,1]
    // integration range. Splitting at corners prevents quadrature of a kink.
    const cuts = [-1, 1];
    for (const [t] of knots) {
      const u = (x - t) / epsilon;
      if (u > -1 && u < 1) cuts.push(u);
    }
    cuts.sort((a, b) => a - b);
    let result = 0;
    for (let i = 1; i < cuts.length; i++) {
      result += integrate(u => f(x - epsilon * u) * rho(u), cuts[i - 1], cuts[i]);
    }
    return Math.max(0, result);
  }

  function kernelArea(epsilon = state.epsilon) {
    if (!(epsilon > 0)) throw new RangeError('epsilon must be positive');
    return integrate(t => rhoEpsilon(t, epsilon), -epsilon, epsilon, normalizationQuadrature);
  }

  function linePath(points) {
    return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(3)},${y.toFixed(3)}`).join(' ');
  }

  function fillPath(points, baseline) {
    return `${linePath(points)} L${points[points.length - 1][0].toFixed(3)},${baseline} L${points[0][0].toFixed(3)},${baseline} Z`;
  }

  function drawInput() {
    const input = [[plot.min, 0], ...knots, [plot.max, 0]];
    const points = input.map(([x, y]) => [px(x), inputY(y)]);
    $('input-curve').setAttribute('d', linePath(points));
    $('local-input-curve').setAttribute('d', linePath(points));
    $('input-fill').setAttribute('d', fillPath(points, 168));
    $('local-input-fill').setAttribute('d', fillPath(points, 168));
    $('original-ghost').setAttribute('d', linePath(input.map(([x, y]) => [px(x), outputY(y)])));
    const svgNS = 'http://www.w3.org/2000/svg';
    for (let x = -3; x <= 3; x++) {
      const tick = document.createElementNS(svgNS, 'line');
      tick.setAttribute('x1', px(x)); tick.setAttribute('x2', px(x));
      tick.setAttribute('y1', '526'); tick.setAttribute('y2', '531');
      tick.setAttribute('class', 'tick');
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', px(x)); label.setAttribute('y', '549');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'note math');
      label.textContent = String(x).replace('-', '−');
      $('x-ticks').append(tick, label);
    }
  }

  function drawOutput() {
    if (curveEpsilon === state.epsilon) return;
    const points = [];
    for (let i = 0; i <= 780; i++) {
      const x = plot.min + (plot.max - plot.min) * i / 780;
      points.push([px(x), outputY(convolve(x))]);
    }
    $('output-curve').setAttribute('d', linePath(points));
    $('output-fill').setAttribute('d', fillPath(points, 526));
    curveEpsilon = state.epsilon;
  }

  function draw() {
    drawOutput();
    const { x, epsilon } = state;
    const center = px(x);
    const left = px(x - epsilon), right = px(x + epsilon);
    $('window-band').setAttribute('x', left);
    $('window-band').setAttribute('width', right - left);
    $('local-input-window').setAttribute('x', left);
    $('local-input-window').setAttribute('width', right - left);
    const kernelPoints = [];
    for (let i = 0; i <= 240; i++) {
      const u = -1 + i / 120;
      kernelPoints.push([px(x + epsilon * u), kernelY(rho(u) / epsilon)]);
    }
    $('kernel-curve').setAttribute('d', linePath(kernelPoints));
    $('kernel-fill').setAttribute('d', fillPath(kernelPoints, 343));
    $('support-bracket').setAttribute('d', `M${left},351 v7 H${right} v-7`);
    $('support-label').setAttribute('x', center);
    $('position-guide').setAttribute('x1', center);
    $('position-guide').setAttribute('x2', center);
    $('input-point').setAttribute('cx', center);
    $('input-point').setAttribute('cy', inputY(f(x)));
    const outputHeight = outputY(convolve(x));
    for (const id of ['output-point', 'output-halo']) {
      $(id).setAttribute('cx', center); $(id).setAttribute('cy', outputHeight);
    }
    $('current-x-label').setAttribute('x', center);
    $('position').value = x;
    $('epsilon').value = epsilon;
    $('position-value').textContent = `x = ${number(x)}`;
    $('epsilon-value').textContent = `ε = ${number(epsilon)}`;
    $('mollifier').dataset.x = x;
    $('mollifier').dataset.epsilon = epsilon;
  }

  function updatePlayback() {
    $('play').setAttribute('aria-pressed', String(state.playing));
    $('play-icon').textContent = state.playing ? 'Ⅱ' : '▶';
    $('play-label').textContent = state.playing ? '暂停' : '播放';
    $('animation-status').textContent = state.playing ? '窗口正在左右移动。' : '动画已暂停，可拖动窗口位置和平滑宽度。';
  }

  function tick(time) {
    if (!state.playing) { frame = 0; previousTime = null; return; }
    if (previousTime !== null) {
      const dt = Math.min((time - previousTime) / 1000, 0.08);
      state.x += direction * dt * 0.46;
      if (state.x >= limits.x[1]) { state.x = limits.x[1]; direction = -1; }
      if (state.x <= limits.x[0]) { state.x = limits.x[0]; direction = 1; }
    }
    previousTime = time;
    draw();
    frame = requestAnimationFrame(tick);
  }

  function setState(next = {}) {
    if (Number.isFinite(next.x)) state.x = clamp(next.x, limits.x);
    if (Number.isFinite(next.epsilon)) state.epsilon = clamp(next.epsilon, limits.epsilon);
    if (typeof next.playing === 'boolean') state.playing = next.playing;
    draw();
    updatePlayback();
    if (state.playing && !frame) frame = requestAnimationFrame(tick);
    if (!state.playing && frame) { cancelAnimationFrame(frame); frame = 0; previousTime = null; }
    return getState();
  }

  function getState() {
    return {
      ...state,
      input: f(state.x), value: convolve(state.x),
      support: [state.x - state.epsilon, state.x + state.epsilon],
      kernelPeak: rho(0) / state.epsilon,
      kernelArea: kernelArea(),
      outputPoint: { x: px(state.x), y: outputY(convolve(state.x)) }
    };
  }

  $('play').addEventListener('click', () => setState({ playing: !state.playing }));
  $('position').addEventListener('input', event => setState({ x: Number(event.target.value), playing: false }));
  $('epsilon').addEventListener('input', event => setState({ epsilon: Number(event.target.value) }));
  // Avoid hidden-tab catch-up, while preserving the user's play/pause choice.
  document.addEventListener('visibilitychange', () => { previousTime = null; });

  window.mollifierDemo = Object.freeze({
    getState, setState,
    math: Object.freeze({
      f, rho, rhoEpsilon, convolve, kernelArea, normalizer,
      knots: Object.freeze(knots.map(point => Object.freeze([...point]))),
      domain: Object.freeze([plot.min, plot.max])
    })
  });
  drawInput();
  setState();
})();
