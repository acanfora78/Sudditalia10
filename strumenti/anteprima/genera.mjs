// Anteprima statica del tema, senza Shopify.
//
// Fa girare i file Liquid veri del tema (layout, sezioni, snippet, template JSON) con LiquidJS,
// usando i dati veri dello store scaricati da scarica_dati.py, e scrive pagine HTML statiche:
//   index.html, prodotto-<handle>.html, collezione-<handle>.html, carrello.html
//
// Uso:
//   python3 strumenti/anteprima/scarica_dati.py     (una volta, o per aggiornare i prodotti)
//   cd strumenti/anteprima && npm install && node genera.mjs [cartella-uscita]
//
// Differenze rispetto allo store vero (l'anteprima non ha un server dietro):
//   - carrello, ricerca, account e filtri non funzionano;
//   - i menu sono ricostruiti dalle collezioni (i menu veri si leggono solo dall'admin);
//   - nella hero entrano anche le felpe senza foto indossata, con la sagoma al posto del capo
//     (sullo store vero entrano solo i prodotti con il metafield capo_fronte).
//     Con --solo-pronti la hero si comporta come sullo store.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Liquid, Tag, Value } from 'liquidjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const TEMA = path.resolve(QUI, '../..');
const args = process.argv.slice(2);
const SOLO_PRONTI = args.includes('--solo-pronti');
const OUT = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(QUI, 'build'));
const DATI = JSON.parse(fs.readFileSync(path.join(QUI, 'dati/store.json'), 'utf8'));
const LOCALE = JSON.parse(fs.readFileSync(path.join(TEMA, 'locales/it.default.json'), 'utf8'));
const SETTINGS = JSON.parse(fs.readFileSync(path.join(TEMA, 'config/settings_data.json'), 'utf8')).current;
const HERO_COLLEZIONE = 'hoodies';

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
const immaginiUsate = new Set();

// ---------- oggetti Shopify ----------

const urlProdotto = (h) => `prodotto-${h}.html`;
const urlCollezione = (h) => `collezione-${h}.html`;

function img(data, alt = '') {
  if (!data) return null;
  immaginiUsate.add(data.src);
  return { src: data.src, width: data.width, height: data.height, alt, aspect_ratio: data.width / data.height };
}

// file doppi della hero: foto/capo-fronte-<handle>.png -> img/capo-fronte-<handle>.webp
function fileCapo(vista, handle) {
  const sorgente = path.join(TEMA, 'foto', `capo-${vista}-${handle}.png`);
  if (!fs.existsSync(sorgente)) return null;
  const nome = `img/capo-${vista}-${handle}.webp`;
  execFileSync('python3', ['-I', '-c',
    'import sys;from PIL import Image;im=Image.open(sys.argv[1]);im.save(sys.argv[2],"WEBP",quality=86);print(*im.size)',
    sorgente, path.join(OUT, nome)]);
  const [w, h] = execFileSync('python3', ['-I', '-c', 'import sys;from PIL import Image;print(*Image.open(sys.argv[1]).size)',
    path.join(OUT, nome)]).toString().trim().split(' ').map(Number);
  return { src: nome, width: w, height: h, alt: '', aspect_ratio: w / h };
}

// foto delle sezioni: "shopify://shop_images/<nome>" -> foto/sezioni/<nome> (su Shopify: Contenuti → File)
function immagineSezione(valore) {
  const m = /^shopify:\/\/shop_images\/(.+)$/.exec(valore || '');
  if (!m) return null;
  const sorgente = path.join(TEMA, 'foto', 'sezioni', m[1]);
  if (!fs.existsSync(sorgente)) return null;
  const nome = `img/sez-${m[1].replace(/\.[^.]+$/, '')}.webp`;
  const [w, h] = execFileSync('python3', ['-I', '-c',
    'import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGB");im.thumbnail((1800,1800));im.save(sys.argv[2],"WEBP",quality=82);print(*im.size)',
    sorgente, path.join(OUT, nome)]).toString().trim().split(' ').map(Number);
  return { src: nome, width: w, height: h, alt: '', aspect_ratio: w / h };
}

