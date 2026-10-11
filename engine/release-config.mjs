import {isPlainObject as plain} from './plain-object.mjs';
import {invalid} from './invalid-config.mjs';

/** The keys of the release block. */
export const RELEASE_KEYS=Object.freeze(['suite']);
/** Where the full test suite of a release is judged: `local` (the release cut runs it, the shipped default) or `ci` (the GitHub workflow runs it after the push; the cut runs only the affected specs of the release and the rows CI cannot run). */
export const SUITE_MODES=Object.freeze(['local','ci']);
export const RELEASE_DEFAULTS=Object.freeze({suite:'local'});

/**
 * config.yaml `release` - {suite?: local | ci}: who judges the full suite of a release (docs/releasing.md "Where the suite runs"). `local` is the shipped
 * default: `starci release cut` runs the root suite and the Linux parity container before it pushes. `ci` is the owner's recorded choice (2026-10-09) that
 * the full suite runs on GitHub only: the cut runs no root suite and no Linux container, and the CI workflow's verdict is read afterwards (`starci release ci-status`).
 * `none` is refused: the suite does not vanish, it moves to CI, and the value says so.
 */
export function validateRelease(release){
  if(release===null)return;
  const bad=invalid('release');
  if(!plain(release))bad(` must be {suite?: ${SUITE_MODES.join(' | ')}} or null.`);
  for(const key of Object.keys(release))if(!RELEASE_KEYS.includes(key))bad(` has unknown key ${key} (allowed: ${RELEASE_KEYS.join(', ')}).`);
  const value=release.suite;
  if(value===undefined||value===null)return;
  if(value==='none')bad('.suite: "none" is not a mode: write "ci" (no local full suite, CI judges) or "local".');
  if(!SUITE_MODES.includes(value))bad(`.suite must be ${SUITE_MODES.join(' or ')}, or null.`);
}

/** The suite mode a validated owner config names; an absent block or key is the shipped default. */
export const releaseSuiteMode=config=>config?.release?.suite??RELEASE_DEFAULTS.suite;
