// Records every 2D canvas frame as SVG so charts export as editable vectors, not pixels.
// Installed before page scripts; each frame restarts at a full clearRect or a canvas resize.
(() => {
  const P = CanvasRenderingContext2D.prototype;
  const norm = document.createElement('canvas').getContext('2d');
  const color = c => { norm.fillStyle = '#000'; norm.fillStyle = c; return norm.fillStyle; };
  const rec = cv => cv.__rec || (cv.__rec = { ops: [], defs: [], path: '', gid: 0 });
  const f = n => Math.round(n * 100) / 100;
  const pt = (ctx, x, y) => { const m = ctx.getTransform(); return `${f(m.a * x + m.c * y + m.e)} ${f(m.b * x + m.d * y + m.f)}`; };
  const scaleOf = ctx => { const m = ctx.getTransform(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; };
  const wrap = (name, fn) => {
    const orig = P[name]; if (!orig) return;
    P[name] = function (...a) { try { fn.call(this, rec(this.canvas), ...a); } catch (e) { /* recording never breaks drawing */ } return orig.apply(this, a); };
  };
  const seg = (r, cmd) => { r.path += (r.path ? 'L' : 'M') + cmd; };
  function arcPts(ctx, r, cx, cy, rx, ry, rot, a0, a1, ccw) {
    let sw = a1 - a0;
    if (Math.abs(sw) >= 2 * Math.PI) sw = ccw ? -2 * Math.PI : 2 * Math.PI;
    else if (!ccw && sw < 0) sw += 2 * Math.PI;
    else if (ccw && sw > 0) sw -= 2 * Math.PI;
    const n = Math.max(6, Math.ceil(Math.abs(sw) / (Math.PI / 40)));
    for (let i = 0; i <= n; i++) {
      const t = a0 + sw * i / n, ex = rx * Math.cos(t), ey = ry * Math.sin(t);
      seg(r, pt(ctx, cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot)));
    }
  }
  const gradOrig = { lin: P.createLinearGradient, rad: P.createRadialGradient };
  P.createLinearGradient = function (...a) { const g = gradOrig.lin.apply(this, a); g.__g = { type: 'lin', a, stops: [] }; return g; };
  P.createRadialGradient = function (...a) { const g = gradOrig.rad.apply(this, a); g.__g = { type: 'rad', a, stops: [] }; return g; };
  const addStop = CanvasGradient.prototype.addColorStop;
  CanvasGradient.prototype.addColorStop = function (o, c) { this.__g && this.__g.stops.push([o, color(c)]); return addStop.call(this, o, c); };
  const stopAttr = c => { const m = /rgba\(([^)]+)\)/.exec(c); if (!m) return `stop-color="${c}"`; const p = m[1].split(',').map(s => s.trim()); return `stop-color="rgb(${p[0]},${p[1]},${p[2]})" stop-opacity="${p[3]}"`; };
  function paint(ctx, r, style) {
    if (typeof style === 'string') return color(style);
    const g = style && style.__g; if (!g) return '#000';
    const id = `cg${Math.random().toString(36).slice(2, 7)}${r.gid++}`, m = ctx.getTransform(), s = scaleOf(ctx);
    const T = (x, y) => [f(m.a * x + m.c * y + m.e), f(m.b * x + m.d * y + m.f)];
    const stops = g.stops.map(([o, c]) => `<stop offset="${o}" ${stopAttr(c)}/>`).join('');
    if (g.type === 'lin') { const [x1, y1] = T(g.a[0], g.a[1]), [x2, y2] = T(g.a[2], g.a[3]); r.defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`); }
    else { const [fx, fy] = T(g.a[0], g.a[1]), [cx, cy] = T(g.a[3], g.a[4]); r.defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${f(g.a[5] * s)}" fx="${fx}" fy="${fy}">${stops}</radialGradient>`); }
    return `url(#${id})`;
  }
  const alphaOf = (ctx, c) => { const a = ctx.globalAlpha; const m = /rgba\([^)]*,\s*([\d.]+)\)/.exec(c); return f(a * (m ? +m[1] : 1)); };
  const fillAttrs = (ctx, r) => { const p = paint(ctx, r, ctx.fillStyle), base = p.startsWith('rgba') ? p.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, 'rgb($1,$2,$3)') : p; return `fill="${base}" fill-opacity="${alphaOf(ctx, p)}"`; };
  const strokeAttrs = (ctx, r) => {
    const p = paint(ctx, r, ctx.strokeStyle), base = p.startsWith('rgba') ? p.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, 'rgb($1,$2,$3)') : p, s = scaleOf(ctx), d = ctx.getLineDash();
    return `fill="none" stroke="${base}" stroke-opacity="${alphaOf(ctx, p)}" stroke-width="${f(ctx.lineWidth * s)}" stroke-linecap="${ctx.lineCap}" stroke-linejoin="${ctx.lineJoin}"${d.length ? ` stroke-dasharray="${d.map(x => f(x * s)).join(' ')}"` : ''}`;
  };
  wrap('beginPath', r => { r.path = ''; });
  wrap('moveTo', function (r, x, y) { r.path += 'M' + pt(this, x, y); });
  wrap('lineTo', function (r, x, y) { seg(r, pt(this, x, y)); });
  wrap('bezierCurveTo', function (r, a, b, c, d, e, g) { r.path += `C${pt(this, a, b)} ${pt(this, c, d)} ${pt(this, e, g)}`; });
  wrap('quadraticCurveTo', function (r, a, b, c, d) { r.path += `Q${pt(this, a, b)} ${pt(this, c, d)}`; });
  wrap('closePath', r => { r.path += 'Z'; });
  wrap('arc', function (r, x, y, rad, a0, a1, ccw) { arcPts(this, r, x, y, rad, rad, 0, a0, a1, !!ccw); });
  wrap('ellipse', function (r, x, y, rx, ry, rot, a0, a1, ccw) { arcPts(this, r, x, y, rx, ry, rot, a0, a1, !!ccw); });
  const rectPath = (ctx, x, y, w, h) => `M${pt(ctx, x, y)}L${pt(ctx, x + w, y)}L${pt(ctx, x + w, y + h)}L${pt(ctx, x, y + h)}Z`;
  function rrPath(ctx, x, y, w, h, rr) {
    const k = Math.min(Math.abs(w), Math.abs(h)) / 2, q = Math.min(k, Array.isArray(rr) ? (typeof rr[0] === 'number' ? rr[0] : (rr[0] && rr[0].x) || 0) : (typeof rr === 'number' ? rr : (rr && rr.x) || 0));
    const t = { path: '' };
    t.path += 'M' + pt(ctx, x + q, y);
    arcPts(ctx, t, x + w - q, y + q, q, q, 0, -Math.PI / 2, 0, false);
    arcPts(ctx, t, x + w - q, y + h - q, q, q, 0, 0, Math.PI / 2, false);
    arcPts(ctx, t, x + q, y + h - q, q, q, 0, Math.PI / 2, Math.PI, false);
    arcPts(ctx, t, x + q, y + q, q, q, 0, Math.PI, Math.PI * 1.5, false);
    return t.path + 'Z';
  }
  wrap('rect', function (r, x, y, w, h) { r.path += rectPath(this, x, y, w, h); });
  wrap('roundRect', function (r, x, y, w, h, rr) { r.path += rrPath(this, x, y, w, h, rr); });
  wrap('fill', function (r) { if (r.path) r.ops.push(`<path d="${r.path}" ${fillAttrs(this, r)}/>`); });
  wrap('stroke', function (r) { if (r.path) r.ops.push(`<path d="${r.path}" ${strokeAttrs(this, r)}/>`); });
  wrap('fillRect', function (r, x, y, w, h) { r.ops.push(`<path d="${rectPath(this, x, y, w, h)}" ${fillAttrs(this, r)}/>`); });
  wrap('strokeRect', function (r, x, y, w, h) { r.ops.push(`<path d="${rectPath(this, x, y, w, h)}" ${strokeAttrs(this, r)}/>`); });
  wrap('fillText', function (r, text, x, y) {
    const m = /(\d+(?:\.\d+)?)px/.exec(this.font), size = m ? +m[1] * scaleOf(this) : 10;
    const anchor = { center: 'middle', right: 'end', end: 'end' }[this.textAlign] || 'start';
    const [X, Y] = pt(this, x, y).split(' ');
    r.ops.push(`<text x="${X}" y="${Y}" font-family="${/mono/i.test(this.font) ? 'JetBrains Mono' : 'Inter'}" font-size="${f(size)}" text-anchor="${anchor}" ${fillAttrs(this, r)}>${String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`);
  });
  wrap('clearRect', function (r, x, y, w, h) { if (w * scaleOf(this) >= this.canvas.width - 1 && h * scaleOf(this) >= this.canvas.height - 1) { r.ops = []; r.defs = []; } });
  for (const dim of ['width', 'height']) {
    const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, dim);
    Object.defineProperty(HTMLCanvasElement.prototype, dim, { get: d.get, set(v) { if (this.__rec) { this.__rec.ops = []; this.__rec.defs = []; } d.set.call(this, v); }, configurable: true });
  }
})();
