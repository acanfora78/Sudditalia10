# Progetto: tema Shopify Sudditalia con "capi sul modello"

## Obiettivo
Tema Shopify scritto da zero per Sudditalia (sudditalia.it, streetwear italiano). Chiaro e minimale.
In home, una hero come nel reel "Master Shopify Templates" di @hanzife: un modello fermo al centro e
i capi dello store che gli scorrono addosso in orizzontale. Il capo al centro è indossato, i vicini
restano in trasparenza ai lati. Bottone Fronte / Retro per vedere il modello di spalle.

## Stato attuale
- Il tema completo c'è: file `sudditalia-tema-nuovo.zip` (allegato), Online Store 2.0, Liquid + CSS +
  JS senza framework, `shopify theme check` senza errori. Provato solo in locale, non ancora sullo store.
- Pagine: home, collezione con filtri, prodotto con varianti, carrello, ricerca, pagine, blog,
  account, 404, password. Testi in italiano (`locales/it.default.json`).
- Stile: sfondo #E9EAEC, testo #0E1A33, accento #1F6FE0, font Archivo, titoli in maiuscolo.
  Tutto modificabile da Impostazioni tema.
- Hero: `sections/hero-outfit-slider.liquid`, `snippets/outfit-look|outfit-layer|outfit-caption.liquid`,
  `assets/outfit-slider.css|js`. Si cambia capo con trascinamento, swipe del trackpad, frecce e
  tastiera. La home la collega alle 4 Zip Boxy Hoodie (sky-blue-shark-zip-boxy, yellow-shark-zip-boxy,
  pink-shark-zip-boxy, black-on-black-boxy-zip-hoodie).
- Su GitHub: questo repo (`acanfora78/Sudditalia10`) contiene il tema nuovo. `acanfora78/Sudditalia` contiene il **vecchio** tema di luglio (scuro, con intro squalo) e
  la PR #2 con una prima versione della hero.

## Come i capi vanno sul modello (decisione presa)
- Una foto prodotto stesa incollata sul modello sembra un adesivo (maniche ad ali, niente pieghe).
  Testato e scartato, anche ruotando le maniche via codice.
- La strada che funziona: per ogni capo, una foto **del modello che lo indossa**, nella stessa posa
  e inquadratura della foto base. Generata con AI partendo da foto modello + foto prodotto.
- Da quella foto, `strumenti/prepara_capo.py` crea un **file doppio** sulla tela del modello
  (due pannelli 624 × 980 affiancati): `[ solo il capo con le mani | modello vestito intero ]`.
  Nella hero il primo pannello scorre sul modello in t-shirt nera; quando il capo è al centro
  compare il secondo, cioè la foto vestita vera.
- Il file va nella scheda prodotto, in metafield di tipo File: `custom.capo_fronte` e
  `custom.capo_retro` (da creare in Impostazioni → Dati personalizzati → Prodotti).
- La hero prende i capi dalla collezione **`hoodies`** dello store ("Zip Hoodie & Hoodie"): entrano,
  nell'ordine della collezione, i prodotti che hanno `capo_fronte`. Titolo e sottotitolo della hero
  sono il nome e la descrizione della collezione. Nel tema non c'è nessun nome di prodotto scritto a
  mano: per aggiungere o togliere un capo basta caricare (o togliere) il file nel metafield.
  I blocchi "Capo" (prodotto scelto a mano) restano disponibili nell'editor, ma non sono usati.

## Nomi dei file
Un file per prodotto e per vista, con l'handle del prodotto (l'ultima parte dell'URL):
`capo-fronte-<handle>.png` e `capo-retro-<handle>.png`, per esempio `capo-fronte-diamond-hoodie.png`.

## Immagini
- Modello base frontale: uomo, t-shirt nera aderente, pantaloni neri, sneakers bianche, in piedi di
  fronte con le braccia lungo i fianchi, sfondo chiaro, 1024 × 1536. Incluso nel tema come
  `assets/modello-fronte.webp` (ritaglio dalla testa a metà coscia).
- Primo capo fatto: felpa zip nera con la S gotica sul petto e la stella sulla manica
  → `capo-fronte-felpa-zip-S.png`. Corrisponde alla **Diamond Hoodie** (`diamond-hoodie`), che non è
  tra le 4 felpe collegate prima alla hero; ora la hero prende i capi dalla collezione `hoodies`.

