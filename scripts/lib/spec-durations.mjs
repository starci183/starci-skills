// spec-durations.mjs - pure extraction of per-spec elapsed time from a node:test spec-reporter log.
// The reporter names tests but not their source files, so callers provide the spec source texts; a title
// is charged only when exactly one source declares it. Dynamic and duplicate titles stay unassigned.

const TEST_TITLE = /\b(?:test|it)\s*\(\s*(?:\{[^}]*\}\s*,\s*)?(['"`])((?:\\.|(?!\1).)*)\1/gs;
const REPORTER_ROW = /^[\u2714\u2716]\s+(.*?)\s+\((\d+(?:\.\d+)?)ms\)\s*$/;

/** The literal test titles declared in a spec source. Dynamic template titles are not stable identifiers. */
export function literalTestTitles(source) {
  const titles = [];
  for (const match of String(source ?? '').matchAll(TEST_TITLE)) {
    if (match[1] === '`' && match[2].includes('${')) continue;
    titles.push(match[2]);
  }
  return titles;
}

/**
 * Convert a spec-reporter log and {repoRelativeSpec: sourceText} into sorted {spec, seconds} rows.
 * Durations are summed in milliseconds and rounded to whole seconds only after aggregation.
 */
export function specDurationRows(log, specSources) {
  const owners = new Map();
  for (const [spec, source] of Object.entries(specSources ?? {})) {
    for (const title of literalTestTitles(source)) {
      const paths = owners.get(title) ?? [];
      paths.push(spec);
      owners.set(title, paths);
    }
  }

  const milliseconds = new Map();
  for (const line of String(log ?? '').split(/\r?\n/)) {
    const match = REPORTER_ROW.exec(line);
    if (!match) continue;
    const paths = owners.get(match[1]);
    if (paths?.length !== 1) continue;
    milliseconds.set(paths[0], (milliseconds.get(paths[0]) ?? 0) + Number(match[2]));
  }

  return [...milliseconds]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([spec, ms]) => ({ spec, seconds: Math.round(ms / 1000) }));
}
