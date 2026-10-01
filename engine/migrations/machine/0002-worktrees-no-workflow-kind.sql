-- 0002-worktrees-no-workflow-kind (starci/machine@1, user_version 1 -> 2). Applied by engine/machine-db.mjs migrateMachine on
-- the first writer open of an older machine.sqlite (after an integrity_check and a VACUUM INTO backup, with foreign_key_check
-- + quick_check before COMMIT); a fresh machine.sqlite runs 0001 then the forward files.
--
-- The per-workflow worktree is removed: a workflow owns no checkout of its own, an op works in its job worktree and a land
-- in its scratch. worktrees.kind no longer accepts 'workflow'. A row of that kind describes the removed mechanism and is
-- deleted (a directory it named, if any is left, is an unregistered worktree the worktree GC and the footprint scan report);
-- then the table's CHECK is rewritten in place (writable_schema: the views over worktrees stay as they are).
DELETE FROM worktrees WHERE kind='workflow';
PRAGMA writable_schema=ON;
UPDATE sqlite_master
   SET sql=replace(sql, 'CHECK(kind IN (''op'',''workflow'',''land-scratch'',', 'CHECK(kind IN (''op'',''land-scratch'',')
 WHERE type='table' AND name='worktrees';
