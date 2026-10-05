import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

/** Supplies one selected child outcome while native fixture calls keep their real implementation; restores ESM bindings on failure. */
export async function withSpawnResult(t, matches, result, action) {
  const native = childProcess.spawnSync;
  const mocked = t.mock.method(childProcess, 'spawnSync', (command, args, options) => matches(command, args, options)
    ? result : native(command, args, options));
  syncBuiltinESMExports();
  try { return await action(); }
  finally { mocked.mock.restore(); syncBuiltinESMExports(); }
}
