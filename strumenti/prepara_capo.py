#!/usr/bin/env python3
"""
Prepara il file doppio di un capo per la hero "capi sul modello".

Parte dalla foto del modello che indossa il capo (stessa posa e inquadratura della
foto base, 1024 x 1536) e crea un PNG 1248 x 980 con due pannelli affiancati, sulla
stessa tela di assets/modello-fronte.webp (624 x 980):

    [ solo il capo con le mani | modello vestito intero ]

Il file va caricato nella scheda prodotto, metafield custom.capo_fronte o custom.capo_retro.

Uso:
    python strumenti/prepara_capo.py foto/vestito.png -o capo-fronte.png
    python strumenti/prepara_capo.py foto/vestito.png -o capo-fronte.png --testa 190 --orlo 698

Cosa fa:
  1. scontorna la foto vestita (rembg, modello BiRefNet);
  2. toglie testa e collo: tutto sopra la riga --testa, più la pelle attaccata al viso;
  3. toglie i pantaloni: sotto la riga --orlo restano solo mani e polsini;
  4. ritaglia sulla tela del modello del tema e affianca i due pannelli.
--testa e --orlo, se non indicati, sono stimati in automatico e stampati a video:
controlla l'anteprima (-p) e correggili se serve.

Dipendenze: pip install "rembg[cpu]" opencv-python-headless pillow numpy
"""
import argparse
import sys

import cv2
import numpy as np
from PIL import Image

# Riquadro di assets/modello-fronte.webp dentro la foto base 1024 x 1536 (sinistra, alto, destra, basso).
# Ricavato confrontando le due immagini; da ricalcolare con --base se cambia la foto del modello.
RIQUADRO = (197.4, 16.2, 829.0, 1008.1)
TELA = (624, 980)


def scontorna(img):
    from rembg import new_session, remove
    return remove(img.convert('RGB'), session=new_session('birefnet-general')).convert('RGBA')


def calcola_riquadro(base_path, modello_path):
    """Trova dove cade modello-fronte.webp nella foto base (scala + posizione)."""
    t = np.asarray(Image.open(modello_path).convert('RGBA'))
    tg = cv2.cvtColor(t[..., :3], cv2.COLOR_RGB2GRAY).astype(np.float32)
    m = (t[..., 3] > 250).astype(np.float32)
    base = Image.open(base_path).convert('RGB')
    migliore = None
    for s in np.arange(0.80, 1.30, 0.002):
        w, h = round(base.width * s), round(base.height * s)
        if w < TELA[0] or h < TELA[1]:
            continue
        g = cv2.cvtColor(np.asarray(base.resize((w, h), Image.LANCZOS)), cv2.COLOR_RGB2GRAY).astype(np.float32)
        mn, _, loc, _ = cv2.minMaxLoc(cv2.matchTemplate(g, tg, cv2.TM_SQDIFF, mask=m))
        if migliore is None or mn < migliore[0]:
            migliore = (mn, s, loc)
    _, s, (x, y) = migliore
    return (x / s, y / s, (x + TELA[0]) / s, (y + TELA[1]) / s)


def maschera_pelle(rgb):
    ycc = cv2.cvtColor(rgb, cv2.COLOR_RGB2YCrCb)
    pelle = cv2.inRange(ycc, (40, 135, 80), (255, 180, 130)) > 0
    k = np.ones((3, 3), np.uint8)
    pelle = cv2.morphologyEx(pelle.astype(np.uint8), cv2.MORPH_OPEN, k)
    return cv2.dilate(pelle, k, iterations=2) > 0


def stima_testa(persona):
    """Prima riga in cui la figura si allarga molto rispetto alla testa (spalle o cappuccio)."""
    righe = np.where(persona.any(axis=1))[0]
    top = righe[0]
    def larghezza(y):
        xs = np.where(persona[y])[0]
        return xs[-1] - xs[0] if len(xs) else 0
    testa = larghezza(top + 60)
    for y in range(top + 60, top + 400):
        if larghezza(y) > 1.35 * testa:
            # risale fino a dove inizia l'allargamento, per non tagliare la punta del cappuccio
            while larghezza(y - 1) > 1.1 * testa:
                y -= 1
            return y - 3
    return top + 200


