/*
  Galleria cinema (sections/galleria-cinema.liquid)
  <galleria-cinema>: la sezione si blocca sotto l'header e lo scroll verticale fa scorrere la pista di
  pannelli in orizzontale. Per ogni pannello:
    - parallasse interna (la foto va più lenta della pista) e zoom mentre entra
    - un "otturatore" (clip-path sulla cornice) che lo scopre mentre arriva da destra
    - inclinazione e scala legate alla velocità
    - numero grande a contorno più veloce della pista; didascalia che entra al centro
  In basso: barra di avanzamento con le tacche dei pannelli, contatore 01/05 e timecode.
  Si può anche trascinare (mouse o dito, con inerzia) o usare lo swipe orizzontale del trackpad:
  in tutti i casi si muove la pagina, così pista e scroll restano sempre allineati.

  Prestazioni: si anima solo transform/opacity; le misure si prendono all'avvio e al resize;
  il ciclo gira solo mentre la sezione è vicina allo schermo e si ferma quando tutto è fermo.
  "Riduci movimento" o schermi molto bassi: modo statico (griglia/striscia), nessun blocco.
*/
(function () {
  'use strict';
  if (!window.customElements || customElements.get('galleria-cinema')) return;

  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqShort = window.matchMedia('(max-height: 459px)');
  var coarse = window.matchMedia('(pointer: coarse)').matches;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function listen(mq, fn, add) {
    if (mq.addEventListener) mq[add ? 'addEventListener' : 'removeEventListener']('change', fn);
    else mq[add ? 'addListener' : 'removeListener'](fn);
  }
  function playVideo(v) {
    if (!v) return;
    v.muted = true;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }

  class GalleriaCinema extends HTMLElement {
    connectedCallback() {
      if (this._connected) return;
      this._connected = true;
      var self = this;
      this._tick = this.tick.bind(this);
      this._onMq = function () { self.teardown(); self.setup(); };
      listen(mqReduce, this._onMq, true);
      listen(mqShort, this._onMq, true);
      this.setup();
    }

    disconnectedCallback() {
      this._connected = false;
      listen(mqReduce, this._onMq, false);
      listen(mqShort, this._onMq, false);
      this.teardown();
    }

    on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      this.cleanup.push(function () { target.removeEventListener(type, fn, opts); });
    }

    setup() {
      var self = this;
      this.cleanup = [];
      this.pin = this.querySelector('.gc__pin');
      this.track = this.querySelector('[data-gc-track]');
      this.panels = Array.prototype.map.call(this.querySelectorAll('[data-gc-panel]'), function (el, i) {
        return {
          el: el,
          i: i,
          frame: el.querySelector('[data-gc-frame]'),
          media: el.querySelector('[data-gc-media]'),
          num: el.querySelector('[data-gc-num]'),
          video: el.querySelector('video'),
          left: 0,
          w: 0,
          active: false,
          vis: false,
          clip: -1
        };
      });
      this.intro = this.querySelector('[data-gc-intro]');
      this.introInner = this.intro ? this.intro.firstElementChild : null;
      this.words = Array.prototype.slice.call(this.querySelectorAll('[data-gc-word]'));
      this.fill = this.querySelector('[data-gc-fill]');
      this.ticks = Array.prototype.slice.call(this.querySelectorAll('[data-gc-tick]'));
      this.count = this.querySelector('[data-gc-count]');
      this.tc = this.querySelector('[data-gc-tc]');

      // il titolo entra quando la sezione arriva sullo schermo
      if ('IntersectionObserver' in window && !mqReduce.matches) {
        var ioIn = new IntersectionObserver(function (en) {
          if (en[0].isIntersecting) { self.classList.add('is-in'); ioIn.disconnect(); }
        }, { threshold: 0, rootMargin: '0px 0px -30% 0px' });
        ioIn.observe(this);
        this.cleanup.push(function () { ioIn.disconnect(); });
      } else this.classList.add('is-in');

      if (mqReduce.matches || mqShort.matches || !this.pin || !this.track || !this.panels.length || !('IntersectionObserver' in window)) {
        this.dataset.mode = 'static';
        this.setupStatic(mqReduce.matches);
        return;
      }
      this.dataset.mode = 'pin';
      this.setupPin();
    }

    teardown() {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      (this.cleanup || []).forEach(function (fn) { fn(); });
      this.cleanup = [];
      this.style.height = '';
      if (this.track) { this.track.style.transform = ''; this.track.style.paddingRight = ''; }
      (this.panels || []).forEach(function (p) {
        [p.frame, p.media, p.num].forEach(function (el) { if (el) el.style.transform = ''; });
        if (p.frame) p.frame.style.clipPath = '';
        p.clip = -1;
        p.el.classList.remove('is-active');
        if (p.video) p.video.pause();
      });
      if (this.intro) { this.intro.style.transform = ''; this.intro.style.visibility = ''; }
      if (this.introInner) this.introInner.style.opacity = '';
      (this.words || []).forEach(function (w) { w.style.transform = ''; });
      if (this.fill) this.fill.style.transform = '';
      if (this.count) this.count.style.transform = '';
      if (this.pin && this._cursorSet) this.pin.removeAttribute('data-cursor');
      this._cursorSet = false;
      this.classList.remove('is-dragging');
    }

    /* ------------------------------------------------------------------
       Modo statico: tutto visibile; i video partono solo se si possono muovere le cose
       ------------------------------------------------------------------ */
    setupStatic(reduce) {
      var vids = this.panels.map(function (p) { return p.video; }).filter(Boolean);
      if (!vids.length) return;
      if (reduce || !('IntersectionObserver' in window)) {
        // fermi sulla copertina, ma si possono far partire a mano
        vids.forEach(function (v) { v.pause(); v.controls = true; });
        this.cleanup.push(function () { vids.forEach(function (v) { v.controls = false; }); });
        return;
      }
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (e) { if (e.isIntersecting) playVideo(e.target); else e.target.pause(); });
      }, { threshold: 0.25 });
      vids.forEach(function (v) { io.observe(v); });
      this.cleanup.push(function () { io.disconnect(); });
    }

    /* ------------------------------------------------------------------
       Modo bloccato
       ------------------------------------------------------------------ */
    setupPin() {
      var self = this;
      this.speed = clamp((parseFloat(this.dataset.speed) || 110) / 100, 0.6, 2);
      // con lo scorrimento morbido del tema la pagina è già levigata: si segue più da vicino
      this.ease = document.body && document.body.dataset.smoothScroll === 'true' && !coarse ? 0.2 : 0.14;
      this.cur = 0;
      this.vel = 0;
      this.sk = 0;
      this.lastT = 0;
      this.lastIndex = -1;
      this.lastTc = '';
      this.lastE = -1;
      this.visible = false;
      this.dirty = true;
      if (this.dataset.cursorDrag && !this.pin.hasAttribute('data-cursor')) {
        this.pin.setAttribute('data-cursor', this.dataset.cursorDrag);
        this._cursorSet = true;
      }

      this.measure();
      this.lastW = window.innerWidth;
      this.lastH = window.innerHeight;
      // sul telefono la barra degli indirizzi cambia l'altezza a ogni scroll: si rimisura solo se cambia davvero
      this.on(window, 'resize', function () {
        var w = window.innerWidth;
        var h = window.innerHeight;
        if (w === self.lastW && coarse && Math.abs(h - self.lastH) < 160) return;
        self.lastW = w;
        self.lastH = h;
        // un fotogramma dopo: prima il tema aggiorna --header-h
        cancelAnimationFrame(self._rz);
        self._rz = requestAnimationFrame(function () { self.measure(); self.kick(); });
      });
      this.cleanup.push(function () { cancelAnimationFrame(self._rz); });
      // la pagina sopra cambia altezza (immagini, font, sezioni ricaricate nell'editor)
      if ('ResizeObserver' in window) {
        var ro = new ResizeObserver(function () { self.measureTop(); self.dirty = true; self.kick(); });
        ro.observe(document.body);
        this.cleanup.push(function () { ro.disconnect(); });
      }
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
          if (self.dataset.mode === 'pin' && self.isConnected) { self.measure(); self.kick(); }
        });
      }
      this.on(window, 'load', function () { self.measure(); self.kick(); });

      // si lavora solo quando la sezione è vicina allo schermo
      var io = new IntersectionObserver(function (en) {
        self.visible = en[0].isIntersecting;
        if (self.visible) {
          // le foto fuori dalla pista (a destra, ritagliate) il browser non le caricherebbe in anticipo
          if (!self._eager) {
            self._eager = true;
            Array.prototype.forEach.call(self.track.querySelectorAll('img[loading="lazy"]'), function (img) { img.loading = 'eager'; });
          }
          self.dirty = true;
          self.kick();
        } else self.syncVideos();
      }, { rootMargin: '60% 0px' });
      io.observe(this);
      this.cleanup.push(function () { io.disconnect(); });

      this.on(window, 'scroll', function () { self.kick(); }, { passive: true });

      this.bindDrag();
      this.bindWheel();
      this.bindSnap();
      this.bindFocus();
      this.bindEditor();
      this.kick();
    }

    measure() {
      if (!this.pin || !this.track) return;
      var vw = this.pin.clientWidth || document.documentElement.clientWidth;
      this.vw = vw;
      this.pinH = this.pin.offsetHeight;
      this.headerTop = parseFloat(getComputedStyle(this.pin).top) || 0;
      this.track.style.paddingRight = '';
      var self = this;
      this.panels.forEach(function (p) {
        p.left = p.el.offsetLeft;
        p.w = p.el.offsetWidth;
        p.open = p.left + p.w <= vw;   // già tutto a schermo all'inizio: niente otturatore
      });
      var last = this.panels[this.panels.length - 1];
      // senza finale: spazio dopo l'ultimo pannello perché possa arrivare al centro
      if (!this.querySelector('[data-gc-end]')) {
        var gap = parseFloat(getComputedStyle(last.el).marginRight) || 0;
        this.track.style.paddingRight = Math.max(0, (vw - last.w) / 2 - gap) + 'px';
      }
      this.dist = Math.max(1, this.track.scrollWidth - vw);
      this.introW = Math.max(1, this.panels[0].left);
      this.len = Math.max(1, Math.round(this.dist * this.speed));
      this.style.height = (this.pinH + this.len) + 'px';
      this.panels.forEach(function (p, i) {
        var at = clamp((p.left + p.w / 2 - vw / 2) / self.dist, 0, 1);
        if (self.ticks[i]) self.ticks[i].style.left = (at * 100).toFixed(3) + '%';
      });
      this.measureTop();
      this.dirty = true;
    }

    measureTop() {
      this.top = this.getBoundingClientRect().top + window.scrollY;
    }

    // scroll della pagina in cui la pista è all'inizio / alla fine
    range() {
      var min = this.top - this.headerTop;
      return [min, min + this.len];
    }

    kick() {
      if (!this.raf && this.dataset.mode === 'pin') this.raf = requestAnimationFrame(this._tick);
    }

    tick(now) {
      this.raf = 0;
      if (this.dataset.mode !== 'pin') return;
      var dt = this.lastT ? clamp(now - this.lastT, 8, 64) : 16.7;
      this.lastT = now;
      var p = clamp((window.scrollY + this.headerTop - this.top) / this.len, 0, 1);
      var target = p * this.dist;
      var d = target - this.cur;
      var settled = Math.abs(d) < 0.08 && Math.abs(this.sk) < 0.01;
      if (settled && !this.dirty) { this.lastT = 0; return; }
      this.dirty = false;
      var k = 1 - Math.pow(1 - this.ease, dt / 16.7);
      var next = Math.abs(d) < 0.08 ? target : this.cur + d * k;
      this.vel = (next - this.cur) * (16.7 / dt);           // px per fotogramma a 60 Hz
      this.cur = next;
      // inclinazione dalla velocità, levigata
      var skT = clamp(this.vel * 0.09, -4, 4);
      this.sk += (skT - this.sk) * Math.min(1, 0.2 * dt / 16.7);
      if (Math.abs(this.sk) < 0.01) this.sk = 0;
      this.render();
      this.raf = requestAnimationFrame(this._tick);
    }

    render() {
      var cur = this.cur;
      var vw = this.vw;
      this.track.style.transform = 'translate3d(' + (-cur).toFixed(2) + 'px,0,0)';

      // titolo: va via più lento della pista e le parole escono dall'alto, una dopo l'altra
      if (this.intro) {
        var e = clamp(cur / (this.introW * 0.9), 0, 1);
        if (e !== this.lastE) {
          this.lastE = e;
          this.intro.style.transform = 'translate3d(' + (-cur * 0.42).toFixed(1) + 'px,0,0)';
          var nw = this.words.length;
          for (var j = 0; j < nw; j++) {
            var t = clamp(e * 1.7 - (nw > 1 ? j / (nw - 1) : 0) * 0.7, 0, 1);
            var q = t * t * (3 - 2 * t);
            this.words[j].style.transform = 'translate3d(0,' + (-118 * q).toFixed(1) + '%,0) rotate(' + (-7 * q).toFixed(2) + 'deg)';
          }
          if (this.introInner) this.introInner.style.opacity = (1 - clamp((e - 0.55) / 0.45, 0, 1)).toFixed(3);
          this.intro.style.visibility = e >= 1 ? 'hidden' : '';
        }
      }

      var sk = this.sk;
      var sc = 1 - Math.min(Math.abs(sk) / 4, 1) * 0.04;
      var frameT = 'skewX(' + sk.toFixed(2) + 'deg) scale(' + sc.toFixed(4) + ')';
      var best = 0;
      var bestD = Infinity;
      for (var i = 0; i < this.panels.length; i++) {
        var pn = this.panels[i];
        var left = pn.left - cur;
        var right = left + pn.w;
        var dc = left + pn.w / 2 - vw / 2;
        if (Math.abs(dc) < bestD) { bestD = Math.abs(dc); best = i; }
        var vis = right > -vw * 0.15 && left < vw * 1.15;
        if (vis !== pn.vis) { pn.vis = vis; this.videoState(pn); }
        if (!vis) continue;
        var norm = clamp(dc / (vw / 2 + pn.w / 2), -1, 1);
        if (pn.media) {
          var mx = -norm * pn.w * 0.11;
          var ms = 1.04 + Math.max(0, norm) * 0.16;
          pn.media.style.transform = 'translate3d(' + mx.toFixed(1) + 'px,0,0) scale(' + ms.toFixed(4) + ')';
        }
        if (pn.frame) {
          pn.frame.style.transform = frameT;
          // otturatore: la parte destra resta chiusa finché il pannello non entra davvero
          var r = pn.open ? 0 : clamp((left - vw * 0.42) / (vw * 0.44), 0, 1);
          r = Math.round(r * r * (3 - 2 * r) * 1000) / 10;
          // mai un capello di immagine a riposo: o chiuso del tutto o aperto almeno del 12%
          if (r > 88) r = 100;
          if (r !== pn.clip) { pn.clip = r; pn.frame.style.clipPath = r > 0 ? 'inset(0 ' + r + '% 0 0)' : ''; }
        }
        if (pn.num) pn.num.style.transform = 'translate3d(' + (norm * vw * 0.075).toFixed(1) + 'px,0,0)';
        var on = pn.active ? Math.abs(norm) < 0.45 && left > -pn.w * 0.15 : Math.abs(norm) < 0.32;
        if (on !== pn.active) { pn.active = on; pn.el.classList.toggle('is-active', on); }
      }

      if (best !== this.lastIndex && this.count) {
        this.lastIndex = best;
        this.count.style.transform = 'translate3d(0,' + (-best) + 'em,0)';
      }
      var prog = cur / this.dist;
      if (this.fill) this.fill.style.transform = 'scaleX(' + prog.toFixed(4) + ')';
      if (this.tc) {
        // timecode a 24 fotogrammi: circa 6 secondi di "pellicola" per pannello
        var f = Math.round(prog * this.panels.length * 6 * 24);
        var s = Math.floor(f / 24);
        var txt = '00:' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60) + ':' + pad(f % 24);
        if (txt !== this.lastTc) { this.lastTc = txt; this.tc.textContent = txt; }
      }
    }

    /* video: suonano solo i pannelli a schermo, e solo con la sezione visibile */
    videoState(pn) {
      if (!pn.video) return;
      if (pn.vis && this.visible) playVideo(pn.video);
      else pn.video.pause();
    }
    syncVideos() {
      var self = this;
      this.panels.forEach(function (p) { self.videoState(p); });
    }

    // porta il pannello i al centro muovendo la pagina
    scrollToPanel(i, smooth) {
      var p = this.panels[i];
      if (!p) return;
      var x = clamp(p.left + p.w / 2 - this.vw / 2, 0, this.dist);
      var rg = this.range();
      window.scrollTo({ top: rg[0] + (x / this.dist) * this.len, behavior: smooth ? 'smooth' : 'auto' });
    }

    /* trascinamento con mouse o dito: muove la pagina, con inerzia al rilascio */
    bindDrag() {
      var self = this;
      var pin = this.pin;
      var id = null;
      var x0 = 0;
      var y0 = 0;
      var s0 = 0;
      var lastX = 0;
      var lastT = 0;
      var v = 0;
      var dragging = false;
      var moved = false;
      var inertia = 0;
      function ratio() { return self.len / self.dist; }
      this.on(pin, 'pointerdown', function (e) {
        if (e.button !== 0) return;
        cancelAnimationFrame(inertia);
        id = e.pointerId;
        x0 = lastX = e.clientX;
        y0 = e.clientY;
        s0 = window.scrollY;
        lastT = e.timeStamp;
        v = 0;
        dragging = false;
        moved = false;
      });
      this.on(pin, 'pointermove', function (e) {
        if (e.pointerId !== id) return;
        var dx = e.clientX - x0;
        var dy = e.clientY - y0;
        if (!dragging) {
          if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { id = null; return; }
          if (Math.abs(dx) < 8) return;
          dragging = true;
          moved = true;
          x0 = lastX = e.clientX;
          s0 = window.scrollY;
          try { pin.setPointerCapture(id); } catch (err) {}
          self.classList.add('is-dragging');
          return;
        }
        var dt = Math.max(1, e.timeStamp - lastT);
        v = 0.75 * ((e.clientX - lastX) / dt) + 0.25 * v;
        lastX = e.clientX;
        lastT = e.timeStamp;
        var rg = self.range();
        window.scrollTo(0, clamp(s0 - (e.clientX - x0) * ratio(), rg[0], rg[1]));
      });
      function end(e) {
        if (e.pointerId !== id) return;
        id = null;
        if (!dragging) return;
        dragging = false;
        self.classList.remove('is-dragging');
        if (e.timeStamp - lastT > 80) v = 0;
        var vel = -v * ratio() * 16.7;
        (function step() {
          vel *= 0.935;
          if (Math.abs(vel) < 0.4) return;
          var rg = self.range();
          var y = clamp(window.scrollY + vel, rg[0], rg[1]);
          window.scrollTo(0, y);
          if (y === rg[0] || y === rg[1]) return;
          inertia = requestAnimationFrame(step);
        })();
      }
      this.on(pin, 'pointerup', end);
      this.on(pin, 'pointercancel', end);
      // dopo un trascinamento il rilascio non apre il link
      this.on(pin, 'click', function (e) {
        if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
      }, true);
      this.on(pin, 'dragstart', function (e) { e.preventDefault(); });
      this.cleanup.push(function () { cancelAnimationFrame(inertia); });
    }

    /* col dito: quando lo scorrimento si ferma dentro la pista, il pannello più vicino va al centro
       (come uno scroll-snap, ma sullo scroll della pagina che muove la pista) */
    bindSnap() {
      if (!coarse) return;
      var self = this;
      var timer = 0;
      var touching = false;
      function schedule() {
        clearTimeout(timer);
        if (!touching && self.visible) timer = setTimeout(snap, 170);
      }
      function snap() {
        if (touching || !self.visible || self.dataset.mode !== 'pin') return;
        var rg = self.range();
        var y = window.scrollY;
        if (y <= rg[0] + 2 || y >= rg[1] - 2) return;   // all'inizio e alla fine si esce liberamente
        var x = ((y - rg[0]) / self.len) * self.dist;
        var best = 0;
        var bestD = x;                                   // il titolo d'apertura (x = 0)
        for (var i = 0; i < self.panels.length; i++) {
          var p = self.panels[i];
          var c = clamp(p.left + p.w / 2 - self.vw / 2, 0, self.dist);
          if (Math.abs(c - x) < bestD) { bestD = Math.abs(c - x); best = c; }
        }
        if (self.dist - x < bestD) best = self.dist;    // il finale
        var ty = Math.round(rg[0] + (best / self.dist) * self.len);
        if (Math.abs(ty - y) < 3) return;
        window.scrollTo({ top: ty, behavior: 'smooth' });
      }
      function down() { touching = true; clearTimeout(timer); }
      function up() { touching = false; schedule(); }
      this.on(window, 'touchstart', down, { passive: true });
      this.on(window, 'touchend', up, { passive: true });
      this.on(window, 'touchcancel', up, { passive: true });
      this.on(window, 'scroll', schedule, { passive: true });
      this.cleanup.push(function () { clearTimeout(timer); });
    }

    /* swipe orizzontale del trackpad: diventa scroll della pagina, solo mentre la pista è bloccata */
    bindWheel() {
      var self = this;
      var acc = 0;
      var raf = 0;
      this.on(this.pin, 'wheel', function (e) {
        if (e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        var rg = self.range();
        var y = window.scrollY;
        if (y < rg[0] - 4 || y > rg[1] + 4) return;
        e.preventDefault();
        acc += e.deltaX * (e.deltaMode === 1 ? 40 : 1) * (self.len / self.dist);
        if (!raf) {
          raf = requestAnimationFrame(function () {
            raf = 0;
            var r = self.range();
            window.scrollTo(0, clamp(window.scrollY + acc, r[0], r[1]));
            acc = 0;
          });
        }
      }, { passive: false });
      this.cleanup.push(function () { cancelAnimationFrame(raf); });
    }

    /* tastiera: il pannello che riceve il focus arriva al centro */
    bindFocus() {
      var self = this;
      this.on(this, 'focusin', function (e) {
        var li = e.target.closest && e.target.closest('[data-gc-panel], [data-gc-end]');
        if (!li) return;
        if (self.pin.scrollLeft) self.pin.scrollLeft = 0;
        requestAnimationFrame(function () {
          var i = -1;
          for (var k = 0; k < self.panels.length; k++) if (self.panels[k].el === li) i = k;
          if (i >= 0) self.scrollToPanel(i, false);
          else window.scrollTo(0, self.range()[1]);
        });
      });
    }

    /* editor del tema: selezionando un blocco il pannello va al centro */
    bindEditor() {
      var self = this;
      if (!window.Shopify || !window.Shopify.designMode) return;
      this.on(document, 'shopify:block:select', function (e) {
        if (!self.contains(e.target)) return;
        for (var k = 0; k < self.panels.length; k++) {
          if (self.panels[k].el === e.target || self.panels[k].el.contains(e.target)) {
            var i = k;
            setTimeout(function () { self.scrollToPanel(i, true); }, 60);
            return;
          }
        }
      });
    }
  }

  customElements.define('galleria-cinema', GalleriaCinema);
})();
