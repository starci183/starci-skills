import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const processLives = (pid) => {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
};

export async function withOwnedFileLock(lock, operation) {
  lock = path.resolve(lock);
  await mkdir(path.dirname(lock), { recursive: true });
  const owner = { pid: process.pid, token: randomUUID(), acquiredAt: new Date().toISOString() };
  let handle;
  for (let tries = 0; tries < 400; tries += 1) {
    try {
      handle = await open(lock, 'wx');
      await handle.writeFile(`${JSON.stringify(owner)}\n`, 'utf8');
      await handle.sync();
      break;
    } catch (error) {
      if (!['EEXIST', 'EPERM', 'ENOENT'].includes(error.code)) throw error;
      if (error.code === 'ENOENT') await mkdir(path.dirname(lock), { recursive: true });
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
  return withOwnedFileLock(path.join(session, 'runtime', '.session-lock'), operation);
}

export async function mutateSession(session, operation) {
  session = path.resolve(session);
  return withSessionLock(session, async () => {
    const file = path.join(session, 'state.json');
    const state = JSON.parse(await readFile(file, 'utf8'));
    const result = await operation(state);
    const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await rename(temp, file);
    return result;
  });
}

export async function readSessionState(session) {
  if (!existsSync(path.join(session, 'state.json'))) throw new Error('SESSION_MISSING: state.json is absent');
  return JSON.parse(await readFile(path.join(session, 'state.json'), 'utf8'));
}
