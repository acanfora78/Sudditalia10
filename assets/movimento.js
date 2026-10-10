/*
  Movimento del tema Sudditalia (senza librerie), in aggiunta a effetti.js:
    barra di lettura   linea sottilissima in alto che si riempie mentre si legge la pagina
    header             si nasconde scorrendo in giù e riappare appena si torna su; resta visibile
                       con menu o ricerca aperti e sopra le sezioni bloccate sotto l'header
                       (apertura, galleria…), così non saltano e non lasciano buchi
    magnetico          bottoni, icone dell'header, frecce della hero e "Vedi tutto" seguono il mouse
                       e tornano al loro posto con un piccolo rimbalzo (solo mouse o trackpad)
    [data-parallax]    l'elemento scorre più lento (0.2) o più veloce (-0.2) della pagina
    [data-split]       testo che entra a righe, parole o lettere: data-split="lines|words|chars"
                       (facoltativo data-split-delay="0.4" in secondi)
    nome nel footer    le lettere del nome gigante salgono a onda e saltano vicino al mouse
    [data-depth]       livelli che seguono il mouse (data-depth="20" = spostamento massimo in px)
    [data-glitch]      disturbo a scatti, a intervalli casuali e al passaggio del mouse
  Con "riduci movimento" attivo nel sistema resta solo la barra di lettura: tutto è fermo e visibile.
  Gli spostamenti usano la proprietà CSS "translate", così si sommano alle "transform" degli altri script.
*/
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasIO = 'IntersectionObserver' in window;
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function toArray(list) { return Array.prototype.slice.call(list); }

  /* ------------------------------------------------------------------
     Spostamenti che si sommano: ogni effetto scrive la sua parte
     ------------------------------------------------------------------ */
  function setT(el, key, x, y) {
    var t = el._mvT || (el._mvT = {});
    t[key] = [x, y];
    var sx = 0, sy = 0;
    for (var k in t) { sx += t[k][0]; sy += t[k][1]; }
    el.style.translate = (Math.abs(sx) > 0.01 || Math.abs(sy) > 0.01) ? sx.toFixed(2) + 'px ' + sy.toFixed(2) + 'px' : '';
  }
  function getTY(el) {
    var t = el._mvT, s = 0;
    if (t) for (var k in t) s += t[k][1];
    return s;
  }

  /* ------------------------------------------------------------------
     Un solo ascolto dello scroll: un fotogramma, una lettura di scrollY.
     Le misure (posizioni, altezza pagina) si prendono solo al resize e
     quando cambia l'altezza della pagina.
     ------------------------------------------------------------------ */
  var vh = window.innerHeight;
  var docH = root.scrollHeight;
  var onScrollFns = [];
  var onMeasureFns = [];
  var ticking = false;
  function frame() {
    ticking = false;
    var y = window.scrollY;
    for (var i = 0; i < onScrollFns.length; i++) onScrollFns[i](y);
  }
  function requestFrame() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(frame);
  }
  function measureAll() {
    vh = window.innerHeight;
    docH = root.scrollHeight;
    for (var i = 0; i < onMeasureFns.length; i++) onMeasureFns[i]();
    requestFrame();
  }
  var measureRaf = 0;
  function scheduleMeasure() {
    if (measureRaf) return;
    measureRaf = requestAnimationFrame(function () { measureRaf = 0; measureAll(); });
  }
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', scheduleMeasure, { passive: true });
  window.addEventListener('load', scheduleMeasure);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleMeasure).observe(document.body);

  /* ------------------------------------------------------------------
     Barra di lettura
     ------------------------------------------------------------------ */
  function readingBar() {
    if (document.querySelector('.mv-progress')) return;
    var bar = document.createElement('div');
    bar.className = 'mv-progress';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<span class="mv-progress__fill"></span>';
    document.body.appendChild(bar);
    var fill = bar.firstChild;
    var on = null, last = -1;
    onScrollFns.push(function (y) {
      var max = docH - vh;
      var show = max > vh * 0.3;
      if (show !== on) { on = show; bar.classList.toggle('is-on', show); }
      if (!show) return;
      var p = clamp(y / max, 0, 1);
      if (Math.abs(p - last) < 0.0005) return;
      last = p;
      fill.style.transform = 'translate3d(' + ((p - 1) * 100).toFixed(3) + '%,0,0)';
    });
  }

  /* ------------------------------------------------------------------
     Header che si nasconde
     ------------------------------------------------------------------ */
  function headerHide() {
    var sec = document.querySelector('.section-header');
    if (!sec || reduce) return;
    var hidden = false;
    var lastY = window.scrollY;
    var acc = 0;
    var headerH = sec.offsetHeight;
    var zones = [];

    // sezioni bloccate proprio sotto l'header (top = --header-h) e alte quasi quanto lo schermo:
    // finché sono a schermo l'header resta, altrimenti sopra di loro resterebbe un buco
    function measure() {
      headerH = sec.offsetHeight;
      zones = [];
      document.querySelectorAll('main [class*="sticky"], main [class*="pin"], [data-header-pin]').forEach(function (el) {
        var cs = getComputedStyle(el);
        if (cs.position !== 'sticky' && !el.hasAttribute('data-header-pin')) return;
        if (cs.position === 'sticky' && Math.abs((parseFloat(cs.top) || 0) - headerH) > 3) return;
        if (el.offsetHeight < vh * 0.5) return;
        var box = (el.parentElement || el).getBoundingClientRect();
        zones.push({ top: box.top + window.scrollY, bottom: box.bottom + window.scrollY });
      });
    }
    function inZone(y) {
      for (var i = 0; i < zones.length; i++) {
        if (zones[i].top - y < vh * 0.6 && zones[i].bottom - y > vh * 0.4) return true;
      }
      return false;
    }
    function canHide() {
      if (root.classList.contains('cine-on')) return false;
      if (sec.querySelector('details[open]') || document.querySelector('[data-menu-drawer][open], .cf[open]')) return false;
      if (sec.contains(document.activeElement)) return false;
      return true;
    }
    function set(h) {
      if (h === hidden) return;
      hidden = h;
      root.classList.toggle('mv-hdr-hide', h);
    }
    onMeasureFns.push(measure);
    onScrollFns.push(function (y) {
      var d = y - lastY;
      lastY = y;
      if (y < Math.max(120, headerH * 1.5) || inZone(y)) { acc = 0; set(false); return; }
      if (d === 0) return;
      if ((d > 0) !== (acc > 0)) acc = 0;
      acc += d;
      if (acc > 10 && !hidden && canHide()) set(true);
      else if (acc < -10) set(false);
    });
    // menu, ricerca o filtri aperti, tastiera dentro l'header: si vede sempre
    document.addEventListener('toggle', function () { if (hidden && !canHide()) set(false); }, true);
    sec.addEventListener('focusin', function () { set(false); });
    measure();
    // la galleria e la finestra si preparano dopo: si rimisura appena sono pronte
    setTimeout(scheduleMeasure, 600);
  }

  /* ------------------------------------------------------------------
     Effetto magnetico (solo mouse o trackpad)
     ------------------------------------------------------------------ */
  var MAGNET = '.btn, .header__icon, .os__arrow, .g-link, .link-underline, [data-magnetic]';
  function magnetic() {
    if (reduce || !fine) return;
    var current = null;
    var running = [];
    var dirty = true;

    function allowed(el) {
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
      if (el.classList.contains('btn--full') || el.closest('[data-no-magnetic]')) return false;
      return el.offsetWidth <= 480;
    }
    function state(el) {
      if (!el._mvMag) {
        var inner = el.querySelector(':scope > svg, :scope > .icon, :scope > span > svg, .g-link__arrow');
        el._mvMag = { el: el, inner: inner, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, r: null, on: false };
      }
      return el._mvMag;
    }
    function tick() {
      for (var i = running.length - 1; i >= 0; i--) {
        var s = running[i];
        // molla: insegue il bersaglio e, lasciata, rimbalza appena prima di fermarsi
        s.vx = (s.vx + (s.tx - s.x) * 0.16) * 0.74;
        s.vy = (s.vy + (s.ty - s.y) * 0.16) * 0.74;
        s.x += s.vx;
        s.y += s.vy;
        var rest = !s.on && Math.abs(s.x) < 0.05 && Math.abs(s.y) < 0.05 && Math.abs(s.vx) < 0.05 && Math.abs(s.vy) < 0.05;
        if (rest) { s.x = s.y = s.vx = s.vy = 0; running.splice(i, 1); }
        setT(s.el, 'mag', s.x, s.y);
        if (s.inner) setT(s.inner, 'mag', s.x * 0.45, s.y * 0.45);
      }
      if (running.length) requestAnimationFrame(tick);
    }
    function wake(s) {
      if (running.indexOf(s) !== -1) return;
      running.push(s);
      if (running.length === 1) requestAnimationFrame(tick);
    }
    function release(el) {
      var s = state(el);
      s.on = false;
      s.tx = s.ty = 0;
      wake(s);
    }
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      var el = e.target.closest ? e.target.closest(MAGNET) : null;
      if (el && !allowed(el)) el = null;
      if (el !== current) {
        if (current) release(current);
        current = el;
        if (el) { state(el).r = null; state(el).on = true; }
      }
      if (!current) return;
      var s = state(current);
      if (!s.r || dirty) {
        var r = current.getBoundingClientRect();
        s.r = { cx: r.left - s.x + r.width / 2, cy: r.top - s.y + r.height / 2, max: clamp(Math.min(r.width, r.height) * 0.3, 6, 16) };
        dirty = false;
      }
      var dx = (e.clientX - s.r.cx) * 0.35;
      var dy = (e.clientY - s.r.cy) * 0.35;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len > s.r.max) { dx *= s.r.max / len; dy *= s.r.max / len; }
      s.tx = dx;
      s.ty = dy;
      wake(s);
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { if (current) { release(current); current = null; } });
    window.addEventListener('scroll', function () { dirty = true; }, { passive: true });
  }

  /* ------------------------------------------------------------------
     [data-parallax]
     ------------------------------------------------------------------ */
  var parallaxItems = [];
  var parallaxIO = null;
  function parallax(scope) {
    if (reduce) return;
    var found = toArray(scope.querySelectorAll('[data-parallax]')).filter(function (el) { return !el._mvPx; });
    if (!found.length) return;
    if (!parallaxIO && hasIO) {
      parallaxIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.target._mvPx) e.target._mvPx.visible = e.isIntersecting; });
        requestFrame();
      }, { rootMargin: '30% 0px 30% 0px' });
    }
    found.forEach(function (el) {
      var it = { el: el, speed: parseFloat(el.getAttribute('data-parallax')) || 0.2, top: 0, h: 0, visible: !hasIO, last: null };
      el._mvPx = it;
      parallaxItems.push(it);
      if (parallaxIO) parallaxIO.observe(el);
      measureParallax(it);
    });
    requestFrame();
  }
  function measureParallax(it) {
    var r = it.el.getBoundingClientRect();
    it.top = r.top + window.scrollY - getTY(it.el);
    it.h = r.height;
  }
  onMeasureFns.push(function () {
    parallaxItems = parallaxItems.filter(function (it) { return it.el.isConnected; });
    parallaxItems.forEach(measureParallax);
  });
  onScrollFns.push(function (y) {
    for (var i = 0; i < parallaxItems.length; i++) {
      var it = parallaxItems[i];
      if (!it.visible) continue;
      var off = (y + vh / 2 - (it.top + it.h / 2)) * it.speed;
      if (it.last !== null && Math.abs(off - it.last) < 0.1) continue;
      it.last = off;
      setT(it.el, 'px', 0, off);
    }
  });

  /* ------------------------------------------------------------------
     [data-split]: righe, parole o lettere che salgono da sotto una maschera
     ------------------------------------------------------------------ */
  var splitIO = null;
  var splitLines = [];
  function plainText(el) {
    for (var k = 0; k < el.children.length; k++) if (el.children[k].tagName !== 'BR') return false;
    return true;
  }
  function wordsOf(el, mode) {
    // parole in maschere; con "chars" ogni parola contiene le sue lettere
    var frag = document.createDocumentFragment();
    var n = 0;
    toArray(el.childNodes).forEach(function (node) {
      if (node.nodeType !== 3) { frag.appendChild(node.cloneNode()); return; }
      node.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        var w = document.createElement('span');
        w.className = 'mv-w';
        if (mode === 'chars') {
          Array.from(part).forEach(function (ch) {
            var c = document.createElement('span');
            c.className = 'mv-c';
            c.style.setProperty('--i', n++);
            c.textContent = ch;
            w.appendChild(c);
          });
        } else if (mode === 'lines') {
          w.className = 'mv-lw';
          w.textContent = part;
        } else {
          var i = document.createElement('span');
          i.className = 'mv-c';
          i.style.setProperty('--i', n++);
          i.textContent = part;
          w.appendChild(i);
        }
        frag.appendChild(w);
      });
    });
    return frag;
  }
  function buildLines(el) {
    // si parte sempre dal testo originale: parole misurabili, poi raggruppate per riga
    el.innerHTML = el._mvSrc;
    var frag = wordsOf(el, 'lines');
    el.textContent = '';
    el.appendChild(frag);
    var lines = [], top = null;
    toArray(el.querySelectorAll('.mv-lw')).forEach(function (w) {
      var t = w.offsetTop;
      if (top === null || Math.abs(t - top) > 2) { lines.push([]); top = t; }
      lines[lines.length - 1].push(w.textContent);
    });
    el.textContent = '';
    lines.forEach(function (ws, i) {
      var l = document.createElement('span');
      l.className = 'mv-l';
      var li = document.createElement('span');
      li.className = 'mv-c';
      li.style.setProperty('--i', i);
      li.textContent = ws.join(' ');
      l.appendChild(li);
      el.appendChild(l);
    });
    el._mvW = el.clientWidth;
  }
  function split(scope) {
    if (reduce) return;
    var els = toArray(scope.querySelectorAll('[data-split]'));
    if (scope.nodeType === 1 && scope.hasAttribute && scope.hasAttribute('data-split')) els.unshift(scope);
    els.forEach(function (el) {
      // già animati da effetti.js (.rv) o già divisi: non si tocca
      if (el._mvSplit || el.classList.contains('rv') || el.closest('.rv') || el.querySelector('.rv')) return;
      var mode = el.getAttribute('data-split');
      if (mode !== 'lines' && mode !== 'chars') mode = 'words';
      el._mvSplit = mode;
      if (!plainText(el)) mode = 'block';
      el.classList.add('mv-split', 'mv-split--' + mode);
      var delay = parseFloat(el.getAttribute('data-split-delay'));
      if (delay) el.style.setProperty('--mv-delay', delay + 's');

      if (mode === 'lines') {
        el._mvSrc = el.innerHTML;
        buildLinesSafe(el);
        splitLines.push(el);
        // con il font vero le parole cambiano larghezza: si ricalcolano le righe
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { rebuildLines(el, true); });
      } else if (mode === 'words' || mode === 'chars') {
        if (mode === 'chars') {
          // le lettere singole si leggono male: il testo intero resta per i lettori di schermo
          var sr = document.createElement('span');
          sr.className = 'visually-hidden';
          sr.textContent = el.textContent;
          var vis = document.createElement('span');
          vis.setAttribute('aria-hidden', 'true');
          vis.appendChild(wordsOf(el, 'chars'));
          el.textContent = '';
          el.appendChild(sr);
          el.appendChild(vis);
        } else {
          var frag = wordsOf(el, 'words');
          el.textContent = '';
          el.appendChild(frag);
        }
      }
      watchSplit(el);
    });
  }
  function buildLinesSafe(el) {
    try { buildLines(el); } catch (err) { el.innerHTML = el._mvSrc; el.classList.remove('mv-split--lines'); el.classList.add('mv-split--block'); }
  }
  function rebuildLines(el, force) {
    if (!el.isConnected || (!force && el.clientWidth === el._mvW)) return;
    buildLinesSafe(el);
  }
  onMeasureFns.push(function () {
    splitLines = splitLines.filter(function (el) { return el.isConnected; });
    splitLines.forEach(function (el) { rebuildLines(el); });
  });
  function watchSplit(el) {
    if (!hasIO) { el.classList.add('is-in'); return; }
    if (!splitIO) {
      splitIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          splitIO.unobserve(e.target);
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    }
    splitIO.observe(el);
  }

  /* ------------------------------------------------------------------
     Nome gigante del footer: lettere a onda e che saltano vicino al mouse.
     effetti.js lo ridimensiona (data-fit-text) misurando il genitore: il nome
     va in un contenitore senza margini interni, largo quanto lo spazio vero.
     ------------------------------------------------------------------ */
  function wordmark(scope) {
    var el = scope.querySelector ? scope.querySelector('.footer__wordmark') : null;
    if (!el || el._mvWm) return;
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return;
    el._mvWm = true;

    var box = el.parentElement;
    if (!box.classList.contains('mv-wm-box')) {
      box = document.createElement('div');
      box.className = 'mv-wm-box';
      el.parentNode.insertBefore(box, el);
      box.appendChild(el);
    }
    // da qui in poi il nome lo anima questo script, non i titoli di testa di effetti.js
    el.classList.remove('rv');
    el.classList.add('mv-wm');

    var letters = [];
    if (!reduce) {
      el.textContent = '';
      Array.from(text).forEach(function (ch, i) {
        var o = document.createElement('span');
        o.className = 'mv-wl';
        var inner = document.createElement('span');
        inner.className = 'mv-wi';
        inner.style.setProperty('--i', i);
        inner.textContent = ch === ' ' ? ' ' : ch;
        o.appendChild(inner);
        el.appendChild(o);
        letters.push({ el: o, cx: 0, y: 0, v: 0, t: 0, s: 1, sv: 0, st: 1 });
      });
    } else {
      el.textContent = text;
    }

    // stesso calcolo di effetti.js, rifatto ora che il genitore è il contenitore giusto
    function fit() {
      el.style.fontSize = '100px';
      var w = el.scrollWidth;
      var bw = box.clientWidth;
      if (w && bw) el.style.fontSize = (100 * bw / w).toFixed(2) + 'px';
      measureLetters();
    }
    var H = 0, left = 0, top = 0, avg = 1;
    function measureLetters() {
      if (!letters.length) return;
      var r = el.getBoundingClientRect();
      left = r.left;
      top = r.top + window.scrollY;
      H = r.height;
      letters.forEach(function (l) { l.cx = l.el.offsetLeft + l.el.offsetWidth / 2; });
      avg = r.width / letters.length;
    }
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    window.addEventListener('resize', function () { requestAnimationFrame(measureLetters); }, { passive: true });
    onMeasureFns.push(measureLetters);
    if (reduce || !letters.length) return;

    // ingresso a onda quando il footer arriva
    el.classList.add('mv-wm--armed');
    var done = false;
    function wave() {
      el.classList.add('is-wave');
      setTimeout(function () { done = true; el.classList.add('is-done'); measureLetters(); }, (letters.length * 0.055 + 1.3) * 1000);
    }
    if (hasIO) {
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { io.disconnect(); wave(); }
      }, { threshold: 0.35 });
      io.observe(el);
    } else wave();

    // le lettere vicine al puntatore saltano su; lasciate, ricadono con un rimbalzo
    var footer = el.closest('footer') || box;
    var px = -1e5, py = 0, inside = false, running = false;
    function tick() {
      var moving = false;
      var sigma = avg * 1.15;
      letters.forEach(function (l) {
        var f = 0;
        if (inside && done) {
          var dx = (px - left - l.cx) / sigma;
          var dy = py - (top + H / 2);
          var fy = clamp(1 - Math.abs(dy) / (H * 2.4), 0, 1);
          f = Math.exp(-dx * dx) * fy;
        }
        l.t = -f * H * 0.2;
        l.st = 1 + f * 0.1;
        l.v = (l.v + (l.t - l.y) * 0.14) * 0.76;
        l.y += l.v;
        l.sv = (l.sv + (l.st - l.s) * 0.14) * 0.76;
        l.s += l.sv;
        if (Math.abs(l.v) > 0.02 || Math.abs(l.t - l.y) > 0.05 || Math.abs(l.sv) > 0.0005 || Math.abs(l.st - l.s) > 0.0005) moving = true;
        l.el.style.transform = (Math.abs(l.y) < 0.05 && Math.abs(l.s - 1) < 0.0005) ? '' : 'translate3d(0,' + l.y.toFixed(2) + 'px,0) scaleY(' + l.s.toFixed(4) + ')';
      });
      if (moving || inside) requestAnimationFrame(tick);
      else running = false;
    }
    function run() { if (!running) { running = true; requestAnimationFrame(tick); } }
    if (fine) {
      footer.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        px = e.clientX;
        py = e.clientY + window.scrollY;
        inside = true;
        run();
      }, { passive: true });
      footer.addEventListener('pointerleave', function () { inside = false; run(); });
    }
    // tocco o clic sul nome: le lettere vicine fanno un salto
    el.addEventListener('pointerdown', function (e) {
      if (!done) return;
      var x = e.clientX - left;
      letters.forEach(function (l) {
        var d = (x - l.cx) / (avg * 1.6);
        l.v -= Math.exp(-d * d) * H * 0.09;
      });
      run();
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     [data-depth]: livelli che seguono il mouse
     ------------------------------------------------------------------ */
  var depthItems = [];
  var depthIO = null;
  var depthPointer = { x: 0, y: 0 };
  var depthRunning = false;
  function depth(scope) {
    if (reduce || !fine) return;
    var found = toArray(scope.querySelectorAll('[data-depth]')).filter(function (el) { return !el._mvDepth; });
    if (!found.length) return;
    if (!depthIO && hasIO) {
      depthIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.target._mvDepth) e.target._mvDepth.visible = e.isIntersecting; });
        runDepth();
      });
    }
    found.forEach(function (el) {
      var it = { el: el, amt: parseFloat(el.getAttribute('data-depth')) || 16, x: 0, y: 0, visible: !hasIO };
      el._mvDepth = it;
      depthItems.push(it);
      if (depthIO) depthIO.observe(el);
    });
    if (depth._bound) return;
    depth._bound = true;
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      depthPointer.x = clamp(e.clientX / window.innerWidth * 2 - 1, -1, 1);
      depthPointer.y = clamp(e.clientY / window.innerHeight * 2 - 1, -1, 1);
      runDepth();
    }, { passive: true });
    root.addEventListener('pointerleave', function () { depthPointer.x = depthPointer.y = 0; runDepth(); });
  }
  function runDepth() {
    if (depthRunning) return;
    depthRunning = true;
    requestAnimationFrame(function step() {
      var moving = false;
      depthItems.forEach(function (it) {
        if (!it.visible || !it.el.isConnected) return;
        var tx = depthPointer.x * it.amt, ty = depthPointer.y * it.amt;
        it.x += (tx - it.x) * 0.07;
        it.y += (ty - it.y) * 0.07;
        if (Math.abs(tx - it.x) > 0.05 || Math.abs(ty - it.y) > 0.05) moving = true;
        setT(it.el, 'depth', it.x, it.y);
      });
      if (moving) requestAnimationFrame(step);
      else depthRunning = false;
    });
  }

  /* ------------------------------------------------------------------
     [data-glitch]: disturbo a scatti
     ------------------------------------------------------------------ */
  function glitch(scope) {
    if (reduce) return;
    toArray(scope.querySelectorAll('[data-glitch]')).forEach(function (el) {
      if (el._mvGlitch) return;
      el._mvGlitch = true;
      var visible = !hasIO, timer = 0, busy = false;
      function burst(strong) {
        if (busy) return;
        busy = true;
        el.classList.add(strong ? 'is-glitch-strong' : 'is-glitch');
        setTimeout(function () { el.classList.remove('is-glitch', 'is-glitch-strong'); busy = false; }, strong ? 640 : 420);
      }
      function schedule(first) {
        clearTimeout(timer);
        if (!visible) return;
        timer = setTimeout(function () {
          if (!document.hidden) burst(Math.random() < 0.3);
          schedule();
        }, first ? 1700 : 2200 + Math.random() * 3600);
      }
      if (hasIO) {
        new IntersectionObserver(function (en) {
          var was = visible;
          visible = en[0].isIntersecting;
          if (visible && !was) schedule(!el._mvGlitchSeen);
          el._mvGlitchSeen = true;
        }).observe(el);
      } else schedule(true);
      el.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') burst(true); });
      el.addEventListener('pointerdown', function () { burst(true); });
    });
  }

  /* ------------------------------------------------------------------ */
  function initScope(scope) {
    split(scope);
    parallax(scope);
    depth(scope);
    glitch(scope);
    wordmark(scope);
    scheduleMeasure();
  }
  function init() {
    readingBar();
    headerHide();
    magnetic();
    initScope(document);
    requestFrame();
    // editor del tema: una sezione ricaricata riparte da capo
    document.addEventListener('shopify:section:load', function (e) { initScope(e.target); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
