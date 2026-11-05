# M2 — Revisione UX e accessibilità

Verifica dei principi del prodotto rispetto a ciò che è **realmente** implementato.

## Principi

| Principio                                               | Esito | Come                                                                                                                                            |
| ------------------------------------------------------- | :---: | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Creare una scheda richiede solo il titolo               |  ✅   | Invariato (creazione rapida); tutti i dettagli sono facoltativi (test API e E2E)                                                                |
| I dettagli avanzati sono facoltativi e **progressivi**  |  ✅   | Pannello a sezioni: Panoramica aperta; Opportunità, Candidatura e Campi personalizzati **chiuse se vuote**, si aprono da sole con dati o errori |
| La personalizzazione non compromette la semplicità      |  ✅   | I campi personalizzati sono in un configuratore separato (menu «Azioni bacheca»); senza campi la sezione dice come crearli, non occupa spazio   |
| Kanban e Tabella mostrano gli stessi dati               |  ✅   | Stessa fonte, invalidazione incrociata delle cache; E2E n. 7–8 di `search.spec.ts`                                                              |
| Le statistiche usano informazioni semantiche reali      |  ✅   | Fase/data/esito, mai il nome della colonna (ADR-0009)                                                                                           |
| Le impostazioni non alterano silenziosamente i dati     |  ✅   | Lo spostamento non cambia fase/esito; il suggerimento di fase è un'azione esplicita; disattivare un campo non cancella i valori                 |
| Funziona da desktop e mobile                            |  ✅   | Pannello a schermo intero a 390 px; tabella → elenco compatto; configuratore e filtri senza scroll orizzontale (E2E a 390/768 px)               |
| Nessuna funzione dimostrativa presentata come operativa |  ✅   | La ricerca «in arrivo» è ora reale; restano dichiarate solo M3/M4 (Attività, Insights)                                                          |

## Decisioni di interazione

- **Salvataggio:** un solo «Salva» esplicito per dettagli + campi personalizzati (coerente con M1), che invia **solo ciò che è cambiato** e mostra «Modifiche non salvate» / «Salvataggio…». Un errore del server non cancella la bozza: l'utente vede il motivo accanto al campo e può riprovare o «Annulla modifiche». Azioni discrete (colonna, etichette, archiviazione) sono **immediate**.
- **Validazione inline** con gli stessi messaggi del server (contratti Zod condivisi); la sezione con un errore si apre da sola.
- **Etichette e campi vuoti:** testo esplicito («Non indicato», «Nessuna etichetta.»), non spazi vuoti.
- **Riordino dei campi e delle opzioni** con frecce su/giù (alternativa accessibile al trascinamento), come nel menu del Kanban.
- **Eliminazioni:** sempre `AlertDialog` con il numero di schede coinvolte; per i campi si suggerisce «Disattiva».
- **Filtri:** gruppi di caselle di controllo con legenda; contrassegni rimovibili dei filtri attivi; «Cancella filtri»; contatore dei filtri sul pulsante; ambito sempre scritto.

## Accessibilità (WCAG 2.2 AA)

Verifiche **automatiche** con axe (tag `wcag2a/aa`, `wcag21a/aa`, `wcag22aa`) su ogni schermata nuova, **temi chiaro e scuro**, e a 390/768 px: pannello (sezioni chiuse/aperte/con errori/con campi/con etichette), configuratore (vuoto, con campi, modulo, 390 px), Impostazioni con etichette, Tabella (ordinata, filtri aperti, nessun risultato, errore, 768 px, scuro), Opportunità (390 px con filtri). **Zero violazioni.**

| Area              | Misura                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tabella           | `caption` che riassume l'ordine; `th scope`; titolo come intestazione di riga; `aria-sort`; area che scorre focalizzabile; contatore `role=status` |
| Form dinamici     | etichette `label`/`legend`; errori `role=alert` collegati con `aria-describedby` e `aria-invalid`; scelta multipla come `fieldset`                 |
| Colore            | mai da solo: le etichette hanno il nome, il colore selezionato ha una spunta, le priorità hanno il testo                                           |
| Touch             | controlli ≥ 44 px sotto `md` (pulsanti, caselle, rimozione filtri)                                                                                 |
| Movimento ridotto | le animazioni rispettano `prefers-reduced-motion` (regola globale di M0)                                                                           |
| Focus             | il pannello riporta il focus al link di partenza (Kanban, Tabella o Opportunità); i dialoghi annidati usano Radix                                  |

### Non verificato (limiti dichiarati)

- **Nessuna prova con screen reader reali** (NVDA/JAWS/VoiceOver/TalkBack) né con browser Firefox/WebKit: solo Chromium e axe.
- Il comportamento dell'`<input type="date">` varia per browser/locale; la data è sempre `YYYY-MM-DD` nel valore.
- Nessuna navigazione a frecce tra le celle della tabella (non è una griglia modificabile).

## Revisione critica (cosa si potrebbe migliorare)

- Il pannello è lungo per schede ricche: è un compromesso consapevole (sezioni comprimibili) rispetto a schede/tab; da rivalutare con l'uso reale.
- Le modifiche dei campi personalizzati non compaiono nella cronologia (solo gli eventi semantici principali): scelta per tenere la cronologia leggibile.
- Nessun «annulla» dopo un'eliminazione definitiva di campo o etichetta: per questo la conferma elenca le conseguenze.
