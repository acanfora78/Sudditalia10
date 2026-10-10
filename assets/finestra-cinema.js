/*
  <finestra-cinema>  (sections/finestra-cinema.liquid)
  Lo schermo resta bloccato mentre si scorre; il progresso p (0 → 1) muove tutto:
    0.00 – 0.04  finestra piccola, scritta intera
    0.04 – 0.60  la finestra si allarga fino a tutto schermo (clip-path), il video passa da zoom 1.3 a 1,
                 le lettere si allontanano dal centro verso i lati e sfumano, la scritta "avanza" verso chi guarda
    ~0.55        finestra aperta: entrano etichetta, titolo, sottotitolo, bottone, prodotti (classe .is-open)
    0.60 – 1.00  il video continua a muoversi piano; alla fine si scurisce per legarsi alla sezione dopo
  All'arrivo sullo schermo: le lettere salgono dal basso e la finestra si apre come un otturatore.
  Col mouse la scena dentro la finestra segue appena il puntatore.
  Lavora solo quando la sezione è sullo schermo; misura una volta (e a ogni ridimensionamento).
  Con "riduci movimento" non fa niente: il CSS mostra video e testi fermi, senza blocco.
*/
(function () {
  'use strict';
  if (!window.customElements || customElements.get('finestra-cinema')) return;

  var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mobileMq = window.matchMedia('(max-width: 749px)');
  var fineMq = window.matchMedia('(hover: hover) and (pointer: fine)');

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function range(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function inOutQuart(t) { return t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; }
  function inOutCubic(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function outExpo(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function px(v) { return v.toFixed(1) + 'px'; }

  var INTRO_MS = 1500;

  customElements.define('finestra-cinema', class extends HTMLElement {
    connectedCallback() {
      if (this._live) return;
      this.sticky = this.querySelector('.fc__sticky');
      this.win = this.querySelector('[data-fc-window]');
      this.media = this.querySelector('[data-fc-media]');
      this.probe = this.querySelector('[data-fc-probe]');
      this.videos = Array.prototype.slice.call(this.querySelectorAll('[data-fc-video] video'));
      this.videos.forEach(function (v) {
        v.muted = true;
        v.addEventListener('playing', function () { v.classList.add('is-playing'); });
      });
      if (!this.sticky || !this.win || !this.media || !this.probe || reduceMq.matches) return;
      this._live = true;

      this.fill = this.querySelector('.fc__word--fill');
      this.ghost = this.querySelector('.fc__word--ghost');
      this.frame = this.querySelector('[data-fc-frame]');
      this.corners = this.frame ? Array.prototype.slice.call(this.frame.children) : [];
      this.hud = this.querySelector('[data-fc-hud]');
      this.count = this.querySelector('[data-fc-count]');
      this.bar = this.querySelector('[data-fc-bar]');
      this.dim = this.querySelector('[data-fc-dim]');
      this.par = this.querySelector('[data-fc-par]');
      this.lines = this.fill ? Array.prototype.slice.call(this.fill.querySelectorAll('[data-fc-line]')) : [];
      this.ghostLines = this.ghost ? Array.prototype.slice.call(this.ghost.querySelectorAll('[data-fc-line]')) : [];
      this.isLogo = this.classList.contains('fc--logo');

      // ogni lettera (o striscia del logo) sa quanto è lontana dal centro della sua riga
      var self = this;
      this.items = [];
      this.lines.forEach(function (line, li) {
        var chars = line.querySelectorAll('[data-fc-ch]');
        var twins = self.ghostLines[li] ? self.ghostLines[li].querySelectorAll('[data-fc-ch]') : [];
        var n = chars.length;
        var c = (n - 1) / 2;
        var dir = parseFloat(line.getAttribute('data-fc-dir')) || 0;
        for (var i = 0; i < n; i++) {
          var d = c > 0 ? (i - c) / c : 0;
          var a = Math.abs(d);
          var els = [chars[i]];
          if (twins[i]) els.push(twins[i]);
          els.forEach(function (el) { el.style.setProperty('--o', a.toFixed(3)); });
          if (chars[i].classList.contains('fc__ch--sp')) continue;
          self.items.push({ els: els, d: d, a: a, dir: dir, last: '' });
        }
      });

      this.p = -1;
      this.introStart = 0;
      this.introE = 0;
      this.open = false;
      this.visible = false;
      this.classList.add('is-ready');

      this._frame = this.frameTick.bind(this);
      this._onScroll = function () { if (self.visible) self.request(); };
      this._onResize = function () {
        if (self._resizeRaf) return;
        self._resizeRaf = requestAnimationFrame(function () { self._resizeRaf = 0; self.measure(true); });
      };
      this._onMq = function () { self.measure(true); self.playVideo(self.visible); };
      // mouse: la scena dentro la finestra segue appena il puntatore (profondità)
      this.pt = { x: 0, y: 0, tx: 0, ty: 0 };
      this._parTick = this.parTick.bind(this);
      this._onPointer = function (e) {
        if (!self.visible || !self.par || e.pointerType !== 'mouse' || !fineMq.matches) return;
        self.pt.tx = (e.clientX / (self.vw || window.innerWidth)) * 2 - 1;
        self.pt.ty = (e.clientY / (self.vh || window.innerHeight)) * 2 - 1;
        if (!self._parRaf) self._parRaf = requestAnimationFrame(self._parTick);
      };
      window.addEventListener('pointermove', this._onPointer, { passive: true });
      window.addEventListener('scroll', this._onScroll, { passive: true });
      window.addEventListener('resize', this._onResize, { passive: true });
      window.addEventListener('load', this._onResize);
      if (mobileMq.addEventListener) mobileMq.addEventListener('change', this._onMq);

      // la pagina sopra cambia altezza (immagini, altre sezioni): si rimisura solo la posizione
      if ('ResizeObserver' in window) {
        this.ro = new ResizeObserver(function () { self.measureTop(); self.request(); });
        this.ro.observe(document.body);
      }
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (self._live) self.measure(true); });

      if ('IntersectionObserver' in window) {
        this.io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            self.visible = e.isIntersecting;
            self.classList.toggle('is-visible', self.visible);
            self.playVideo(self.visible);
            if (self.visible) self.request();
          });
        }, { rootMargin: '15% 0px 15% 0px' });
        this.io.observe(this);
        // entrata: quando l'inizio della sezione supera tre quarti dello schermo
        this.ioIn = new IntersectionObserver(function (entries) {
          if (!entries.some(function (e) { return e.isIntersecting; })) return;
          self.ioIn.disconnect();
          self.startIntro();
        }, { rootMargin: '0px 0px -25% 0px' });
        this.ioIn.observe(this);
      } else {
        this.visible = true;
        this.classList.add('is-visible');
        this.startIntro();
        this.playVideo(true);
      }

      this.measure(true);
    }

    disconnectedCallback() {
      if (!this._live) return;
      this._live = false;
      window.removeEventListener('pointermove', this._onPointer);
      window.removeEventListener('scroll', this._onScroll);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('load', this._onResize);
      if (mobileMq.removeEventListener) mobileMq.removeEventListener('change', this._onMq);
      if (this.io) this.io.disconnect();
      if (this.ioIn) this.ioIn.disconnect();
      if (this.ro) this.ro.disconnect();
      cancelAnimationFrame(this._raf);
      cancelAnimationFrame(this._resizeRaf);
      cancelAnimationFrame(this._parRaf);
      this._raf = this._resizeRaf = this._parRaf = 0;
      this.videos.forEach(function (v) { v.pause(); });
    }

    startIntro() {
      if (this.introStart) return;
      this.introStart = performance.now();
      // arrivati già dentro (pagina ricaricata più in basso, o si risale da sotto): niente otturatore
      if (this.dist && (window.scrollY - this.top) / this.dist > .2) this.introStart -= INTRO_MS;
      this.classList.add('is-in');
      this.request();
    }

    // il video adatto allo schermo parte solo quando la sezione si vede
    playVideo(on) {
      if (!this.videos.length) return;
      var mobile = this.querySelector('[data-fc-video="mobile"] video');
      var desktop = this.querySelector('[data-fc-video="desktop"] video');
      var pick = mobileMq.matches && mobile ? mobile : desktop || mobile;
      this.videos.forEach(function (v) {
        if (v !== pick || !on) { if (!v.paused) v.pause(); return; }
        if (v.preload === 'none') v.preload = 'auto';
        v.muted = true;
        var pr = v.play();
        if (pr && pr.catch) pr.catch(function () {});
      });
    }

    measureTop() {
      if (!this._live) return;
      this.top = this.getBoundingClientRect().top + window.scrollY;
      this.dist = Math.max(1, this.offsetHeight - this.sticky.offsetHeight);
    }

    measure(refit) {
      if (!this._live) return;
      var sr = this.sticky.getBoundingClientRect();
      var pr = this.probe.getBoundingClientRect();
      this.vw = sr.width;
      this.vh = sr.height;
      this.r0 = { l: pr.left - sr.left, t: pr.top - sr.top, r: sr.right - pr.right, b: sr.bottom - pr.bottom };
      this.rad0 = parseFloat(getComputedStyle(this.probe).borderTopLeftRadius) || 0;
      this.probeH = pr.height;
      // altezza dell'area visibile per la scritta (tolti header e barra del browser)
      var area = this.probe.parentNode;
      var cs = getComputedStyle(area);
      this.areaH = area.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
      if (refit) this.fit();
      this.measureTop();
      this.p = -1;
      this.request();
    }

    // scritta: ogni riga riempie la larghezza dello schermo, senza uscire in altezza
    fit() {
      if (this.isLogo || !this.lines.length) return;
      var self = this;
      var avail = this.vw * (mobileMq.matches ? .93 : .95);
      var gap = this.probeH * .56;
      var area = this.areaH;
      var top = this.fill.querySelectorAll('.fc__grp--top [data-fc-line]').length;
      var bot = this.fill.querySelectorAll('.fc__grp--bot [data-fc-line]').length;
      var maxFs = this.lines.length === 1 ? area * .42 : ((area - gap) / 2) / (Math.max(top, bot, 1) * .84);
      this.lines.forEach(function (l) { l.style.fontSize = '100px'; });
      var widths = this.lines.map(function (l) { return l.offsetWidth; });
      this.lines.forEach(function (l, i) {
        var fs = widths[i] ? Math.min(100 * avail / widths[i], maxFs) : 100;
        l.style.fontSize = fs.toFixed(2) + 'px';
        if (self.ghostLines[i]) self.ghostLines[i].style.fontSize = fs.toFixed(2) + 'px';
      });
    }

    // spostamento morbido verso il puntatore; si ferma da solo quando arriva
    parTick() {
      this._parRaf = 0;
      if (!this._live) return;
      var pt = this.pt;
      pt.x += (pt.tx - pt.x) * .07;
      pt.y += (pt.ty - pt.y) * .07;
      if (Math.abs(pt.tx - pt.x) > .002 || Math.abs(pt.ty - pt.y) > .002) this._parRaf = requestAnimationFrame(this._parTick);
      this.par.style.transform = 'translate3d(' + (pt.x * -12).toFixed(2) + 'px,' + (pt.y * -8).toFixed(2) + 'px,0) scale(1.02)';
    }

    request() {
      if (!this._raf && this._live) this._raf = requestAnimationFrame(this._frame);
    }

    frameTick(now) {
      this._raf = 0;
      if (!this._live) return;
      var p = clamp((window.scrollY - this.top) / this.dist, 0, 1);
      var introE = 0;
      if (this.introStart) {
        var t = clamp((now - this.introStart) / INTRO_MS, 0, 1);
        introE = outExpo(t);
        if (t < 1) this.request();
      }
      if (p === this.p && introE === this.introE) return;
      this.p = p;
      this.introE = introE;
      this.render(p, introE);
    }

    render(p, introE) {
      var vw = this.vw, vh = this.vh, r0 = this.r0;
      var eo = inOutQuart(range(p, .04, .6));          // apertura della finestra
      var late = range(p, .6, 1);                        // dopo l'apertura

      // finestra: dal rettangolo iniziale a tutto schermo
      var L = lerp(r0.l, 0, eo), T = lerp(r0.t, 0, eo), R = lerp(r0.r, 0, eo), B = lerp(r0.b, 0, eo);
      var rad = lerp(this.rad0, 0, eo);
      if (introE < 1) {
        // entrata come un otturatore: una riga sottile che si apre in altezza
        var w = vw - L - R, h = vh - T - B;
        var kw = .62 + .38 * introE, kh = introE;
        L += w * (1 - kw) / 2; R += w * (1 - kw) / 2;
        T += h * (1 - kh) / 2; B += h * (1 - kh) / 2;
      }
      var clip = 'inset(' + px(T) + ' ' + px(R) + ' ' + px(B) + ' ' + px(L) + ' round ' + px(rad) + ')';
      this.win.style.clipPath = clip;
      if (this.ghost) this.ghost.style.clipPath = clip;

      // video: zoom 1.3 → 1, poi una lenta salita
      var s = lerp(1.3, 1.045, eo) * (1 + .18 * (1 - introE)) - .045 * late;
      this.media.style.transform = 'translate3d(0,' + (-2.2 * late).toFixed(2) + '%,0) scale(' + s.toFixed(4) + ')';
      if (this.dim) this.dim.style.opacity = (range(p, .86, 1) * .5).toFixed(3);

      // la scritta avanza verso chi guarda mentre le lettere si aprono
      var push = 'scale(' + (1 + .2 * eo).toFixed(4) + ')';
      if (this.fill) this.fill.style.transform = push;
      if (this.ghost) this.ghost.style.transform = push;

      for (var i = 0; i < this.items.length; i++) {
        var it = this.items[i];
        var start = .03 + it.a * .1;
        var e = inOutCubic(range(p, start, start + .4));
        var sign = it.d > 0 ? 1 : it.d < 0 ? -1 : 0;
        var tx = sign * (vw * .1 + it.a * vw * .6) * e;
        var ty = it.dir * vh * .14 * e - (sign === 0 ? vh * .06 * e : 0);
        var rot = it.d * 7 * e;
        var op = 1 - range(e, .4, .95);
        var val = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0) rotate(' + rot.toFixed(2) + 'deg)';
        if (val === it.last) continue;
        it.last = val;
        for (var k = 0; k < it.els.length; k++) {
          it.els[k].style.transform = val;
          it.els[k].style.opacity = op.toFixed(3);
        }
      }

      // mirino: segue gli angoli della finestra e sparisce a finestra aperta
      if (this.corners.length === 4) {
        var g = 14, cs = 22;
        var fo = (1 - range(eo, .45, .85)) * introE;
        var pos = [[L - g, T - g], [vw - R + g - cs, T - g], [L - g, vh - B + g - cs], [vw - R + g - cs, vh - B + g - cs]];
        for (var c = 0; c < 4; c++) {
          this.corners[c].style.transform = 'translate3d(' + px(pos[c][0]) + ',' + px(pos[c][1]) + ',0)';
          this.corners[c].style.opacity = fo.toFixed(3);
        }
      }

      if (this.hud) this.hud.style.opacity = (1 - range(p, .2, .36)).toFixed(3);
      if (this.bar) this.bar.style.transform = 'scaleX(' + eo.toFixed(4) + ')';
      if (this.count) {
        var n = String(Math.round(eo * 100));
        n = n.length === 1 ? '00' + n : n.length === 2 ? '0' + n : n;
        if (this.count.textContent !== n) this.count.textContent = n;
      }

      // testi: entrano a finestra quasi aperta, escono se si torna indietro
      if (!this.open && eo > .9) { this.open = true; this.classList.add('is-open'); }
      else if (this.open && eo < .62) { this.open = false; this.classList.remove('is-open'); }
    }
  });
})();
