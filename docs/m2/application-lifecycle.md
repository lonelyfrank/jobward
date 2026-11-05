# M2 — Informazioni dell'opportunità e ciclo della candidatura

## 1. Tre concetti distinti

| Concetto    | Che cos'è                                                          | Chi lo cambia                                              | Dove vive                     |
| ----------- | ------------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------- |
| **Colonna** | L'organizzazione personale della bacheca ("Da valutare", "Estero") | Trascinamento, menu "Sposta in", selettore del pannello    | `cards.column_id`             |
| **Fase**    | Il punto del percorso di candidatura (vocabolario strutturato)     | Solo l'utente, dal pannello (o dal suggerimento esplicito) | `application_details.stage`   |
| **Esito**   | Il risultato della candidatura                                     | Solo l'utente, dal pannello                                | `application_details.outcome` |

**Spostare una scheda non cambia mai fase né esito**, né lato client né lato server (test: `application-details.test.ts` «spostare … NON cambia mai fase né esito», E2E `details.spec.ts` n. 6).

### Suggerimento di fase (non distruttivo)

Se la colonna di arrivo dichiara una **categoria** (facoltativa, impostata in M1) diversa dalla fase della scheda, dopo che lo spostamento è **già concluso** compare una notifica:
«La colonna “X” corrisponde alla fase “Y”.» con l'azione **Imposta fase**. Regole:

- solo dopo un cambio di colonna, mai nello stesso passaggio dello spostamento (nessuna interferenza con la coda ottimistica);
- una sola notifica per raffica di spostamenti, nessuna conferma modale;
- nulla se la categoria coincide già con la fase o la colonna non ha categoria;
- l'esito non viene proposto né toccato;
- nel pannello, sotto Fase/Esito, lo stesso suggerimento è un pulsante **Usa questa fase** che compila il campo (si salva con «Salva»).

## 2. Dati professionali (tutti facoltativi)

| Gruppo         | Campi                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Identità       | titolo della scheda, `company`, `jobTitle` (colonna `position`), descrizione, `source`, `sourceUrl` |
| Localizzazione | `location`, `workMode` (in presenza / ibrido / da remoto)                                           |
| Contratto      | `contractType`, `salaryMin`, `salaryMax`, `currency`, `salaryPeriod`, `salaryBasis`                 |
| Cronologia     | `publishedOn`, `appliedOn` (date di calendario `YYYY-MM-DD`, senza fuso)                            |
| Stato          | `stage`, `outcome`                                                                                  |

Creare una scheda richiede solo titolo e colonna. Nel pannello le sezioni **Opportunità** e **Candidatura** partono chiuse se vuote (informazioni progressive) e si aprono da sole se contengono dati o un errore.

### Semantica della patch

`PATCH /cards/:id` invia **solo i campi cambiati**: assente = invariato, `null` = azzera. Il testo si rifila; la stringa vuota equivale a `null`. Chiavi sconosciute (anche `workspaceId`, `id`, `createdAt`, `labelIds`) → 400.

## 3. Retribuzione

- Importi **interi**, in **unità della valuta** (non centesimi), `0 ≤ importo ≤ 2·10⁹`. Nessuna conversione di valuta.
- `currency`: codice ISO 4217 a tre lettere maiuscole. **Un importo richiede la valuta** (verificato sullo stato risultante: indicare solo `salaryMin` è valido se la valuta è già salvata).
- `salaryMin ≤ salaryMax` se entrambi presenti; **un solo estremo è ammesso** ("da 1500", "fino a 2000"). Il database mantiene il `CHECK` come ultima difesa.
- `salaryPeriod`: ora, giorno, settimana, mese, anno — facoltativa. Una retribuzione «a ore» e una «annuale» **non si confrontano mai** (il filtro lo impone).
- `salaryBasis` (**nuovo, migrazione 0003**): `gross` / `net` / `NULL` = **non specificato**. L'interfaccia scrive «lordo» o «netto» **solo** se registrato; altrimenti non lo dice. Le righe esistenti ricevono `NULL`.
- Retribuzioni non numeriche («da concordare») non sono rappresentabili: si usano le note o un campo personalizzato di testo.

## 4. Cronologia (eventi)

Registrati nella stessa `batch()` atomica della modifica, **solo se il valore cambia davvero** e solo se la scrittura è avvenuta (guardia SQL):

| Evento                                                                             | Quando                                            | Metadati      |
| ---------------------------------------------------------------------------------- | ------------------------------------------------- | ------------- |
| `stage_changed`                                                                    | la fase cambia (anche rimossa)                    | `{from, to}`  |
| `application_submitted`                                                            | **prima** registrazione della data di candidatura | `{appliedOn}` |
| `application_closed`                                                               | l'esito diventa un valore diverso da «in attesa»  | `{outcome}`   |
| `priority_changed`, `card_moved`, `card_archived`, `card_restored`, `card_created` | come in M1                                        | —             |

Eventi più ricchi (attività, follow-up) restano in M3.

## 5. Statistiche dell'Overview

Solo schede **non archiviate**; una riga per scheda (join 1:1), nessuna doppia contabilizzazione.

| Contatore               | Definizione                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Opportunità             | schede attive                                                                                                     |
| **Candidature inviate** | `appliedOn` registrata **oppure** fase ∈ {Inviata, In contatto, Colloquio, Offerta}. «Conclusa» da sola non basta |
| **In colloquio**        | fase = Colloquio **e** esito assente o «in attesa» (un colloquio con esito «rifiutata» è concluso)                |

- Il **nome o la categoria della colonna non producono mai** colloqui né invii (test dedicato).
- Date o fasi mancanti: la scheda non è contata come inviata.
- Archiviate: escluse da tutto.
- Limite: una scheda «Conclusa» con esito «ritirata» senza data né fase di invio non è una candidatura inviata.
