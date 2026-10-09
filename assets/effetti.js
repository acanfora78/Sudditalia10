/*
  Effetti del tema Sudditalia (senza librerie):
    <intro-blocchi>      apertura a blocchi: la foto si compone a rettangoli e, scorrendo, si separa e sparisce
    [data-pixel-reveal]  passaggio "a pixel": quando la sezione entra nello schermo, una griglia di
                         quadratini del colore di fondo si scioglie in ordine casuale e la scopre
    <product-stage>      foto centrale della pagina prodotto: foto stesa -> modello che indossa il capo
  Con "riduci movimento" attivo nel sistema gli effetti sono spenti e tutto è subito visibile.
*/
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ------------------------------------------------------------------
     Apertura a blocchi
     ------------------------------------------------------------------ */
  if (!customElements.get('intro-blocchi')) {
    customElements.define('intro-blocchi', class extends HTMLElement {
      connectedCallback() {
        var self = this;
        var tiles = this.querySelectorAll('.ib__tile');
        // ogni rettangolo entra da un lato diverso, con un ritardo diverso
        tiles.forEach(function (t, i) {
          var side = Math.floor(Math.random() * 4);
          var dist = rand(18, 40) + '%';
          t.style.setProperty('--dx', side === 0 ? dist : side === 1 ? '-' + dist : '0%');
          t.style.setProperty('--dy', side === 2 ? dist : side === 3 ? '-' + dist : '0%');
          t.style.setProperty('--delay', (rand(0, 0.55) + (i % 2) * 0.08).toFixed(2) + 's');
        });
        requestAnimationFrame(function () { requestAnimationFrame(function () { self.classList.add('is-in'); }); });
        if (reduce) return;

        this._onScroll = function () {
          if (self._raf) return;
          self._raf = requestAnimationFrame(function () {
            self._raf = 0;
            var total = self.offsetHeight - window.innerHeight;
            var p = total > 0 ? clamp(-self.getBoundingClientRect().top / total, 0, 1) : 0;
            self.style.setProperty('--p', p.toFixed(3));
          });
        };
        window.addEventListener('scroll', this._onScroll, { passive: true });
        window.addEventListener('resize', this._onScroll);
        this._onScroll();
      }
      disconnectedCallback() {
        window.removeEventListener('scroll', this._onScroll);
        window.removeEventListener('resize', this._onScroll);
      }
    });
  }

  /* ------------------------------------------------------------------
     Passaggio a pixel
     ------------------------------------------------------------------ */
  function pixelReveal() {
    if (reduce || !('IntersectionObserver' in window)) return;
    var targets = Array.prototype.slice.call(document.querySelectorAll('[data-pixel-reveal]'));
    // solo ciò che è sotto lo schermo all'apertura: quello già visibile non si copre mai
    targets = targets.filter(function (el) { return el.getBoundingClientRect().top > window.innerHeight * 0.9; });
    if (!targets.length) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var cover = e.target.querySelector(':scope > .px-cover');
        if (!cover) return;
        var cells = cover.children;
        for (var i = 0; i < cells.length; i++) cells[i].style.transitionDelay = rand(0, 0.7).toFixed(2) + 's';
        cover.classList.add('is-open');
        setTimeout(function () { cover.remove(); }, 1300);
      });
    }, { threshold: 0.18 });

    targets.forEach(function (el) {
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      var w = el.offsetWidth || window.innerWidth;
      var h = el.offsetHeight || window.innerHeight;
      var size = clamp(w / 16, 40, 110);
      var cols = Math.max(4, Math.round(w / size));
      var rows = Math.max(3, Math.round(h / size));
      var cover = document.createElement('div');
      cover.className = 'px-cover';
      cover.setAttribute('aria-hidden', 'true');
      cover.style.setProperty('--px-cols', cols);
      cover.style.setProperty('--px-rows', rows);
      var frag = document.createDocumentFragment();
      for (var i = 0; i < cols * rows; i++) frag.appendChild(document.createElement('span'));
      cover.appendChild(frag);
      el.appendChild(cover);
      io.observe(el);
    });
  }

  /* ------------------------------------------------------------------
     Foto centrale della pagina prodotto
     ------------------------------------------------------------------ */
  if (!customElements.get('product-stage')) {
    customElements.define('product-stage', class extends HTMLElement {
      connectedCallback() {
        var self = this;
        this.slides = Array.prototype.slice.call(this.querySelectorAll('[data-slide]'));
        this.thumbs = Array.prototype.slice.call(this.querySelectorAll('[data-thumb]'));
        this.index = 0;
        this.touched = false;

        this.thumbs.forEach(function (b) {
          b.addEventListener('click', function () { self.touched = true; self.show(Number(b.dataset.thumb)); });
        });
        // variante con una sua foto (evento lanciato da theme.js)
        this.addEventListener('stage:show', function (e) {
          var i = self.slides.indexOf(e.target.closest('[data-slide]'));
          if (i >= 0) { self.touched = true; self.show(i); }
        });
        // scorrimento col dito
        var x0 = null;
        this.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
        this.addEventListener('pointerup', function (e) {
          if (x0 === null) return;
          var dx = e.clientX - x0; x0 = null;
          if (Math.abs(dx) < 40) return;
          self.touched = true;
          self.show((self.index + (dx < 0 ? 1 : -1) + self.slides.length) % self.slides.length);
        });

        // come nel reel: dopo un attimo la foto stesa diventa il capo indossato
        var worn = this.slides.findIndex(function (s) { return s.hasAttribute('data-worn'); });
        if (worn > 0) {
          var start = function () {
            setTimeout(function () { if (!self.touched) self.show(worn); }, reduce ? 0 : 1400);
          };
          if ('IntersectionObserver' in window) {
            var io = new IntersectionObserver(function (en) {
              if (en[0].isIntersecting) { io.disconnect(); start(); }
            }, { threshold: 0.5 });
            io.observe(this);
          } else start();
        }
      }
      show(i) {
        if (i === this.index || !this.slides[i]) return;
        this.slides[this.index].classList.remove('is-active');
        this.slides[i].classList.add('is-active');
        if (this.thumbs[this.index]) { this.thumbs[this.index].classList.remove('is-active'); this.thumbs[this.index].removeAttribute('aria-current'); }
        if (this.thumbs[i]) { this.thumbs[i].classList.add('is-active'); this.thumbs[i].setAttribute('aria-current', 'true'); }
        this.index = i;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pixelReveal);
  else pixelReveal();
})();
