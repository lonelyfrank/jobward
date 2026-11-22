/**
 * Testo di conferma dell'eliminazione di una bacheca (M5-SW.10-a, ADR-0016). Unica fonte per l'elenco
 * delle bacheche e per la bacheca aperta, così le due schermate non possono divergere.
 *
 * Cosa succede davvero (`deleteBoard`, un solo batch atomico): le opportunità NON vengono eliminate, restano
 * senza bacheca con tutto ciò che le riguarda; spariscono la bacheca, le sue colonne e i suoi campi
 * personalizzati con i valori inseriti nelle schede.
 */
export function DeleteBoardDescription({ columnCount }: { columnCount: number }) {
  return (
    <>
      <p>
        La bacheca e le sue {columnCount} colonne saranno eliminate definitivamente. Le opportunità
        che contiene, anche quelle archiviate, <strong>non vengono eliminate</strong>: restano in
        Opportunità, senza bacheca, con candidature, colloqui, note, documenti e cronologia.
      </p>
      <p className="font-medium text-foreground">
        I campi personalizzati di questa bacheca e i valori inseriti nelle sue schede saranno
        eliminati definitivamente.
      </p>
      <p className="font-medium text-foreground">Questa azione non si può annullare.</p>
    </>
  );
}
