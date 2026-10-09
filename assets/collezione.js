/*
  Sudditalia — collezione.js (pagina collezione, senza librerie)
    apertura   titolo che entra lettera per lettera, foto che si apre e zooma piano, contatore che sale;
               scorrendo la foto si allontana e si scurisce, il titolo sale
    barra      in vetro sotto l'header: diventa "attaccata", linea di avanzamento nella griglia
    griglia    scelta delle colonne (computer 2/3/4, telefono 1/2) con passaggio FLIP, ricordata nel browser;
               le schede entrano a cascata per righe
    filtri     pannello laterale che si apre e si chiude con Esc, sfondo o ×; l'invio lo fa theme.js
  Con "riduci movimento" tutto è fermo e subito visibile. Riparte da solo nell'editor del tema.
*/
(function () {
  'use strict';

  var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var deskMq = window.matchMedia('(min-width: 750px)');
  var KEY = { d: 'sud-griglia-computer', m: 'sud-griglia-telefono' };
  var VALID = { d: ['2', '3', '4'], m: ['1', '2'] };
  var EASE_IO = 'cubic-bezier(.77, 0, .18, 1)';

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function store(k, v) {
    try {
      if (v === undefined) return window.localStorage.getItem(k);
      window.localStorage.setItem(k, v);
    } catch (e) { /* navigazione privata o archivio bloccato: si usa il valore del tema */ }
    return null;
  }
  function docTop(el) { return el.getBoundingClientRect().top + window.scrollY; }
  function headerH() {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h'));
    return isNaN(v) ? 64 : v;
  }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  function Collection(root) {
    this.root = root;
    this.reduce = reduceMq.matches;
    this.off = [];
    this.hero = root.querySelector('[data-ch]');
    this.bar = root.querySelector('[data-ctb]');
    this.mark = root.querySelector('[data-ctb-mark]');
    this.progress = root.querySelector('[data-ctb-progress]');
    this.grid = root.querySelector('[data-cg]');
    this.items = this.grid ? Array.prototype.slice.call(this.grid.children) : [];
    this.m = { heroTop: 0, heroH: 1, markTop: 0, gridTop: 0, gridH: 1, head: 64, barH: 68, vh: window.innerHeight };
    this.last = { p: -1, pr: -1, stuck: null };
    this.heroVisible = true;
    this.ticking = false;

    this.initHero();
    this.initDensity();
    this.initGrid();
    this.initFilters();
    this.initScroll();
  }

  Collection.prototype.on = function (target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.off.push(function () { target.removeEventListener(type, fn, opts); });
  };

  /* ------------------------------------------------------------------
     Apertura
     ------------------------------------------------------------------ */
  Collection.prototype.initHero = function () {
    var self = this;
    var hero = this.hero;
    if (!hero) return;
    this.frame = hero.querySelector('[data-ch-frame]');
    this.dark = hero.querySelector('[data-ch-dark]');
    this.content = hero.querySelector('[data-ch-content]');
    this.title = hero.querySelector('[data-ch-title]');
    this.cue = hero.querySelector('.ch__scroll');

    this.fitTitle();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { self.fitTitle(); self.measure(); });

    if (this.reduce) {
      hero.classList.remove('is-armed');
      hero.classList.add('is-in');
      return;
    }
    hero.classList.add('is-armed');
    // con il sipario tra le pagine si parte mentre il telo si alza
    var delay = document.documentElement.classList.contains('curtain-in') ? 260 : 60;
    var start = function () {
      hero.classList.add('is-in');
      var num = hero.querySelector('[data-ch-count]');
      if (num) setTimeout(function () { self.countUp(num, parseInt(num.getAttribute('data-ch-count'), 10) || 0); }, 1050);
    };
    // il primo fotogramma deve avere lo stato iniziale, poi parte l'entrata
    requestAnimationFrame(function () { setTimeout(start, delay); });
  };

  // il titolo gigante non deve mai uscire dallo schermo: si rimpicciolisce se la parola più lunga non ci sta
  // e tutta l'apertura deve stare nell'altezza: se il testo è troppo alto il titolo si riduce ancora
  Collection.prototype.fitTitle = function () {
    var t = this.title;
    if (!t) return;
    var words = t.querySelectorAll('.ch__w');
    t.style.setProperty('--ch-fit', '1');
    var fit = 1;
    var box = t.clientWidth;
    var widest = 0;
    each(words, function (w) { widest = Math.max(widest, w.offsetWidth); });
    if (box && widest > box) fit = box / widest * 0.98;
    var hero = this.hero;
    var content = this.content;
    if (hero && content) {
      for (var k = 0; k < 3; k++) {
        t.style.setProperty('--ch-fit', fit.toFixed(3));
        var cs = getComputedStyle(hero);
        var room = hero.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        var over = content.offsetHeight - room;
        if (over <= 1) break;
        var th = t.offsetHeight;
        fit *= Math.max(0.5, (th - over) / th);
      }
    }
    t.style.setProperty('--ch-fit', fit.toFixed(3));
  };

  Collection.prototype.countUp = function (el, to) {
    if (!to) return;
    var dur = clamp(900 + to * 40, 1100, 2200);
    var t0 = null;
    el.textContent = pad(0);
    function frame(t) {
      if (t0 === null) t0 = t;
      var k = clamp((t - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - k, 4);
      el.textContent = pad(Math.round(to * e));
      if (k < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  /* ------------------------------------------------------------------
     Scorrimento: apertura che si allontana, barra attaccata, avanzamento
     ------------------------------------------------------------------ */
  Collection.prototype.initScroll = function () {
    var self = this;
    this.measure();
    this.onScroll = function () {
      if (self.ticking) return;
      self.ticking = true;
      requestAnimationFrame(function () { self.ticking = false; self.update(); });
    };
    this.on(window, 'scroll', this.onScroll, { passive: true });
    var resizeTimer = null;
    var lastW = window.innerWidth;
    this.on(window, 'resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        // sul telefono la barra del browser che compare e sparisce cambia solo l'altezza: basta aggiornare lo schermo
        if (window.innerWidth === lastW) { self.m.vh = window.innerHeight; self.update(); return; }
        lastW = window.innerWidth;
        self.fitTitle(); self.measure(); self.applySizes(); self.update();
      }, 120);
    }, { passive: true });
    this.on(window, 'load', function () { self.measure(); self.update(); });

    // l'altezza della pagina cambia (font, immagini, filtri): si rimisura senza leggere il layout a ogni fotogramma
    if ('ResizeObserver' in window) {
      var roTimer = null;
      this.ro = new ResizeObserver(function () {
        clearTimeout(roTimer);
        roTimer = setTimeout(function () { self.measure(); self.update(); }, 80);
      });
      this.ro.observe(this.root);
    }
    if (this.hero && 'IntersectionObserver' in window) {
      this.heroIo = new IntersectionObserver(function (en) { self.heroVisible = en[0].isIntersecting; self.onScroll(); });
      this.heroIo.observe(this.hero);
    }
    this.update();
  };

  Collection.prototype.measure = function () {
    var m = this.m;
    m.vh = window.innerHeight;
    m.head = headerH();
    if (this.hero) { m.heroTop = docTop(this.hero); m.heroH = this.hero.offsetHeight || 1; }
    if (this.mark) m.markTop = docTop(this.mark);
    if (this.bar) m.barH = this.bar.offsetHeight;
    if (this.grid) { m.gridTop = docTop(this.grid); m.gridH = this.grid.offsetHeight || 1; }
    this.last.p = -1;
  };

  Collection.prototype.update = function () {
    var m = this.m;
    var y = window.scrollY;

    if (this.hero && !this.reduce && (this.heroVisible || this.last.p !== 1)) {
      var p = clamp((y - m.heroTop) / Math.max(1, m.heroH - m.head), 0, 1);
      if (Math.abs(p - this.last.p) > 0.0005) {
        this.last.p = p;
        var h = m.heroH;
        if (this.frame) {
          this.frame.style.transform = p ? 'translate3d(0,' + (p * h * 0.34).toFixed(1) + 'px,0) scale(' + (1 - p * 0.16).toFixed(4) + ')' : '';
          this.frame.style.clipPath = p ? 'inset(0 round ' + (p * 36).toFixed(1) + 'px)' : '';
        }
        if (this.dark) this.dark.style.opacity = (p * 0.8).toFixed(3);
        if (this.content) {
          this.content.style.transform = p ? 'translate3d(0,' + (-p * h * 0.3).toFixed(1) + 'px,0)' : '';
          this.content.style.opacity = p ? clamp(1 - p * 1.5, 0, 1).toFixed(3) : '';
        }
        if (this.cue) this.cue.style.opacity = p ? clamp(1 - p * 4, 0, 1).toFixed(3) : '';
      }
    }

    if (this.bar) {
      var stuck = y > m.markTop - m.head - 1;
      if (stuck !== this.last.stuck) { this.last.stuck = stuck; this.bar.classList.toggle('is-stuck', stuck); }
    }
    if (this.progress && this.grid) {
      var startY = m.gridTop - m.head - m.barH - 40;
      var endY = m.gridTop + m.gridH - m.vh;
      var pr = endY > startY ? clamp((y - startY) / (endY - startY), 0, 1) : 1;
      if (Math.abs(pr - this.last.pr) > 0.001) { this.last.pr = pr; this.progress.style.transform = 'scaleX(' + pr.toFixed(4) + ')'; }
    }
  };

  /* ------------------------------------------------------------------
     Densità della griglia
     ------------------------------------------------------------------ */
  Collection.prototype.initDensity = function () {
    var self = this;
    var grid = this.grid;
    this.groups = this.root.querySelectorAll('[data-dens]');
    if (!grid) return;
    this.cols = {
      d: String(grid.getAttribute('data-cols-d') || '3'),
      m: String(grid.getAttribute('data-cols-m') || '2')
    };
    if (this.groups.length) {
      ['d', 'm'].forEach(function (k) {
        var saved = store(KEY[k]);
        if (saved && VALID[k].indexOf(saved) > -1) self.cols[k] = saved;
      });
    }
    this.applyCols();
    each(this.groups, function (g) {
      var k = g.getAttribute('data-dens');
      each(g.querySelectorAll('[data-cols]'), function (b) {
        self.on(b, 'click', function () {
          var v = b.getAttribute('data-cols');
          if (v === self.cols[k]) return;
          self.flip(function () {
            self.cols[k] = v;
            store(KEY[k], v);
            self.applyCols();
          });
        });
      });
      // l'indicatore scorre solo dopo il primo posizionamento
      requestAnimationFrame(function () { g.classList.add('is-ready'); });
    });
  };

  Collection.prototype.currentCols = function () {
    return parseInt(deskMq.matches ? (this.cols ? this.cols.d : 3) : (this.cols ? this.cols.m : 2), 10) || 2;
  };

  Collection.prototype.applyCols = function () {
    var self = this;
    var grid = this.grid;
    grid.style.setProperty('--cols-d', this.cols.d);
    grid.style.setProperty('--cols-m', this.cols.m);
    each(this.groups, function (g) {
      var k = g.getAttribute('data-dens');
      var btns = g.querySelectorAll('[data-cols]');
      each(btns, function (b, i) {
        var on = b.getAttribute('data-cols') === self.cols[k];
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on) {
          var ind = g.querySelector('.ctb__dens-ind');
          if (ind) ind.style.setProperty('--dens-i', i);
        }
      });
    });
    this.applySizes();
  };

  // le immagini chiedono al browser la misura giusta per la griglia scelta
  Collection.prototype.applySizes = function () {
    if (!this.grid || !this.cols) return;
    var sizes = '(min-width: 750px) ' + Math.round(100 / this.cols.d) + 'vw, ' + Math.round(100 / this.cols.m) + 'vw';
    each(this.grid.querySelectorAll('.card__media img[sizes]'), function (img) {
      if (img.getAttribute('sizes') !== sizes) img.setAttribute('sizes', sizes);
    });
  };

  // FLIP: si misura prima, si cambia la griglia, si misura dopo, ogni scheda parte da dove era
  Collection.prototype.flip = function (mutate) {
    var self = this;
    if (this.reduce) { mutate(); this.measure(); this.update(); return; }
    var cards = this.items.map(function (li) { return li.firstElementChild; }).filter(Boolean);
    clearTimeout(this.flipTimer);
    cards.forEach(function (c) { c.style.transition = 'none'; c.style.transform = ''; });

    var vh = window.innerHeight;
    var barBottom = this.bar ? this.bar.getBoundingClientRect().bottom : 0;
    // la scheda che si sta guardando: la prima che comincia sotto la barra, altrimenti quella tagliata dalla barra
    var anchor = null;
    var anchorTop = 0;
    var cut = null;
    for (var i = 0; i < this.items.length; i++) {
      var r = this.items[i].getBoundingClientRect();
      if (r.bottom <= barBottom + 40 || r.top >= vh) continue;
      if (r.top >= barBottom - 4) { anchor = this.items[i]; anchorTop = r.top; break; }
      if (!cut) cut = this.items[i];
    }
    var gridTop = this.grid.getBoundingClientRect().top;
    if (!anchor && cut && gridTop < barBottom) { anchor = cut; anchorTop = barBottom + 24; }
    var first = cards.map(function (c) { return c.getBoundingClientRect(); });

    mutate();

    // dopo il cambio, quella scheda resta allo stesso punto dello schermo (la pagina sopra non si muove)
    if (anchor && gridTop < barBottom + 40) {
      var dy = anchor.getBoundingClientRect().top - anchorTop;
      if (Math.abs(dy) > 1) window.scrollTo({ top: Math.max(0, window.scrollY + dy), behavior: 'instant' });
    }
    var moved = [];
    cards.forEach(function (c, i) {
      var f = first[i];
      var l = c.getBoundingClientRect();
      if (!l.width || !f.width) return;
      var seenBefore = f.bottom > -80 && f.top < vh + 80;
      var seenAfter = l.bottom > -80 && l.top < vh + 80;
      if (!seenBefore && !seenAfter) return;
      var s = f.width / l.width;
      // da fuori schermo si arriva con un ingresso corto, non da chilometri di distanza
      var dx = f.left - l.left;
      var dyc = seenBefore ? f.top - l.top : (f.top > l.top ? 160 : -160);
      c.style.transform = 'translate3d(' + dx.toFixed(1) + 'px,' + dyc.toFixed(1) + 'px,0) scale(' + s.toFixed(4) + ')';
      moved.push(c);
    });
    void this.grid.offsetWidth;
    requestAnimationFrame(function () {
      moved.forEach(function (c, i) {
        c.style.transition = 'transform .9s ' + EASE_IO + ' ' + Math.min(i * 0.012, 0.18).toFixed(3) + 's';
        c.style.transform = '';
      });
    });
    this.flipTimer = setTimeout(function () {
      cards.forEach(function (c) { c.style.transition = ''; });
      self.measure();
      self.update();
    }, 1150);
  };

  /* ------------------------------------------------------------------
     Entrata a cascata delle schede, per righe
     ------------------------------------------------------------------ */
  Collection.prototype.initGrid = function () {
    var self = this;
    var grid = this.grid;
    if (!grid || this.reduce || !('IntersectionObserver' in window)) return;
    grid.classList.add('is-armed');
    this.items.forEach(function (li, i) { li._ci = i; });
    this.gridIo = new IntersectionObserver(function (entries) {
      var batch = entries.filter(function (e) { return e.isIntersecting; }).map(function (e) { return e.target; });
      if (!batch.length) return;
      batch.sort(function (a, b) { return a._ci - b._ci; });
      var cols = self.currentCols();
      var row0 = Math.floor(batch[0]._ci / cols);
      batch.forEach(function (li) {
        self.gridIo.unobserve(li);
        var row = Math.floor(li._ci / cols) - row0;
        var col = li._ci % cols;
        li.style.setProperty('--d', (Math.min(row, 3) * 0.16 + col * 0.09).toFixed(2) + 's');
        li.classList.add('is-in');
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    this.items.forEach(function (li) { self.gridIo.observe(li); });

    // filtri e ordinamento ricaricano la pagina: la griglia si fa da parte nel frattempo
    var form = this.root.querySelector('form[data-filters-form]');
    if (form) {
      var leave = function () { grid.classList.add('is-leaving'); };
      this.on(form, 'change', function (e) { if (!e.target.matches('input[type="number"]')) leave(); });
      this.on(form, 'submit', leave);
      this.on(window, 'pageshow', function (e) { if (e.persisted) grid.classList.remove('is-leaving'); });
    }
  };

  /* ------------------------------------------------------------------
     Pannello filtri
     ------------------------------------------------------------------ */
  Collection.prototype.initFilters = function () {
    var self = this;
    var cf = this.root.querySelector('[data-cf]');
    if (!cf) return;
    var summary = cf.querySelector('summary');
    var closeBtn = cf.querySelector('.cf__close');
    var closing = null;

    function close() {
      if (!cf.open || closing) return;
      if (self.reduce) { cf.open = false; return; }
      cf.classList.add('is-closing');
      closing = setTimeout(function () {
        closing = null;
        cf.classList.remove('is-closing');
        cf.open = false;
      }, 560);
    }
    this.on(summary, 'click', function (e) {
      if (cf.open) { e.preventDefault(); close(); }
    });
    each(cf.querySelectorAll('[data-cf-close]'), function (b) { self.on(b, 'click', close); });
    this.on(cf, 'toggle', function () {
      document.documentElement.classList.toggle('cf-lock', cf.open);
      if (cf.open && closeBtn) closeBtn.focus({ preventScroll: true });
      else if (!cf.open && cf.contains(document.activeElement)) summary.focus({ preventScroll: true });
    });
    this.on(document, 'keydown', function (e) {
      if (!cf.open) return;
      if (e.key === 'Escape') { close(); return; }
      // il Tab resta dentro il pannello finché è aperto
      if (e.key !== 'Tab') return;
      var panel = cf.querySelector('.cf__panel');
      var list = Array.prototype.filter.call(
        panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])'),
        function (el) { return el.offsetWidth || el.offsetHeight; }
      );
      if (!list.length) return;
      var firstEl = list[0];
      var lastEl = list[list.length - 1];
      if (!panel.contains(document.activeElement)) { e.preventDefault(); firstEl.focus(); }
      else if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    });
    this.off.push(function () { document.documentElement.classList.remove('cf-lock'); });

    // se ci sono due collezioni nella pagina, theme.js gestisce solo il primo form: l'altro lo invia questo script
    var form = this.root.querySelector('form[data-filters-form]');
    if (form && document.querySelector('form[data-filters-form]') !== form) {
      this.on(form, 'change', function (e) {
        if (e.target.matches('input[type="number"]')) return;
        each(form.querySelectorAll('input[type="number"]'), function (i) { if (i.value === '') i.disabled = true; });
        form.submit();
      });
    }
  };

  Collection.prototype.destroy = function () {
    this.off.forEach(function (fn) { fn(); });
    this.off = [];
    if (this.ro) this.ro.disconnect();
    if (this.heroIo) this.heroIo.disconnect();
    if (this.gridIo) this.gridIo.disconnect();
    clearTimeout(this.flipTimer);
  };

  /* ------------------------------------------------------------------
     Avvio (anche nell'editor del tema)
     ------------------------------------------------------------------ */
  var instances = [];
  function init(scope) {
    each((scope || document).querySelectorAll('[data-coll]'), function (root) {
      if (root._coll) return;
      root._coll = new Collection(root);
      instances.push(root._coll);
    });
  }
  function teardown(scope) {
    each(scope.querySelectorAll('[data-coll]'), function (root) {
      if (!root._coll) return;
      root._coll.destroy();
      instances.splice(instances.indexOf(root._coll), 1);
      root._coll = null;
    });
  }
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
  document.addEventListener('shopify:section:unload', function (e) { teardown(e.target); });
  // cambiando da telefono a computer cambia il numero di colonne di riferimento per la cascata
  if (deskMq.addEventListener) deskMq.addEventListener('change', function () { instances.forEach(function (c) { c.applySizes(); }); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
})();
