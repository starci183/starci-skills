// project-graph.mjs - the ONE project graph the lint canon shares: the architecture machine's module graph and slot manifest,
// built once per process for a repository and cached, so every file a lint rule visits looks itself up in it.
//
// Both @starci/eslint-canon-be and @starci/eslint-canon-fe ship a byte copy of this file (and of the machine it imports) in their
// runtime/ bundle (scripts/hfs/sync-runtime.mjs). There is no second graph: `projectGraph` runs `checkArchitecture`
// (scripts/hfs/architecture/index.mjs) with `surface: 'lint'`, which judges exactly the checks whose findings attach to a
// TypeScript file, and indexes the findings by repository-relative path. `hfs check` runs the other surface ('check') and never
// the lint one, so no rule has two enforcers.
//
// The per-path judgements of the slot manifest (hfs-path-findings.mjs: slot ownership, source file name, spec placement) over the
// tracked tree join the same index, so a file looks up all of its findings in one place.
//
// A graph that cannot be built (no tsconfig, unresolvable import, invalid declaration) is an error: a check that cannot run is
// never a pass, so `projectGraph` throws the machine's own message and the lint run stops.
import fs from 'node:fs';
import { checkArchitecture } from './architecture/index.mjs';
import { openHfs } from './slots.mjs';
import { pathFindings } from './path-findings.mjs';
import { runGit } from '../api/git/lib.mjs';
import { posixPath } from '../lib/path-key.mjs';
import { onLintSurface } from './architecture/surface.mjs';

const cache = new Map();

/**
 * The graph findings of the repository at `repoRoot`, built on the first call of the process and reused after.
 *
 * @param {{ repoRoot: string, runtimeRoot: string, injectedTypeScript?: object }} input - `runtimeRoot` holds the slot manifest copy; `injectedTypeScript` is for hermetic fixtures only.
 * @returns {{ byFile: Map<string, object[]>, files: number }} Findings of the lint surface keyed by repository-relative path.
 */
export function projectGraph({ repoRoot, runtimeRoot, injectedTypeScript }) {
  const key = fs.realpathSync(repoRoot);
  if (!cache.has(key)) {
    const opened = openHfs({ root: runtimeRoot, repoRoot: key });
    const report = checkArchitecture({ repositoryRoot: key, hfs: opened, injectedTypeScript, surface: 'lint' });
    if (report.errors.length) throw new Error(`the project graph of ${key} cannot be built: ${report.errors.map((e) => `${e.ruleId}: ${e.message}`).join('; ')}`);
    const listed = runGit(['ls-files', '-z', '--cached', '--exclude-standard'], { dir: key, maxBuffer: 256 * 1024 * 1024 });
    if (listed.error || listed.status !== 0) throw new Error(`the project graph of ${key} needs a Git work tree (git ls-files failed)`);
    const tracked = listed.stdout.split('\0').filter(Boolean).map(posixPath);
    const repoFindings = pathFindings({ files: tracked, resolver: opened, profile: opened.repo.profile }).filter((finding) => onLintSurface(key, finding));
    const byFile = new Map();
    for (const violation of [...report.violations, ...repoFindings]) {
      const file = posixPath(violation.path ?? '');
      byFile.set(file, [...(byFile.get(file) ?? []), violation]);
    }
    cache.set(key, { byFile, files: report.files });
  }
  return cache.get(key);
}

/** Forget every built graph (fixtures that rewrite a repository between cases). */
export const resetProjectGraphs = () => cache.clear();
