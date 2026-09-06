import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const mutations = new AsyncLocalStorage();
export const currentSessionMutation = session => mutations.getStore()?.active && mutations.getStore().session === path.resolve(session) ? mutations.getStore().state : null;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function replaceFile(temp, file, { renameFile = rename, platform = process.platform, pause = wait } = {}) {
  // Windows readers or scanners may briefly deny replacement of an existing file. Keep the
  // owner's lock and both files intact; retry only the atomic rename, never unlink the old state.
  for (let tries = 0; ; tries += 1) {
    try { return await renameFile(temp, file); }
    catch (error) {
      if (platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || tries >= 19) throw error;
      await pause(25);
    }
  }
}
const processLives = (pid) => {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
};

export async function withOwnedFileLock(lock, operation, { requiredFile = null } = {}) {
  lock = path.resolve(lock);
  requiredFile = requiredFile ? path.resolve(requiredFile) : null;
  if (requiredFile && !existsSync(requiredFile)) throw new Error('SESSION_MISSING: state.json is absent');
  if (!existsSync(path.dirname(lock))) await mkdir(path.dirname(lock), { recursive: true });
  const owner = { pid: process.pid, token: randomUUID(), acquiredAt: new Date().toISOString() };
  let handle;
  for (let tries = 0; tries < 400; tries += 1) {
    if (requiredFile && !existsSync(requiredFile)) throw new Error('SESSION_MISSING: state.json was removed while waiting for its lock');
    try {
      handle = await open(lock, 'wx');
      await handle.writeFile(`${JSON.stringify(owner)}\n`, 'utf8');
      await handle.sync();
      break;
    } catch (error) {
      if (!['EEXIST', 'EPERM', 'ENOENT'].includes(error.code)) throw error;
      if (error.code === 'ENOENT') {
        if (requiredFile && !existsSync(requiredFile)) throw new Error('SESSION_MISSING: state.json was removed while waiting for its lock');
        await mkdir(path.dirname(lock), { recursive: true });
      }
      if (error.code === 'EEXIST') {
        try {
          const held = JSON.parse(await readFile(lock, 'utf8'));
          if (!processLives(held.pid)) await rm(lock, { force: true });
        } catch {}
      }
      // Windows can briefly return EPERM while another owner has closed and its lock file is
      // delete-pending. Retrying never removes that ambiguous file and therefore cannot unlock a
      // live writer; a persistent permission failure reaches SESSION_STATE_BUSY below.
      await wait(10);
    }
  }
  if (!handle) throw new Error('SESSION_STATE_BUSY: could not acquire the owning session lock');
  try { return await operation(); }
  finally {
    await handle.close();
    try {
      const held = JSON.parse(await readFile(lock, 'utf8'));
      if (held.token === owner.token) await rm(lock, { force: true });
    } catch {}
  }
}

export async function withSessionLock(session, operation) {
  session = path.resolve(session);
  const refuseRetired = () => {
    if (existsSync(path.join(session,'retirement.json'))) throw Error('WORKFLOW_RETIRED: historical ledger cannot be written');
    if (existsSync(path.join(session,'relocation.json'))) throw Error('WORKFLOW_RELOCATED: former owner ledger cannot be written');
  };
  refuseRetired();
  return withOwnedFileLock(path.join(session, 'runtime', '.session-lock'), async () => { refuseRetired(); return operation(); }, { requiredFile: path.join(session, 'state.json') });
}

export async function mutateSession(session, operation) {
  session = path.resolve(session);
  return withSessionLock(session, async () => {
    if (existsSync(path.join(session, 'relocation.json'))) throw Error('WORKFLOW_RELOCATED: retained source ledger is read-only; use its verified destination');
    const file = path.join(session, 'state.json');
    const state = JSON.parse(await readFile(file, 'utf8'));
    if (state.upgrade || state.contractVersion === 'starci/v2.2' && state.runtimeRevision !== 3) throw Error('WORKFLOW_RESET_REQUIRED: old or migrated state is immutable; archive and open a fresh current session');
    const context = { session, state, active: true };
    let result;
    try { result = await mutations.run(context, () => operation(state)); }
    finally { context.active = false; }
    const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await replaceFile(temp, file);
    return result;
  });
}

export async function readSessionState(session) {
  if (!existsSync(path.join(session, 'state.json'))) throw new Error('SESSION_MISSING: state.json is absent');
  return JSON.parse(await readFile(path.join(session, 'state.json'), 'utf8'));
}
