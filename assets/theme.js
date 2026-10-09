/* ==========================================================================
   Sudditalia — theme.js
   Menu, varianti prodotto, aggiunta al carrello, quantità, filtri.
   Vanilla JS, nessuna dipendenza. Senza JS il sito resta utilizzabile:
   i form funzionano con il normale invio della pagina.
   ========================================================================== */
(function () {
  'use strict';

  var theme = window.theme || { routes: {}, strings: {} };

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* ------------------------------------------------------------------
     Menu a tendina e ricerca: si chiudono con Esc e cliccando fuori
     ------------------------------------------------------------------ */
  function initDropdowns() {
    document.addEventListener('click', function (e) {
      document.querySelectorAll('[data-dropdown][open]').forEach(function (d) {
        if (!d.contains(e.target)) d.removeAttribute('open');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('[data-dropdown][open], [data-menu-drawer][open]').forEach(function (d) {
        d.removeAttribute('open');
        var s = d.querySelector('summary');
        if (s) s.focus();
      });
    });
    document.addEventListener('toggle', function (e) {
      var d = e.target;
      if (!d.matches) return;
      if (d.matches('[data-menu-drawer]')) {
        document.documentElement.style.overflow = d.open ? 'hidden' : '';
      }
      if (d.matches('.header__search') && d.open) {
        var input = d.querySelector('input[type="search"]');
        if (input) input.focus();
      }
    }, true);
  }

  /* ------------------------------------------------------------------
     Avviso in basso (prodotto aggiunto / errore)
     ------------------------------------------------------------------ */
  var toastTimer = null;
  function toast(message, isError) {
    var el = document.querySelector('[data-toast]');
    if (!el) return;
    el.querySelector('[data-toast-text]').textContent = message;
    el.classList.toggle('is-error', !!isError);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, isError ? 6000 : 4000);
  }

  function updateCartCount() {
    if (!theme.routes.cartJson) return;
    fetch(theme.routes.cartJson, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        document.querySelectorAll('[data-cart-count]').forEach(function (el) {
          el.textContent = cart.item_count;
          el.hidden = cart.item_count === 0;
        });
      })
      .catch(function () { /* il contatore si aggiorna al prossimo caricamento */ });
  }

  /* ------------------------------------------------------------------
     Quantità: bottoni − e +
     ------------------------------------------------------------------ */
  function initQuantity() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-qty-step]');
      if (!btn) return;
      var input = btn.parentElement.querySelector('input[type="number"]');
      if (!input) return;
      var min = input.min === '' ? 0 : parseInt(input.min, 10);
      var next = (parseInt(input.value, 10) || 0) + parseInt(btn.dataset.qtyStep, 10);
      if (next < min) next = min;
      if (input.max !== '' && next > parseInt(input.max, 10)) next = parseInt(input.max, 10);
      if (String(next) === input.value) return;
      input.value = next;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /* ------------------------------------------------------------------
     Pagina prodotto: scelta variante
     ------------------------------------------------------------------ */
  function initProductForms() {
    document.querySelectorAll('[data-product]').forEach(function (root) {
      var dataEl = root.querySelector('[data-variants]');
      if (!dataEl) return;
      var variants;
      try { variants = JSON.parse(dataEl.textContent); } catch (err) { return; }

      var idInput = root.querySelector('input[name="id"]');
      var button = root.querySelector('[data-add-to-cart]');
      var buttonText = root.querySelector('[data-add-to-cart-text]');
      var priceEl = root.querySelector('[data-price]');
      var payment = root.querySelector('[data-payment-button]');
      var groups = Array.prototype.slice.call(root.querySelectorAll('[data-option]'));

      function selected() {
        return groups.map(function (g) {
          var checked = g.querySelector('input:checked');
          return checked ? checked.value : null;
        });
      }
      function find(values) {
        return variants.filter(function (v) {
          return v.options.every(function (o, i) { return o === values[i]; });
        })[0];
      }

      /* segna le opzioni non disponibili con la selezione corrente */
      function markAvailability(values) {
        groups.forEach(function (g, i) {
          g.querySelectorAll('input').forEach(function (input) {
            var test = values.slice();
            test[i] = input.value;
            var v = find(test);
            input.classList.toggle('is-unavailable', !v || !v.available);
          });
          var label = g.querySelector('[data-option-value]');
          if (label) label.textContent = values[i] || '';
        });
      }

      function render(variant) {
        if (!variant) {
          button.disabled = true;
          buttonText.textContent = theme.strings.unavailable;
          if (payment) payment.hidden = true;
          return;
        }
        idInput.value = variant.id;
        button.disabled = !variant.available;
        buttonText.textContent = variant.available ? theme.strings.addToCart : theme.strings.soldOut;
        if (payment) payment.hidden = !variant.available;
        if (priceEl && variant.price_html) priceEl.innerHTML = variant.price_html;

        var url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());

        if (variant.media_id) {
          var media = document.querySelector('[data-media-id="' + variant.media_id + '"]');
          if (media) media.dispatchEvent(new CustomEvent('stage:show', { bubbles: true }));
          if (media && media.scrollIntoView && window.matchMedia('(max-width: 989px)').matches) {
            media.scrollIntoView({ block: 'nearest', inline: 'start', behavior: 'smooth' });
          }
        }
      }

      root.addEventListener('change', function (e) {
        if (!e.target.closest('[data-option]')) return;
        var values = selected();
        markAvailability(values);
        render(find(values));
      });
      if (groups.length) markAvailability(selected());
    });
  }

  /* ------------------------------------------------------------------
     Aggiunta al carrello senza ricaricare la pagina
     ------------------------------------------------------------------ */
  function initAddToCart() {
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form.matches || !form.matches('form[data-product-form]')) return;
      if (!window.fetch || !theme.routes.cartAdd) return;
      e.preventDefault();

      var button = form.querySelector('[data-add-to-cart]');
      if (button) button.classList.add('is-loading');

      fetch(theme.routes.cartAdd, {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: new FormData(form)
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (!res.ok) {
            toast(res.data.description || res.data.message || theme.strings.cartError, true);
            return;
          }
          toast(theme.strings.added);
          updateCartCount();
        })
        .catch(function () { form.submit(); })
        .then(function () { if (button) button.classList.remove('is-loading'); });
    });
  }

  /* ------------------------------------------------------------------
     Carrello: cambiando la quantità il form si aggiorna da solo
     ------------------------------------------------------------------ */
  function initCart() {
    var form = document.querySelector('form[data-cart-form]');
    if (!form) return;
    var timer = null;
    form.addEventListener('change', function (e) {
      if (!e.target.matches('input[name="updates[]"]')) return;
      clearTimeout(timer);
      timer = setTimeout(function () { form.submit(); }, 500);
    });
  }

  /* ------------------------------------------------------------------
     Collezione: filtri e ordinamento si applicano al cambio
     ------------------------------------------------------------------ */
  function initFilters() {
    var form = document.querySelector('form[data-filters-form]');
    if (!form) return;
    form.addEventListener('change', function (e) {
      if (e.target.matches('input[type="number"]')) return; // il prezzo si conferma con il bottone
      /* i campi prezzo vuoti non devono finire nell'indirizzo */
      form.querySelectorAll('input[type="number"]').forEach(function (i) { if (i.value === '') i.disabled = true; });
      form.submit();
    });
    form.addEventListener('submit', function () {
      form.querySelectorAll('input[type="number"]').forEach(function (i) { if (i.value === '') i.disabled = true; });
    });
  }

  ready(function () {
    initDropdowns();
    initQuantity();
    initProductForms();
    initAddToCart();
    initCart();
    initFilters();
  });
})();
