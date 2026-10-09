/*
  Effetti del tema Sudditalia (senza librerie):
    <intro-blocchi>      apertura a blocchi, con ingresso da film: la foto si compone a rettangoli e,
                         scorrendo, si separa e sparisce
    scorrimento morbido  inerzia con mouse e trackpad (Impostazioni tema → Movimento)
    titoli di testa      i titoli entrano parola per parola; le immagini si scoprono dal basso
    [data-marquee]       fascia con la scritta gigante che scorre e accelera con lo scroll
    cursore              un cerchio con una parola (Trascina, Vedi) dove c'è qualcosa da fare
    sipario              un telo scuro copre e scopre lo schermo tra una pagina e l'altra
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
        // due video (computer / telefono): si tiene solo quello adatto, l'altro non si scarica
        var vids = this.querySelectorAll('[data-ib-video]');
        if (vids.length > 1) {
          var keep = window.matchMedia('(max-width: 749px)').matches ? 'mobile' : 'desktop';
          vids.forEach(function (v) { if (v.dataset.ibVideo !== keep) v.remove(); });
        }
        if (reduce) this.querySelectorAll('.ib__video video').forEach(function (v) { v.removeAttribute('autoplay'); v.pause(); });

        var cine = this.querySelector('[data-cine]');
        if (cine) this.playCine(cine);
        else requestAnimationFrame(function () { requestAnimationFrame(function () { self.classList.add('is-in'); }); });
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
      // ingresso da film: i tempi vengono da sezioni.css (lettere, poi barre che si aprono)
      playCine(cine) {
        var self = this;
        var n = parseInt(cine.style.getPropertyValue('--n'), 10) || 10;
        var open = 0.3 + n * 0.055 + 0.9 + 0.35;               // secondi, come --t-open
        var zoom = this.querySelector('.ib__zoom');
        if (zoom) zoom.style.setProperty('--kb-delay', open + 's');
        var timers = [];
        var done = false;
        // i rettangoli compongono la foto mentre le barre si aprono
        timers.push(setTimeout(function () { self.classList.add('is-in'); }, (open + 0.15) * 1000));
        function finish() {
          if (done) return;
          done = true;
          timers.forEach(clearTimeout);
          self.classList.add('is-in');
          document.documentElement.classList.remove('cine-on');
          try { sessionStorage.setItem('sud-cine', '1'); } catch (e) {}
          cine.remove();
          ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (t) { window.removeEventListener(t, skip); });
        }
        function skip() {
          if (done) return;
          cine.classList.add('is-skip');
          if (zoom) zoom.style.setProperty('--kb-delay', '0s');
          setTimeout(finish, 450);
        }
        timers.push(setTimeout(finish, (open + 1.25) * 1000));
        ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (t) { window.addEventListener(t, skip, { passive: true }); });
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

  /* ------------------------------------------------------------------
     Scorrimento morbido (mouse e trackpad; sul telefono resta quello normale)
     Solo i gesti verticali: quelli orizzontali restano alla hero e alle strisce.
     ------------------------------------------------------------------ */
  function smoothScroll() {
    if (reduce || document.body.dataset.smoothScroll !== 'true') return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    var target = window.scrollY;
    var current = target;
    var running = false;
    var EASE = 0.1;

    function limit() { return document.documentElement.scrollHeight - window.innerHeight; }
    function scrollsInside(el) {
      for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        if (el.hasAttribute && el.hasAttribute('data-native-scroll')) return true;
        var oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) return true;
      }
      return false;
    }
    function tick() {
      current += (target - current) * EASE;
      if (Math.abs(target - current) < 0.5) { current = target; running = false; }
      window.scrollTo({ top: current, behavior: 'instant' });
      if (running) requestAnimationFrame(tick);
    }
    window.addEventListener('wheel', function (e) {
      if (e.defaultPrevented || e.ctrlKey) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (document.documentElement.classList.contains('cine-on')) return;
      if (scrollsInside(e.target)) return;
      e.preventDefault();
      var d = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1);
      if (!running) target = current = window.scrollY;
      target = clamp(target + d, 0, limit());
      if (!running) { running = true; requestAnimationFrame(tick); }
    }, { passive: false });
    // tastiera, barra di scorrimento, link interni: si riparte da dove è la pagina
    window.addEventListener('scroll', function () { if (!running) target = current = window.scrollY; }, { passive: true });
  }

  /* altezza dell'header fisso, per le sezioni che devono stare sotto (apertura) */
  function headerHeight() {
    var h = document.querySelector('.section-header');
    if (!h) return;
    var set = function () { document.documentElement.style.setProperty('--header-h', h.offsetHeight + 'px'); };
    set();
    window.addEventListener('resize', set);
  }

  /* ------------------------------------------------------------------
     Titoli di testa: i titoli entrano parola per parola, dal basso
     ------------------------------------------------------------------ */
  function textReveal() {
    if (reduce || !('IntersectionObserver' in window)) return;
    var els = document.querySelectorAll('main h2, .os__title, .pe__headline, .ib__title, .footer__wordmark, .mq-title');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.2 });
    els.forEach(function (el) {
      if (el.closest('.cine') || el.classList.contains('rv')) return;
      // solo titoli fatti di testo (al massimo con degli a capo): non si tocca altro markup
      for (var k = 0; k < el.children.length; k++) if (el.children[k].tagName !== 'BR') return;
      var n = 0;
      var frag = document.createDocumentFragment();
      Array.prototype.slice.call(el.childNodes).forEach(function (node) {
        if (node.nodeType !== 3) { frag.appendChild(node.cloneNode()); return; }
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span');
          w.className = 'rv-w';
          var i = document.createElement('span');
          i.className = 'rv-i';
          i.style.setProperty('--i', n++);
          i.textContent = part;
          w.appendChild(i);
          frag.appendChild(w);
        });
      });
      el.textContent = '';
      el.appendChild(frag);
      el.classList.add('rv');
      io.observe(el);
    });
  }

  /* ------------------------------------------------------------------
     Immagini che si scoprono dal basso, con un leggero zoom all'indietro
     ------------------------------------------------------------------ */
  function mediaReveal() {
    if (reduce || !('IntersectionObserver' in window)) return;
    var els = Array.prototype.slice.call(document.querySelectorAll('.card__media, .tile__media, .social__card'))
      .filter(function (el) { return el.getBoundingClientRect().top > window.innerHeight * 0.85; });
    if (!els.length) return;
    // si osserva il contenitore: l'immagine ritagliata a zero per il browser non è "visibile"
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target._rvMedia.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) {
      var item = el.closest('li, article, .tile') || el.parentElement;
      var idx = item.parentElement ? Array.prototype.indexOf.call(item.parentElement.children, item) : 0;
      el.style.setProperty('--d', ((idx % 5) * 0.09).toFixed(2) + 's');
      el.classList.add('rv-m');
      item._rvMedia = el;
      io.observe(item);
    });
  }

  /* ------------------------------------------------------------------
     Fascia scorrevole: va da sola e accelera (e si inclina) con lo scroll
     ------------------------------------------------------------------ */
  function marquee() {
    var rows = Array.prototype.slice.call(document.querySelectorAll('[data-marquee]'));
    if (!rows.length || reduce) return;
    var state = rows.map(function (r) {
      return { row: r, track: r.firstElementChild, dir: parseFloat(r.dataset.marquee) || -1, x: null, visible: false };
    });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          state.forEach(function (st) { if (st.row === e.target) st.visible = e.isIntersecting; });
        });
      });
      state.forEach(function (st) { io.observe(st.row); });
    } else state.forEach(function (st) { st.visible = true; });

    var lastY = window.scrollY;
    var vel = 0;
    function frame() {
      var y = window.scrollY;
      vel += ((y - lastY) - vel) * 0.12;
      lastY = y;
      var skew = clamp(-vel * 0.12, -7, 7);
      state.forEach(function (st) {
        if (!st.visible) return;
        var half = st.track.scrollWidth / 2;
        if (!half) return;
        if (st.x === null) st.x = st.dir > 0 ? -half : 0;
        st.x += st.dir * (0.55 + Math.abs(vel) * 0.45);
        if (st.dir < 0 && st.x <= -half) st.x += half;
        if (st.dir > 0 && st.x >= 0) st.x -= half;
        st.track.style.transform = 'translate3d(' + st.x.toFixed(1) + 'px,0,0) skewX(' + skew.toFixed(2) + 'deg)';
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------
     Cursore: un cerchio con una parola dove c'è qualcosa da fare
     (Trascina sulla hero, Vedi sui prodotti). Solo con mouse o trackpad.
     ------------------------------------------------------------------ */
  function cursor() {
    if (reduce || !window.matchMedia('(pointer: fine)').matches) return;
    var labels = (window.theme && theme.strings && theme.strings.cursor) || {};
    [['.os__stage', labels.drag || 'Trascina'], ['.card__link', labels.view || 'Vedi'],
     ['.social__card', labels.open || 'Apri'], ['.tile', labels.explore || 'Scopri']].forEach(function (z) {
      document.querySelectorAll(z[0]).forEach(function (el) { if (!el.dataset.cursor) el.dataset.cursor = z[1]; });
    });
    var c = document.createElement('div');
    c.className = 'cursor';
    c.setAttribute('aria-hidden', 'true');
    c.innerHTML = '<span></span>';
    document.body.appendChild(c);
    var label = c.firstChild;
    var tx = -100, ty = -100, x = -100, y = -100;
    window.addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
    document.addEventListener('pointerover', function (e) {
      var z = e.target.closest && e.target.closest('[data-cursor]');
      if (z) { label.textContent = z.dataset.cursor; c.classList.add('is-on'); }
      else c.classList.remove('is-on');
    });
    document.addEventListener('pointerdown', function () { c.classList.add('is-down'); });
    document.addEventListener('pointerup', function () { c.classList.remove('is-down'); });
    (function loop() {
      x += (tx - x) * 0.2;
      y += (ty - y) * 0.2;
      c.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      requestAnimationFrame(loop);
    })();
  }

  /* ------------------------------------------------------------------
     Sipario tra le pagine: un telo scuro sale, si cambia pagina, si riapre
     ------------------------------------------------------------------ */
  function curtain() {
    var root = document.documentElement;
    if (root.classList.contains('curtain-in')) {
      requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('curtain-out'); }); });
      setTimeout(function () { root.classList.remove('curtain-in', 'curtain-out'); }, 1000);
    }
    if (reduce) return;
    var leave = null;
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download') || a.closest('[data-no-curtain]')) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(mailto|tel|sms|javascript):/i.test(href)) return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      try { sessionStorage.setItem('sud-curtain', '1'); } catch (err) {}
      if (!leave) {
        leave = document.createElement('div');
        leave.className = 'curtain-leave';
        leave.setAttribute('aria-hidden', 'true');
        document.body.appendChild(leave);
      }
      requestAnimationFrame(function () { leave.classList.add('is-on'); });
      setTimeout(function () { location.href = a.href; }, 560);
    });
    // tornando indietro col browser la pagina può riapparire dalla cache: si toglie il telo
    window.addEventListener('pageshow', function (e) { if (e.persisted && leave) leave.classList.remove('is-on'); });
  }

  /* testo che riempie esattamente la larghezza (il nome gigante del footer) */
  function fitText() {
    var els = document.querySelectorAll('[data-fit-text]');
    if (!els.length) return;
    function fit() {
      els.forEach(function (el) {
        el.style.fontSize = '100px';
        var w = el.scrollWidth;
        var box = el.parentElement.clientWidth;
        if (w) el.style.fontSize = (100 * box / w).toFixed(2) + 'px';
      });
    }
    fit();
    window.addEventListener('resize', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }

  function init() {
    headerHeight();
    fitText();
    pixelReveal();
    textReveal();
    mediaReveal();
    marquee();
    cursor();
    curtain();
    smoothScroll();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
