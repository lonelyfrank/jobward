# ADR-0015 — Restyle UI: palette indaco e forme del design «Jobward · UI Guidelines»

**Stato:** accettata · **Data:** 2026-11-05

## Contesto

Il frontend usava token verdi su neutri caldi (ADR-0005). Il proprietario ha fornito una board di design (linee guida +
schermate desktop e mobile) con palette indaco su fondo lavanda, forme più morbide e badge di stato a pillola.

## Decisione

- Cambiano **solo i valori** dei token semantici in `styles/index.css` e le classi dei componenti di base
  (`Button`, `Badge`, `Input`, `Tabs`, `Dialog`, `PageHeader`, `Field`, menu) e della struttura (sidebar 220 px, topbar 86 px
  con percorso «Workspace / Vista», margini 44 px). I nomi dei token non cambiano: nessun colore letterale nei componenti.
- I raggi di Tailwind sono ridefiniti una volta sola (`--radius-md` 12 px, `--radius-lg` 16 px, `--radius-xl` 20 px) per
  ottenere controlli, card e colonne/modali del design senza toccare ogni utilizzo.
- Nuovi token per i badge di fase: `success-soft`, `info-soft`, `teal-soft` (+ foreground) e `hover-soft`. Il tono di ogni fase è
  in `STAGE_TONE` (`lib/labels.ts`) e vale per Kanban, tabella e pannello. Il testo del badge c'è sempre: il colore non è l'unico segnale.
- Il tema scuro **non è nel design**: è derivato dagli stessi ruoli (indaco chiaro come primario, superfici blu notte) e validato da
  `check:contrast` e dagli E2E con axe.
- Il bordo dei controlli resta ≥ 3:1 (regola di ADR-0005): il valore del design (`#8E92B2`) è stato scurito di poco.
- I colori scelti dall'utente per bacheche e colonne restano token validati. Nel Kanban la barra colorata in cima alla colonna
  diventa un punto accanto al nome, perché il design non prevede barre colorate.
- **Logo in tema scuro**: si usa `jobward-light.png` (865 × 289, trasparente, scritta chiara) senza targa bianca, per wordmark e simbolo compatto. Sostituisce la targa su `jobward-white.png` descritta in [ADR-0014](0014-jobward-technical-rebranding.md). Il tema chiaro e la favicon restano invariati.

## Non incluso (volutamente)

- Etichette di navigazione del design («Panoramica», «Statistiche»): restano «Overview» e «Insights», usate da test e documentazione.
- Tab bar mobile in basso: resta il drawer del menu (flusso già coperto dagli E2E).
- Elementi del design senza funzione dietro (campanella notifiche, dati di esempio): non aggiunti. Le funzioni non ancora attive restano dichiarate «In arrivo».
