// release-store.mjs - the release record protocol on the manager: /srv/<stack>/releases/<digest16>/{stack.yaml,release.json} behind the
// stable `current` and `previous` pointers, which move only after verification. A JavaScript object over an injected ssh runner:
//   ssh(command, { input }) -> { status, stdout, stderr }     runs a shell command on the manager (remote.mjs provides the real one)
// Every remote command is composed ONLY from a validated release id (16 lowercase hex) and a validated base path, so no free text reaches
// the remote shell. The record holds names and digests, never a secret value. Files travel as text on stdin / stdout.
import fs from 'node:fs';
import path from 'node:path';
import { eachInOrder, mapInOrder } from '../runtime/scripts/lib/in-order.mjs';
import { firstLine, lines as splitLines } from './context.mjs';
import { isReleaseId } from './digest.mjs';
import { failure, refusal } from './errors.mjs';

const BASE = /^\/[A-Za-z0-9._/-]+$/u;
const FILES = ['stack.yaml', 'release.json'];

/** Removes every carriage return: a snippet from a Windows checkout must never reach a remote shell with CRLF. */
export const lfOnly = (text) => String(text).replaceAll('\r', '');

const checkedId = (id) => {
  if (!isReleaseId(id)) throw refusal('STACK_RELEASE_ID', 'a release id is exactly 16 lowercase hex characters');
  return id;
};

const checkedBase = (config) => {
  const base = config.remote?.releasesBase ?? `/srv/${config.stack}`;
  if (!BASE.test(base) || base.split('/').includes('..')) throw refusal('STACK_RELEASE_BASE', `the releases base ${base} must be an absolute path without ..`);
  return base;
};

/**
 * The release store of one stack. `ssh` is the runner; the returned API is async:
 *   store(dir, id) accept(id) current() previous() fetch(id, targetDir) list()
 */
export function createReleaseStore(config, ssh) {
  const base = checkedBase(config);
  const dirOf = (id) => `${base}/releases/${checkedId(id)}`;

  async function run(command, input) {
    const answer = await ssh(lfOnly(command), { input });
    if (answer.status !== 0) throw failure('STACK_RELEASE_SSH', `remote command failed: ${firstLine(answer.stderr)}`);
    return answer.stdout;
  }

  function readLocal(dir, name) {
    try { return fs.readFileSync(path.join(dir, name), 'utf8'); } catch { throw failure('STACK_RELEASE_STORE', `cannot read ${name} in ${dir}`); }
  }

  async function pointer(name) {
    const out = await run(`cd "${base}" 2>/dev/null && [ -L ${name} ] && basename "$(readlink ${name})" || true`);
    const id = out.trim();
    return isReleaseId(id) ? id : '';
  }

  return {
    /** Uploads stack.yaml and release.json of a rendered release as text; read-only afterwards. */
    async store(dir, id) {
      const target = dirOf(id);
      const contents = FILES.map((name) => [name, readLocal(dir, name)]);
      await run(`set -e; d="${target}"; if [ -d "$d" ]; then chmod -R u+w "$d"; else mkdir -p "$d"; fi`);
      await eachInOrder(contents, ([name, text]) => run(`set -e; d="${target}"; cat > "$d/${name}"`, text));
      await run(`set -e; d="${target}"; chmod 440 "$d/stack.yaml" "$d/release.json"; chmod 550 "$d"`);
    },
    /** The release was verified: previous := current, current := id. */
    async accept(id) {
      checkedId(id);
      await run(`set -e; cd "${base}"; test -d "releases/${id}"; if [ -L current ] && [ "$(basename "$(readlink current)")" != "${id}" ]; then ln -sfn "$(readlink current)" previous; fi; ln -sfn "releases/${id}" current.new; mv -Tf current.new current`);
    },
    /** The accepted release id, '' when none. */
    current: () => pointer('current'),
    /** The release accepted before the current one, '' when none. */
    previous: () => pointer('previous'),
    /** Downloads a stored release (both files) into `targetDir` for a rollback or an audit. */
    async fetch(id, targetDir) {
      const source = dirOf(id);
      const files = await mapInOrder(FILES, async (name) => [name, await run(`cat "${source}/${name}"`)]);
      fs.mkdirSync(targetDir, { recursive: true });
      for (const [name, text] of files) fs.writeFileSync(path.join(targetDir, name), text);
      return targetDir;
    },
    /** The stored releases, newest first: [{ id, current, previous }]. */
    async list() {
      const [now, before] = [await pointer('current'), await pointer('previous')];
      const out = await run(`cd "${base}/releases" 2>/dev/null && ls -1t || true`);
      return splitLines(out).filter(isReleaseId).map((id) => ({ id, current: id === now, previous: id === before }));
    },
  };
}
