// pipeline.mjs - HFS_CI_MISSING_CANON (R13): CI runs the pinned `hfs check`; pre-push runs typecheck and lint.
//   .github/workflows/ci.yml   a `run:` step `npx hfs check` (or `npx @starci/hfs[@<version>] check`) that is the whole check
//                              (not `--fast`); a version named in the step is the @starci/hfs pin of canon-pins.yaml
//   .husky/pre-push            `npm run typecheck` and `npm run lint:check`, each on a line of its own
// A missing file is the slot manifest's finding (HFS_SLOT_REQUIRED_MISSING); a file that is present and lacks the step is this rule's.
// The redirect of `core.hooksPath` away from husky is the architecture machine's (HFS_HOOKS_PATH_REDIRECTED).
import { found, readText } from './read.mjs';

export const CI_MISSING_CANON = 'HFS_CI_MISSING_CANON';
export const CI_FILE = '.github/workflows/ci.yml';
export const PRE_PUSH_FILE = '.husky/pre-push';
export const hfsPackage = '@starci/hfs';
const RUN_LINE = /^\s*(?:-\s+)?run:\s*(.+?)\s*$/;
const HFS_CHECK = /^npx\s+(?:--no-install\s+|-y\s+)?(?:@starci\/hfs|hfs)(?:@(\S+))?\s+check(\s.*)?$/;

const commandsOf = (text) => text.split(/\r?\n/).map((line) => RUN_LINE.exec(line)?.[1]).filter(Boolean).map((command) => command.replace(/^["']|["']$/g, ''));

/** The findings of R13 over the repository at `repoRoot`; `pins` is the parsed canon-pins.yaml pin map. */
export function pipelineFindings({ repoRoot, files, pins }) {
  const findings = [];
  const pinned = pins?.[hfsPackage]?.version;
  const ci = files.includes(CI_FILE) ? readText(repoRoot, CI_FILE) : null;
  if (ci !== null) {
    const checks = commandsOf(ci).map((command) => HFS_CHECK.exec(command)).filter(Boolean);
    const whole = checks.filter((match) => !/(^|\s)--fast(\s|$)/.test(match[2] ?? ''));
    if (!whole.length) findings.push(found(CI_MISSING_CANON, CI_FILE, `${CI_FILE} has no step \`run: npx hfs check\`; CI must run the whole pinned hfs check (not --fast)`, { step: 'hfs check' }));
    else if (pinned && !whole.some((match) => match[1] === undefined || match[1] === pinned)) {
      findings.push(found(CI_MISSING_CANON, CI_FILE, `${CI_FILE} runs hfs check at ${whole[0][1]}, but ${hfsPackage} is pinned at ${pinned}; run the pinned version`, { step: 'hfs check', pinned }));
    }
  }
  const prePush = files.includes(PRE_PUSH_FILE) ? readText(repoRoot, PRE_PUSH_FILE) : null;
  if (prePush !== null) {
    const lines = prePush.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
    for (const step of ['typecheck', 'lint:check']) {
      if (!lines.some((line) => new RegExp(`^npm run ${step}(\s|$)`).test(line))) findings.push(found(CI_MISSING_CANON, PRE_PUSH_FILE, `${PRE_PUSH_FILE} does not run \`npm run ${step}\`; pre-push runs typecheck and lint`, { step }));
    }
  }
  return findings;
}
