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
const RUN_PREFIX = /^\s*(?:-\s+)?run:/;
const NPX_PREFIX = /^npx\s+(?:(?:--no-install|-y)\s+)?/;
const LINT_COMMAND = /^(?:@starci\/cli(?:@(\S+))?|starci)\s+app\s+lint/;
const NPM_RUN_PREFIX = 'npm run ';
const SCRIPT_NAME = /^[\w:.-]+/;
const ARGS_SEPARATOR = /^\s+--\s+/;
const LINE_TERMINATOR = /[\n\r\u2028\u2029]/;
const WHITESPACE = /\s/;

/** The command of a workflow `run:` line (`run: <command>` or `- run: <command>`): the text after `run:` without surrounding whitespace, on one line. */
function runCommandOf(line) {
  const prefix = RUN_PREFIX.exec(line);
  if (!prefix) return undefined;
  const rest = line.slice(prefix[0].length);
  const command = rest.trim();
  if (command) return LINE_TERMINATOR.test(command) ? undefined : command;
  return [...rest].findLast((character) => !LINE_TERMINATOR.test(character));
}

const commandsOf = (text) => text.split(/\r?\n/).map(runCommandOf).filter(Boolean).map((command) => command.replace(/^["']|["']$/g, ''));

/** The commands of a `a && b` chain: the whitespace around each `&&` belongs to the separator. */
function chainedCommands(command) {
  const pieces = command.split('&&');
  const last = pieces.length - 1;
  return pieces.map((piece, index) => {
    const head = index > 0 ? piece.trimStart() : piece;
    return index < last ? head.trimEnd() : head;
  });
}

/** `npm run <script>` or `npm run <script> -- <args>` as { script, args } (args undefined without `--`), else null. */
function parseNpmRun(command) {
  if (!command.startsWith(NPM_RUN_PREFIX)) return null;
  const rest = command.slice(NPM_RUN_PREFIX.length);
  const script = SCRIPT_NAME.exec(rest)?.[0];
  if (!script) return null;
  const tail = rest.slice(script.length);
  if (!tail) return { script, args: undefined };
  const separator = ARGS_SEPARATOR.exec(tail);
  const args = separator ? tail.slice(separator[0].length) : null;
  return args !== null && !LINE_TERMINATOR.test(args) ? { script, args } : null;
}

/** { version } of a `starci app lint` command (`version` undefined when no @starci/cli version is named), else null. */
function lintCommandOf(command) {
  const rest = command.replace(NPX_PREFIX, '');
  const match = LINT_COMMAND.exec(rest);
  if (!match) return null;
  const tail = rest.slice(match[0].length);
  if (tail && !(WHITESPACE.test(tail[0]) && !LINE_TERMINATOR.test(tail.slice(1)))) return null;
  return { version: match[1] };
}

/** `npm run <script> -- <args>` spelled out as the root package.json script it runs; any other command is itself. */
function expanded(command, scripts) {
  const run = parseNpmRun(command);
  if (!run || typeof scripts[run.script] !== 'string') return command;
  return run.args ? `${scripts[run.script]} ${run.args}` : scripts[run.script];
}

/** The findings of R13 over the repository at `repoRoot`; `pins` is the parsed canon-pins.yaml pin map. */
export function pipelineFindings({ repoRoot, files, pins }) {
  const findings = [];
  const pinned = pins?.[hfsPackage]?.version;
  const ci = files.includes(CI_FILE) ? readText(repoRoot, CI_FILE) : null;
  if (ci !== null) {
    const scripts = readJson(repoRoot, 'package.json')?.scripts ?? {};
    const lints = commandsOf(ci).flatMap((command) => chainedCommands(expanded(command, scripts))).map(lintCommandOf).filter(Boolean);
    if (!lints.length) findings.push(found(CI_MISSING_CANON, CI_FILE, `${CI_FILE} has no step that runs \`starci app lint\` (directly or through \`npm run lint\`); CI runs the one lint entry, which includes the repository check`, { step: 'starci app lint' }));
    else if (pinned && !lints.some((match) => match.version === undefined || match.version === pinned)) {
      findings.push(found(CI_MISSING_CANON, CI_FILE, `${CI_FILE} runs starci app lint at ${lints[0].version}, but ${hfsPackage} is pinned at ${pinned}; run the pinned version`, { step: 'starci app lint', pinned }));
    }
  }
  return findings;
}
