# ADR-0010 — Campi personalizzati: modello conservativo

**Stato:** Accettato · **Data:** 2026-11-05 · **Integra:** ADR-0007

## Contesto

Le tabelle `custom_field_definitions` e `custom_field_values` esistevano dal M0 (con trigger che impediscono valori di un campo di un'altra bacheca). M2 le espone all'utente: i campi sono la parte distintiva del prodotto e devono funzionare per qualsiasi settore senza mai perdere dati.

## Decisioni

1. **Tipo immutabile** dopo la creazione. Nessuna conversione silenziosa (testo→numero perde informazioni); per cambiarlo si crea un nuovo campo.
2. **Configurazione modificabile solo se tutti i valori salvati restano validi.** Controllo generico (rivalida ogni valore con `valueSchemaFor` sulla nuova definizione), non regole per tipo; scrittura condizionata a «nessun valore cambiato dopo la lettura» per chiudere la finestra di concorrenza. Violazione → 409 con il numero di schede.
3. **Disattivare ≠ eliminare.** Disattivare nasconde e conserva; eliminare è un'azione distinta che con valori richiede `deleteValues: true` (e conferma esplicita nell'interfaccia).
4. **ID stabili per le opzioni**, assegnati dal server; i valori salvano ID, non etichette. Rinominare non invalida nulla.
5. **Valori in JSON con rivalidazione in lettura**: «è JSON» non basta come validazione. `null` persistito = svuotato; riga assente = mai compilato.
6. **Scrittura del valore atomica e vincolata** a scheda, campo, workspace, bacheca, campo attivo e versione della definizione, nello stesso `INSERT … SELECT`. Servizio, SQL e trigger sono tre difese indipendenti (ognuna provata).
7. **Configurazioni `strict`**: chiavi non previste per il tipo → 400.
8. **Nessun filtro sui campi personalizzati in M2**: richiederebbe join su JSON o colonne tipizzate (decisione per M3+ su dati reali).

## Alternative scartate

- **Conversione guidata dei tipi:** richiede anteprima e migrazione dei valori; non necessaria nell'uso iniziale.
- **Tabella tipizzata per valore (colonne per tipo):** ottimizza i filtri ma complica integrità e migrazioni; i filtri non sono in M2.
- **Eliminare in cascata senza avviso:** perdita di dati.
