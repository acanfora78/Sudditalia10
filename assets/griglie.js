/*
  Griglie del tema Sudditalia (senza librerie)
    .g-card              scheda prodotto: entrata a cascata in prospettiva, inclinazione 3D che segue
                         il puntatore con un riflesso di luce (solo mouse / trackpad)
    [data-g-in]          intestazioni e pannelli che entrano quando arrivano nello schermo
    [data-g-drift]       titolo che scivola in orizzontale mentre la pagina scorre
    [data-g-lift]        colonne pari della griglia che salgono più lente (parallasse)
    [data-g-rail]        striscia col dito / carosello: barra di avanzamento, frecce e, con il mouse,
                         trascinamento con inerzia; le schede si inclinano un poco in base alla velocità
    [data-g-acc]         collezioni a fisarmonica (computer) o striscia di pannelli (telefono),
                         con l'immagine in parallasse
    product-recommendations[data-url]   prodotti correlati caricati dopo la pagina
  Le foto delle schede le scopre effetti.js (.card__media → .rv-m): qui si sincronizza solo il ritardo,
  così la foto non viene animata due volte.
  Con "riduci movimento" non parte nessun movimento e tutto resta visibile.
  Il file può essere incluso da più sezioni: gira una volta sola e poi ricontrolla la pagina.
*/
(function () {
  'use strict';

  if (window.SudGriglie) { window.SudGriglie.scan(document); return; }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var hasIO = 'IntersectionObserver' in window;
  var raf = window.requestAnimationFrame.bind(window);
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function each(root, sel, fn) { Array.prototype.forEach.call(root.querySelectorAll(sel), fn); }
  function cursorLabel(key, fallback) {
    var s = window.theme && window.theme.strings && window.theme.strings.cursor;
    return (s && s[key]) || fallback;
  }
  // il cursore personalizzato c'è solo se effetti.js l'ha creato (mouse e niente "riduci movimento")
  function hasCursor() { return !!document.querySelector('.cursor'); }

  /* ------------------------------------------------------------------
     Scroll: un solo ascoltatore, lavora solo per gli elementi a schermo.
     Le posizioni si misurano all'avvio e quando cambia la pagina, non a ogni frame.
     ------------------------------------------------------------------ */
  var scrollers = [];
  var scrollGen = 0;
  var ticking = false;
  var vh = window.innerHeight;
  var sio = hasIO ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.target._gScroll) e.target._gScroll.visible = e.isIntersecting; });
    requestTick();
  }, { rootMargin: '15% 0px' }) : null;

  function requestTick() { if (!ticking) { ticking = true; raf(tick); } }
  function tick() {
    ticking = false;
    var y = window.scrollY;
    for (var i = 0; i < scrollers.length; i++) {
      var s = scrollers[i];
      if (s.visible) s.update(y);
    }
  }
  function addScroller(el, measure, update) {
    var s = { el: el, visible: !sio, measure: measure, update: update };
    el._gScroll = s;
    scrollers.push(s);
    measure();
    if (sio) sio.observe(el);
    requestTick();
  }
  function remeasure() {
    vh = window.innerHeight;
    scrollers = scrollers.filter(function (s) {
      if (s.el.isConnected) return true;
      if (sio) sio.unobserve(s.el);
      return false;
    });
    scrollers.forEach(function (s) { s.measure(); });
    requestTick();
  }
  var rzTimer = 0;
  function remeasureSoon() { clearTimeout(rzTimer); rzTimer = setTimeout(remeasure, 140); }
  function pageTop(el) { return el.getBoundingClientRect().top + window.scrollY; }

  if (!reduce) {
    window.addEventListener('scroll', function () { scrollGen++; requestTick(); }, { passive: true });
    window.addEventListener('resize', remeasureSoon);
    window.addEventListener('load', remeasureSoon);
    // la pagina cambia altezza (foto, font, sezioni sopra): si rimisura con calma
    if ('ResizeObserver' in window) new ResizeObserver(remeasureSoon).observe(document.body);
  }

  /* ------------------------------------------------------------------
     Entrate: .g-pre finché l'elemento è sotto lo schermo, poi .g-in
     ------------------------------------------------------------------ */
  function belowFold(el) { return el.getBoundingClientRect().top > window.innerHeight * 0.85; }
  function byDomOrder(a, b) { return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1; }

  // schede: stesse soglie di effetti.js, così scheda e foto partono nello stesso frame
  var cardIO = hasIO && !reduce ? new IntersectionObserver(function (entries) {
    var batch = [];
    entries.forEach(function (e) { if (e.isIntersecting) batch.push(e.target); });
    batch.sort(byDomOrder).forEach(function (card, i) {
      cardIO.unobserve(card);
      var d = (i * 0.09).toFixed(2) + 's';
      card.style.setProperty('--cd', d);
      var media = card.querySelector('.card__media');
      if (media) media.style.setProperty('--d', d);   // ritardo della foto (effetti.js) = ritardo della scheda
      card.classList.add('g-in');
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }) : null;

  var inIO = hasIO && !reduce ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      inIO.unobserve(e.target);
      e.target.classList.add('g-in');
      if (e.target._gOnIn) e.target._gOnIn();
    });
  }, { threshold: 0.15 }) : null;

  function enter(el) {
    if (el._gIn) return;
    el._gIn = true;
    if (!inIO || !belowFold(el)) return;
    el.classList.add('g-pre');
    inIO.observe(el);
  }

  /* ------------------------------------------------------------------
     Scheda prodotto
     ------------------------------------------------------------------ */
  function cards(root) {
    var list = Array.prototype.filter.call(root.querySelectorAll('.g-card'), function (el) { return !el._g; });
    if (!list.length) return;
    // prima tutte le misure, poi tutte le modifiche: niente ricalcoli a catena
    var below = cardIO ? list.map(belowFold) : [];
    list.forEach(function (el, i) {
      el._g = true;
      var media = el.querySelector('.card__media');
      if (below[i]) {
        el.classList.add('g-pre');
        // effetti.js scopre le foto già presenti all'apertura; per quelle arrivate dopo lo fa .g-m
        if (media && !media.classList.contains('rv-m')) media.classList.add('g-m');
        cardIO.observe(el);
      }
      if (!reduce && media && finePointer.matches) tilt(el, media);
    });
  }

  function tilt(el, media) {
    var glare = media.querySelector('.g-card__glare');
    var rect = null, gen = -1;
    var tx = 0, ty = 0, ts = 1, x = 0, y = 0, s = 1;
    var running = false, on = false;
    function frame() {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      s += (ts - s) * 0.12;
      var settled = Math.abs(tx - x) < 0.001 && Math.abs(ty - y) < 0.001 && Math.abs(ts - s) < 0.0005;
      if (settled && !on) {
        media.style.transform = '';
        if (glare) glare.style.transform = '';
        running = false;
        return;
      }
      media.style.transform = 'perspective(900px) rotateX(' + (-y * 7).toFixed(2) + 'deg) rotateY(' + (x * 9).toFixed(2) + 'deg) scale(' + s.toFixed(4) + ')';
      if (glare) glare.style.transform = 'translate3d(' + (x * 25).toFixed(2) + '%,' + (y * 25).toFixed(2) + '%,0)';
      if (settled) { running = false; return; }
      raf(frame);
    }
    function start() { if (!running) { running = true; raf(frame); } }
    el.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      on = true;
      ts = 1.025;
      gen = -1;
      el.classList.add('is-tilt');
      start();
    });
    el.addEventListener('pointermove', function (e) {
      if (!on) return;
      // si rimisura solo se la pagina è scorsa dall'ultima volta
      if (gen !== scrollGen || !rect) { rect = media.getBoundingClientRect(); gen = scrollGen; }
      if (!rect.width) return;
      tx = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      ty = clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
      start();
    }, { passive: true });
    el.addEventListener('pointerleave', function () {
      if (!on) return;
      on = false;
      tx = ty = 0;
      ts = 1;
      el.classList.remove('is-tilt');
      start();
    });
  }

  /* ------------------------------------------------------------------
     Titolo che scivola in orizzontale con lo scroll
     ------------------------------------------------------------------ */
  function drift(el) {
    if (el._gDrift || reduce) return;
    el._gDrift = true;
    var top = 0, h = 0;
    var amount = parseFloat(el.getAttribute('data-g-drift')) || 6;   // in vw
    addScroller(el, function () { top = pageTop(el); h = el.offsetHeight; }, function (y) {
      var p = clamp((y + vh - top) / (vh + h), 0, 1);   // 0 quando entra dal basso, 1 quando esce in alto
      el.style.transform = 'translate3d(' + ((0.5 - p) * amount).toFixed(3) + 'vw,0,0)';
    });
  }

  /* colonne pari che scendono e risalgono: parallasse leggera sulla griglia (solo computer) */
  function lift(el) {
    if (el._gLift || reduce) return;
    el._gLift = true;
    var top = 0, h = 0, on = false;
    var mq = window.matchMedia('(min-width: 750px)');
    addScroller(el, function () { top = pageTop(el); h = el.offsetHeight; on = mq.matches; }, function (y) {
      if (!on) return;
      var p = clamp((y + vh - top) / (vh + h), 0, 1);
      el.style.setProperty('--lift', (90 - p * 110).toFixed(1) + 'px');
    });
  }

  /* ------------------------------------------------------------------
     Striscia / carosello
     ------------------------------------------------------------------ */
  function rail(root) {
    if (root._gRail) return;
    var track = root.querySelector('[data-g-track]');
    if (!track) return;
    root._gRail = true;
    var thumb = root.querySelector('[data-g-thumb]');
    var prev = root.querySelector('[data-g-prev]');
    var next = root.querySelector('[data-g-next]');
    var items = Array.prototype.slice.call(track.children);
    var max = 0, snaps = [], ratio = 1;
    var lastLeft = track.scrollLeft, skew = 0, skewing = false;
    var anim = 0;

    function measure() {
      max = Math.max(0, track.scrollWidth - track.clientWidth);
      root.classList.toggle('is-static', max <= 2);
      ratio = track.scrollWidth ? track.clientWidth / track.scrollWidth : 1;
      if (thumb) thumb.style.width = (ratio * 100).toFixed(2) + '%';
      var pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      snaps = items.map(function (it) { return clamp(it.offsetLeft - pad, 0, max); });
      update();
    }
    function update() {
      var left = track.scrollLeft;
      var p = max > 0 ? clamp(left / max, 0, 1) : 0;
      if (thumb && ratio < 1) thumb.style.transform = 'translate3d(' + (p * (1 - ratio) / ratio * 100).toFixed(2) + '%,0,0)';
      if (prev) prev.disabled = left <= 2;
      if (next) next.disabled = left >= max - 2;
      // le schede si piegano un poco quando la striscia corre
      if (!reduce) {
        var v = left - lastLeft;
        lastLeft = left;
        skew += (clamp(-v * 0.12, -5, 5) - skew) * 0.3;
        if (!skewing && Math.abs(skew) > 0.05) { skewing = true; raf(relax); }
      }
    }
    function relax() {
      skew *= 0.86;
      if (Math.abs(skew) < 0.05) skew = 0;
      track.style.setProperty('--skew', skew.toFixed(2) + 'deg');
      if (skew !== 0) raf(relax);
      else skewing = false;
    }
    var pending = false;
    track.addEventListener('scroll', function () {
      if (pending) return;
      pending = true;
      raf(function () { pending = false; update(); });
    }, { passive: true });

    // scorrimento animato verso un punto (frecce, fine del lancio); la posizione si tiene in decimali
    function glideTo(target) {
      cancelAnimationFrame(anim);
      target = clamp(target, 0, max);
      if (reduce) { track.scrollLeft = target; return; }
      var pos = track.scrollLeft;
      // durante la corsa lo scatto del browser (telefono) resta spento, poi torna
      root.classList.add('is-gliding');
      (function step() {
        pos += (target - pos) * 0.14;
        if (Math.abs(target - pos) < 0.5) {
          track.scrollLeft = target;
          root.classList.remove('is-gliding');
          return;
        }
        track.scrollLeft = pos;
        anim = raf(step);
      })();
    }
    function nearestSnap(pos) {
      if (pos >= max - 30) return max;
      var best = 0;
      snaps.forEach(function (s) { if (Math.abs(s - pos) < Math.abs(best - pos)) best = s; });
      return best;
    }
    function page(dir) {
      var left = track.scrollLeft;
      var target = left + dir * track.clientWidth * 0.8;
      var s = dir > 0 ? snaps.filter(function (v) { return v > left + 4; }) : snaps.filter(function (v) { return v < left - 4; });
      if (s.length) {
        // la scheda più vicina al passo di una "pagina"
        target = s.reduce(function (a, b) { return Math.abs(b - target) < Math.abs(a - target) ? b : a; });
      }
      glideTo(target);
    }
    // il dito o la rotella fermano subito una corsa in atto
    function stopGlide() { cancelAnimationFrame(anim); root.classList.remove('is-gliding'); }
    track.addEventListener('touchstart', stopGlide, { passive: true });
    track.addEventListener('wheel', stopGlide, { passive: true });
    if (prev) prev.addEventListener('click', function () { page(-1); });
    if (next) next.addEventListener('click', function () { page(1); });

    // trascinamento col mouse, con inerzia
    if (root.hasAttribute('data-g-drag')) {
      var drag = null, moved = false;
      track.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button !== 0 || max <= 2) return;
        stopGlide();
        drag = { x: e.clientX, left: track.scrollLeft, lx: e.clientX, lt: performance.now(), v: 0 };
        moved = false;
        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      });
      track.addEventListener('dragstart', function (e) { e.preventDefault(); });
      // dopo un trascinamento il click non apre il prodotto (e non fa partire il sipario)
      track.addEventListener('click', function (e) {
        if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
      }, true);
      var onMove = function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x;
        if (!moved && Math.abs(dx) > 6) { moved = true; root.classList.add('is-dragging'); }
        if (!moved) return;
        track.scrollLeft = drag.left - dx;
        var now = performance.now();
        var dt = Math.max(1, now - drag.lt);
        drag.v = drag.v * 0.6 + ((e.clientX - drag.lx) / dt) * 16 * 0.4;   // px per frame
        drag.lx = e.clientX;
        drag.lt = now;
      };
      var onUp = function () {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        if (!drag) return;
        var v = performance.now() - drag.lt > 90 ? 0 : -drag.v;
        drag = null;
        root.classList.remove('is-dragging');
        if (!moved) return;
        // il click che segue il rilascio viene fermato; poi i link tornano normali (anche da tastiera)
        setTimeout(function () { moved = false; }, 0);
        if (reduce) return;
        // lancio: rallenta per attrito, poi si posa sulla scheda più vicina
        var pos = track.scrollLeft;
        (function glide() {
          v *= 0.94;
          pos = clamp(pos + v, 0, max);
          track.scrollLeft = pos;
          if (Math.abs(v) > 1.2 && pos > 0 && pos < max) { anim = raf(glide); return; }
          glideTo(nearestSnap(pos));
        })();
      };
    }

    // cursore "Trascina" su tutto il carosello (anche sulle schede)
    if (root.hasAttribute('data-g-drag') && hasCursor()) {
      var label = cursorLabel('drag', 'Trascina');
      track.setAttribute('data-cursor', label);
      each(track, '.card__link', function (a) { a.setAttribute('data-cursor', label); });
    }

    measure();
    if ('ResizeObserver' in window) new ResizeObserver(function () { measure(); }).observe(track);
    else window.addEventListener('resize', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  }

  /* ------------------------------------------------------------------
     Collezioni: fisarmonica su computer, striscia di pannelli su telefono
     ------------------------------------------------------------------ */
  function accordion(root) {
    if (root._gAcc) return;
    var list = root.querySelector('[data-g-acc-list]');
    if (!list) return;
    root._gAcc = true;
    var items = Array.prototype.slice.call(list.children);
    var imgs = items.map(function (it) { return it.querySelector('.cl__img, .placeholder-svg'); });
    var n = items.length;
    var mq = window.matchMedia('(min-width: 990px) and (hover: hover) and (pointer: fine)');
    var frac = parseFloat(list.style.getPropertyValue('--open')) || 0.42;
    var open = 0, active = false, C = 0, gap = 0;
    var px = items.map(function () { return 0; });
    var py = 0;
    var hoverTimer = 0;

    // cursore "Scopri" sui pannelli
    if (hasCursor()) {
      var label = cursorLabel('explore', 'Scopri');
      each(list, '.cl__panel', function (a) { if (!a.dataset.cursor) a.dataset.cursor = label; });
    }

    function paint() {
      for (var i = 0; i < n; i++) {
        if (imgs[i]) imgs[i].style.transform = 'translate3d(' + px[i].toFixed(2) + '%,' + py.toFixed(2) + '%,0)';
      }
    }
    function layout() {
      var o = C * frac;
      var c = (C - o - (n - 1) * gap) / (n - 1);
      var x = 0;
      items.forEach(function (it, i) {
        var w = i === open ? o : c;
        it.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
        it.style.setProperty('--cr', (o - w).toFixed(1) + 'px');
        it.style.setProperty('--shift', (-(o - w) / 2).toFixed(1) + 'px');
        it.classList.toggle('is-open', i === open);
        x += w + gap;
      });
    }
    function setOpen(i) {
      if (i === open || i < 0) return;
      open = i;
      if (active) layout();
    }
    function measure() {
      var on = mq.matches && !reduce && n > 1;
      if (on !== active) {
        active = on;
        list.classList.add('is-setting');
        list.classList.toggle('is-acc', on);
        if (!on) {
          items.forEach(function (it) {
            it.style.transform = '';
            it.style.removeProperty('--cr');
            it.style.removeProperty('--shift');
            it.classList.remove('is-open');
          });
        }
      }
      if (active) {
        C = list.clientWidth;
        gap = parseFloat(getComputedStyle(list).columnGap) || 0;
        list.style.setProperty('--ow', (C * frac).toFixed(1) + 'px');
        layout();
      }
      // le posizioni dei pannelli nella striscia, per la parallasse orizzontale
      stripMeasure();
      if (list.classList.contains('is-setting')) {
        list.offsetWidth;   // applica la nuova disposizione senza transizione
        raf(function () { list.classList.remove('is-setting'); });
      }
    }

    items.forEach(function (it, i) {
      it.addEventListener('pointerenter', function (e) {
        if (!active || e.pointerType !== 'mouse') return;
        clearTimeout(hoverTimer);
        // piccola attesa: passando veloce sopra i pannelli non si aprono tutti
        hoverTimer = setTimeout(function () { setOpen(i); }, 70);
      });
      it.addEventListener('focusin', function () { setOpen(i); });
    });
    list.addEventListener('pointerleave', function () { clearTimeout(hoverTimer); });
    // editor del tema: selezionando un blocco si apre il suo pannello
    root.addEventListener('shopify:block:select', function (e) {
      var i = items.indexOf(e.target.closest('.cl__item'));
      if (i >= 0) setOpen(i);
    });

    // striscia (telefono): l'immagine scorre più lenta del pannello
    var lefts = [], widths = [], stripW = 0, stripPending = false;
    function stripMeasure() {
      stripW = list.clientWidth;
      lefts = items.map(function (it) { return it.offsetLeft; });
      widths = items.map(function (it) { return it.offsetWidth; });
      stripUpdate();
    }
    function stripUpdate() {
      if (reduce) return;
      if (active) { for (var k = 0; k < n; k++) px[k] = 0; paint(); return; }
      var sl = list.scrollLeft;
      for (var i = 0; i < n; i++) {
        var center = lefts[i] - sl + widths[i] / 2;
        var p = stripW ? clamp((center - stripW / 2) / stripW, -1.2, 1.2) : 0;
        px[i] = -p * 7;
      }
      paint();
    }
    list.addEventListener('scroll', function () {
      if (stripPending || reduce) return;
      stripPending = true;
      raf(function () { stripPending = false; stripUpdate(); });
    }, { passive: true });

    // parallasse verticale con lo scroll della pagina
    if (!reduce) {
      var top = 0, h = 0;
      addScroller(root, function () { top = pageTop(list); h = list.offsetHeight; measure(); }, function (y) {
        var p = clamp((y + vh - top) / (vh + h), 0, 1);
        py = (0.5 - p) * 12;
        paint();
      });
    } else {
      measure();
    }
    if ('ResizeObserver' in window) {
      var rw = list.clientWidth;
      new ResizeObserver(function () {
        if (Math.abs(list.clientWidth - rw) < 1) return;
        rw = list.clientWidth;
        measure();
      }).observe(list);
    }
    mq.addEventListener && mq.addEventListener('change', measure);

    // entrata: i pannelli salgono uno dopo l'altro; poi si tolgono i ritardi
    if (inIO && belowFold(list)) {
      items.forEach(function (it, i) { it.style.setProperty('--pd', (i * 0.1).toFixed(2) + 's'); });
      list._gOnIn = function () {
        setTimeout(function () {
          list.classList.remove('g-pre', 'g-in');
          items.forEach(function (it) { it.style.removeProperty('--pd'); });
        }, 1300 + n * 100);
      };
      enter(list);
    }
  }

  /* ------------------------------------------------------------------
     Prodotti correlati: Shopify li calcola dopo, si caricano con una richiesta
     ------------------------------------------------------------------ */
  function recommendations(el) {
    if (el._gRec) return;
    el._gRec = true;
    if (el.querySelector('.g-card') || !window.fetch || !el.dataset.url) return;
    fetch(el.dataset.url)
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (html) {
        if (!html) return;
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var fresh = doc.querySelector('product-recommendations');
        if (!fresh || !fresh.innerHTML.trim()) return;
        el.innerHTML = fresh.innerHTML;
        scan(el);
      })
      .catch(function () { /* senza consigliati la pagina resta completa */ });
  }

  function scan(root) {
    root = root || document;
    cards(root);
    each(root, '[data-g-in]', enter);
    each(root, '[data-g-drift]', drift);
    each(root, '[data-g-lift]', lift);
    each(root, '[data-g-rail]', rail);
    each(root, '[data-g-acc]', accordion);
    each(root, 'product-recommendations[data-url]', recommendations);
  }

  window.SudGriglie = { scan: scan };

  function init() { scan(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // editor del tema: sezioni aggiunte o ricaricate
  document.addEventListener('shopify:section:load', function (e) { scan(e.target); remeasureSoon(); });
  document.addEventListener('shopify:section:unload', remeasureSoon);
})();
