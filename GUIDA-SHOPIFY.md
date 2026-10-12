# Cosa si cambia da Shopify

Tutto si cambia da **Negozio online → Temi → Personalizza**, senza toccare il codice.

## Regole generali
- **Font del sito**: Impostazioni tema (ingranaggio) → *Tipografia*: font dei titoli, font dei testi, titoli in maiuscolo, dimensione del testo.
- **Font di una sola sezione**: in ogni sezione, in fondo, gruppo *Font della sezione* → "Usa font diversi per questa sezione", poi scegli font dei titoli, font dei testi, maiuscolo e spaziatura.
- **Colori**: Impostazioni tema → *Colori* (sfondo, testo, accento, "Set" dietro i prodotti). **Movimento**: scorrimento morbido e grana.
- **Menu in alto e nel footer**: si gestiscono in *Contenuti → Menu* di Shopify (collezioni, pagine, sottomenu). Nel tema scegli quale menu mostrare (Header → Menu; Footer → blocchi Menu).
- **Link**: ogni campo "link" apre il selettore di Shopify: puoi scegliere una collezione, un prodotto, una pagina o scrivere un indirizzo.
- **Immagini e video**: si caricano direttamente dal campo (o da *Contenuti → File*). Per foto a tutto schermo meglio almeno 2000 px.
- **Social**: Impostazioni tema → *Social* (Instagram, TikTok…). Il nome @ della striscia Instagram viene da lì.
- **Testi dei bottoni fissi** ("Aggiungi al carrello", "Vedi prodotto", "Seguici", parole del cursore…): *Temi → … → Modifica contenuti predefiniti del tema*.

## Dati nella scheda prodotto / collezione (metafield)
Da creare una volta in *Impostazioni → Dati personalizzati*:
| Dove | Nome | Chiave | Tipo | A cosa serve |
|---|---|---|---|---|
| Prodotti | Capo fronte | custom.capo_fronte | File | Capo sul modello nella hero e modello vestito nella pagina prodotto |
| Prodotti | Capo retro | custom.capo_retro | File | Vista di spalle nella hero |
| Prodotti | Frase | custom.frase | Testo su una riga | Frase grande nella pagina prodotto (altrimenti il nome) |
| Prodotti | Etichetta | custom.etichetta | Testo su una riga | Scritta sopra il titolo del prodotto (altrimenti il tipo) |
| Collezioni | Immagine apertura | custom.immagine_apertura | File (immagine) | Foto d'apertura della pagina collezione (altrimenti l'immagine della collezione) |

## Sezione per sezione (generato dalle impostazioni del tema)

### Home

**Apertura (intro tra le nuvole + video a blocchi)** — Ingresso da film; Mostra l'ingresso una volta per visita; Tipo di ingresso; Logo dell'ingresso (nuvole) *(immagine)*; Scritta dell'ingresso (su nero) *(testo)*; Barre cinema sopra e sotto la foto; Video *(video)*; Video per telefono (facoltativo) *(video)*; Foto *(immagine)*; Foto per telefono (facoltativa) *(immagine)*; Parte della foto da tenere al centro; Colonne di blocchi; Righe di blocchi; Lunghezza dello scorrimento; Titolo *(testo)*; Sottotitolo *(testo)*; Testo del bottone *(testo)*; Link del bottone *(link)*.

