// pipeline.mjs - HFS_CI_MISSING_CANON (R13): CI runs the pinned `starci app lint`.
//   .github/workflows/ci.yml   a `run:` step that runs the one lint entry: `starci app lint`,
//                              `npx @starci/cli[@<version>] app lint`, or `npm run <script>` whose command runs `starci app lint`
//                              (`npm run lint`, arguments after `--` allowed); a version named in the step is the @starci/cli pin of
//                              canon-pins.yaml (an installed one is pinned by the pin check, R15)
//   (the push hook is no lint or typecheck step: it checks the release gate, scripts/hfs/runtime-rules/hook-shape.mjs keeps its shape)
// A missing file is the slot manifest's finding (HFS_SLOT_REQUIRED_MISSING); a file that is present and lacks the step is this rule's.
// The redirect of `core.hooksPath` away from husky is the architecture machine's (HFS_HOOKS_PATH_REDIRECTED).
import { found, readJson, readText } from './read.mjs';

const CI_MISSING_CANON = 'HFS_CI_MISSING_CANON';
const CI_FILE = '.github/workflows/ci.yml';
const hfsPackage = '@starci/cli';
const RUN_LINE = /^\s*(?:-\s+)?run:\s*(.+?)\s*$/;
const HFS_LINT = /^(?:npx\s+(?:--no-install\s+|-y\s+)?)?(?:@starci\/cli(?:@(\S+))?|starci)\s+app\s+lint(\s.*)?$/;
const NPM_RUN = /^npm run ([\w:.-]+)(?:\s+--\s+(.*))?$/;

const commandsOf = (text) => text.split(/\r?\n/).map((line) => RUN_LINE.exec(line)?.[1]).filter(Boolean).map((command) => command.replace(/^["']|["']$/g, ''));

/** `npm run <script> -- <args>` spelled out as the root package.json script it runs; any other command is itself. */
function expanded(command, scripts) {
  const run = NPM_RUN.exec(command);
  if (!run || typeof scripts[run[1]] !== 'string') return command;
  return run[2] ? `${scripts[run[1]]} ${run[2]}` : scripts[run[1]];
}

/** The findings of R13 over the repository at `repoRoot`; `pins` is the parsed canon-pins.yaml pin map. */
export function pipelineFindings({ repoRoot, files, pins }) {
  const findings = [];
  const pinned = pins?.[hfsPackage]?.version;
  const ci = files.includes(CI_FILE) ? readText(repoRoot, CI_FILE) : null;
  if (ci !== null) {
    const scripts = readJson(repoRoot, 'package.json')?.scripts ?? {};
    const lints = commandsOf(ci).flatMap((command) => expanded(command, scripts).split(/\s*&&\s*/)).map((command) => HFS_LINT.exec(command)).filter(Boolean);
    if (!lints.length) findings.push(found(CI_MISSING_CANON, CI_FILE, `${CI_FILE} has no step that runs \`starci app lint\` (directly or through \`npm run lint\`); CI runs the one lint entry, which includes the repository check`, { step: 'starci app lint' }));
    else if (pinned && !lints.some((match) => match[1] === undefined || match[1] === pinned)) {
      findings.push(found(CI_MISSING_CANON, CI_FILE, `${CI_FILE} runs starci app lint at ${lints[0][1]}, but ${hfsPackage} is pinned at ${pinned}; run the pinned version`, { step: 'starci app lint', pinned }));
    }
  }
  return findings;
}
