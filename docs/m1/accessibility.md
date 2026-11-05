# M1 — Accessibilità

Verifica automatica con axe (WCAG 2.0/2.1/2.2 A–AA) + prove con tastiera su stack reale. **Non** sostituisce un audit con screen reader (M4).

## Cosa è stato fatto

| Area                  | Intervento                                                                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trascinamento         | **Alternativa completa senza trascinare** (menu e selettore). Tastiera tramite maniglie (pulsanti reali con nome accessibile). Istruzioni e **annunci in italiano** per screen reader ("Hai preso…", "…è ora sopra…", "…rilasciata in…", "…annullato") |
| Tastiera nella scheda | Il titolo è un **link** (Invio apre il dettaglio); Spazio/Invio sulla maniglia solleva la scheda. Il puntatore trascina da tutta la scheda, la tastiera solo dalla maniglia, per non confondere i due usi                                              |
| Finestre              | Radix `Dialog`/`AlertDialog`: focus trap, Esc, ruoli e titoli. La conferma di eliminazione mette il focus su **Annulla**; Esc non conferma mai                                                                                                         |
| Focus                 | Pannello di dettaglio → alla chiusura il focus torna alla scheda; creazione rapida → Esc riporta il focus sul pulsante; dopo ogni inserimento il campo resta focalizzato                                                                               |
| Menu                  | Non modali (nessun `aria-hidden` su tutta l'app); voci piatte (niente sottomenu); voci non disponibili con `aria-disabled`                                                                                                                             |
| Colore                | Mai unica informazione: priorità e stato in testo ("Priorità alta"), colori con nome ("Blu") nel selettore; 8 token `accent-*` verificati **≥ 3:1** su sfondo e superficie in chiaro e scuro (`pnpm check:contrast`, ora 70 coppie)                    |
| Form                  | Etichetta sempre presente; errori con `role="alert"` e `aria-invalid`; "Salva" disattivato senza modifiche                                                                                                                                             |
| Avvisi                | Regione viva: errori `role="alert"` (restano finché non chiusi), successi `role="status"` (4–8 s); azioni "Annulla"/"Apri" raggiungibili da tastiera                                                                                                   |
| Touch                 | Target ≥ 44 px a telefono (pulsanti, maniglie, menu, selettore colore); verificato anche per i controlli nuovi                                                                                                                                         |
| Movimento             | Animazioni brevi; `prefers-reduced-motion` già rispettato dal design system                                                                                                                                                                            |
| Pagina                | Nessuno scroll orizzontale del documento a 390/768/1024/1360 px: scorre solo la bacheca. (Difetto reale M1-07: gli elementi `sr-only` allargavano la pagina)                                                                                           |

## Verifiche eseguite (E2E, Chromium)

axe senza violazioni su: galleria vuota · dialogo "Nuova bacheca" · bacheca appena creata · galleria con dati · pannello di dettaglio ·
elenco archiviate · dialogo di eliminazione colonna · overview → dettaglio · **bacheca a 390, 768, 1024, 1360 px** · dettaglio a 390 px.
Prove di tastiera: trascinamento con Spazio/frecce/Spazio, annullamento con Esc, Invio sul titolo, menu aperto e voce attivata da tastiera, creazione rapida in serie.

## Non verificato

- **Screen reader reali** (NVDA, VoiceOver, TalkBack): gli annunci sono presenti nella live region, non ascoltati.
- **Trascinamento da tastiera tra colonne diverse**: provato solo nella stessa colonna; tra colonne il percorso verificato è il menu "Sposta in".
- **Touch reale su iOS/Android**: la pressione prolungata è provata con eventi touch reali di Chromium (CDP), non su dispositivi.
- Firefox e WebKit; zoom 200 %/400 % e riflusso; modalità contrasto forzato; criteri WCAG non automatizzabili (es. 2.4.11, 3.3.x applicati caso per caso).
