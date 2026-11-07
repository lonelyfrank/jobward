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

Inter variabile (self-hosted). Titolo pagina 24/800; titolo sezione 17/700; numero chiave 32/700; corpo 14–15; meta-dati 13; etichette di campo 11/600 maiuscolo con interlettera. Forme: controlli e navigazione 12 px (`rounded-md`), card 16 px (`rounded-lg`), colonne e modali 20 px (`rounded-xl`), badge a pillola 26 px. Altezza dei controlli 44 px. Ritmo di spaziatura multiplo di 4 px; sidebar 220 px, topbar 86 px, margini laterali del contenuto 16 px su mobile, 24 px da `sm` e 32 px da `lg`, senza limite di larghezza massimo. Il contenuto parte a 20 px dall’alto; `WorkspacePageHeader` mantiene titolo, ricerca e azioni nella stessa posizione fra le viste, con descrizione compatta e toolbar a 8 px dalla testata.

## Componenti (`apps/web/src/components`)

La sidebar desktop passa da 220 px aderenti al lato a 60 px fluttuanti con il [collapse e bulge derivati da Sensei](sidebar.md).
La transizione fluttuante dura 300 ms; su mobile resta il drawer di navigazione.

| Componente                         | Note                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| `Button`                           | Varianti `primary/secondary/ghost/danger`, taglie `sm/md/icon`; ≥ 44 px su mobile     |
| `Input`, `Select`, `Field`         | Etichetta sempre presente; errore con `role="alert"` e `aria-invalid`                 |
| `Badge`                            | Toni `neutral/primary/warning/danger`                                                 |
| `Surface`, `PageHeader`            | Struttura delle pagine                                                                |
| `EmptyState`                       | Icona, titolo, descrizione e, se serve, milestone prevista                            |
| `PlannedAction`                    | Pulsante disabilitato **con motivo accessibile** per funzioni future                  |
| `Skeleton`                         | Caricamento discreto, nascosto agli screen reader                                     |
| `Sheet`, `DropdownMenu`, `Tooltip` | Basati su Radix: focus trap, tastiera, ARIA                                           |
| `LogoMark`, `Wordmark`             | Logo PNG originale nei due temi e doppio chevron compatto ricavato dagli stessi pixel |

## Superficie delle bacheche

Nella galleria, le card riprendono il colore della board nella testata. Nome e descrizione occupano fino a due righe, con un richiamo all’apertura sotto il titolo; il footer raccoglie conteggi, preferiti e menu. Il link del titolo estende la propria area alla card, mentre i pulsanti delle azioni restano indipendenti. Hover e focus rendono evidente l’interazione, rispettando il movimento ridotto.

Kanban e Tabella condividono una superficie delimitata con angoli da 20 px, bordo discreto e 12 px di distanza dall’intestazione. Su desktop i selettori Kanban/Tabella e Compatta/Informativa stanno nella stessa riga della ricerca, alla sua destra; sotto `lg` occupano una riga dedicata per restare accessibili senza comprimere il titolo. La board resta separata dalla sidebar e termina a 16 px dal fondo; lo scorrimento orizzontale è contenuto nella superficie. Il Kanban usa 12 px di padding e distanza fra le colonne; le colonne vuote non riservano spazio per schede assenti.

I due selettori condividono un indicatore che scorre fra le opzioni e ne segue la larghezza naturale in 250 ms, senza animazione iniziale. La transizione è disattivata con movimento ridotto; il cambio stato mantiene link, pulsanti e focus accessibili.

“Cambia il background di [nome bacheca]” nel menu delle azioni in alto a destra apre il selettore di otto paesaggi, otto tinte unite e del fondo predefinito. Il colore usa `Board.color`; l’immagine usa la proprietà indipendente `Board.backgroundImage`, validata su un catalogo chiuso di file locali. Selezionando un colore si rimuove l’immagine. La scelta si applica alla sola superficie della bacheca, in entrambe le viste. Le tinte sono miscelate con il fondo del tema (14% in chiaro, 28% in scuro); i contenitori delle colonne usano [Glass · Subtle](kanban-glass.md), adattato dal preset Jello, mentre le card e il pannello Tabella restano opachi. [File, origine e dettagli degli sfondi](board-backgrounds.md).

## Accessibilità implementata

Skip link · landmark (`banner`, `navigation`, `main`, `search`) · `aria-current` sulla voce attiva · focus su `main` a ogni
navigazione · titolo documento per vista · focus visibile globale · errori annunciati · tema e movimento rispettano le preferenze
di sistema. Verifica automatica: axe (WCAG 2.0/2.1/2.2 A–AA) su tutte le schermate in chiaro e scuro. **Non ancora fatto**:
audit manuale con screen reader e verifica criteri applicabili uno a uno (M4).
