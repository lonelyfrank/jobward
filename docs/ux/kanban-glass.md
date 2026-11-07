# Colonne Kanban: Glass · Subtle

Le colonne adottano un adattamento del percorso CSS del materiale **Glass · Subtle** di Jello, identificato dal preset `navbar`. Sorgenti verificate: [catalogo](https://github.com/lonelyfrank/jello/blob/492e221fa393dc0a29247c1ad894125ffed215f1/src/model/catalog/index.ts), [preset](https://github.com/lonelyfrank/jello/blob/492e221fa393dc0a29247c1ad894125ffed215f1/src/core/presets.ts), [superficie](https://github.com/lonelyfrank/jello/blob/492e221fa393dc0a29247c1ad894125ffed215f1/src/core/glass.css).

L'adattatore locale `apps/web/src/styles/glass.css` riprende blur 4 px, saturazione 160%, ombra 0,2 con sfocatura 26 px e scostamento 8 px dal preset. Per le colonne sono disattivati sia il riflesso perimetrale sia la luce interna sul bordo. Il contenuto della colonna non riceve filtri né opacità.

La tinta bianca al 14% del preset originale è adattata alle superfici di lettura di Jobward: bianca al 90% in chiaro e scura al 78% in scuro. Le fotografie restano visibili attraverso la colonna, con blur leggero e senza contorno luminoso, mantenendo il contrasto dei testi. Non viene più forzata l'opacità al 100% quando la board ha uno sfondo immagine. Card, badge e pulsanti conservano le proprie superfici.

L'adattatore usa il percorso CSS, senza caricare il runtime imperativo di Jello: non include la rifrazione del percorso SVG o gli effetti di pressione e trascinamento del materiale. Il trascinamento delle colonne rimane gestito da dnd-kit. Dimensioni e disposizione delle colonne restano invariate.

Con trasparenza ridotta, contrasto elevato o browser privi di `backdrop-filter`, il materiale torna opaco. Con colori forzati usa le superfici di sistema.
