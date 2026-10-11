import childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';

/** A finished child that reports `result` ({status, signal, stdout, stderr, error}) through the events of a real spawned child. */
function finishedChild(result) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => {
    if (result.stdout) child.stdout.emit('data', Buffer.from(result.stdout));
    if (result.stderr) child.stderr.emit('data', Buffer.from(result.stderr));
    if (result.error) child.emit('error', result.error);
    child.emit('close', result.status ?? null, result.signal ?? null);
  });
  return child;
}

/** Supplies one selected child outcome (to a synchronous or an asynchronous spawn) while native fixture calls keep their real implementation; restores ESM bindings on failure. */
export async function withSpawnResult(t, matches, result, action) {
  const native = childProcess.spawnSync;
  const nativeSpawn = childProcess.spawn;
  const mocked = t.mock.method(childProcess, 'spawnSync', (command, args, options) => matches(command, args, options)
    ? result : native(command, args, options));
  const mockedSpawn = t.mock.method(childProcess, 'spawn', (command, args, options) => matches(command, args, options)
    ? finishedChild(result) : nativeSpawn(command, args, options));
  syncBuiltinESMExports();
  try { return await action(); }
  finally { mocked.mock.restore(); mockedSpawn.mock.restore(); syncBuiltinESMExports(); }
}
