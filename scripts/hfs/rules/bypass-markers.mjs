// bypass-markers.mjs - HFS_BYPASS_MARKER (R303): a product repository holds no bypass of a check. Whatever makes a check pass without
// satisfying it is refused wherever it is written (owner ruling loosening-always-red: a bypass is always red):
//   - an inline disable of any tool (eslint, stylelint, tslint, prettier, biome), a type-check escape (the ts-ignore, ts-expect-error and
//     ts-nocheck directives), a Sonar exclusion comment, an istanbul / c8 / v8 coverage ignore;
//   - a skipped, focused or todo test, or a skip option (a front end has no specs, but its source is still judged for the inline disables);
//   - a failure swallowed in a hook, a script or a workflow: `|| true`, `continue-on-error`, `set +e`, `HUSKY=0`, `--no-verify`,
//     `fail_ci_if_error: false`.
// The text is read from the tracked tree here, and from the index by `starci app hygiene` (the pre-commit hook), which uses the same table
// (scripts/lib/bypass-markers.mjs). A managed config edited to loosen is the managed-file drift's (HFS_MANAGED_FILE_DRIFT).
import { found, readText } from './read.mjs';
import { bypassesIn } from '../../lib/bypass-markers.mjs';

export const HFS_BYPASS_MARKER = 'HFS_BYPASS_MARKER';

/** The finding message of one marker of `file`. */
export const bypassMessage = (file, hit) => `${file}:${hit.line} spells ${hit.label} (${hit.text.slice(0, 80)}); a check is satisfied, never bypassed: fix the cause and delete the marker`;

/** The findings of R303 over the tracked paths `files` of the repository at `repoRoot`. */
export function bypassMarkerFindings({ repoRoot, files }) {
  return files.flatMap((file) => {
    const text = readText(repoRoot, file);
    return text === null ? [] : bypassesIn(file, text).map((hit) => found(HFS_BYPASS_MARKER, file, bypassMessage(file, hit), { line: hit.line }));
  });
}
