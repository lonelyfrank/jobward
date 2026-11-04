# Design system

> Decisioni: [ADR-0005](../architecture/decisions/0005-design-system-and-ui.md). Sorgente dei token: [`apps/web/src/styles/index.css`](../../apps/web/src/styles/index.css).

**Direzione**: _minimal, functional, modern productivity software._ Densità e precisione, bordi discreti, animazioni
brevi (≤ 180 ms) e disattivate con `prefers-reduced-motion`. Niente glassmorphism, gradienti decorativi o grafiche ingombranti.

## Token semantici

| Token                                                                         | Uso                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| `background`, `surface`, `surface-muted`, `sidebar`                           | Sfondi: pagina, carte, aree secondarie, barra laterale |
| `foreground`, `muted-foreground`                                              | Testo principale e secondario                          |
| `border` / `border-strong`                                                    | Bordi decorativi / **bordi dei controlli** (≥ 3:1)     |
| `primary`, `primary-hover`, `primary-foreground`, `primary-soft(-foreground)` | Azione principale, stato attivo, evidenze              |
| `danger`, `danger-soft`                                                       | Urgenza, errori, azioni distruttive                    |
| `warning-soft(-foreground)`                                                   | Badge "In arrivo"                                      |
| `ring`                                                                        | Anello di focus                                        |

Tema chiaro e scuro ridefiniscono gli stessi nomi. Colori scelti dall'utente (bacheche, etichette) sono **token** (`slate`, `blue`, …) validati da Zod, mai CSS arbitrario.

## Contrasto (calcolato)

`pnpm check:contrast` verifica 38 coppie (19 per tema): testo ≥ 4.5:1; focus ring e bordi dei controlli ≥ 3:1. Minimi attuali (chiaro / scuro): testo secondario 5.66 / 6.72; bordo dei controlli 3.35 / 4.01; focus ring 4.27 / 8.23.

## Tipografia e spaziatura

Inter variabile (self-hosted). Titolo pagina `text-xl semibold`; corpo `text-sm`; etichette secondarie `text-xs`. Ritmo di spaziatura multiplo di 4 px; contenuto max 72 rem.

## Componenti (`apps/web/src/components`)

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
