// view.mjs - `npm view`: what the npm registry says about one package version. The release gate reads it to know whether a
// version is published and which shasum the registry holds; it never writes.
import { npmSpawn } from './lib.mjs';

/** The JSON `npm view <spec> <field> --json` printed, or null when it printed none. */
const parsed = (text) => { try { return JSON.parse(String(text ?? '').trim() || 'null'); } catch { return null; } };

/**
 * {state: 'present' | 'absent' | 'unreachable', shasum?, latest?, detail?} of `name@version`. A package the registry does not
 * know (E404) or a version it does not list is `absent` (with the registry's latest when it has one); any other failure
 * (network, auth, a broken npm) is `unreachable`, never a guess. `run` is the spawn seam of a spec.
 */
export function view(name, version, { run = npmSpawn } = {}) {
  const listed = run(['view', name, 'versions', 'dist-tags.latest', '--json'], { timeout: 120_000 });
  const err = `${listed.stderr ?? ''}${listed.error?.message ?? ''}`;
  if (listed.error || listed.status === null) return { state: 'unreachable', detail: err.trim().slice(0, 200) || 'npm did not run' };
  if (listed.status !== 0) {
    return /\bE404\b|404 Not Found|code E404/.test(err) ? { state: 'absent', latest: '-' } : { state: 'unreachable', detail: err.trim().split(/\r?\n/)[0].slice(0, 200) };
  }
  const doc = parsed(listed.stdout);
  const versions = [doc?.versions ?? doc].flat().filter((v) => typeof v === 'string');
  const latest = typeof doc?.['dist-tags.latest'] === 'string' ? doc['dist-tags.latest'] : '-';
  if (!versions.includes(version)) return { state: 'absent', latest };
  const dist = run(['view', `${name}@${version}`, 'dist.shasum', '--json'], { timeout: 120_000 });
  const shasum = dist.status === 0 ? parsed(dist.stdout) : null;
  return typeof shasum === 'string' ? { state: 'present', shasum, latest } : { state: 'unreachable', detail: 'the registry lists the version but gave no shasum' };
}
