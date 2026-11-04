# User stories

Come **candidato**, voglio…

| #     | Storia                                                                | Milestone                   | Stato                            |
| ----- | --------------------------------------------------------------------- | --------------------------- | -------------------------------- |
| US-01 | creare una bacheca per raccogliere opportunità di lavoro              | M1                          | ⏳                               |
| US-02 | modificare le colonne per adattarle al mio processo                   | M1                          | ⏳                               |
| US-03 | aggiungere un'offerta velocemente, senza un modulo lungo              | M1                          | ⏳                               |
| US-04 | conservare le informazioni importanti sull'offerta                    | M2                          | ⏳                               |
| US-05 | sapere quando ho inviato una candidatura e quali risposte ho ricevuto | M2–M3                       | ⏳                               |
| US-06 | ricordarmi di ricontattare un'azienda                                 | M3                          | ⏳                               |
| US-07 | filtrare le opportunità per caratteristiche importanti                | M2                          | ⏳                               |
| US-08 | avere una panoramica comprensibile della mia ricerca                  | M0 (base), M4 (statistiche) | ✅ base: Overview con dati reali |
| US-09 | esportare i miei dati                                                 | M4                          | ⏳                               |
| US-10 | che i miei dati siano privati e accessibili solo a me                 | M0                          | ✅                               |
| US-11 | cambiare tema e usare l'app comodamente da telefono                   | M0                          | ✅                               |

## Criteri di accettazione (M0)

- **US-08**: con workspace vuoto l'Overview mostra zeri e passi successivi, senza dati inventati; con dati mostra i numeri reali, le scadenze nel fuso del workspace e le bacheche recenti. _(componenti + E2E)_
- **US-10**: senza identità valida l'API risponde 401; un altro utente riceve 403/404; nessun segreto nel frontend. _(auth/ownership tests)_
- **US-11**: tema persistente al refresh; sotto 768 px la navigazione è un drawer, senza scroll orizzontale, con target ≥ 44 px. _(E2E)_
