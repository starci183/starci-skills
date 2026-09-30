// pipeline.mjs - HFS_CI_MISSING_CANON (R13): CI runs the pinned `hfs lint`; pre-push runs typecheck and lint.
//   .github/workflows/ci.yml   a `run:` step that runs `hfs lint` (the one lint entry: eslint, the repository check, stylelint): `npx hfs lint`,
//                              `npx @starci/hfs[@<version>] lint`, or `npm run <script>` of the root package.json whose command runs `hfs lint`
//                              (`npm run lint`, arguments after `--` allowed); a version named in the step is the @starci/hfs pin of
//                              canon-pins.yaml (an installed one is pinned by the pin check, R15)
//   .husky/pre-push            `npm run typecheck` and `npm run lint`, each on a line of its own
// A missing file is the slot manifest's finding (HFS_SLOT_REQUIRED_MISSING); a file that is present and lacks the step is this rule's.
// The redirect of `core.hooksPath` away from husky is the architecture machine's (HFS_HOOKS_PATH_REDIRECTED).
import { found, readJson, readText } from './read.mjs';

export const CI_MISSING_CANON = 'HFS_CI_MISSING_CANON';
export const CI_FILE = '.github/workflows/ci.yml';
export const PRE_PUSH_FILE = '.husky/pre-push';
export const hfsPackage = '@starci/hfs';
const RUN_LINE = /^\s*(?:-\s+)?run:\s*(.+?)\s*$/;
const HFS_LINT = /^(?:npx\s+(?:--no-install\s+|-y\s+)?)?(?:@starci\/hfs|hfs)(?:@(\S+))?\s+lint(\s.*)?$/;
const NPM_RUN = /^npm run ([\w:.-]+)(?:\s+--\s+(.*))?$/;

const commandsOf = (text) => text.split(/\r?\n/).map((line) => RUN_LINE.exec(line)?.[1]).filter(Boolean).map((command) => command.replace(/^["']|["']$/g, ''));

/** `npm run <script> -- <args>` spelled out as the root package.json script it runs; any other command is itself. */
function expanded(command, scripts) {
  const run = NPM_RUN.exec(command);
  return run && typeof scripts[run[1]] === 'string' ? `${scripts[run[1]]}${run[2] ? ` ${run[2]}` : ''}` : command;
}

const runsStep = (lines, step) => lines.some((line) => new RegExp(`^npm run ${step}(\\s|$)`).test(line));

/** The findings of R13 over the repository at `repoRoot`; `pins` is the parsed canon-pins.yaml pin map. */
export function pipelineFindings({ repoRoot, files, pins }) {
  const findings = [];
  const pinned = pins?.[hfsPackage]?.version;
  const ci = files.includes(CI_FILE) ? readText(repoRoot, CI_FILE) : null;
  if (ci !== null) {
    const scripts = readJson(repoRoot, 'package.json')?.scripts ?? {};
    const lints = commandsOf(ci).flatMap((command) => expanded(command, scripts).split(/\s*&&\s*/)).map((command) => HFS_LINT.exec(command)).filter(Boolean);
    if (!lints.length) findings.push(found(CI_MISSING_CANON, CI_FILE, `${CI_FILE} has no step that runs \`hfs lint\` (\`npm run lint\`, or \`npx hfs lint\`); CI runs the one lint entry, which includes the repository check`, { step: 'hfs lint' }));
    else if (pinned && !lints.some((match) => match[1] === undefined || match[1] === pinned)) {
      findings.push(found(CI_MISSING_CANON, CI_FILE, `${CI_FILE} runs hfs lint at ${lints[0][1]}, but ${hfsPackage} is pinned at ${pinned}; run the pinned version`, { step: 'hfs lint', pinned }));
    }
  }
  const prePush = files.includes(PRE_PUSH_FILE) ? readText(repoRoot, PRE_PUSH_FILE) : null;
  if (prePush !== null) {
    const lines = prePush.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
    for (const step of ['typecheck', 'lint']) {
      if (!runsStep(lines, step)) findings.push(found(CI_MISSING_CANON, PRE_PUSH_FILE, `${PRE_PUSH_FILE} does not run \`npm run ${step}\`; pre-push runs typecheck and lint`, { step }));
    }
  }
  return findings;
}
