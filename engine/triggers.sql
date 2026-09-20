-- ============================================================================
-- triggers.sql — the ledger's `events_digest_chain` trigger, standalone.
--
-- schema.sql carries this trigger inline as part of the v1 create transaction;
-- this file exists for migrateLedger's backfill path: a ledger already at
-- LEDGER_VERSION=1 can predate the trigger (it was added to the DDL without a
-- version bump), so the backfill installs it alone, guarded by IF NOT EXISTS.
-- It must stay byte-equivalent to the trigger inside schema.sql.
--
-- WHY THE TABLE ENFORCES THE CHAIN (not the writers): an events writer can omit
-- or miscompute the sha256 link, so `digest` defaults to '' — never tripping
-- NOT NULL — and this AFTER INSERT trigger recomputes prev_digest/digest from
-- the workflow's own history regardless of what was supplied, via the
-- registered SQL function `starci_sha256` (engine/ledger-db.mjs
-- registerDigestFunction; mirrors the module's digestOf exactly).
-- ============================================================================
CREATE TRIGGER IF NOT EXISTS events_digest_chain AFTER INSERT ON events BEGIN
    UPDATE events SET
      prev_digest=(SELECT digest FROM events WHERE workflow_id=NEW.workflow_id AND seq<NEW.seq ORDER BY seq DESC LIMIT 1),
      digest=starci_sha256(COALESCE((SELECT digest FROM events WHERE workflow_id=NEW.workflow_id AND seq<NEW.seq ORDER BY seq DESC LIMIT 1),'')||NEW.event_id||NEW.kind||COALESCE(NEW.payload_json,'')||NEW.created_at)
    WHERE seq=NEW.seq;
  END;
