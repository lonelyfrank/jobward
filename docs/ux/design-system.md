# Design system

> Decisioni: [ADR-0005](../architecture/decisions/0005-design-system-and-ui.md). Sorgente dei token: [`apps/web/src/styles/index.css`](../../apps/web/src/styles/index.css).

**Direzione**: _minimale, luminosa, operativa._ Superfici bianche su fondo lavanda, un solo indaco per l'azione, badge
morbidi per lo stato, bordi discreti, animazioni brevi (≤ 180 ms) e disattivate con `prefers-reduced-motion`.
Niente glassmorphism, gradienti decorativi o grafiche ingombranti. Origine: board «Jobward · UI Guidelines & Screens»
([ADR-0015](../architecture/decisions/0015-ui-restyle-indaco.md)).

## Token semantici

| Token                                                                           | Uso                                                    |
| ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `background`, `surface`, `surface-muted`, `sidebar`                             | Sfondi: pagina, carte, aree secondarie, barra laterale |
| `foreground`, `muted-foreground`                                                | Testo principale e secondario                          |
| `border` / `border-strong`                                                      | Bordi decorativi / **bordi dei controlli** (≥ 3:1)     |
| `primary`, `primary-hover`, `primary-foreground`, `primary-soft(-foreground)`   | Azione principale, stato attivo, evidenze              |
| `danger`, `danger-soft`                                                         | Urgenza, errori, azioni distruttive                    |
| `warning-soft(-foreground)`                                                     | Badge "In arrivo", fase «In contatto», priorità alta   |
| `success-soft(-foreground)`, `info-soft(-foreground)`, `teal-soft(-foreground)` | Badge di fase (Colloquio, In preparazione, Offerta)    |
| `hover-soft`                                                                    | Hover di voci di navigazione e controlli secondari     |
| `ring`                                                                          | Anello di focus                                        |

Tema chiaro e scuro ridefiniscono gli stessi nomi. Colori scelti dall'utente (bacheche, etichette) sono **token** (`slate`, `blue`, …) validati da Zod, mai CSS arbitrario.

## Contrasto (calcolato)

`pnpm check:contrast` verifica 80 coppie (40 per tema): testo ≥ 4.5:1; focus ring e bordi dei controlli ≥ 3:1. Minimi attuali (chiaro / scuro): testo secondario su `surface-muted` 5.23 / 6.95; bordo dei controlli 3.11 / 4.46; focus ring 6.88 / 7.50. Il `#8E92B2` del design (bordo dei controlli) dava 2.82:1 sul fondo lavanda: è stato scurito (≈`#8589AB`) per restare ≥ 3:1.

## Tipografia e spaziatura

Inter variabile (self-hosted). Titolo pagina 30/800; titolo sezione 17/700; numero chiave 32/700; corpo 14–15; meta-dati 13; etichette di campo 11/600 maiuscolo con interlettera. Forme: controlli e navigazione 12 px (`rounded-md`), card 16 px (`rounded-lg`), colonne e modali 20 px (`rounded-xl`), badge a pillola 26 px. Altezza dei controlli 44 px. Ritmo di spaziatura multiplo di 4 px; sidebar 220 px, topbar 86 px, margini del contenuto 44 px, contenuto max 80 rem.

## Componenti (`apps/web/src/components`)

La sidebar desktop passa da 220 a 52 px con il [collapse e bulge derivati da Sensei](sidebar.md).
La transizione di larghezza dura 200 ms; su mobile resta il drawer di navigazione.

| Componente                         | Note                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `Button`                           | Varianti `primary/secondary/ghost/danger`, taglie `sm/md/icon`; ≥ 44 px su mobile |
| `Input`, `Select`, `Field`         | Etichetta sempre presente; errore con `role="alert"` e `aria-invalid`             |
| `Badge`                            | Toni `neutral/primary/warning/danger`                                             |
| `Surface`, `PageHeader`            | Struttura delle pagine                                                            |
| `EmptyState`                       | Icona, titolo, descrizione e, se serve, milestone prevista                        |
| `PlannedAction`                    | Pulsante disabilitato **con motivo accessibile** per funzioni future              |
| `Skeleton`                         | Caricamento discreto, nascosto agli screen reader                                 |
| `Sheet`, `DropdownMenu`, `Tooltip` | Basati su Radix: focus trap, tastiera, ARIA                                       |
| `LogoMark`, `Wordmark`             | Marchio a ruota a spicchi                                                         |

## Accessibilità implementata

Skip link · landmark (`banner`, `navigation`, `main`, `search`) · `aria-current` sulla voce attiva · focus su `main` a ogni
navigazione · titolo documento per vista · focus visibile globale · errori annunciati · tema e movimento rispettano le preferenze
di sistema. Verifica automatica: axe (WCAG 2.0/2.1/2.2 A–AA) su tutte le schermate in chiaro e scuro. **Non ancora fatto**:
audit manuale con screen reader e verifica criteri applicabili uno a uno (M4).
