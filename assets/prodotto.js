/*
  Sudditalia — pagina prodotto (sections/main-product.liquid, stili in assets/prodotto.css)
  Movimento sopra <product-stage> (effetti.js) e sopra varianti/carrello (theme.js), senza modificarli:
    titolo a righe        il titolo grande entra una riga alla volta (diviso dopo il caricamento dei font)
    set                   parallasse 3D e luce che seguono il mouse; tendina con zoom tra le foto;
                          contatore e lineette; lente al clic (mouse) o zoom con il dito (telefono)
    taglie                indicatore che scivola sotto la scelta, esaurite barrate in diagonale
    quantità / prezzo     il numero rotola, il prezzo si aggiorna con un piccolo ingresso
    carrello              il bottone segue gli stati di theme.js: .is-loading (caricamento) e l'avviso
                          [data-toast] (esito) → conferma animata o scossa d'errore
    barra su telefono     compare quando il bottone principale è passato sopra lo schermo; invia lo stesso form
  Con "riduci movimento" niente parallasse, niente tendina, tutto visibile subito.
*/
(function () {
  'use strict';
  if (window.__sudProdotto) return;
  window.__sudProdotto = true;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasIO = 'IntersectionObserver' in window;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function $(root, sel) { return root ? root.querySelector(sel) : null; }
  function $$(root, sel) { return root ? Array.prototype.slice.call(root.querySelectorAll(sel)) : []; }
  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function fontsReady(fn) {
    var done = false;
    var go = function () { if (!done) { done = true; fn(); } };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go);
    setTimeout(go, 1200);
  }

  function init(root) {
    if (root._pd) return;
    var cleanups = [];
    var ctx = {
      root: root,
      on: function (target, type, fn, opts) {
        if (!target) return;
        target.addEventListener(type, fn, opts);
        cleanups.push(function () { target.removeEventListener(type, fn, opts); });
      },
      keep: function (obs) { cleanups.push(function () { obs.disconnect(); }); return obs; },
      later: function (fn) { cleanups.push(fn); }
    };
    root._pd = { destroy: function () { cleanups.forEach(function (fn) { try { fn(); } catch (e) {} }); root._pd = null; } };

    // arrivando col sipario (effetti.js) gli ingressi aspettano che il telo si apra
    if (!reduce && document.documentElement.classList.contains('curtain-in')) root.style.setProperty('--pd-delay', '.45s');
    root.classList.add('pd-ok');

    [reveals, headline, stage, options, quantity, price, addToCart, stickyBar].forEach(function (part) {
      try { part(ctx); } catch (err) { if (window.console) console.error(err); }
    });
  }

  /* ------------------------------------------------------------------
     Ingressi [data-pd-in]: salgono e compaiono quando sono a schermo
     ------------------------------------------------------------------ */
  function reveals(ctx) {
    var els = $$(ctx.root, '[data-pd-in]');
    if (reduce || !hasIO) { els.forEach(function (el) { el.classList.add('is-in'); }); return; }
    var io = ctx.keep(new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' }));
    els.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------
     Titolo a righe
     ------------------------------------------------------------------ */
  function headline(ctx) {
    var h = $(ctx.root, '[data-pd-lines]');
    if (!h) return;
    if (reduce) { h.classList.add('is-split', 'is-in'); return; }
    var text = h.textContent.replace(/\s+/g, ' ').trim();
    if (!text) { h.classList.add('is-split', 'is-in'); return; }
    h.setAttribute('aria-label', text);
    var width = 0;

    function split() {
      var words = text.split(' ');
      h.textContent = '';
      var spans = words.map(function (w, i) {
        var s = document.createElement('span');
        s.style.display = 'inline-block';
        s.textContent = w;
        h.appendChild(s);
        if (i < words.length - 1) h.appendChild(document.createTextNode(' '));
        return s;
      });
      var lines = [];
      var top = null;
      spans.forEach(function (s) {
        var t = s.offsetTop;
        if (top === null || Math.abs(t - top) > 3) { lines.push([]); top = t; }
        lines[lines.length - 1].push(s.textContent);
      });
      h.textContent = '';
      lines.forEach(function (ws, i) {
        var line = document.createElement('span');
        line.className = 'pd-line';
        line.setAttribute('aria-hidden', 'true');
        var inner = document.createElement('span');
        inner.className = 'pd-line__i';
        inner.style.setProperty('--i', i);
        inner.textContent = ws.join(' ');
        line.appendChild(inner);
        h.appendChild(line);
      });
      width = h.clientWidth;
      h.classList.add('is-split');
    }

    fontsReady(function () {
      split();
      if (!hasIO) { h.classList.add('is-in'); return; }
      var io = ctx.keep(new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return;
        io.disconnect();
        requestAnimationFrame(function () { requestAnimationFrame(function () { h.classList.add('is-in'); }); });
      }, { threshold: 0.1 }));
      io.observe(h);
      // se i font arrivano dopo, le righe si rifanno (senza ripetere l'ingresso)
      if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(split);
    });
    var rt = 0;
    ctx.on(window, 'resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (h.classList.contains('is-split') && h.clientWidth !== width) split(); }, 150);
    });
  }

  /* ------------------------------------------------------------------
     Il set: tendina, contatore, parallasse, luce, lente e zoom
     ------------------------------------------------------------------ */
  function stage(ctx) {
    var st = $(ctx.root, '.pd-stage');
    var set = $(st, '[data-pd-set]');
    var box = $(set, '[data-pd-slides]');
    if (!st || !set || !box) return;
    var slides = $$(box, ':scope > [data-slide]');
    if (!slides.length) return;
    var n = slides.length;
    var wipe = $(box, '.pd-wipe');
    var light = $(set, '.pd-light');
    var lens = $(set, '.pd-lens');
    var lensIn = $(lens, '.pd-lens__in');
    var countCur = $(st, '.pd-count__cur');
    var countBar = $(st, '.pd-count__bar');
    var zoomOK = box.hasAttribute('data-pd-zoom') && lens && lensIn;
    var cursorLabel = box.getAttribute('data-cursor') || '';
    var current = Math.max(0, slides.findIndex(function (s) { return s.classList.contains('is-active'); }));
    var visible = !hasIO;
    var cleanT = 0;

    if (countBar) countBar.style.setProperty('--p', ((current + 1) / n).toFixed(3));

    /* ingresso del set */
    if (reduce || !hasIO) st.classList.add('is-in');
    else {
      var ioIn = ctx.keep(new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return;
        ioIn.disconnect();
        requestAnimationFrame(function () { st.classList.add('is-in'); });
      }, { threshold: 0.2 }));
      ioIn.observe(st);
    }
    if (hasIO) {
      ctx.keep(new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (!visible) settle(); })).observe(st);
    }

    function activeImage() { var s = slides[current]; return s ? s.querySelector('img') : null; }
    function poke() { box.dispatchEvent(new Event('pointerover', { bubbles: true })); }
    function updateCursor() {
      if (!zoomOK) return;
      if (!lensOn && activeImage()) box.setAttribute('data-cursor', cursorLabel);
      else box.removeAttribute('data-cursor');
    }

    /* passaggio tra le foto: product-stage cambia .is-active, qui si aggiunge la tendina */
    function clean() {
      slides.forEach(function (s) { s.classList.remove('pd-enter', 'pd-leave', 'pd-back', 'pd-up'); });
      if (wipe) wipe.className = 'pd-wipe';
    }
    function changed(prev, idx) {
      var dir;
      if (slides[idx].hasAttribute('data-worn')) dir = 'up';
      else if (n === 2) dir = idx > prev ? 'fwd' : 'back';
      else dir = ((idx - prev + n) % n) <= n / 2 ? 'fwd' : 'back';

      if (zoomed) exitZoom(true);
      count(idx, dir);
      if (lensOn) buildLens();
      updateCursor();
      if (reduce) return;

      clean();
      void box.offsetWidth;
      var extra = dir === 'back' ? 'pd-back' : dir === 'up' ? 'pd-up' : '';
      slides[prev].classList.add('pd-leave');
      slides[idx].classList.add('pd-enter');
      if (extra) { slides[prev].classList.add(extra); slides[idx].classList.add(extra); }
      if (wipe) wipe.classList.add('is-' + dir);
      clearTimeout(cleanT);
      cleanT = setTimeout(clean, 1650);
    }
    var mo = ctx.keep(new MutationObserver(function () {
      var idx = slides.findIndex(function (s) { return s.classList.contains('is-active'); });
      if (idx < 0 || idx === current) return;
      var prev = current;
      current = idx;
      changed(prev, idx);
    }));
    slides.forEach(function (s) { mo.observe(s, { attributes: true, attributeFilter: ['class'] }); });

    function count(idx, dir) {
      if (countBar) countBar.style.setProperty('--p', ((idx + 1) / n).toFixed(3));
      if (!countCur) return;
      var txt = (idx + 1 < 10 ? '0' : '') + (idx + 1);
      var spans = countCur.children;
      while (spans.length > 1) countCur.removeChild(spans[0]);
      var old = spans[0];
      var s = document.createElement('span');
      s.textContent = txt;
      if (reduce || !old) { countCur.textContent = ''; countCur.appendChild(s); return; }
      countCur.classList.toggle('is-back', dir === 'back');
      old.className = 'is-out';
      s.className = 'is-new';
      countCur.appendChild(s);
      setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); s.className = ''; }, 720);
    }

    /* misure (una volta, poi solo dopo scroll/resize) */
    var rect = null, setL = 0, setT = 0, setW = 0, setH = 0;
    function measure() {
      rect = st.getBoundingClientRect();
      setL = set.offsetLeft; setT = set.offsetTop;
      setW = set.offsetWidth; setH = set.offsetHeight;
    }
    ctx.on(window, 'scroll', function () { rect = null; }, { passive: true });
    ctx.on(window, 'resize', function () { rect = null; if (lensOn) exitLens(); if (zoomed) exitZoom(true); });

    /* parallasse 3D e luce (solo mouse, solo con il movimento permesso) */
    var tiltOn = finePointer && !reduce;
    var tx = 0, ty = 0, x = 0, y = 0, lxT = 0, lyT = 0, lx = 0, ly = 0, raf = 0;
    function frame() {
      raf = 0;
      x += (tx - x) * 0.08; y += (ty - y) * 0.08;
      lx += (lxT - lx) * 0.14; ly += (lyT - ly) * 0.14;
      set.style.transform = 'perspective(1600px) rotateX(' + (-y * 7).toFixed(3) + 'deg) rotateY(' + (x * 9).toFixed(3) + 'deg)';
      if (light) light.style.transform = 'translate3d(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px,0)';
      if (Math.abs(tx - x) > 0.0005 || Math.abs(ty - y) > 0.0005 || Math.abs(lxT - lx) > 0.3 || Math.abs(lyT - ly) > 0.3) kick();
    }
    function kick() { if (!raf && visible && tiltOn) raf = requestAnimationFrame(frame); }
    function settle() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (!tiltOn) return;
      tx = ty = x = y = 0;
      set.style.transform = '';
    }

    ctx.on(st, 'pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      measure();
      if (tiltOn) st.classList.add('is-hover');
    });
    ctx.on(st, 'pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      if (!rect) measure();
      if (lensOn) lensMove(e.clientX, e.clientY);
      if (!tiltOn) return;
      var px = (e.clientX - rect.left) / rect.width;
      var py = (e.clientY - rect.top) / rect.height;
      tx = lensOn ? 0 : clamp(px - 0.5, -0.5, 0.5);
      ty = lensOn ? 0 : clamp(py - 0.5, -0.5, 0.5);
      lxT = e.clientX - rect.left - setL - setW / 2;
      lyT = e.clientY - rect.top - setT - setH / 2;
      kick();
    }, { passive: true });
    ctx.on(st, 'pointerleave', function (e) {
      if (e.pointerType !== 'mouse') return;
      tx = ty = 0;
      st.classList.remove('is-hover');
      kick();
    });

    /* lente (mouse) */
    var lensOn = false, Z = 2.5, lensD = 0, lraf = 0, lpx = 0, lpy = 0, ltx = 0, lty = 0;
    function buildLens() {
      var src = slides[current];
      if (!src || !src.querySelector('img')) { exitLens(); return; }
      var c = src.cloneNode(true);
      ['data-slide', 'data-media-id', 'data-worn'].forEach(function (a) { c.removeAttribute(a); });
      c.classList.remove('pd-enter', 'pd-leave', 'pd-back', 'pd-up');
      c.classList.add('is-active');
      $$(c, '[id]').forEach(function (el) { el.removeAttribute('id'); });
      $$(c, 'img').forEach(function (im) {
        var k = im.closest('.pe__worn--double') ? 2 : 1;
        im.loading = 'eager';
        im.removeAttribute('fetchpriority');
        im.sizes = Math.round(setW * Z * k) + 'px';
        im.alt = '';
      });
      lensIn.textContent = '';
      lensIn.style.width = setW + 'px';
      lensIn.style.height = setH + 'px';
      lensIn.appendChild(c);
    }
    function lensFrame() {
      lraf = 0;
      lpx += (ltx - lpx) * 0.35; lpy += (lty - lpy) * 0.35;
      var r = lensD / 2;
      var cx = clamp(lpx, 0, setW), cy = clamp(lpy, 0, setH);
      lens.style.transform = 'translate3d(' + lpx.toFixed(1) + 'px,' + lpy.toFixed(1) + 'px,0)';
      lensIn.style.transform = 'translate3d(' + (r - cx * Z).toFixed(1) + 'px,' + (r - cy * Z).toFixed(1) + 'px,0) scale(' + Z + ')';
      if (lensOn && (Math.abs(ltx - lpx) > 0.3 || Math.abs(lty - lpy) > 0.3)) lraf = requestAnimationFrame(lensFrame);
    }
    function lensMove(cx, cy) {
      ltx = cx - rect.left - setL;
      lty = cy - rect.top - setT;
      if (!lraf) lraf = requestAnimationFrame(lensFrame);
    }
    function openLens(e) {
      if (!zoomOK || !activeImage()) return;
      measure();
      lensD = lens.offsetWidth;
      lensOn = true;
      tx = ty = 0; kick();
      buildLens();
      lpx = ltx = e.clientX - rect.left - setL;
      lpy = lty = e.clientY - rect.top - setT;
      lensFrame();
      lens.classList.add('is-on');
      st.classList.add('is-lens');
      updateCursor();
      poke();
    }
    function exitLens() {
      if (!lensOn) return;
      lensOn = false;
      lens.classList.remove('is-on');
      st.classList.remove('is-lens');
      updateCursor();
      poke();
      setTimeout(function () { if (!lensOn) lensIn.textContent = ''; }, 600);
    }

    /* zoom con il dito (telefono): tocca per ingrandire, trascina, tocca per uscire */
    var zoomed = false, ZT = 2.4, ztx = 0, zty = 0, pan = null, praf = 0, zoomT = 0;
    function applyZoom() {
      praf = 0;
      box.style.transform = 'translate3d(' + ztx.toFixed(1) + 'px,' + zty.toFixed(1) + 'px,0) scale(' + ZT + ')';
    }
    function clampZoom() {
      ztx = clamp(ztx, setW * (1 - ZT), 0);
      zty = clamp(zty, setH * (1 - ZT), 0);
    }
    function enterZoom(e) {
      var img = activeImage();
      if (!zoomOK || !img) return;
      var r = set.getBoundingClientRect();
      setW = r.width; setH = r.height;
      ztx = (e.clientX - r.left) * (1 - ZT);
      zty = (e.clientY - r.top) * (1 - ZT);
      clampZoom();
      zoomed = true;
      $$(slides[current], 'img').forEach(function (im) {
        var k = im.closest('.pe__worn--double') ? 2 : 1;
        im.sizes = Math.round(setW * ZT * k) + 'px';
      });
      set.classList.add('is-zoomed');
      clearTimeout(zoomT);
      if (!reduce) box.classList.add('is-zoom-anim');
      applyZoom();
      zoomT = setTimeout(function () { box.classList.remove('is-zoom-anim'); }, 650);
    }
    function exitZoom(instant) {
      if (!zoomed) return;
      zoomed = false;
      pan = null;
      clearTimeout(zoomT);
      if (praf) { cancelAnimationFrame(praf); praf = 0; }
      if (!reduce && !instant) box.classList.add('is-zoom-anim');
      else box.classList.remove('is-zoom-anim');
      box.style.transform = '';
      var finish = function () { box.classList.remove('is-zoom-anim'); if (!zoomed) set.classList.remove('is-zoomed'); };
      if (instant || reduce) finish(); else zoomT = setTimeout(finish, 650);
    }

    /* clic / tocco sulla foto. Durante lo zoom i gesti non arrivano a product-stage (niente cambio foto) */
    var down = null;
    ctx.on(box, 'pointerdown', function (e) {
      if (zoomed) {
        e.stopPropagation();
        pan = { id: e.pointerId, x: e.clientX, y: e.clientY, tx: ztx, ty: zty, t: Date.now(), moved: 0 };
        box.classList.remove('is-zoom-anim');
        try { box.setPointerCapture(e.pointerId); } catch (err) {}
        return;
      }
      down = { x: e.clientX, y: e.clientY, t: Date.now() };
    });
    ctx.on(box, 'pointermove', function (e) {
      if (!zoomed || !pan || e.pointerId !== pan.id) return;
      var dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      pan.moved = Math.max(pan.moved, Math.abs(dx) + Math.abs(dy));
      ztx = pan.tx + dx; zty = pan.ty + dy;
      clampZoom();
      if (!praf) praf = requestAnimationFrame(applyZoom);
    }, { passive: true });
    ctx.on(box, 'pointerup', function (e) {
      if (zoomed) {
        e.stopPropagation();
        if (pan && pan.moved < 8 && Date.now() - pan.t < 450) exitZoom(false);
        pan = null;
        return;
      }
      if (!down || !zoomOK) { down = null; return; }
      var moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y);
      var dt = Date.now() - down.t;
      down = null;
      if (moved > 8) return;
      if (e.pointerType === 'touch') { if (dt < 450) enterZoom(e); return; }
      if (e.button !== 0) return;
      if (lensOn) exitLens(); else openLens(e);
    });
    ctx.on(box, 'pointercancel', function () { down = null; pan = null; });
    ctx.on(box, 'pointerleave', function (e) { if (e.pointerType === 'mouse') exitLens(); });
    ctx.on(document, 'keydown', function (e) {
      if (e.key !== 'Escape') return;
      exitLens();
      exitZoom(false);
    });

    updateCursor();
    ctx.later(function () { clearTimeout(cleanT); clearTimeout(zoomT); settle(); });
  }

  /* ------------------------------------------------------------------
     Taglie: indicatore che scivola, esaurite barrate in diagonale
     ------------------------------------------------------------------ */
  function options(ctx) {
    var groups = $$(ctx.root, '.pd-opt').map(function (fs) {
      var box = $(fs, '[data-pd-values]');
      var ind = $(box, '.pd-ind');
      if (!box || !ind) return null;
      return { fs: fs, box: box, ind: ind, labels: $$(box, 'label'), pos: [], bw: 52, bh: 48 };
    }).filter(Boolean);
    if (!groups.length) return;

    function measure(g) {
      g.pos = g.labels.map(function (l) { return { x: l.offsetLeft, y: l.offsetTop, w: l.offsetWidth, h: l.offsetHeight }; });
      if (!g.pos.length || !g.pos[0].w) return false;
      g.bw = g.pos[0].w; g.bh = g.pos[0].h;
      g.ind.style.width = g.bw + 'px';
      g.ind.style.height = g.bh + 'px';
      g.labels.forEach(function (l, i) {
        var p = g.pos[i];
        l.style.setProperty('--len', Math.sqrt(p.w * p.w + p.h * p.h).toFixed(1) + 'px');
        l.style.setProperty('--ang', (-Math.atan2(p.h, p.w) * 180 / Math.PI).toFixed(2) + 'deg');
      });
      return true;
    }
    function place(g, anim) {
      var input = g.box.querySelector('input:checked');
      var p = input ? g.pos[g.labels.indexOf(input.nextElementSibling)] : null;
      if (!p) { g.fs.classList.remove('is-ready'); return; }
      g.ind.classList.toggle('is-anim', !!anim && !reduce);
      g.ind.classList.toggle('is-off', input.classList.contains('is-unavailable'));
      g.ind.style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0) scale(' + (p.w / g.bw).toFixed(4) + ',' + (p.h / g.bh).toFixed(4) + ')';
      g.fs.classList.add('is-ready');
    }
    function all(anim) { groups.forEach(function (g) { if (measure(g)) place(g, anim); }); }

    all(false);
    fontsReady(function () { all(false); });
    // theme.js aggiorna le disponibilità nello stesso evento: si aspetta un fotogramma
    ctx.on(ctx.root, 'change', function (e) {
      if (!e.target.closest || !e.target.closest('.pd-opt')) return;
      requestAnimationFrame(function () { groups.forEach(function (g) { place(g, true); }); });
    });
    if ('ResizeObserver' in window) {
      var ro = ctx.keep(new ResizeObserver(function () { all(false); }));
      groups.forEach(function (g) { ro.observe(g.box); });
    } else {
      ctx.on(window, 'resize', function () { all(false); });
    }
  }

  /* ------------------------------------------------------------------
     Quantità: il numero rotola nella direzione del cambio
     ------------------------------------------------------------------ */
  function quantity(ctx) {
    $$(ctx.root, '[data-pd-qty]').forEach(function (q) {
      var input = $(q, 'input');
      if (!input) return;
      var last = parseInt(input.value, 10) || 0;
      ctx.on(input, 'change', function () {
        var v = parseInt(input.value, 10) || 0;
        if (v !== last && !reduce) {
          input.classList.remove('is-up', 'is-down');
          void input.offsetWidth;
          input.classList.add(v > last ? 'is-up' : 'is-down');
        }
        last = v;
      });
      ctx.on(input, 'animationend', function () { input.classList.remove('is-up', 'is-down'); });
    });
  }

  /* ------------------------------------------------------------------
     Prezzo: theme.js lo riscrive al cambio variante → piccolo ingresso, copia nella barra
     ------------------------------------------------------------------ */
  function price(ctx) {
    var p = $(ctx.root, '[data-price]');
    if (!p) return;
    var barPrice = $(ctx.root, '[data-pd-bar-price]');
    ctx.keep(new MutationObserver(function () {
      if (barPrice) barPrice.innerHTML = p.innerHTML;
      if (reduce) return;
      var el = $(p, '.price');
      if (el) restart(el, 'is-swap');
    })).observe(p, { childList: true });
  }

  /* ------------------------------------------------------------------
     Aggiungi al carrello: theme.js mette .is-loading durante l'invio e mostra l'avviso [data-toast]
     (con .is-error se qualcosa va storto). Qui si legge quell'esito e si anima il bottone.
     ------------------------------------------------------------------ */
  function addToCart(ctx) {
    var btn = $(ctx.root, '[data-pd-atc]');
    if (!btn) return;
    var text = $(btn, '[data-add-to-cart-text]');
    var barBtn = $(ctx.root, '[data-pd-bar-btn]');
    var barText = $(ctx.root, '[data-pd-bar-text]');
    var toastEl = document.querySelector('[data-toast]');
    var pending = false, result = null, doneT = 0, errT = 0;

    function mirror() {
      if (!barBtn) return;
      barBtn.disabled = btn.disabled;
      ['is-loading', 'is-done', 'is-error'].forEach(function (c) { barBtn.classList.toggle(c, btn.classList.contains(c)); });
      if (barText && text) {
        var t = text.textContent.trim();
        if (barText.textContent !== t) barText.textContent = t;
      }
    }
    function success() {
      clearTimeout(doneT);
      btn.classList.remove('is-error');
      btn.classList.add('is-done');
      doneT = setTimeout(function () { btn.classList.remove('is-done'); }, 2400);
      var count = document.querySelector('[data-cart-count]');
      var cartLink = count && count.closest('a');
      if (cartLink && !reduce) {
        restart(cartLink, 'pd-cart-bump');
        setTimeout(function () { cartLink.classList.remove('pd-cart-bump'); }, 800);
      }
    }
    function fail() {
      clearTimeout(errT);
      if (!reduce) restart(btn, 'is-error');
      errT = setTimeout(function () { btn.classList.remove('is-error'); }, 650);
    }

    ctx.keep(new MutationObserver(function () {
      var loading = btn.classList.contains('is-loading');
      if (loading && !pending) {
        pending = true;
        result = null;
        clearTimeout(doneT);
        btn.classList.remove('is-done', 'is-error');
      } else if (!loading && pending) {
        pending = false;
        if (result === 'ok') success();
        else if (result === 'error') fail();
      }
      mirror();
    })).observe(btn, { attributes: true, attributeFilter: ['class', 'disabled'] });
    if (text) ctx.keep(new MutationObserver(mirror)).observe(text, { childList: true, characterData: true, subtree: true });
    if (toastEl) {
      ctx.keep(new MutationObserver(function () {
        if (!pending || toastEl.hidden) return;
        result = toastEl.classList.contains('is-error') ? 'error' : 'ok';
      })).observe(toastEl, { attributes: true, attributeFilter: ['hidden', 'class'], childList: true, subtree: true, characterData: true });
    }
    mirror();
    ctx.later(function () { clearTimeout(doneT); clearTimeout(errT); });
  }

  /* ------------------------------------------------------------------
     Barra di acquisto su telefono
     ------------------------------------------------------------------ */
  function stickyBar(ctx) {
    var bar = $(ctx.root, '[data-pd-bar]');
    var btn = $(ctx.root, '[data-pd-atc]');
    var pe = $(ctx.root, '.pe');
    if (!bar || !btn || !pe || !hasIO) return;
    var mq = window.matchMedia('(max-width: 989px)');
    var passed = false, inside = false;
    function update() {
      var show = mq.matches && passed && inside;
      if (bar.classList.contains('is-on') === show) return;
      bar.classList.toggle('is-on', show);
      document.documentElement.classList.toggle('pd-bar-on', show);
    }
    ctx.keep(new IntersectionObserver(function (en) {
      var e = en[en.length - 1];
      passed = !e.isIntersecting && e.boundingClientRect.top < 0;
      update();
    })).observe(btn);
    // la barra resta finché la sezione prodotto arriva in fondo allo schermo
    ctx.keep(new IntersectionObserver(function (en) {
      inside = en[en.length - 1].isIntersecting;
      update();
    }, { rootMargin: '-85% 0px 0px 0px' })).observe(pe);
    if (mq.addEventListener) {
      mq.addEventListener('change', update);
      ctx.later(function () { mq.removeEventListener('change', update); });
    }
    ctx.later(function () { document.documentElement.classList.remove('pd-bar-on'); });
  }

  function boot(scope) { $$(scope, '[data-pd]').forEach(init); }
  boot(document);
  document.addEventListener('shopify:section:load', function (e) { boot(e.target); });
  document.addEventListener('shopify:section:unload', function (e) {
    $$(e.target, '[data-pd]').forEach(function (r) { if (r._pd) r._pd.destroy(); });
  });
})();
