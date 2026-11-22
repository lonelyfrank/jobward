# Integrazioni e automazioni

**Stato:** canonico (solo visione e vincoli) · **Origine:** JW-CORE-01. Obiettivo: [PRODUCT-VISION §10](../product/PRODUCT-VISION.md#10-estensibilità-visione-a-lungo-termine).

## Ambito

API pubbliche, import strutturato, collegamento ad assistenti AI (MCP), automazioni, notifiche, sincronizzazioni.

## Stato attuale

**Nessuna integrazione esiste.** L'API è privata (un solo utente dietro Cloudflare Access), senza token, rate limiting né registro dell'origine delle modifiche. Basi riutilizzabili: contratti Zod condivisi e validati in ingresso e in uscita, idempotenza per id client e impronta, errori standardizzati, tenancy verificata in un solo punto ([API-CONTRACTS](../architecture/API-CONTRACTS.md)).

## Stato decisionale

Tutto lo Stream F della [roadmap](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md#stream-f--integrations--automation) è **P3 e non approvato**:

- funzioni AI/LLM (incluso un server MCP per ChatGPT/Claude): **fuori dalla roadmap corrente** per la [scope policy](../roadmap/scope-policy.md);
- notifiche, integrazioni email/calendario, acquisizione assistita delle offerte: **candidate nel backlog**, non approvate;
- già esclusi dai requisiti originari: scraping, connessione obbligatoria a LinkedIn, invio automatico di candidature ([requirements](../product/requirements.md#fuori-ambito-vincoli)).

## Requisiti minimi per qualsiasi integrazione futura

1. Decisione esplicita del proprietario e specifica approvata.
2. Nessuna piattaforma esterna si presume accessibile: solo API documentate e consentite dai termini d'uso.
3. Token con ambiti minimi, revocabili, legati al workspace ([SECURITY](../architecture/SECURITY.md#requisiti-per-estensioni-future)).
4. Origine registrata per ogni modifica (A-05); nessuna modifica silenziosa dello stato: l'assistente o l'automazione **propone**, l'utente **conferma**.
5. Limiti di frequenza (H-02) e costi misurati (H-08).
6. Test senza rete esterna (fixture statiche).
7. Disattivabile senza perdita o corruzione dei dati del prodotto personale ([CORE §4.8](../product/CORE.md#48-extensibility)).

## Voci di roadmap

B-06 import strutturato · F-01 API pubblica · F-02 token e audit · F-03 MCP · F-04 automazioni · F-05 calendario esterno · F-06 import da email e servizi esterni.
