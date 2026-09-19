-- ============================================================================
-- queries/inputs.sql — owner-named external inputs, frozen at goal time as
-- bytes. The bytes are the record; consumers bind by sha256 through
-- `ledger://inputs/<workflow_id>/<key>#sha256=<hex>`, never by path. A tampered
-- row refuses on read (`input-digest-mismatch`).
-- ============================================================================

-- source: ledger-db.mjs::openLedger.inputs.put — upsert keyed (workflow_id,key);
-- sha256/size are computed from the bytes at write time
INSERT INTO inputs(workflow_id,key,goal_revision,sha256,size,media_type,origin,bytes,created_at)
  VALUES(?,?,?,?,?,?,?,?,?)
  ON CONFLICT(workflow_id,key) DO UPDATE SET
    goal_revision=excluded.goal_revision,sha256=excluded.sha256,size=excluded.size,
    media_type=excluded.media_type,origin=excluded.origin,bytes=excluded.bytes,created_at=excluded.created_at;

-- source: ledger-db.mjs::readInput — full row; JS re-hashes `bytes` and refuses
-- when it differs from the stored sha256
SELECT * FROM inputs WHERE workflow_id=? AND key=?;

-- source: ledger-db.mjs::inputs.list — metadata listing (bytes left in the
-- table; a listing is provenance, not payload)
SELECT workflow_id,key,goal_revision,sha256,size,media_type,origin,created_at
  FROM inputs WHERE workflow_id=? ORDER BY key;

-- inputs.materialise writes a digest-checked COPY to a worker directory
-- (os.tmpdir()/starci/inputs/<wf>/<key>) — file output, no SQL of its own.

-- retirement: inputs die with the workflow (retireWorkflow drops them);
-- migration imports them per workflow (see migration.sql).
