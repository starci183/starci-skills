import {spawnCapture} from './spawn-capture.mjs';
import {nativeAppEntry} from './native-app-entry.mjs';

/**
 * Inspect or run only the app's installed native release CLI. The asynchronous bounded process
 * keeps the caller's operation lease alive. Raw output stays private; only its closed JSON fields
 * are returned, and a lost/partial result never authorizes rerunning the native gate.
 */
export async function sonarRelease({repoRoot, mode = 'inspect', expectedIdentity, revision, env, timeoutMs, gateSha256}) {
  let installed;
  try {installed = nativeAppEntry({repoRoot, requiredHfsFiles: {'release/gate.mjs': gateSha256}});}
  catch (error) {
    if (error?.message === 'NATIVE_APP_OWNER_VERSION_REQUIRED') throw new Error('SONAR_RELEASE_NATIVE_UPGRADE_REQUIRED');
    throw error;
  }
  if (mode === 'inspect') return installed.public;
  if (mode !== 'run' || JSON.stringify(installed.public) !== JSON.stringify(expectedIdentity)
      || !/^[a-f0-9]{40}$/.test(revision ?? '') || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 7200000)
    throw new Error('SONAR_RELEASE_NATIVE_INPUT_DRIFT');
  const result = await spawnCapture(process.execPath, [installed.entry, 'app', 'release', 'gate', '--source', revision,
    '--sonar', '--execute', '--json'], {cwd: repoRoot, env, timeoutMs});
  if (result.code !== 0 || !result.outputComplete) return {ok: false, unknown: true, processClosed: result.processState === 'closed'};
  let value;
  try {value = JSON.parse(result.stdout);} catch {return {ok: false, unknown: true, processClosed: true};}
  const rows = value?.results;
  if (value.verb !== 'gate' || value.ok !== true || value.executed !== true || value.head !== revision
      || typeof value.tag !== 'string' || !/^[A-Za-z0-9._/-]{1,128}$/.test(value.tag)
      || typeof value.record !== 'string' || !Array.isArray(rows) || rows.length === 0
      || rows.some(row => typeof row.name !== 'string' || row.pass !== true && row.skipped !== true)
      || rows.filter(row => row.name === 'sonar' && row.pass === true && row.skipped !== true).length !== 1)
    return {ok: false, unknown: true, processClosed: true};
  return {ok: true, processClosed: true, head: revision, tag: value.tag, record: value.record,
    tagCreated: value.tagCreated === true, nativeGates: rows.length};
}
