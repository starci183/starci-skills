-- 0003-worktrees-workflow-orca (starci/machine@1, user_version 2 -> 3). Applied by engine/machine-db.mjs migrateMachine on
-- the first writer open of an older machine.sqlite (after an integrity_check and a VACUUM INTO backup, with foreign_key_check
-- + quick_check before COMMIT); a fresh machine.sqlite runs 0001 then the forward files.
--
-- One worktree per Kernel workflow replaces the per-op worktree (owner decision WFWT, final). Orca creates and owns it (the
-- Kernel launch), so the registry keys it by Orca's worktree id (orca_id, unique among the rows that have one), records
-- the workflow's last checkpoint (checkpoint_sha) and the moment its finish asked for its release (release_pending_at: the
-- host-side GC removes it once the Kernel's and the ops' terminals are released; never from inside itself). The draw
-- critic's placement is an Orca worktree too (kind critic). worktrees.kind no longer accepts 'op': a row of that kind
-- describes the removed mechanism and is deleted (a directory it named, if any is left, is an unregistered worktree the
-- worktree GC and the footprint scan report); then the table's CHECK is rewritten in place (writable_schema: the views over worktrees stay as they are).
DELETE FROM worktrees WHERE kind='op';
ALTER TABLE worktrees ADD COLUMN orca_id TEXT;
ALTER TABLE worktrees ADD COLUMN checkpoint_sha TEXT;
ALTER TABLE worktrees ADD COLUMN release_pending_at INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS ux_worktrees_orca_id ON worktrees(orca_id) WHERE orca_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_worktrees_workflow ON worktrees(workflow_id,kind,removed_at);
PRAGMA writable_schema=ON;
UPDATE sqlite_master
   SET sql=replace(sql, 'CHECK(kind IN (''op'',''land-scratch'',', 'CHECK(kind IN (''workflow'',''critic'',''land-scratch'',')
 WHERE type='table' AND name='worktrees';