**Hero capi sul modello** — Modello di fronte (scontornato) *(immagine)*; Modello di spalle (scontornato) *(immagine)*; Collezione da cui prendere i capi *(collezione)*; Numero massimo di capi dalla collezione; Titolo *(testo)*; Sottotitolo *(testo)*; Suggerimento in basso a sinistra *(testo)*; Testo del link al prodotto *(testo)*; Mostra il prezzo; Etichetta accessibilità (se manca il titolo) *(testo)*; Colore sfondo *(colore)*; Colore testo *(colore)*; Altezza sezione; Altezza modello (desktop); Altezza modello (mobile); Distanza tra i capi; Opacità dei capi laterali; Dimensione dei capi laterali; Scorrimento continuo (dall'ultimo torna al primo); Cambio automatico; Intervallo cambio automatico.
  - Blocco *Capo* (puoi aggiungerne, toglierne e riordinarli): Prodotto *(prodotto)*; Capo di fronte *(immagine)*; Capo di spalle *(immagine)*; Nome (se diverso dal prodotto) *(testo)*; Link (se diverso dal prodotto) *(link)*; Scala; Sposta in orizzontale; Sposta in verticale.

**Finestra che si apre** — Scritta *(testo)*; Disposizione della scritta; Logo al posto della scritta (facoltativo) *(immagine)*; Video *(video)*; Video per telefono (facoltativo) *(video)*; Immagine *(immagine)*; Parte del video o della foto da tenere al centro; Lunghezza dello scorrimento; Mirino e contatore intorno alla finestra; Invito a scorrere *(testo)*; Collezione *(collezione)*; Etichetta sopra il titolo *(testo)*; Titolo *(testo)*; Sottotitolo *(testo)*; Numero di prodotti accanto al titolo; Testo del bottone *(testo)*; Link del bottone *(link)*; Prodotti della collezione da mostrare.

**Fascia scorrevole** — Scritta *(testo)*; Scritta della seconda riga *(testo)*; Solo una riga; Link (facoltativo) *(link)*.

**Prodotti in evidenza** — Collezione *(collezione)*; Oppure scegli i prodotti a mano *(prodotti a scelta)*; Titolo *(testo)*; Testo del link alla collezione *(testo)*; Link di "Vedi tutto" *(link)*; Mostra il numero dei prodotti; Prodotti da mostrare; Colonne su computer; Colonne sfalsate in movimento.

**Galleria orizzontale (lookbook)** — Riga sopra il titolo *(testo)*; Titolo grande *(testo)*; Invito sotto il titolo *(testo)*; Numeri grandi sui pannelli; Durata dello scorrimento; Sopra il nome di un prodotto *(testo)*; Sopra il nome di una collezione *(testo)*; Testo del link *(testo)*; Scritta finale *(testo)*; Link del bottone finale *(link)*; Testo del bottone finale *(testo)*.
  - Blocco *Pannello* (puoi aggiungerne, toglierne e riordinarli): Foto *(immagine)*; Video (facoltativo) *(video)*; Prodotto (facoltativo) *(prodotto)*; Collezione (facoltativa) *(collezione)*; Titolo *(testo)*; Sottotitolo *(testo)*; Formato; Posizione in altezza.

**Collezioni (fisarmonica)** — Titolo *(testo)*; Testo del link a tutte le collezioni *(testo)*.
  - Blocco *Collezione* (puoi aggiungerne, toglierne e riordinarli): Collezione *(collezione)*; Immagine *(immagine)*; Nome (se diverso dalla collezione) *(testo)*; Nome segnaposto *(testo)*.

**Striscia Instagram** — Nome del profilo *(testo)*; Riga sotto il nome *(testo)*; Link del profilo *(link)*; Testo del bottone *(testo)*.
  - Blocco *Foto o video* (puoi aggiungerne, toglierne e riordinarli): Foto *(immagine)*; Video (facoltativo) *(video)*; Link (facoltativo) *(link)*.

### Sezioni da aggiungere

**Frase in grande** — Frase *(testo)*; Testo *(testo)*; Testo del bottone *(testo)*; Link del bottone *(link)*; Allineamento.

**Immagine con testo** — Immagine *(immagine)*; Formato immagine; Posizione immagine; Titolo *(testo)*; Testo *(testo)*; Testo del bottone *(testo)*; Link del bottone *(link)*.

### Tutte le pagine

**Header (logo, menu, avviso)** — Logo *(immagine)*; Larghezza logo; Menu *(menu)*; Testo *(testo)*; Link *(link)*.

**Footer** — Nome gigante in fondo; Testo del nome gigante *(testo)*; Frase sotto il nome *(testo)*; Mostra i metodi di pagamento.
  - Blocco *Menu* (puoi aggiungerne, toglierne e riordinarli): Titolo *(testo)*; Menu *(menu)*.
  - Blocco *Testo* (puoi aggiungerne, toglierne e riordinarli): Titolo *(testo)*; Testo *(testo)*.
  - Blocco *Newsletter* (puoi aggiungerne, toglierne e riordinarli): Titolo *(testo)*; Testo *(testo)*.

### Pagina prodotto

**Prodotto** — Mostra l'etichetta sopra il titolo; Etichetta sopra il titolo *(testo)*; Mostra il selettore quantità; Mostra il bottone di acquisto rapido; Lente di ingrandimento sulla foto; Parola sul cursore della foto *(testo)*; Conferma sul bottone dopo l'aggiunta *(testo)*; Barra di acquisto fissa su telefono.
  - Blocco *Scheda a comparsa* (puoi aggiungerne, toglierne e riordinarli): Titolo *(testo)*; Testo *(testo)*; Oppure usa il contenuto di una pagina *(pagina)*.

**Potrebbe piacerti** — Titolo *(testo)*; Prodotti da mostrare; Collezione *(collezione)*; Prodotti da mostrare.

### Pagina collezione

**Collezione** — Mostra la foto della collezione; Altezza dell'apertura; Scurimento della foto; Scritta sopra il titolo *(testo)*; Mostra la descrizione; Mostra il contatore dei prodotti; Contatore: parola al singolare *(testo)*; Contatore: parola al plurale *(testo)*; Invito a scorrere *(testo)*; Prodotti per pagina; Colonne su computer; Colonne su telefono; Fai scegliere la griglia a chi visita; Nome del selettore della griglia *(testo)*; Testo del tasto per chiudere i filtri *(testo)*; Titolo *(testo)*; Testo *(testo)*; Testo del bottone *(testo)*.

### Tutte le collezioni

**Elenco collezioni** — Titolo *(testo)*; Testo sotto il titolo *(testo)*; Parola dopo il numero delle collezioni *(testo)*; Invito a scorrere *(testo)*; Ordine (tutte le collezioni); Nascondi le collezioni senza prodotti; Sfondo dei pannelli; Mostra i primi prodotti in piccolo (computer); Mostra l'indice delle collezioni; Nome dell'indice (per i lettori di schermo) *(testo)*; Testo del bottone *(testo)*; Parola dopo il numero (1 prodotto) *(testo)*; Parola dopo il numero (più prodotti) *(testo)*; Messaggio senza collezioni *(testo)*; Mostra la schermata "Tutti i prodotti" alla fine; Testo piccolo *(testo)*; Titolo *(testo)*; Testo del bottone *(testo)*.
  - Blocco *Collezione* (puoi aggiungerne, toglierne e riordinarli): Collezione *(collezione)*; Foto del pannello *(immagine)*.

### Altre pagine

**Carrello** — Titolo *(testo)*; Permetti una nota all'ordine.

**Ricerca** — Titolo *(testo)*.

**Pagina 404** — Etichetta sopra il numero *(testo)*; Titolo *(testo)*; Testo *(testo)*; Bottone verso la home *(testo)*; Bottone verso le collezioni *(testo)*; Mostra la ricerca; Nuvole che scorrono; Disturbo sul 404.

**Modulo contatti** — Titolo *(testo)*.