const prodotti = {};
for (const p of Object.values(DATI.products)) {
  const media = p.images.map((im, i) => ({ id: p.id * 100 + i, media_type: 'image', alt: p.title, preview_image: img(im, p.title) }));
  const variants = p.variants.map((v) => ({
    ...v,
    featured_media: v.featured_image ? media.find((m) => m.preview_image.src === v.featured_image.src) || null : null,
  }));
  const prezzi = variants.map((v) => v.price);
  const confronti = variants.map((v) => v.compare_at_price || 0);
  const current = variants.find((v) => v.available) || variants[0];
  const capo_fronte = fileCapo('fronte', p.handle);
  const capo_retro = fileCapo('retro', p.handle);
  prodotti[p.handle] = {
    id: p.id, handle: p.handle, title: p.title, url: urlProdotto(p.handle),
    description: p.body_html, type: p.product_type, vendor: p.vendor,
    available: variants.some((v) => v.available),
    price_min: Math.min(...prezzi), price_max: Math.max(...prezzi), price: Math.min(...prezzi),
    price_varies: Math.min(...prezzi) !== Math.max(...prezzi),
    compare_at_price_min: Math.min(...confronti),
    variants, selected_or_first_available_variant: current,
    has_only_default_variant: variants.length === 1 && variants[0].title === 'Default Title',
    options_with_values: p.options.map((o, i) => ({ ...o, selected_value: current.options[i] })),
    media, featured_media: media[0] || null,
    metafields: { custom: {
      capo_fronte: capo_fronte ? { value: capo_fronte } : null,
      capo_retro: capo_retro ? { value: capo_retro } : null,
    } },
  };
}

const collezioni = {};
for (const c of DATI.collections) {
  const products = c.products.map((h) => prodotti[h]).filter(Boolean);
  collezioni[c.handle] = {
    handle: c.handle, title: c.title, description: c.description, url: urlCollezione(c.handle),
    products, products_count: products.length, all_products_count: products.length,
    image: img(c.image, c.title), featured_image: img(c.image, c.title),
    filters: [], sort_options: [], sort_by: 'manual', default_sort_by: 'manual',
  };
}

// menu ricostruito con le collezioni usate in home (il menu vero si legge solo dall'admin)
const home = JSON.parse(fs.readFileSync(path.join(TEMA, 'templates/index.json'), 'utf8'));
const handlesMenu = [home.sections.hero?.settings?.collection,
  ...Object.values(home.sections.collections?.blocks || {}).map((b) => b.settings.collection)];
const linkCollezioni = [...new Set(handlesMenu)].filter((h) => collezioni[h]?.products_count)
  .map((h) => ({ title: collezioni[h].title, url: collezioni[h].url, links: [], current: false, active: false, child_active: false }));
const menus = { 'main-menu': { links: linkCollezioni }, footer: { links: [] } };

function font(id) {
  const [nome, stile] = id.split('_');
  return { family: nome.charAt(0).toUpperCase() + nome.slice(1), fallback_families: 'sans-serif',
    weight: Number((stile || 'n4').slice(1)) * 100, style: 'normal', 'system?': false };
}

const settings = { ...SETTINGS, font_heading: font(SETTINGS.font_heading), font_body: font(SETTINGS.font_body) };
const shop = {
  name: DATI.shop.name, description: DATI.shop.description, customer_accounts_enabled: true,
  policies: [], enabled_payment_types: [], shipping_policy: { body: '', url: '#' }, password_message: '',
};
const routes = {
  root_url: 'index.html', cart_url: 'carrello.html', cart_add_url: '#', search_url: '#', account_url: '#',
  collections_url: '#', all_products_collection_url: '#', product_recommendations_url: '#',
};
const cart = { item_count: 0, items: [], total_price: 0, taxes_included: true, note: '', cart_level_discount_applications: [] };

// ---------- motore Liquid ----------

const engine = new Liquid({
  root: [path.join(TEMA, 'snippets')], extname: '.liquid', jsTruthy: false,
  strictFilters: false, strictVariables: false, dynamicPartials: true, relativeReference: false,
});

function blocco(nome, apertura, chiusura) {
  return class extends Tag {
    constructor(token, remain, liquid) {
      super(token, remain, liquid);
      this.args = token.args;
      this.tpls = [];
      const stream = liquid.parser.parseStream(remain)
        .on(`tag:end${nome}`, () => stream.stop())
        .on('template', (t) => this.tpls.push(t))
        .on('end', () => { throw new Error(`${nome} non chiuso`); });
      stream.start();
    }
    *render(ctx, emitter) {
      const extra = apertura ? yield* apertura.call(this, ctx, emitter) : {};
      ctx.push(extra || {});
      yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
      ctx.pop();
      if (chiusura) emitter.write(chiusura);
    }
  };
}

