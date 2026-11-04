# M0.H — Audit del frontend

Schermate esaminate: Onboarding, Overview, Bacheche (+ segnaposto bacheca), Opportunità/Attività/Insights (stati vuoti), Impostazioni, 404, schermate di errore/accesso negato. Metodo: lettura del codice, misure in browser reale (Playwright/Chromium), screenshot ispezionati a occhio, axe, test di tastiera, correzione, test di regressione con verifica che **falliscano sul bug originale**.

## D1. Responsive — 320 · 390 · 768 · 1024 · 1360 px

Su **tutte** le schermate (7 percorsi) e a ogni larghezza il test E2E verifica: nessuno scroll orizzontale, nessun controllo interattivo fuori dal viewport, sidebar visibile e hamburger nascosto da 768 px in su (e viceversa sotto).

| Larghezza | Layout                                                                     | Esito                                           |
| --------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| 320       | Mobile (reflow WCAG 1.4.10 ≈ zoom 400%)                                    | ✅ nessun overflow                              |
| 390       | Mobile, drawer                                                             | ✅                                              |
| 768       | **Tablet = layout desktop** con sidebar da 256 px (contenuto utile 512 px) | ✅ (corretta la scheda statistica orfana, H-17) |
| 1024      | Desktop stretto                                                            | ✅ (corrette icone schiacciate, H-17)           |
| 1360      | Desktop                                                                    | ✅                                              |

| Verifica                                                      | Esito     | Nota                                                        |
| ------------------------------------------------------------- | --------- | ----------------------------------------------------------- |
| Touch target ≥ 44×44 px sotto 768 px (esclusi link nel testo) | ✅ (H-14) | "Nuova scheda" era 36 px                                    |
| Drawer che resta aperto passando a desktop                    | ✅ (H-11) | Prima: pagina **non cliccabile**                            |
| Tipografia, spaziatura, tabelle/griglie                       | ✅        | Ispezione screenshot a 768/1024/1360. Nessuna tabella in M0 |
| Scorrimento                                                   | ✅        | Un solo contenitore scrollabile (`main`); body non scorre   |
| Stati vuoti                                                   | ✅        |                                                             |

**Decisione di design:** il "tablet" non ha un layout dedicato: da 768 px la sidebar è persistente. È coerente con la specifica (_sidebar collassabile_: lo è) e regge a 768 px; da rivalutare in M1 con il Kanban.

## D2. Accessibilità

| Area                | Verifica                                                                                                                | Esito    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| Tastiera            | Primo Tab → skip link visibile; Invio → focus su `main`                                                                 | ✅       |
| Indicatore di focus | Ogni controllo raggiungibile con Tab (≥ 8 distinti) ha outline ≥ 2 px o ombra                                           | ✅       |
| Focus management    | Focus su `main` a ogni **navigazione**, non al caricamento (H-16: in sviluppo StrictMode lo spostava)                   | ✅       |
| Drawer (Dialog)     | Focus intrappolato (12 Tab), Esc chiude, **focus restituito al pulsante** (H-12)                                        | ✅       |
| Menu account        | Si apre da tastiera, focus sulla prima voce, frecce, Esc chiude e restituisce il focus; **axe pulito** (H-15)           | ✅       |
| Form                | Etichette associate, `aria-invalid`, errore con `role="alert"` e descrizione accessibile, **focus sul campo in errore** | ✅       |
| Messaggi d'errore   | Errore del riepilogo, accesso negato (401), server irraggiungibile: annunciati, axe pulito, recuperabili                | ✅       |
| Semantica           | Landmark `banner/navigation/main/search`, gerarchia dei titoli, `aria-current`, `lang="it"`, titolo documento           | ✅ (axe) |
| Contrasti           | 38 coppie calcolate (chiaro/scuro) + axe su tutte le schermate in entrambi i temi                                       | ✅       |
| Movimento ridotto   | Con `prefers-reduced-motion` animazioni e transizioni ≈ 0,01 ms                                                         | ✅       |
| Reflow 320 px       | Nessun overflow orizzontale                                                                                             | ✅       |

**Non verificato — dichiarato esplicitamente** (R-08):

- **Screen reader reali** (NVDA, JAWS, VoiceOver, TalkBack): nessuna prova. Strumenti automatici e test di tastiera **non dimostrano** la conformità WCAG.
- Firefox e WebKit/Safari (un solo browser: Chromium). Nota: Safari non dà il focus ai pulsanti al click, quindi il ritorno del focus al pulsante del drawer va riprovato lì.
- Modalità ad alto contrasto del sistema, zoom reale del browser, testo ingrandito (WCAG 1.4.4/1.4.12), dispositivi touch reali.
- Criteri WCAG 2.2 AA applicabili elencati e verificati **uno per uno**: non fatto (è previsto per M4).

## D3. Coerenza UX

| Controllo                     | Esito | Note                                                                                                                                                     |
| ----------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spazi e gerarchia tipografica | ✅    | Scale coerenti (titolo `xl`, corpo `sm`, secondario `xs`)                                                                                                |
| Hover/focus                   | ✅    | Focus globale; hover su pulsanti, voci di menu e righe                                                                                                   |
| Loading                       | ✅    | Skeleton con `role="status"` (gate, Overview, onboarding a richiesta)                                                                                    |
| Error                         | ✅    | Con "Riprova"; per il server irraggiungibile ora suggerisce di ricaricare (sessione scaduta, H-22 da confermare dal vivo)                                |
| Empty states                  | ✅    | Dichiarano la milestone; nessun dato fittizio                                                                                                            |
| Tema chiaro/scuro             | ✅    | **Stato del tema unico** (H-13: prima menu e Impostazioni si disallineavano)                                                                             |
| Pulsanti senza azione         | ✅    | Tutti disabilitati con motivo accessibile (`PlannedAction`, "Nuova scheda", ricerca) — verificato che nessun pulsante attivo compaia nelle pagine future |
| Componenti inutilizzati       | 🟡    | `Button variant="danger"` e `DropdownMenuSeparator` non ancora usati: servono a M1. Nessun altro                                                         |
| Richieste duplicate           | ✅    | Overview: 1 `GET /me` e 1 `GET /overview` (sidebar e pagina condividono la query)                                                                        |

## Limite metodologico

I giudizi visivi (aspetto a 768/1024) sono miei, su screenshot: non sostituiscono una revisione di design. Le misure (overflow, target, icone, focus) sono invece automatiche e ripetibili.
