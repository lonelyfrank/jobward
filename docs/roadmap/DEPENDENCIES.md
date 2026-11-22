# Dipendenze della roadmap funzionale

**Stato:** canonico · **Origine:** JW-CORE-01. Grafo delle dipendenze tra le voci della [Master Functional Roadmap](MASTER-FUNCTIONAL-ROADMAP.md). Le dipendenze interne all'iniziativa Smart Workspace (SW.x) restano di proprietà della roadmap SW nel ramo locale; qui sono riportate solo dove determinano l'ordine globale.

## Gate decisionali (bloccano lavoro, non codice)

| Gate                                            | Che cosa sblocca                            | Stato al 2026-11-21                                                     |
| ----------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| Integrazione del ramo SW in `main` (PR a fette) | A-01…A-04, D-03 e tutto ciò che ne dipende  | Non autorizzata; 19 commit locali mai pushati                           |
| SW.0b — stato reale di staging/D1               | ordine A-01 ↔ H-04, prima migrazione remota | Aperta; M4.1-A riporta **BLOCKED**                                      |
| SW.0c — specifica unica delle metriche          | E-01, E-02, D-10                            | Aperta                                                                  |
| SW.0a/D2 — confronto con i rami UI              | D-02, D-05 (file in comune)                 | Eseguito in sola lettura; D2 resta condizionata                         |
| Decisione sul percorso legacy `PATCH /cards`    | A-02                                        | Da prendere (proposta in [IMPLEMENTATION-PLAN](IMPLEMENTATION-PLAN.md)) |
| Scope policy (nuova decisione)                  | B-06, C-06, C-07, tutto lo Stream F e G     | Nessuna decisione: fuori roadmap                                        |

## Grafo

```text
                     ┌──────────── D-03 motore di query ─────────────┐
                     │                │              │               │
                     ▼                ▼              ▼               ▼
SW.6 ──► A-01 ──► A-04 ──► C-02   B-03 filtri    D-04 viste ──► D-09 Smart Boards
          │  │      │      C-03   B-01 Inbox ◄── A-01           D-10 dashboard ◄── E-01
          │  │      ▼                 │
          │  │    A-06 cleanup        ▼
          │  └──► A-03 eventi ──► A-05 audit ──► F-02 ──► F-01 ──► F-03
          │           │                │
          │           ▼                ▼
          │         E-02 funnel      F-04 automazioni (con C-06)
          ▼
   B-02 campi ──► B-04 wizard        B-05 aziende ──► C-05 contatti
          │                          B-05 ──► B-06 import
          ▼
   D-07 mappa ──► E-03 confronti     B-07 matrice ──► C-08 offerte
A-02 transizioni ──► C-01 bacheca canonica ──► C-09 workflow configurabili
H-04 staging ──► H-03 Access ──► M4-C5 beta privata
H-05 export (formato dipende da A-01)      H-02 + H-05 + H-08 ──► H-07 multiutenza ──► G-01 ──► G-02 ──► G-03
```

## Percorso critico verso il prodotto ideale

1. **Dominio:** SW.6 (piano approvato) → A-01 → A-04 → C-02/C-03 → B-01 (Opportunity Center). È lo stesso percorso critico della roadmap SW (SW.1 → SW.3 → SW.6 → SW.10 → SW.11 → SW.12 → SW.13 → SW.14).
2. **Viste:** D-03 → B-03 / D-04 → D-09 → D-10.
3. **Rilascio privato (M4):** H-04 → H-03 → M4-C5, con E-01 e H-05 come impegni di contenuto.

## Tensioni di ordinamento da decidere

| Tensione                         | Opzione 1                                               | Opzione 2                                                        | Raccomandazione                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 prima o dopo H-04 (staging) | Dominio nuovo prima di qualunque dato reale remoto (D3) | Staging subito con lo schema attuale, migrazione di dominio dopo | Opzione 1 se il ramo SW può essere integrato in tempi brevi: evita una migrazione con ricostruzione su dati reali remoti. Decisione del proprietario (SW.0b). |
| E-01 (M4-C1) prima o dopo A-01   | Insights per scheda subito                              | Insights per candidatura dopo A-01                               | Scrivere **prima** la specifica unica (SW.0c), implementare dopo A-01 o progettare le query per non dipendere dalla scheda.                                   |
| H-05 export prima o dopo A-01    | Formato sullo schema attuale                            | Formato sul dominio nuovo                                        | Formato versionato e indipendente dalle tabelle, con sezione `applications` facoltativa.                                                                      |

## Regola

Una nuova voce o dipendenza si registra qui e nella voce della roadmap. Le dipendenze SW.x si modificano solo nella roadmap SW.
