// pack.mjs - `npm pack`: a package folder or a registry spec as the .tgz npm would publish or serve, written into a
// directory the caller made (scripts/gates/release-registry.mjs compares the two tarballs file by file). No lifecycle
// script runs: --ignore-scripts.
import { npmSpawn } from './lib.mjs';

/** {ok, file, detail}: `spec` (a folder or name@version) packed into `destination`; `file` is the tarball's name there. */
export function pack(spec, destination, { cwd, run = npmSpawn } = {}) {
  const r = run(['pack', spec, '--ignore-scripts', '--pack-destination', destination, '--silent'], { cwd, timeout: 300_000 });
  const file = String(r.stdout ?? '').trim().split(/\r?\n/).findLast(Boolean) ?? '';
  return r.error || r.status !== 0 || !file ? { ok: false, file: null, detail: String(r.stderr ?? r.error?.message ?? '').trim().slice(0, 200) } : { ok: true, file, detail: '' };
}