def stima_orlo(persona, pelle):
    """Riga dell'orlo: scendendo al centro, dove il capo lascia il posto ai pantaloni.
    Stima grezza: prima riga sotto il busto dove compare pelle (le mani) ai lati."""
    h, w = persona.shape
    for y in range(h // 3, h):
        if pelle[y, : w // 2].any() and pelle[y, w // 2:].any():
            return y - 15
    return h // 2


def solo_capo(rgba, testa, orlo):
    a = np.asarray(rgba).copy()
    rgb, alpha = a[..., :3], a[..., 3]
    persona = alpha > 20
    pelle = maschera_pelle(rgb) & persona
    h, w = persona.shape
    tieni = persona.copy()

    # testa e collo
    tieni[:testa] = False
    n, lab = cv2.connectedComponents(pelle.astype(np.uint8))
    for i in set(lab[testa][pelle[testa]]) - {0}:
        tieni &= lab != i

    # pantaloni: sotto l'orlo si tiene la pelle (mani) e ciò che sta fuori dai pantaloni (polsini)
    riga = persona[orlo + 10]
    cx = w // 2
    sx = cx
    while sx > 0 and riga[sx - 1]:
        sx -= 1
    dx = cx
    while dx < w - 1 and riga[dx + 1]:
        dx += 1
    sotto = np.zeros_like(tieni)
    margine = 10  # i pantaloni si allargano scendendo
    sotto[orlo:, max(sx - margine, 0):dx + margine + 1] = True
    # nella zona dei pantaloni la pelle allargata prende anche i bordi neri: si scartano i pixel scuri
    luma = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    mani_ok = pelle & (luma > 45)
    tieni &= ~(sotto & ~mani_ok)
    # sotto le mani non resta niente
    mani = np.where(pelle[orlo:].any(axis=1))[0]
    fondo = orlo + (mani[-1] if len(mani) else 0) + 10
    tieni[fondo:] = False

    m = cv2.GaussianBlur(tieni.astype(np.float32), (3, 3), 0)
    a[..., 3] = (alpha.astype(np.float32) * m).astype(np.uint8)
    return Image.fromarray(a), (sx, dx, fondo)


def sulla_tela(img, riquadro):
    return img.crop(tuple(round(v) for v in riquadro)).resize(TELA, Image.LANCZOS)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('vestito', help='foto del modello che indossa il capo (1024 x 1536)')
    p.add_argument('-o', '--out', required=True, help='PNG di uscita (1248 x 980)')
    p.add_argument('-p', '--anteprima', help='PNG di controllo: capo sul modello base e modello vestito')
    p.add_argument('--testa', type=int, help='riga (foto intera) sopra cui si toglie tutto')
    p.add_argument('--orlo', type=int, help="riga (foto intera) dell'orlo del capo")
    p.add_argument('--base', help='foto base del modello, per ricalcolare il riquadro')
    p.add_argument('--modello', default='assets/modello-fronte.webp', help='modello del tema (con --base)')
    p.add_argument('--retro', action='store_true', help='vista di spalle: non cerca la pelle del viso')
    args = p.parse_args()

    vestito = Image.open(args.vestito)
    if vestito.size != (1024, 1536):
        print(f'attenzione: la foto è {vestito.size[0]} x {vestito.size[1]}, attesa 1024 x 1536', file=sys.stderr)
    riquadro = calcola_riquadro(args.base, args.modello) if args.base else RIQUADRO

    pieno = scontorna(vestito)
    persona = np.asarray(pieno)[..., 3] > 20
    pelle = maschera_pelle(np.asarray(pieno)[..., :3]) & persona
    testa = args.testa if args.testa is not None else stima_testa(persona)
    orlo = args.orlo if args.orlo is not None else stima_orlo(persona, pelle)
    capo, (sx, dx, fondo) = solo_capo(pieno, testa, orlo)
    print(f'riquadro {tuple(round(v, 1) for v in riquadro)}  testa {testa}  orlo {orlo}  '
          f'pantaloni x {sx}-{dx}  fondo {fondo}')

    sinistra, destra = sulla_tela(capo, riquadro), sulla_tela(pieno, riquadro)
    doppio = Image.new('RGBA', (TELA[0] * 2, TELA[1]), (0, 0, 0, 0))
    doppio.paste(sinistra, (0, 0))
    doppio.paste(destra, (TELA[0], 0))
    doppio.save(args.out, optimize=True)
    print(f'salvato {args.out}')

    if args.anteprima:
        fondo_col = (233, 234, 236, 255)
        prova = Image.new('RGBA', (TELA[0] * 2, TELA[1]), fondo_col)
        try:
            modello = Image.open(args.modello).convert('RGBA')
            prova.alpha_composite(modello, (0, 0))
        except FileNotFoundError:
            pass
        prova.alpha_composite(sinistra, (0, 0))
        prova.alpha_composite(destra, (TELA[0], 0))
        prova.convert('RGB').save(args.anteprima)
        print(f'anteprima {args.anteprima}')


if __name__ == '__main__':
    main()
