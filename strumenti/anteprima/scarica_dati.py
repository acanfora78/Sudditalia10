#!/usr/bin/env python3
"""
Scarica dal sito pubblico (sudditalia.it) i dati dello store per l'anteprima del tema:
negozio, collezioni, prodotti e immagini. Non serve l'accesso all'admin di Shopify.

Uso:  python strumenti/anteprima/scarica_dati.py
Crea: strumenti/anteprima/dati/store.json  e  strumenti/anteprima/dati/img/*.webp
"""
import hashlib
import io
import json
import os
import subprocess
import sys

from PIL import Image

SITO = 'https://sudditalia.it'
QUI = os.path.dirname(os.path.abspath(__file__))
DATI = os.path.join(QUI, 'dati')
IMG = os.path.join(DATI, 'img')


def scarica(url):
    r = subprocess.run(['curl', '-sSfL', '-m', '30', url], capture_output=True)
    if r.returncode:
        raise RuntimeError(f'download fallito: {url}\n{r.stderr.decode()}')
    return r.stdout


def json_da(path):
    return json.loads(scarica(SITO + path))


def immagine(src, larghezza=900):
    """Scarica un'immagine del CDN Shopify, la salva in webp e ne restituisce i dati."""
    if not src:
        return None
    nome = hashlib.sha1(src.split('?')[0].encode()).hexdigest()[:16] + '.webp'
    dest = os.path.join(IMG, nome)
    if not os.path.exists(dest):
        sep = '&' if '?' in src else '?'
        im = Image.open(io.BytesIO(scarica(f'{src}{sep}width={larghezza}')))
        im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
        im.save(dest, 'WEBP', quality=82)
    w, h = Image.open(dest).size
    return {'src': 'img/' + nome, 'width': w, 'height': h}


def main():
    os.makedirs(IMG, exist_ok=True)
    meta = json_da('/meta.json')
    shop = {'name': meta['name'], 'description': meta.get('description') or '',
            'money_format': meta.get('money_format', '€{{amount_with_comma_separator}}'),
            'currency': meta.get('currency', 'EUR')}

    prodotti = {}
    for p in json_da('/products.json?limit=250')['products']:
        varianti = [{
            'id': v['id'], 'title': v['title'], 'available': v['available'],
            'price': round(float(v['price']) * 100),
            'compare_at_price': round(float(v['compare_at_price']) * 100) if v.get('compare_at_price') else None,
            'options': [v.get(f'option{i}') for i in (1, 2, 3) if v.get(f'option{i}')],
            'featured_image_src': (v.get('featured_image') or {}).get('src'),
        } for v in p['variants']]
        prodotti[p['handle']] = {
            'id': p['id'], 'handle': p['handle'], 'title': p['title'], 'body_html': p.get('body_html') or '',
            'product_type': p.get('product_type') or '', 'vendor': p.get('vendor') or '',
            'options': [{'name': o['name'], 'position': o['position'], 'values': o['values']} for o in p['options']],
            'variants': varianti, 'image_srcs': [i['src'] for i in p['images']],
        }

    collezioni = []
    for c in json_da('/collections.json?limit=250')['collections']:
        handles = [p['handle'] for p in json_da(f"/collections/{c['handle']}/products.json?limit=250")['products']]
        collezioni.append({'handle': c['handle'], 'title': c['title'], 'description': c.get('description') or '',
                           'image_src': (c.get('image') or {}).get('src'), 'products': handles})

    # immagini: tutte per i prodotti, l'immagine per le collezioni (o il primo prodotto)
    print(f'{len(prodotti)} prodotti, {len(collezioni)} collezioni: scarico le immagini...')
    for p in prodotti.values():
        p['images'] = [immagine(s) for s in p.pop('image_srcs')]
        for v in p['variants']:
            src = v.pop('featured_image_src')
            v['featured_image'] = immagine(src) if src else None
    for c in collezioni:
        c['image'] = immagine(c.pop('image_src'))

    with open(os.path.join(DATI, 'store.json'), 'w') as f:
        json.dump({'shop': shop, 'products': prodotti, 'collections': collezioni}, f, ensure_ascii=False, indent=1)
    print('salvato', os.path.join(DATI, 'store.json'))


if __name__ == '__main__':
    sys.exit(main())
