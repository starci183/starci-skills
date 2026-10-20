// lint-report.mjs - the external issues report the release gate's sonar row produces before it runs the scanner.
// The app declares `sonar.externalIssuesReportPaths=reports/lint.sonar.json`; the managed CI makes it with `lint --side <side> --sonar reports/lint.<side>.sonar.json`
// per lint matrix side and a "merge Sonar lint reports" step. This module does the same locally, through the same process seam as every gate
// (an argument array through ctx.spawn, never a shell). The merge below is the one in packages/hfs/sync/ci-commands.mjs (sonarMergeSteps): keep them identical.
import fs from 'node:fs';
import path from 'node:path';
import { firstLine, tool } from '../stack/context.mjs';

const LINT_SIDES = ['be', 'fe'];
const MERGED_REPORT = 'reports/lint.sonar.json';
const sideReport = (side) => `reports/lint.${side}.sonar.json`;

/** CI merge: rules unique by id (last one wins, first position kept), issues concatenated in side order. */
function mergeSonarReports(reports) {
  const rules = [...new Map(reports.flatMap((report) => report.rules).map((rule) => [rule.id, rule])).values()];
  const issues = reports.flatMap((report) => report.issues);
  return { rules, issues };
}

/** The sides the app has: a be/ or fe/ folder beside the app root. */
const sidesOf = (root) => LINT_SIDES.filter((side) => fs.existsSync(path.join(root, side)));

/**
 * Runs `starci app lint --side <side> --sonar <file>` for every side the app has, then writes reports/lint.sonar.json.
 * `launch` turns an argv into [command, args] for the platform. Returns { pass, text }: the honest log of every lint run and the verdict.
 * A lint that exits non-zero (findings or error) or writes no report fails the row; nothing is skipped.
 */
export function produceLintReports(ctx, { launch, platform, env }) {
  const sides = sidesOf(ctx.cwd);
  const out = [];
  if (sides.length === 0) return { pass: false, text: `no be/ or fe/ side in ${ctx.cwd}: cannot produce ${MERGED_REPORT}\n` };
  fs.mkdirSync(path.join(ctx.cwd, 'reports'), { recursive: true });
  for (const side of sides) {
    const file = path.join(ctx.cwd, sideReport(side));
    fs.rmSync(file, { force: true });
    const argv = ['npx', 'starci', 'app', 'lint', '--side', side, '--sonar', sideReport(side)];
    const [command, args] = launch(argv, platform);
    out.push(`$ ${argv.join(' ')}\n`);
    const run = tool(ctx, command, args, { cwd: ctx.cwd, env });
    out.push(`${run.stdout ?? ''}${run.stderr ?? ''}`);
    if (run.error) return { pass: false, text: `${out.join('')}\nlint ${side} cannot run (${run.error.message})\n` };
    if (run.status !== 0) return { pass: false, text: `${out.join('')}\nlint ${side} failed: exit ${run.status}; the scanner was not run\n` };
    if (!fs.existsSync(file)) return { pass: false, text: `${out.join('')}\nlint ${side} wrote no ${sideReport(side)}; the scanner was not run\n` };
  }
  try {
    const reports = sides.map((side) => JSON.parse(fs.readFileSync(path.join(ctx.cwd, sideReport(side)), 'utf8')));
    fs.writeFileSync(path.join(ctx.cwd, MERGED_REPORT), `${JSON.stringify(mergeSonarReports(reports), null, 2)}\n`);
  } catch (error) {
    return { pass: false, text: `${out.join('')}\ncannot merge the side reports: ${firstLine(error.message)}\n` };
  }
  return { pass: true, text: `${out.join('')}\nwrote ${MERGED_REPORT} from ${sides.map(sideReport).join(', ')}\n\n` };
}
