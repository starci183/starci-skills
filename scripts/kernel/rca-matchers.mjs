// rca-matchers.mjs — the failure-cause text matchers of progress-rca.mjs. Each reads a report or blocker in
// whichever language it was written: the Vietnamese alternatives are lexicon data
// (modules/goal/source-phrases.yaml rca), never source literals.
import { altOf } from '../lib/source-phrases.mjs';

const rcaText = (en, key) => new RegExp(`${en}|${altOf('rca.' + key)}`, 'i');
export const MISSING_PATHS_RE = rcaText(String.raw`does not exist|do not exist|not exist(?:ing)?\b|are absent|is absent|files=0|scanned 0`, 'missingPaths');
export const GRANT_NARROW_RE = rcaText('outside (?:the )?(?:owned|allowlist|grant|binding)|beyond the grant', 'grantTooNarrow');
export const TOOL_TIMEOUT_RE = rcaText(String.raw`timed? ?out|timeout|30[- ]?s(?:econd)?\b|exit(?:code)?[=: ]*124`, 'toolTimeout');
export const TEST_GAP_RE = rcaText('regression suite|no (?:existing )?regression', 'testGap');
export const CHECKER_UNAVAILABLE_RE = rcaText(String.raw`status[= ]unavailable|unavailable \(exit|checker (?:is )?unavailable`, 'checkerUnavailable');
