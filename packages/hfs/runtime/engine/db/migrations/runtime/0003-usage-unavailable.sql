-- 0003-usage-unavailable (starci/runtime@1, user_version 1 -> 3). Applied by engine/ledger-db.mjs migrateLedger on the first
-- writer open of an older ledger, after a VACUUM INTO backup and an integrity_check, with foreign_key_check + quick_check
-- before COMMIT; a fresh ledger runs 0001 then this file.
--
-- op_attempts.usage_source admits 'unavailable' (the attempt's agent has no usage adapter, or no session file was ever found),
-- and usage_reason says why. SQLite cannot ALTER a CHECK, so the table SQL in sqlite_master is rewritten under
-- writable_schema (the documented path for a change that leaves the on-disk row format alone: the constraint only widens),
-- then schema_version is bumped by the migrator. Every existing row already satisfies the wider constraint.
ALTER TABLE op_attempts ADD COLUMN usage_reason TEXT;
PRAGMA writable_schema=ON;
UPDATE sqlite_master
   SET sql=replace(sql,'usage_source IN (''cli-transcript'',''provider-report'')','usage_source IN (''cli-transcript'',''provider-report'',''unavailable'')')
 WHERE type='table' AND name='op_attempts' AND instr(sql,'''unavailable''')=0;
