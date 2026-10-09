#!/usr/bin/env python3
"""
Genera le nuvole dell'ingresso del sito (assets/nuvola-*.webp): PNG/WebP con trasparenza,
rumore frattale a più ottave, bianche con ombre azzurrine. Nessuna foto di terzi.
Uso: python3 strumenti/genera_nuvole.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter

QUI = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(QUI, '..', 'assets')
W, H = 1920, 1080


def fbm(seed, w=W, h=H, base=5, octaves=7, persistence=0.55):
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        gw, gh = base * 2 ** o + 1, max(2, int(base * 2 ** o * h / w) + 1)
        g = (rng.random((gh, gw)) * 255).astype(np.uint8)
        layer = np.asarray(Image.fromarray(g).resize((w, h), Image.BICUBIC), np.float32) / 255
        out += layer * amp
        tot += amp
        amp *= persistence
    return out / tot


def nuvola(seed, mask, soglia=0.47, morbidezza=0.16, blur=2):
    n = fbm(seed)
    d = np.clip((n - soglia) / morbidezza, 0, 1) * mask
    d = d ** 1.3
    # ombre: dove la nuvola è più sottile e in basso è più azzurra
    s = fbm(seed + 99, base=4, octaves=5)
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    luce = np.clip(0.55 + 0.6 * s - 0.25 * yy + 0.35 * d, 0, 1)
    ombra = np.array([150, 172, 210], np.float32)
    bianco = np.array([255, 255, 255], np.float32)
    rgb = ombra * (1 - luce[..., None]) + bianco * luce[..., None]
    a = np.clip(d * 255, 0, 255)
    img = np.dstack([rgb, a]).astype(np.uint8)
    im = Image.fromarray(img, 'RGBA')
    return im.filter(ImageFilter.GaussianBlur(blur)) if blur else im


def lato(da_sinistra, larghezza=0.62):
    x = np.linspace(0, 1, W, dtype=np.float32)
    if not da_sinistra:
        x = 1 - x
    # un muro pieno verso il bordo, che si sfrangia verso il centro
    m = np.clip((larghezza - x) / (larghezza * 0.55), 0, 1) ** 0.6
    y = np.linspace(-1, 1, H, dtype=np.float32)[:, None]
    return m[None, :] * np.clip(1.25 - np.abs(y) * 0.5, 0, 1)


def banco(alto=False):
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    m = np.clip((y - 0.35) / 0.65, 0, 1) if not alto else np.clip((0.7 - y) / 0.7, 0, 1)
    return np.repeat(m, W, axis=1) ** 0.7


def centro_libero(r=0.42):
    x = np.linspace(-1, 1, W, dtype=np.float32)[None, :]
    y = np.linspace(-1, 1, H, dtype=np.float32)[:, None]
    d = np.sqrt((x / 1.0) ** 2 + (y / 0.75) ** 2)
    return np.clip((d - r) / 0.45, 0, 1)


def main():
    pezzi = {
        'nuvola-sfondo': nuvola(11, (banco() * 0.6 + banco(True) * 0.35) * centro_libero(), soglia=0.46, morbidezza=0.22, blur=6),
        'nuvola-sinistra': nuvola(23, lato(True), soglia=0.42, blur=2),
        'nuvola-destra': nuvola(37, lato(False), soglia=0.42, blur=2),
        'nuvola-vicina-sinistra': nuvola(51, lato(True, 0.5), soglia=0.4, morbidezza=0.14, blur=1),
        'nuvola-vicina-destra': nuvola(67, lato(False, 0.5), soglia=0.4, morbidezza=0.14, blur=1),
    }
    for nome, im in pezzi.items():
        dest = os.path.join(ASSETS, nome + '.webp')
        im.save(dest, 'WEBP', quality=80, method=6)
        print(nome, os.path.getsize(dest) // 1024, 'KB')


if __name__ == '__main__':
    main()
