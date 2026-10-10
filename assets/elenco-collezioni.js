/*
  Tutte le collezioni — schermate impilate (sections/main-list-collections.liquid)
  <elenco-collezioni>
    - i pannelli stanno fermi sotto l'header con position: sticky (CSS); qui, a ogni frame di scroll,
      il pannello che viene coperto si rimpicciolisce, si scurisce e arrotonda gli angoli, quello che sale
      ha la foto in parallasse e gli angoli che si raddrizzano mentre si appoggia
    - la collezione a schermo (quella che attraversa il centro dello schermo) accende il suo titolo
      e si evidenzia nell'indice laterale; un clic sull'indice porta alla collezione
  Solo transform / opacity / clip-path; misure prese una volta (e al resize), non a ogni frame.
  Con "riduci movimento": niente pila né animazioni, l'indice funziona lo stesso.
*/
(function () {
  'use strict';
  if (!window.customElements || customElements.get('elenco-collezioni')) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mqPhone = window.matchMedia('(max-width: 749px)');

  // quanto si muove: sul telefono la pila è più leggera
  var DESKTOP = { scale: 0.1, lift: 2.5, radius: 28, par: 10, drift: 4, zoomBase: 1.1, zoomIn: 0.14, shadeIn: 0.45, shadeOut: 0.8 };
  var PHONE = { scale: 0.06, lift: 1.5, radius: 18, par: 5, drift: 2, zoomBase: 1.05, zoomIn: 0.07, shadeIn: 0.3, shadeOut: 0.72 };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function headerHeight() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0;
  }

  class ElencoCollezioni extends HTMLElement {
    connectedCallback() {
      var self = this;
      this.panels = Array.prototype.slice.call(this.querySelectorAll('[data-ec-panel]'));
      this.links = Array.prototype.slice.call(this.querySelectorAll('[data-ec-link]'));
      this.stack = this.querySelector('[data-ec-stack]');
      this.indexList = this.querySelector('.ec__index-list');
      this.current = -1;
      this.cleanup = [];

      if (!reduce) {
        this.classList.add('is-live');
        // l'apertura entra dopo il primo disegno (e dopo il sipario tra le pagine)
        requestAnimationFrame(function () { requestAnimationFrame(function () { self.classList.add('is-ready'); }); });
      }
      if (!this.panels.length || !this.stack) return;

      this.items = this.panels.map(function (panel) {
        return {
          panel: panel,
          card: panel.querySelector('[data-ec-card]'),
          media: panel.querySelector('[data-ec-media]'),
          shade: panel.querySelector('[data-ec-shade]'),
          p: -1, e: -1, near: false
        };
      });

      this.watchCurrent();
      this.bindLinks();
      if (!reduce) this.startStack();
    }

    disconnectedCallback() {
      (this.cleanup || []).forEach(function (fn) { fn(); });
      this.cleanup = [];
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    }

    on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      this.cleanup.push(function () { target.removeEventListener(type, fn, opts); });
    }

    /* collezione a schermo: la più alta tra quelle che attraversano il centro dello schermo
       (nella pila quelle sotto restano lì, coperte; senza pila ce n'è una sola) */
    watchCurrent() {
      var self = this;
      if (!('IntersectionObserver' in window)) {
        this.items.forEach(function (it) { it.panel.classList.add('is-in'); });
        this.setCurrent(0);
        return;
      }
      var crossing = this.items.map(function () { return false; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var i = self.panels.indexOf(en.target);
          if (i >= 0) crossing[i] = en.isIntersecting;
        });
        var top = crossing.lastIndexOf(true);
        if (top >= 0) {
          for (var k = 0; k <= top; k++) if (crossing[k]) self.panels[k].classList.add('is-in');
          self.setCurrent(top);
        }
      }, { rootMargin: '-48% 0px -48% 0px' });
      this.panels.forEach(function (p) { io.observe(p); });
      this.cleanup.push(function () { io.disconnect(); });
    }

    setCurrent(i) {
      if (i === this.current) return;
      this.current = i;
      this.links.forEach(function (a, k) {
        var on = k === i;
        a.classList.toggle('is-current', on);
        if (on) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }

    /* posizione di scroll in cui il pannello i è appoggiato sotto l'header */
    landing(i) {
      if (this.live) return Math.ceil(this.stackTop + i * this.H - this.headerH);
      return Math.ceil(this.panels[i].getBoundingClientRect().top + window.scrollY - headerHeight());
    }

    goTo(i, smooth) {
      if (!this.panels[i]) return;
      if (this.live) this.measure();
      window.scrollTo({ top: this.landing(i), behavior: smooth && !reduce ? 'smooth' : 'auto' });
    }

    bindLinks() {
      var self = this;
      this.links.forEach(function (a) {
        self.on(a, 'click', function (e) {
          var i = parseInt(a.getAttribute('data-ec-link'), 10);
          if (!self.panels[i]) return;
          e.preventDefault();
          self.goTo(i, true);
          var cta = self.panels[i].querySelector('.ec__cta');
          if (cta) { try { cta.focus({ preventScroll: true }); } catch (err) {} }
        });
      });
      // con la tastiera: il pannello del link raggiunto viene portato in primo piano
      this.on(this, 'focusin', function (e) {
        if (!self.live) return;
        var t = e.target;
        var panel = t.closest && t.closest('[data-ec-panel]');
        if (!panel) return;
        var focusVisible = false;
        try { focusVisible = t.matches(':focus-visible'); } catch (err) {}
        if (!focusVisible) return;
        var i = self.panels.indexOf(panel);
        if (i >= 0 && Math.abs(self.f - i) > 0.02) self.goTo(i, false);
      });
      // editor del tema: selezionando un blocco si va alla sua collezione
      this.on(document, 'shopify:block:select', function (e) {
        var i = self.panels.indexOf(e.target);
        if (i >= 0) self.goTo(i, false);
      });
    }

    /* ------------------------------------------------------------------ pila */
    startStack() {
      var self = this;
      this.live = true;
      this.visible = true;
      this.f = 0;

      this.measure();
      this.update();

      this.onScroll = function () {
        if (!self.visible || self.raf) return;
        self.raf = requestAnimationFrame(function () { self.raf = 0; self.update(); });
      };
      this.onResize = function () {
        if (self.rafResize) return;
        self.rafResize = requestAnimationFrame(function () {
          self.rafResize = 0;
          self.measure();
          self.update();
        });
      };
      this.on(window, 'scroll', this.onScroll, { passive: true });
      this.on(window, 'resize', this.onResize, { passive: true });
      if (mqPhone.addEventListener) this.on(mqPhone, 'change', this.onResize);

      // si lavora solo quando la pila è a schermo
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          self.visible = entries[entries.length - 1].isIntersecting;
          if (self.visible) self.onScroll();
        }, { rootMargin: '10% 0px 10% 0px' });
        io.observe(this.stack);
        this.cleanup.push(function () { io.disconnect(); });
      }
      // l'altezza della pagina sopra la pila può cambiare (font, titolo adattato, immagini)
      if ('ResizeObserver' in window) {
        var ro = new ResizeObserver(this.onResize);
        ro.observe(document.body);
        this.cleanup.push(function () { ro.disconnect(); });
      }
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(this.onResize);
    }

    measure() {
      var first = this.panels[0];
      this.H = first.offsetHeight || window.innerHeight;
      this.headerH = parseFloat(getComputedStyle(first).top) || 0;
      this.stackTop = this.stack.getBoundingClientRect().top + window.scrollY;
      this.cfg = mqPhone.matches ? PHONE : DESKTOP;
      // forza il ridisegno di tutti i pannelli con le nuove misure
      this.items.forEach(function (it) { it.p = -1; it.e = -1; });
      this.indexO = -1;
    }

    update() {
      var cfg = this.cfg;
      // f = quanti pannelli sono già appoggiati (0 = il primo è appena arrivato sotto l'header)
      var f = (window.scrollY + this.headerH - this.stackTop) / this.H;
      this.f = f;
      var base = Math.floor(f);
      for (var i = 0; i < this.items.length; i++) {
        var it = this.items[i];
        var p = Math.round(clamp(f - i, 0, 1) * 1000) / 1000;     // quanto è coperto dal successivo
        var e = Math.round(clamp(f - i + 1, 0, 1) * 1000) / 1000; // quanto è salito al suo posto
        var near = i >= base - 1 && i <= base + 1;
        if (near !== it.near) { it.near = near; it.panel.classList.toggle('is-near', near); }
        if (p === it.p && e === it.e) continue;
        it.p = p; it.e = e;

        if (it.card) {
          it.card.style.transform = p > 0
            ? 'translate3d(0,' + (-cfg.lift * p).toFixed(2) + '%,0) scale(' + (1 - cfg.scale * p).toFixed(4) + ')'
            : '';
          var r = p > 0 ? cfg.radius * p : cfg.radius * (1 - e);
          it.card.style.clipPath = r > 0.4 ? 'inset(0 round ' + r.toFixed(1) + 'px)' : '';
          // del tutto coperto: non si disegna più (resta raggiungibile con la tastiera)
          it.card.style.opacity = p >= 1 ? '0' : '';
        }
        if (it.media) {
          var y = -cfg.par * (1 - e) + cfg.drift * p;
          var s = cfg.zoomBase + cfg.zoomIn * (1 - e);
          it.media.style.transform = 'translate3d(0,' + y.toFixed(2) + '%,0) scale(' + s.toFixed(4) + ')';
        }
        if (it.shade) it.shade.style.opacity = Math.max(cfg.shadeIn * (1 - e), cfg.shadeOut * p).toFixed(3);
      }
      // l'indice compare con il primo pannello e se ne va con l'ultimo
      if (this.indexList) {
        var o = Math.min(clamp((f + 0.75) / 0.5, 0, 1), 1 - clamp((f - this.items.length + 1) / 0.35, 0, 1));
        o = Math.round(o * 100) / 100;
        if (o !== this.indexO) {
          this.indexO = o;
          this.indexList.style.opacity = o;
          this.indexList.style.transform = o < 1 ? 'translate3d(' + ((1 - o) * 24).toFixed(1) + 'px,0,0)' : '';
        }
      }
    }
  }

  customElements.define('elenco-collezioni', ElencoCollezioni);
})();
