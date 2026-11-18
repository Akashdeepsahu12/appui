// Serializes the rendered #phone into Paper-ready HTML: every element becomes an absolutely
// positioned layer, text stays live text, SVG stays vector, canvas comes from canvas-rec.js.
// No raster images are emitted (CSS url() backgrounds and <img> are dropped).
window.__dom2paper = (opts = {}) => {
  const root = document.querySelector('#phone');
  const R = root.getBoundingClientRect();
  let uid = 0, count = 0;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const qa = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const px = n => (Math.round(n * 10) / 10) + 'px';
  const fam = f => /mono|consolas|menlo|courier/i.test(f) ? "'JetBrains Mono'" : "'Inter'";
  const clear = c => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
  const out = r => r.bottom <= R.top || r.top >= R.bottom || r.right <= R.left || r.left >= R.right;
  const nameOf = el => (el.getAttribute('aria-label') || el.id || [...el.classList].filter(c => !/^(in|on|rise|lens|glass)$/.test(c)).join(' ') || el.tagName.toLowerCase()).slice(0, 48);

  function paintStyle(cs, isRoot) {
    const s = [];
    if (!clear(cs.backgroundColor)) s.push(`background-color:${cs.backgroundColor}`);
    const bi = cs.backgroundImage;
    if (bi && bi !== 'none' && !/url\(/.test(bi)) {
      s.push(`background-image:${bi}`);
      if (cs.backgroundSize && cs.backgroundSize !== 'auto') s.push(`background-size:${cs.backgroundSize}`);
      if (cs.backgroundPosition && cs.backgroundPosition !== '0% 0%') s.push(`background-position:${cs.backgroundPosition}`);
      if (cs.backgroundRepeat && cs.backgroundRepeat !== 'repeat') s.push(`background-repeat:${cs.backgroundRepeat}`);
    }
    const sides = ['Top', 'Right', 'Bottom', 'Left'].map(k => [parseFloat(cs[`border${k}Width`]) || 0, cs[`border${k}Style`], cs[`border${k}Color`]]);
    const live = sides.filter(([w, st, c]) => w > 0 && st !== 'none' && !clear(c));
    if (live.length === 4 && sides.every(x => x[0] === sides[0][0] && x[2] === sides[0][2])) s.push(`border:${sides[0][0]}px ${sides[0][1]} ${sides[0][2]}`);
    else sides.forEach(([w, st, c], i) => { if (w > 0 && st !== 'none' && !clear(c)) s.push(`border-${['top', 'right', 'bottom', 'left'][i]}:${w}px ${st} ${c}`); });
    const rr = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius];
    if (!isRoot && rr.some(r => parseFloat(r) > 0)) s.push(`border-radius:${rr.every(r => r === rr[0]) ? rr[0] : rr.join(' ')}`);
    if (cs.boxShadow && cs.boxShadow !== 'none') s.push(`box-shadow:${cs.boxShadow}`);
    if (+cs.opacity < 1) s.push(`opacity:${cs.opacity}`);
    const blur = /blur\([^)]+\)/.exec(cs.filter || ''); if (blur) s.push(`filter:${blur[0]}`);
    if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') s.push(`mix-blend-mode:${cs.mixBlendMode}`);
    return s;
  }
  const clips = cs => [cs.overflowX, cs.overflowY].some(o => o && o !== 'visible');

  function pseudo(el, which, ecs) {
    const c = getComputedStyle(el, which);
    if (!c || c.content === 'none' || c.content === 'normal' || c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0) return '';
    if (c.position !== 'absolute' && c.position !== 'fixed') return '';
    const st = paintStyle(c, false); if (!st.length) return '';
    const W = el.clientWidth, H = el.clientHeight, bl = parseFloat(ecs.borderLeftWidth) || 0, bt = parseFloat(ecs.borderTopWidth) || 0;
    let w = parseFloat(c.width), h = parseFloat(c.height), l = parseFloat(c.left), t = parseFloat(c.top);
    const r = parseFloat(c.right), b = parseFloat(c.bottom);
    if (isNaN(w)) w = W - (l || 0) - (r || 0); if (isNaN(h)) h = H - (t || 0) - (b || 0);
    if (isNaN(l)) l = W - (r || 0) - w; if (isNaN(t)) t = H - (b || 0) - h;
    const tr = (c.translate && c.translate !== 'none' ? c.translate : '').split(' ').map(parseFloat);
    if (tr[0]) l += tr[0]; if (tr[1]) t += tr[1];
    const m = /matrix\(([^)]+)\)/.exec(c.transform || ''); if (m) { const v = m[1].split(',').map(Number); l += v[4]; t += v[5]; }
    const sc = c.scale && c.scale !== 'none' ? parseFloat(c.scale) : 1; if (sc !== 1) { l += w * (1 - sc) / 2; t += h * (1 - sc) / 2; w *= sc; h *= sc; }
    if (w <= 0 || h <= 0) return '';
    count++;
    return `<div layer-name="${which.slice(2)}" style="position:absolute;left:${px(bl + l)};top:${px(bt + t)};width:${px(w)};height:${px(h)};${st.join(';')}"></div>`;
  }

  function text(node, o) {
    const raw = node.textContent; if (!raw.trim()) return '';
    const p = node.parentElement, cs = getComputedStyle(p);
    if (cs.visibility === 'hidden') return '';
    const range = document.createRange(); range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter(q => q.width > 0.5 && q.height > 0.5 && !out(q));
    if (!rects.length) return '';
    const L = Math.min(...rects.map(q => q.left)), T = Math.min(...rects.map(q => q.top));
    const Rr = Math.max(...rects.map(q => q.right)), B = Math.max(...rects.map(q => q.bottom));
    const multi = new Set(rects.map(q => Math.round(q.top))).size > 1;
    const lh = cs.lineHeight === 'normal' ? rects[0].height * 1.15 : parseFloat(cs.lineHeight);
    const t = raw.replace(/\s+/g, ' ').trim();
    const st = ['position:absolute', `left:${px(L - o.left)}`, `top:${px(T - o.top)}`, `width:${px(Rr - L + (multi ? 3 : 8))}`,
      `font-family:${fam(cs.fontFamily)}`, `font-size:${cs.fontSize}`, `font-weight:${cs.fontWeight}`, `color:${cs.color}`,
      `line-height:${px(multi ? lh : rects[0].height)}`, `letter-spacing:${cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing}`,
      multi ? 'white-space:normal' : 'white-space:pre'];
    if (multi) st.push(`height:${px(B - T)}`);
    if (cs.textTransform !== 'none') st.push(`text-transform:${cs.textTransform}`);
    if (cs.fontStyle === 'italic') st.push('font-style:italic');
    if (cs.fontVariantNumeric && cs.fontVariantNumeric !== 'normal') st.push(`font-variant-numeric:${cs.fontVariantNumeric}`);
    if (multi && cs.textAlign && /center|right|end/.test(cs.textAlign)) st.push(`text-align:${cs.textAlign === 'end' ? 'right' : cs.textAlign}`);
    count++;
    return `<div layer-name="${qa(t.slice(0, 40))}" style="${st.join(';')}">${esc(t)}</div>`;
  }

  function svg(el, o) {
    const r = el.getBoundingClientRect(); if (r.width < 0.5 || r.height < 0.5 || out(r)) return '';
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return '';
    const clone = el.cloneNode(true), pre = `s${++uid}_`;
    const src = [el, ...el.querySelectorAll('*')], dst = [clone, ...clone.querySelectorAll('*')];
    src.forEach((s, i) => {
      const d = dst[i], c = getComputedStyle(s);
      if (i > 0 && c.display === 'none') { d.remove(); return; }
      if (i > 0 && (s instanceof SVGGeometryElement || s instanceof SVGTextContentElement)) {
        for (const p of ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'opacity']) {
          const v = c.getPropertyValue(p); if (v && v !== 'normal') d.setAttribute(p, v.replace(/px\b/g, ''));
        }
        const pl = s.getAttribute('pathLength');
        if (pl && s.getTotalLength) {
          // Paper does not honour pathLength, so dashes are rescaled to real lengths.
          const k = s.getTotalLength() / +pl;
          const da = c.strokeDasharray; if (da && da !== 'none') d.setAttribute('stroke-dasharray', da.split(/[ ,]+/).map(x => (parseFloat(x) * k).toFixed(2)).join(' '));
          d.setAttribute('stroke-dashoffset', ((parseFloat(c.strokeDashoffset) || 0) * k).toFixed(2));
          d.removeAttribute('pathLength');
        }
      }
      d.removeAttribute('class'); d.removeAttribute('style');
      if (d.id) d.id = pre + d.id;
      for (const a of ['fill', 'stroke', 'clip-path', 'mask', 'filter']) { const v = d.getAttribute(a); if (v && v.includes('url(')) d.setAttribute(a, v.replace(/url\(["']?#([^"')]+)["']?\)/, (m, id) => `url(#${pre}${id})`)); }
    });
    clone.setAttribute('width', Math.round(r.width * 10) / 10); clone.setAttribute('height', Math.round(r.height * 10) / 10);
    const rot = cs.rotate && cs.rotate !== 'none' ? `transform:rotate(${cs.rotate.split(' ').pop()});` : '';
    clone.setAttribute('style', `position:absolute;left:${px(r.left - o.left)};top:${px(r.top - o.top)};${rot}${+cs.opacity < 1 ? `opacity:${cs.opacity};` : ''}`);
    for (const a of ['aria-hidden', 'role', 'aria-label', 'id', 'class']) clone.removeAttribute(a);
    clone.setAttribute('layer-name', el.getAttribute('aria-label') || el.closest('[aria-label]')?.getAttribute('aria-label')?.slice(0, 40) || 'vector');
    count++;
    return clone.outerHTML;
  }

  function canvas(el, o) {
    const r = el.getBoundingClientRect(), rec = el.__rec; if (!rec || !rec.ops.length || out(r)) return '';
    count++;
    return `<svg layer-name="${qa(el.id || 'chart')}" width="${Math.round(r.width)}" height="${Math.round(r.height)}" viewBox="0 0 ${el.width} ${el.height}" preserveAspectRatio="none" style="position:absolute;left:${px(r.left - o.left)};top:${px(r.top - o.top)}"><defs>${rec.defs.join('')}</defs>${rec.ops.join('')}</svg>`;
  }

  function kids(el, o) {
    let h = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) h += text(n, o);
      else if (n.nodeType === 1) {
        const t = n.tagName.toLowerCase();
        if (t === 'svg') h += svg(n, o);
        else if (t === 'canvas') h += canvas(n, o);
        else if (!['img', 'script', 'style', 'video', 'iframe', 'template'].includes(t)) h += node(n, o);
      }
    }
    return h;
  }

  function node(el, o) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || +cs.opacity === 0) return '';
    const r = el.getBoundingClientRect();
    const st = cs.visibility === 'hidden' ? [] : paintStyle(cs, false);
    const before = pseudo(el, '::before', cs), after = pseudo(el, '::after', cs);
    // A clip that matches the parent's box adds nothing, and Paper turns such layers into flow layout.
    const same = Math.abs(r.left - o.left) < 0.6 && Math.abs(r.top - o.top) < 0.6 && Math.abs(r.width - o.width) < 0.6 && Math.abs(r.height - o.height) < 0.6;
    const clip = clips(cs) && r.width > 0 && r.height > 0 && !same;
    const zero = r.width < 0.5 || r.height < 0.5;
    // Wrappers that paint nothing and clip nothing are flattened into their parent.
    if (zero || (!st.length && !before && !after && !clip)) {
      if (!zero && out(r) && !clip) return kids(el, o);
      return kids(el, o);
    }
    if (out(r)) return '';
    const inner = before + kids(el, r) + after;
    count++;
    return `<div layer-name="${qa(nameOf(el))}" style="position:absolute;left:${px(r.left - o.left)};top:${px(r.top - o.top)};width:${px(r.width)};height:${px(r.height)};${st.join(';')}${clip ? ';overflow:hidden' : ''}">${inner}</div>`;
  }

  const cs = getComputedStyle(root);
  const body = kids(root, R);
  const html = `<div layer-name="${qa(opts.name || 'Screen')}" style="position:relative;flex-shrink:0;width:${px(R.width)};height:${px(R.height)};border-radius:28px;overflow:hidden;${paintStyle(cs, true).join(';')}">${body}</div>`;
  return { html, count, width: R.width, height: R.height };
};
