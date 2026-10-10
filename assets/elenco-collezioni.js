/*
  Tutte le collezioni — schermate impilate (sections/main-list-collections.liquid)
  <elenco-collezioni>
    - i pannelli stanno fermi sotto l'header con position: sticky (CSS); qui, a ogni frame di scroll,
      il pannello che viene coperto si rimpicciolisce, si scurisce e arrotonda gli angoli, quello che sale
      ha la foto in parallasse e gli angoli che si raddrizzano mentre si appoggia
    - la schermata finale ("Tutti i prodotti") copre l'ultima collezione come un'ultima carta
    - la collezione a schermo (quella che attraversa il centro dello schermo) accende il suo titolo
      e si evidenzia nell'indice laterale; il binario dell'indice segue lo scroll; un clic porta alla collezione
  Solo transform / opacity / clip-path; misure prese una volta (e al resize), non a ogni frame;
  si lavora solo quando la pila è a schermo.
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
  function round(v, k) { return Math.round(v * k) / k; }
  function headerHeight() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0;
  }

  class ElencoCollezioni extends HTMLElement {
    connectedCallback() {
      var self = this;
      if (this.started) return;
      this.started = true;
      this.panels = Array.prototype.slice.call(this.querySelectorAll('[data-ec-panel]'));
      this.links = Array.prototype.slice.call(this.querySelectorAll('[data-ec-link]'));
      this.stack = this.querySelector('[data-ec-stack]');
      this.index = this.querySelector('[data-ec-index]');
      this.indexBox = this.querySelector('[data-ec-index-box]');
      this.fill = this.querySelector('[data-ec-fill]');
      this.outro = this.querySelector('[data-ec-outro]');
      this.outroInner = this.querySelector('[data-ec-outro-inner]');
      this.glow = this.querySelector('[data-ec-glow]');
      this.current = -1;
      this.cleanup = [];

      if (!reduce) {
        this.classList.add('is-live');
        // l'apertura entra dopo il primo disegno (e dopo il sipario tra le pagine)
        requestAnimationFrame(function () { requestAnimationFrame(function () { self.classList.add('is-ready'); }); });
      }
      this.fitText();
      if (!this.panels.length || !this.stack) return;

      this.items = this.panels.map(function (panel) {
        return {
          panel: panel,
          card: panel.querySelector('[data-ec-card]'),
          media: panel.querySelector('[data-ec-media]'),
          shade: panel.querySelector('[data-ec-shade]'),
          light: panel.hasAttribute('data-ec-light'),
          p: -1, e: -1, near: null
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
      if (this.rafResize) cancelAnimationFrame(this.rafResize);
      this.raf = this.rafResize = 0;
      this.started = false;
      this.live = false;
    }

    /* il titolo dell'apertura riempie la riga (senza superare ~40% dell'altezza dello schermo);
       i nomi delle collezioni si rimpiccioliscono solo se una parola è più larga del pannello.
       Si rimisura quando cambia la larghezza e quando arrivano i font (vale anche con "riduci movimento"). */
    fitText() {
      var self = this;
      var title = this.querySelector('[data-ec-fit]');
      var names = Array.prototype.slice.call(this.querySelectorAll('.ec__name, .ec__outro-title'));
      var lastW = -1;
      var fit = function (force) {
        var w = self.clientWidth;
        if (!w || (w === lastW && force !== true)) return;
        lastW = w;
        // niente transizioni mentre si misura (con "riduci movimento" theme.css dà a tutto una transizione brevissima,
        // e la misura letta subito dopo il cambio sarebbe quella vecchia)
        self.classList.add('ec--measure');
        if (title && title.parentElement) {
          title.style.fontSize = '100px';
          var tw = title.scrollWidth;
          var box = title.parentElement.clientWidth;
          if (tw && box) title.style.fontSize = Math.min(100 * box / tw, window.innerHeight * 0.4).toFixed(2) + 'px';
        }
        names.forEach(function (el) { el.style.fontSize = ''; });
        names.forEach(function (el) {
          var over = el.scrollWidth - el.clientWidth;
          if (over > 1 && el.clientWidth) {
            var fs = parseFloat(getComputedStyle(el).fontSize);
            el.style.fontSize = Math.floor(fs * el.clientWidth / el.scrollWidth) + 'px';
          }
        });
        self.classList.remove('ec--measure');
      };
      var refit = function () { fit(true); };
      fit(true);
      if ('ResizeObserver' in window) {
        var ro = new ResizeObserver(function () { fit(false); });
        ro.observe(this);
        this.cleanup.push(function () { ro.disconnect(); });
      } else {
        this.on(window, 'resize', function () { fit(false); }, { passive: true });
      }
      if (document.fonts) {
        if (document.fonts.addEventListener) this.on(document.fonts, 'loadingdone', refit);
        if (document.fonts.ready) document.fonts.ready.then(function () { if (self.started) refit(); });
      }
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
        if (this.outro) this.outro.classList.add('is-in');
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

      if (this.outro) {
        var io2 = new IntersectionObserver(function (entries) {
          if (entries[entries.length - 1].isIntersecting) { self.outro.classList.add('is-in'); io2.disconnect(); }
        }, { threshold: 0.35 });
        io2.observe(this.outro);
        this.cleanup.push(function () { io2.disconnect(); });
      }
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
      // sui pannelli col set chiaro l'indice diventa scuro
      if (this.index && this.items[i]) this.index.classList.toggle('is-light', this.items[i].light);
      // senza pila il binario segue la collezione a schermo
      if (!this.live && this.fill) this.fill.style.transform = 'scaleY(' + round((i + 1) / this.items.length, 1000) + ')';
    }

    /* posizione di scroll in cui il pannello i è appoggiato sotto l'header */
    landing(i) {
      if (this.live) return Math.ceil(this.stackTop + i * this.P - this.headerH);
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
        // già tutto a schermo (appoggiato o nella pausa): non si muove niente
        var si = i * self.P;
        if (i >= 0 && (self.s < si - 2 || self.s > si + self.gap + 2)) self.goTo(i, false);
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
      // l'altezza della pagina sopra la pila può cambiare (font, titolo adattato, immagini, header)
      if ('ResizeObserver' in window) {
        var ro = new ResizeObserver(this.onResize);
        ro.observe(document.body);
        this.cleanup.push(function () { ro.disconnect(); });
      }
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (self.live) self.onResize(); });
    }

    measure() {
      var first = this.panels[0];
      this.H = first.offsetHeight || window.innerHeight;
      this.headerH = parseFloat(getComputedStyle(first).top) || 0;
      // pausa tra un pannello e l'altro (margine in CSS): il pannello appoggiato resta tutto a schermo per un tratto
      var next = this.panels[1] || this.outro;
      this.gap = next ? parseFloat(getComputedStyle(next).marginTop) || 0 : 0;
      this.P = this.H + this.gap;
      this.stackTop = this.stack.getBoundingClientRect().top + window.scrollY;
      this.cfg = mqPhone.matches ? PHONE : DESKTOP;
      // forza il ridisegno di tutto con le nuove misure
      this.items.forEach(function (it) { it.p = it.e = it.l = -1; });
      this.indexO = this.fillS = this.outroQ = -1;
    }

    update() {
      var cfg = this.cfg;
      var n = this.items.length;
      var H = this.H, gap = this.gap, P = this.P;
      // s = quanto si è scesi nella pila (0 = il primo pannello è appena arrivato sotto l'header);
      // il pannello i si appoggia a s = i * P, resta fermo per "gap", poi il successivo lo copre in H
      var s = window.scrollY + this.headerH - this.stackTop;
      this.s = s;
      this.f = s / P;
      for (var i = 0; i < n; i++) {
        var it = this.items[i];
        var si = i * P;
        // quanto è salito al suo posto
        var e = round(clamp((s - si + H) / H, 0, 1), 1000);
        // quanto è coperto dal successivo (l'ultimo lo copre la schermata finale, se c'è)
        var p = i === n - 1 && !this.outro ? 0 : round(clamp((s - si - gap) / H, 0, 1), 1000);
        // vita intera del pannello, da quando inizia a salire a quando è coperto: la foto scorre e si allarga
        // senza fermarsi mai, anche nella pausa
        var l = round(clamp((s - si + H) / (2 * H + gap), 0, 1), 1000);
        var near = s > si - H - 40 && s < si + gap + H + 40;
        if (near !== it.near) { it.near = near; it.panel.classList.toggle('is-near', near); }
        if (p === it.p && e === it.e && l === it.l) continue;
        var cardChanged = p !== it.p || e !== it.e;
        it.p = p; it.e = e; it.l = l;

        if (it.card && cardChanged) {
          it.card.style.transform = p > 0
            ? 'translate3d(0,' + (-cfg.lift * p).toFixed(2) + '%,0) scale(' + (1 - cfg.scale * p).toFixed(4) + ')'
            : '';
          var r = p > 0 ? cfg.radius * p : cfg.radius * (1 - e);
          it.card.style.clipPath = r > 0.4 ? 'inset(0 round ' + r.toFixed(1) + 'px)' : '';
          // del tutto coperto: non si disegna più (resta raggiungibile con la tastiera)
          it.card.style.opacity = p >= 1 ? '0' : '';
          if (it.shade) it.shade.style.opacity = Math.max(cfg.shadeIn * (1 - e), cfg.shadeOut * p).toFixed(3);
        }
        if (it.media) {
          var y = -cfg.par + (cfg.par + cfg.drift) * l;
          var z = cfg.zoomBase + cfg.zoomIn * (1 - l);
          it.media.style.transform = 'translate3d(0,' + y.toFixed(2) + '%,0) scale(' + z.toFixed(4) + ')';
        }
      }

      var sLast = (n - 1) * P;
      // schermata finale: sale come un'altra carta; la scritta arriva un po' più lenta e la luce cresce
      var q = round(clamp((s - sLast - (this.outro ? gap : 0)) / H, 0, 1), 1000);
      if (this.outro && q !== this.outroQ) {
        this.outroQ = q;
        if (this.outroInner) this.outroInner.style.transform = q < 1 ? 'translate3d(0,' + (-(1 - q) * 18).toFixed(2) + 'vh,0)' : '';
        if (this.glow) {
          this.glow.style.transform = 'translate3d(0,' + ((1 - q) * 22).toFixed(2) + '%,0) scale(' + (0.7 + 0.3 * q).toFixed(4) + ')';
          this.glow.style.opacity = (0.25 + 0.75 * q).toFixed(3);
        }
      }

      if (this.indexBox) {
        // l'indice compare con il primo pannello e se ne va quando sale la schermata finale (o se ne va l'ultimo pannello)
        var o = Math.min(clamp((s + 0.75 * H) / (0.5 * H), 0, 1), 1 - clamp(q / 0.35, 0, 1));
        o = round(o, 100);
        if (o !== this.indexO) {
          this.indexO = o;
          this.indexBox.style.opacity = o;
          this.indexBox.style.transform = o < 1 ? 'translate3d(' + ((1 - o) * 24).toFixed(1) + 'px,0,0)' : '';
          // quasi invisibile: i link non si prendono i clic (con la tastiera l'indice ricompare, vedi CSS)
          this.indexBox.classList.toggle('is-off', o < 0.1);
        }
        // binario: avanza con lo scroll lungo tutto l'elenco, pieno quando l'ultima collezione è appoggiata
        if (this.fill) {
          var fs = round(clamp((s + H) / (sLast + H), 0, 1), 1000);
          if (fs !== this.fillS) { this.fillS = fs; this.fill.style.transform = 'scaleY(' + fs + ')'; }
        }
      }
    }
  }

  customElements.define('elenco-collezioni', ElencoCollezioni);
})();
