-- 0002 — Correzione del trigger activity_events_tenant_update (scoperta in M1.1).
--
-- PROBLEMA. Il trigger di 0001 ricontrollava TUTTI i riferimenti (scheda, bacheca, autore) a
-- ogni UPDATE di quelle colonne. Eliminando una bacheca, il motore esegue prima la CASCADE
-- che rimuove le schede e poi la FK `ON DELETE SET NULL` di activity_events.board_id, che è un
-- UPDATE della riga: in quel momento card_id punta a una scheda già eliminata, quindi il trigger
-- abortiva e la bacheca non poteva essere eliminata se aveva eventi (ogni scheda ne ha uno).
--
-- CORREZIONE. Il trigger valida solo i riferimenti che CAMBIANO (o tutti, se cambia il
-- workspace). Un riferimento che resta invariato, o che viene azzerato dalle FK, non viene
-- ricontrollato; un riferimento nuovo verso un'altra risorsa o un altro workspace è ancora rifiutato.
-- (L'INSERT resta invariato: lì ogni riferimento è nuovo.)

DROP TRIGGER `activity_events_tenant_update`;--> statement-breakpoint
CREATE TRIGGER `activity_events_tenant_update` BEFORE UPDATE OF `workspace_id`, `board_id`, `card_id`, `actor_user_id` ON `activity_events`
WHEN (NEW.card_id IS NOT NULL AND (NEW.card_id IS NOT OLD.card_id OR NEW.workspace_id IS NOT OLD.workspace_id)
      AND NOT EXISTS (SELECT 1 FROM `cards` WHERE `id` = NEW.card_id AND `workspace_id` = NEW.workspace_id))
  OR (NEW.board_id IS NOT NULL AND (NEW.board_id IS NOT OLD.board_id OR NEW.workspace_id IS NOT OLD.workspace_id)
      AND NOT EXISTS (SELECT 1 FROM `boards` WHERE `id` = NEW.board_id AND `workspace_id` = NEW.workspace_id))
  OR (NEW.actor_user_id IS NOT NULL AND (NEW.actor_user_id IS NOT OLD.actor_user_id OR NEW.workspace_id IS NOT OLD.workspace_id)
      AND NOT EXISTS (SELECT 1 FROM `workspace_members` WHERE `workspace_id` = NEW.workspace_id AND `user_id` = NEW.actor_user_id))
BEGIN
  SELECT RAISE(ABORT, 'activity_events: riferimento a una risorsa di un altro workspace');
END;