## Cartella `foto/` (materiale per generare i capi indossati)
- `modello-fronte-base.png`: modello frontale intero, 1024 × 1536, sfondo grigio chiaro #E9EAEC uniforme.
  È questa la foto da dare all'AI insieme alla foto prodotto. L'originale aveva una scacchiera
  "finta" disegnata nei pixel (non vera trasparenza), che l'AI avrebbe copiato nel risultato.
- `modello-fronte-trasparente.png`: stessa foto con vera trasparenza (PNG con canale alfa).
- `prodotto-diamond-hoodie-fronte.webp`: foto prodotto della Diamond Hoodie, fronte.
- `vestito-diamond-hoodie-fronte.webp`: modello che indossa la Diamond Hoodie (generata con AI).
- File doppi pronti (fronte): Diamond Hoodie, Black on Black, Sky Blue Shark, Yellow Shark,
  Hoodie "I Need Money Not Rumors" (`capo-fronte-<handle>.png`). Manca la Pink Shark.
- `capo-fronte-diamond-hoodie.png`: **file doppio pronto** (1248 × 980) da caricare nel metafield
  `custom.capo_fronte` della Diamond Hoodie. `anteprima-diamond-hoodie-fronte.png` mostra il controllo.

## `strumenti/prepara_capo.py`
Crea il file doppio partendo dalla foto vestita (1024 × 1536, stessa posa della base):
```
pip install "rembg[cpu]" opencv-python-headless pillow numpy
python strumenti/prepara_capo.py foto/vestito-XXX.png -o foto/capo-fronte-XXX.png -p anteprima.png
```
Scontorna la foto, toglie testa e pantaloni (tiene capo, mani e polsini) e ritaglia sulla tela di
`assets/modello-fronte.webp`. Le righe di taglio `--testa` e `--orlo` sono stimate in automatico e
stampate: se l'anteprima non va bene, correggile a mano. Al primo avvio scarica il modello di
scontorno (circa 1 GB).

Prompt usato per generare il modello vestito (con allegate foto modello + foto prodotto):
> Usa la prima immagine come base: stessa persona, stessa posa, stessa inquadratura, stessa luce,
> stesso sfondo grigio chiaro, stessi pantaloni e scarpe. Cambia solo la parte di sopra: fagli
> indossare il capo della seconda immagine, con colori, stampe, loghi e scritte identici
> all'originale. Il capo deve calzare in modo naturale, con pieghe realistiche. Non cambiare viso,
> capelli, braccia e mani. Formato verticale 1024×1536.

## Anteprima senza Shopify (`strumenti/anteprima/`)
Fa girare i file Liquid veri del tema con i dati veri presi dal sito pubblico (prodotti, prezzi,
taglie, collezioni, immagini) e crea un sito statico: home, collezioni, prodotti, carrello.
```
python3 strumenti/anteprima/scarica_dati.py          # scarica i dati dello store
cd strumenti/anteprima && npm install && node genera.mjs   # crea build/index.html
```
Nella hero entrano anche le felpe senza foto indossata (sagoma grigia al posto del capo); con
`node genera.mjs --solo-pronti` si comporta come sullo store vero. Carrello, ricerca e account non
funzionano; i menu sono ricostruiti dalle collezioni della home. Quando arriva un nuovo file
`foto/capo-fronte-<handle>.png`, basta rilanciare `node genera.mjs`.

## Cosa manca
1. Caricare il tema sullo store e provarlo davvero (Shopify CLI: `shopify theme dev`).
2. Creare i metafield `capo_fronte` e `capo_retro` e caricare il file della felpa.
3. Modello di spalle (stessa persona e posa, t-shirt nera), da caricare nella hero per Fronte / Retro.
4. Per ogni capo della hero: foto indossata di fronte e di spalle → `prepara_capo.py` → metafield.
5. Facoltativo: automatizzare la generazione delle foto indossate con un servizio di virtual try-on
   via API (FASHN o Google Vertex AI Virtual Try-On). Da verificare se gestiscono la vista di spalle.
6. ~~Mettere il tema nuovo su GitHub.~~ Fatto (questo repo).
