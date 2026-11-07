# Sfondi immagine delle bacheche

La raccolta attiva usa le **otto immagini PNG fornite dall'utente**. Gli originali in Scaricati restano intatti: le copie per l'app hanno nomi descrittivi, in minuscolo e separati da trattini. La [mappa degli asset](board-backgrounds.assets.json) associa ogni nome originale al relativo file ottimizzato.

I file finali sono in `apps/web/public/backgrounds/`, in WebP alla risoluzione nativa di **1672 × 941 px**, senza ingrandimento artificiale. Ogni immagine ha una miniatura `-thumb.webp` di 480 × 270 px. Il selettore carica le miniature; la board carica soltanto lo sfondo scelto. Tutti i file sono serviti dall'applicazione, senza richieste a servizi esterni.

| Paesaggio            | File                                                                                                       | Peso   |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| Costa al tramonto    | [costa-dorata-tramonto.webp](../../apps/web/public/backgrounds/costa-dorata-tramonto.webp)                 | 282 KB |
| Alba in montagna     | [alba-montagna-fiori-selvatici.webp](../../apps/web/public/backgrounds/alba-montagna-fiori-selvatici.webp) | 117 KB |
| Fiordo               | [fiordo-montano.webp](../../apps/web/public/backgrounds/fiordo-montano.webp)                               | 207 KB |
| Foresta nella nebbia | [foresta-nebbia.webp](../../apps/web/public/backgrounds/foresta-nebbia.webp)                               | 209 KB |
| Prato verde          | [prato-verde.webp](../../apps/web/public/backgrounds/prato-verde.webp)                                     | 266 KB |
| Dune dorate          | [dune-dorate.webp](../../apps/web/public/backgrounds/dune-dorate.webp)                                     | 74 KB  |
| Costa mediterranea   | [costa-mediterranea.webp](../../apps/web/public/backgrounds/costa-mediterranea.webp)                       | 296 KB |
| Lago alpino          | [lago-alpino.webp](../../apps/web/public/backgrounds/lago-alpino.webp)                                     | 130 KB |

La preferenza è salvata in `Board.backgroundImage`, indipendentemente da `Board.color`. Gli identificatori già persistiti (`alps`, `lake`, `dunes`, `ocean`) restano validi e puntano alle nuove immagini corrispondenti. I nuovi identificatori sono `golden-coast`, `misty-fjord`, `misty-forest`, `sunny-meadow`. Le API accettano solo questo catalogo oppure `null`; il nome del file è risolto dal catalogo locale, mai dall'input dell'utente. Non è necessaria una nuova migrazione dei dati.

La foto occupa soltanto la superficie della board, con ritaglio centrato e un velo leggero adattato al tema. I contenitori delle colonne usano il materiale [Glass · Subtle](kanban-glass.md), con tinta adattata al tema e card opache; la vista Tabella usa un pannello neutro con un margine che lascia visibile lo sfondo. Scegliendo una tinta unita o “Predefinito” si elimina l'immagine; “Annulla” conserva la scelta salvata.

Verifiche: persistenza e isolamento via API, rifiuto di URL esterni, selezione e annullamento, ripristino dei colori, caricamento degli otto asset, ricaricamento della pagina, cambio vista e axe nei due temi. Selettore verificato anche su mobile.
