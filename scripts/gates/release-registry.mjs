// release-registry.mjs - the npm edge of the release gate: the one object release-plan.mjs and release-publish.mjs talk to.
// {state(name, version), localIntegrity(dir), contentClass(name, version, dir), whoami(), publish(dir, options)}. Specs pass a fake with the
// same five functions, so the gate is judged without a network. Reads never write; `publish` is called only by
// release-publish.mjs when --publish was given.
import fs from 'node:fs';
import path from 'node:path';
import { packDryRun } from '../api/npm/pack-dry-run.mjs';
import { pack } from '../api/npm/pack.mjs';
import { publish } from '../api/npm/publish.mjs';
import { view } from '../api/npm/view.mjs';
import { whoami } from '../api/npm/whoami.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { tarFiles } from '../lib/tar-files.mjs';
import { makeTempDir } from '../api/fs/make-temp-dir.mjs';

const norm = (buffer) => buffer.toString('latin1').replaceAll('\r\n', '\n');

/** How one path compares across the two packs: a bucket entry, 'crlf', or null when identical. */
const fileDiff = (registryFiles, localFiles, file) => {
  const a = registryFiles.get(file);
  const b = localFiles.get(file);
  const bare = file.replace(/^package\//, '');
  if (!a || !b) return `${a ? 'only-registry' : 'only-local'} ${bare}`;
  if (a.equals(b)) return null;
  return norm(a) === norm(b) ? 'crlf' : `differs ${bare}`;
};

/**
 * Compare two tarballs' files (Map path -> Buffer) the way the release plan classifies a published version: `same`, `crlf`
 * (only line endings differ), `dist <n>` (only dist/ files differ: stale build output a publish rebuilds) or
 * `drift <n>: <first files>` (anything else differs, appears or is missing).
 */
export function classifyContent(registryFiles, localFiles) {
  let crlf = 0;
  const dist = [];
  const drift = [];
  for (const file of new Set([...registryFiles.keys(), ...localFiles.keys()])) {
    const diff = fileDiff(registryFiles, localFiles, file);
    if (!diff) continue;
    if (diff === 'crlf') crlf += 1;
    else (file.startsWith('package/dist/') ? dist : drift).push(diff);
  }
  if (drift.length) return `drift ${drift.length}: ${drift.slice(0, 4).join('; ')}${drift.length > 4 ? '; ...' : ''}`;
  if (dist.length) return `dist ${dist.length}`;
  return crlf ? 'crlf' : 'same';
}

/** The default registry seam over `npm` for the packages under `root`. */
export function npmRegistry({ root, pack: packArchive = pack }) {
  const abs = (dir) => path.resolve(root, dir);
  return {
    state: (name, version) => view(name, version),
    /** The integrity (sha512 SRI) `npm pack` would publish from the folder (no lifecycle script runs), null when it cannot be listed. */
    localIntegrity(dir) {
      const r = packDryRun(abs(dir));
      try { return JSON.parse(String(r.stdout).slice(String(r.stdout).indexOf('[')))[0]?.integrity ?? null; } catch { return null; }
    },
    /** `same | crlf | dist <n> | drift <n>: ... | unknown <why>`: the registry tarball against the folder's own pack. */
    contentClass(name, version, dir) {
      const tmp = makeTempDir('release-pack-');
      try {
        const reg = packArchive(`${name}@${version}`, tmp, { cwd: root });
        if (!reg.ok) return `unknown registry pack failed: ${reg.detail}`;
        // Registry and local packs share the deterministic filename; retain the published bytes before the local write.
        const registryFiles = tarFiles(fs.readFileSync(path.join(tmp, reg.file)));
        const loc = packArchive(abs(dir), tmp, { cwd: root });
        if (!loc.ok) return `unknown local pack failed: ${loc.detail}`;
        return classifyContent(registryFiles, tarFiles(fs.readFileSync(path.join(tmp, loc.file))));
      } catch (error) {
        return `unknown compare failed: ${String(error?.message ?? error).slice(0, 120)}`;
      } finally {
        safeRemove(tmp, { hold: artifactHoldReason });
      }
    },
    whoami: () => whoami(),
    publish: (dir, options) => publish(abs(dir), options),
  };
}
