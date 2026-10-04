-- Preserve Supervisor signals while admitting the distinct core maintenance seat and its diagnostics.
CREATE TABLE sup_signals_v3(
  scope TEXT NOT NULL CHECK(scope IN ('supervisor-enabled','supervisor-busy','core-debug-enabled','core-debug-diagnostics')),
  key TEXT NOT NULL,
  holder_pid INTEGER,
  token TEXT,
  value_json TEXT CHECK(value_json IS NULL OR json_valid(value_json)),
  at INTEGER NOT NULL,
  expires_at INTEGER,
  PRIMARY KEY(scope,key)
) STRICT;

INSERT INTO sup_signals_v3(scope,key,holder_pid,token,value_json,at,expires_at)
  SELECT scope,key,holder_pid,token,value_json,at,expires_at FROM sup_signals;
DROP TABLE sup_signals;
ALTER TABLE sup_signals_v3 RENAME TO sup_signals;