engine.registerTag('schema', class extends Tag {
  constructor(token, remain) {
    super(token, remain);
    while (remain.length) {
      const t = remain.shift();
      if (t.name === 'endschema') return;
    }
  }
  *render() {}
});
engine.registerTag('style', blocco('style', function* (ctx, em) { em.write('<style>'); }, '</style>'));
engine.registerTag('form', blocco('form', function* (ctx, em) {
  const id = /id:\s*([\w.]+)/.exec(this.args);
  const cls = /class:\s*'([^']*)'/.exec(this.args);
  const idVal = id ? yield new Value(id[1], this.liquid).value(ctx, false) : '';
  em.write(`<form method="post" action="#" onsubmit="event.preventDefault()"${idVal ? ` id="${idVal}"` : ''}${cls ? ` class="${cls[1]}"` : ''}${/data-product-form/.test(this.args) ? ' data-product-form' : ''}>`);
  return { form: { errors: null, 'posted_successfully?': false } };
}, '</form>'));
engine.registerTag('paginate', blocco('paginate', function* () {
  return { paginate: { current_page: 1, pages: 1, parts: [], previous: null, next: null } };
}));
engine.registerTag('sections', class extends Tag {
  constructor(token, remain, liquid) { super(token, remain, liquid); this.nome = token.args.trim().replace(/['"]/g, ''); }
  *render(ctx, emitter) {
    const gruppo = JSON.parse(fs.readFileSync(path.join(TEMA, 'sections', `${this.nome}.json`), 'utf8'));
    for (const id of gruppo.order) emitter.write(yield renderSezione(id, gruppo.sections[id], ctx.getAll()));
  }
});

function traduci(chiave, params = {}) {
  let v = chiave.split('.').reduce((o, k) => (o == null ? o : o[k]), LOCALE);
  if (v && typeof v === 'object' && 'count' in params) v = params.count === 1 ? v.one : v.other;
  if (typeof v !== 'string') return `traduzione mancante: ${chiave}`;
  return v.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (params[k] ?? ''));
}

function soldi(cents) {
  const n = (Number(cents) || 0) / 100;
  const [int, dec] = n.toFixed(2).split('.');
  return `€${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

const kw = (list) => Object.fromEntries(list.filter(Array.isArray));
engine.registerFilter('t', (k, ...a) => traduci(k, kw(a)));
engine.registerFilter('money', soldi);
engine.registerFilter('money_with_currency', (c) => `${soldi(c)} EUR`);
engine.registerFilter('money_without_trailing_zeros', (c) => soldi(c).replace(',00', ''));
engine.registerFilter('json', (v) => JSON.stringify(v ?? null));
engine.registerFilter('image_url', (v) => (v && typeof v === 'object' ? v.src : v || ''));
engine.registerFilter('asset_url', (n) => `assets/${n}`);
engine.registerFilter('stylesheet_tag', (u) => `<link rel="stylesheet" href="${u}">`);
engine.registerFilter('font_face', () => '');
engine.registerFilter('font_modify', (f, prop, val) => ({ ...f, weight: val === 'bold' ? 700 : f.weight }));
engine.registerFilter('font_url', () => '');
engine.registerFilter('placeholder_svg_tag', (_, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="100" height="100" fill="currentColor" opacity=".08"/></svg>`);
for (const f of ['payment_type_svg_tag', 'payment_button', 'structured_data', 'default_errors', 'video_tag', 'external_video_tag', 'model_viewer_tag'])
  engine.registerFilter(f, () => '');
engine.registerFilter('time_tag', (d, fmt) => `<time>${new Date(d).toLocaleDateString('it-IT')}</time>`);
engine.registerFilter('handle', (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
engine.registerFilter('handleize', (s) => engine.filters.handle.call(null, s));

// ---------- sezioni ----------

const schemaCache = {};
function schemaDi(tipo) {
  if (!(tipo in schemaCache)) {
    const src = fs.readFileSync(path.join(TEMA, 'sections', `${tipo}.liquid`), 'utf8');
    const m = /\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/.exec(src);
    schemaCache[tipo] = { src, schema: m ? JSON.parse(m[1]) : {} };
  }
  return schemaCache[tipo];
}

function risolvi(def, valore) {
  if (valore === undefined) valore = def.default;
  switch (def.type) {
    case 'collection': return valore ? collezioni[valore] || null : null;
    case 'product': return valore ? prodotti[valore] || null : null;
    case 'link_list': return valore ? menus[valore] || { links: [] } : null;
    case 'image_picker': return immagineSezione(valore);
    case 'page': case 'video': return null;
    default: return valore ?? null;
  }
}

function impostazioni(defs = [], valori = {}) {
  const out = {};
  for (const d of defs) if (d.id) out[d.id] = risolvi(d, valori[d.id]);
  return out;
}

async function renderSezione(id, dati, globali) {
  const { src, schema } = schemaDi(dati.type);
  const order = dati.block_order || Object.keys(dati.blocks || {});
  const blocks = order.map((bid) => {
    const b = dati.blocks[bid];
    const def = (schema.blocks || []).find((x) => x.type === b.type) || {};
    return { id: bid, type: b.type, settings: impostazioni(def.settings, b.settings), shopify_attributes: '' };
  });
  const section = { id, settings: impostazioni(schema.settings, dati.settings), blocks };
  const html = await engine.parseAndRender(src, { ...globali, section });
  const tag = schema.tag || 'div';
  return `<${tag} id="shopify-section-${id}" class="shopify-section ${schema.class || ''}">${html}</${tag}>`;
}

// ---------- pagine ----------

const layout = fs.readFileSync(path.join(TEMA, 'layout/theme.liquid'), 'utf8');
const css = (n) => fs.readFileSync(path.join(TEMA, 'assets', n), 'utf8');
const js = (n) => fs.readFileSync(path.join(TEMA, 'assets', n), 'utf8');

function template(nome) {
  const t = JSON.parse(fs.readFileSync(path.join(TEMA, 'templates', `${nome}.json`), 'utf8'));
  if (nome === 'index' && !SOLO_PRONTI) {
    // anteprima: tutte le felpe della collezione nella hero, la sagoma dove manca la foto indossata
    const hero = t.sections.hero;
    const handles = collezioni[HERO_COLLEZIONE].products.map((p) => p.handle);
    hero.blocks = Object.fromEntries(handles.map((h, i) => [`look${i}`, { type: 'look', settings: { product: h } }]));
    hero.block_order = handles.map((_, i) => `look${i}`);
    hero.settings = { ...hero.settings, title: collezioni[HERO_COLLEZIONE].title,
      subtitle: collezioni[HERO_COLLEZIONE].description.replace(/<[^>]+>/g, '') };
  }
  return t;
}

const AVVISO = `<div class="anteprima-avviso" role="note">Anteprima del tema · prodotti e prezzi presi da sudditalia.it · carrello e ricerca disattivati</div>
<style>.anteprima-avviso{background:var(--color-text);color:var(--color-bg);font:500 12px/1.4 var(--font-body-family);
padding:6px 16px;text-align:center}</style>`;

async function pagina(file, nomeTemplate, extra, titolo) {
  const t = template(nomeTemplate);
  const globali = {
    settings, shop, routes, cart, linklists: menus, ...extra,
    request: { locale: { iso_code: 'it' }, page_type: nomeTemplate },
    page_title: titolo, canonical_url: file, content_for_header: '', current_page: 1,
  };
  let contenuto = '';
  for (const id of t.order) if (!t.sections[id].disabled) contenuto += await renderSezione(id, t.sections[id], globali);
  let html = await engine.parseAndRender(layout, { ...globali, content_for_layout: contenuto });
  // i CSS e i JS del tema vanno dentro la pagina; i font Archivo da Google Fonts
  html = html.replace(/<link rel="stylesheet" href="assets\/([\w.-]+\.css)"[^>]*>/g, (_, n) => `<style>${css(n)}</style>`)
    .replace(/<script src="assets\/([\w.-]+\.js)"[^>]*><\/script>/g, (_, n) => `<script type="module">${js(n)}</script>`)
    .replace('</title>', '</title>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700&display=swap">')
    .replace(/src="assets\/([\w.-]+)"/g, (_, n) => { copiaAsset(n); return `src="assets/${n}"`; })
    .replace(/(<body[^>]*>)/, `$1${AVVISO}`);
  fs.writeFileSync(path.join(OUT, file), html);
  console.log('scritto', file);
}

function copiaAsset(n) {
  fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
  fs.copyFileSync(path.join(TEMA, 'assets', n), path.join(OUT, 'assets', n));
}

await pagina('index.html', 'index', {}, DATI.shop.name);
for (const c of Object.values(collezioni)) if (c.products_count)
  await pagina(c.url, 'collection', { collection: c }, c.title);
for (const p of Object.values(prodotti)) await pagina(p.url, 'product', { product: p }, p.title);
await pagina('carrello.html', 'cart', {}, traduci('cart.general.title'));

for (const src of immaginiUsate) fs.copyFileSync(path.join(QUI, 'dati', src), path.join(OUT, src));
console.log(`fatto: ${fs.readdirSync(OUT).length} file in ${OUT}, ${immaginiUsate.size} immagini`);
