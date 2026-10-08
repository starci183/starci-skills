// sonar-hook.mjs - the Sonar-rules step of the runtime's generated pre-commit hook. A commit that stages a .mjs file (or the
// baseline, or the scope file) is judged by the `sonar-rules` self-check on the STAGED content: a new finding, or a baseline entry
// the commit fixed but left listed, refuses the commit and is named. There is no skip switch; the fix is the way through.
import path from 'node:path';
import { shellQuote } from './hook-install.mjs';

const WATCHED = Object.freeze(["'*.mjs'", "'knowledge/sonar-baseline.json'", "'sonar-project.properties'"]);

/** The shell lines the pre-commit hook runs for the Sonar rules of the repository at `root`. */
export function sonarHookCheck({ root, nodePath = process.execPath }) {
  const q = shellQuote;
  return String.raw`# Sonar rules (L0): the staged .mjs files are judged by the same rule table SonarCloud's findings map to, in seconds.
if [ -n "$(git diff --cached --name-only --diff-filter=ACMRD -- ${WATCHED.join(' ')})" ]; then
  STARCI_RUNTIME=${q(root)} ${q(nodePath)} ${q(path.join(root, 'packages', 'cli', 'bin', 'starci.mjs'))} runtime check --only sonar-rules -- --staged --root "$(git rev-parse --show-toplevel)" || exit 1
fi
`;
}
