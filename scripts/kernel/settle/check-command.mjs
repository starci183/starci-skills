// Canonical check commands of the existing independent runner, parsed without a shell.
import path from 'node:path';
import { loadCatalog } from '../../cli/catalog.mjs';
import { loadOpGate } from '../../gates/read-digest.mjs';

const DEFAULT_ROOT = path.resolve(import.meta.dirname, '../../..');
const SHELL_OPERATOR = (s, i) => '&|;<>`'.includes(s[i]) || (s[i] === '$' && s[i + 1] === '(');

/** One unquoted character into {out, cur, q, any}; null when it is a shell operator. */
const unquoted = (st, c, s, i) => {
  if (c === '"' || c === "'") { st.q = c; st.any = true; return st; }
  if (/\s/.test(c)) {
    if (st.cur || st.any) st.out.push(st.cur);
    st.cur = ''; st.any = false;
    return st;
  }
  if (SHELL_OPERATOR(s, i)) return null;
  st.cur += c;
  return st;
};

/** Split a command line into argv, quotes honoured; null when it holds a shell operator or a <placeholder>. */
export function argvOf(command) {
  const s = String(command ?? '').trim();
  if (!s) return null;
  const st = { out: [], cur: '', q: null, any: false };
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (st.q) {
      if (c === st.q) st.q = null;
      else st.cur += c;
      continue;
    }
    if (!unquoted(st, c, s, i)) return null;
  }
  if (st.q) return null;
  if (st.cur || st.any) st.out.push(st.cur);
  return st.out;
}

const norm = (p) => String(p).replaceAll('\\', '/');
const GIT_ACTION = /^git\s+(?:add|commit|status|rev-parse|log|diff|show|push|fetch|cat-file|merge-base|ls-files|branch|stash)\b/i;
const OTHER_ACTION = /^(?:n\/a|read|cat|type|ls|dir)\b/i;
const isAction = (command) => GIT_ACTION.test(command) || OTHER_ACTION.test(command);
const MUTATING_FLAG = /^--(?:fix|write|apply|in-place)(?:=|$)/;

const CLI_REL = 'packages/cli/bin/starci.mjs';
// The read-only actions of `starci work graph` (its script is the verb's impl): propose writes and is never re-run.
const WORK_GRAPH_REL = 'scripts/work/work-graph.mjs';
const WORK_GRAPH_READS = new Set(['validate', 'show', 'diff']);

// The read-only `starci work` verbs that are checks of an op's own contract (modules/ops/ops/brand.decide.yaml: brand and shell conformance): they only read the
// records and report findings, so the settler re-runs them as it re-runs a validate. Verb -> the script that is the verb's impl.
const WORK_CHECK_SCRIPTS = Object.freeze({ brand: 'scripts/work/brand/brand.mjs', 'shell-conformance': 'scripts/work/ui/shell-conformance.mjs' });
const WORK_CHECK_RELS = new Set(Object.values(WORK_CHECK_SCRIPTS));
const workCheckOf = (rest, skillRoot) => {
  const rel = rest[0] === 'work' ? WORK_CHECK_SCRIPTS[rest[1]] : null;
  return rel ? { kind: 'runtime', script: path.join(skillRoot, ...rel.split('/')), argv: rest.slice(2), rel } : null;
};

/** The `starci ...` argv branch of classifyCheck. */
const classifyStarciArgv = (rest, skillRoot, mechanical) => {
  if (rest.some((a) => MUTATING_FLAG.test(a))) return { kind: 'foreign', why: 'mutating-flag' };
  if (mechanical) { const native = mechanismCommand(rest, skillRoot); if (native) return native; }
  if (rest[0] === 'work' && rest[1] === 'graph' && WORK_GRAPH_READS.has(rest[2])) return { kind: 'runtime', script: path.join(skillRoot, ...WORK_GRAPH_REL.split('/')), argv: rest.slice(2), rel: WORK_GRAPH_REL };
  const workCheck = workCheckOf(rest, skillRoot);
  if (workCheck) return workCheck;
  if (rest[0] !== 'runtime' || rest[1] !== 'validate') return { kind: 'foreign', why: 'not-a-runtime-check' };
  return { kind: 'runtime', script: path.join(skillRoot, ...CLI_REL.split('/')), argv: rest, rel: CLI_REL };
};

/** The `node <script> ...` argv branch of classifyCheck. */
const classifyNodeArgv = (argv, skillRoot, mechanical) => {
  if (!/^node(?:\.exe)?$/i.test(path.basename(argv[0])) || !argv[1]) return { kind: 'foreign', why: 'not-a-runtime-check' };
  const rel = /(?:^|\/)\.claude\/((?:packages\/cli\/bin|scripts)\/.+\.mjs)$/i.exec(norm(argv[1]))?.[1]
    ?? (norm(path.resolve(argv[1])).toLowerCase().startsWith(`${norm(skillRoot).toLowerCase()}/`) ? norm(path.relative(skillRoot, path.resolve(argv[1]))) : null);
  if (!rel) return { kind: 'foreign', why: 'outside-runtime' };
  const rest = argv.slice(2);
  if (rest.some((a) => MUTATING_FLAG.test(a))) return { kind: 'foreign', why: 'mutating-flag' };
  const ok = (rel === CLI_REL && rest[0] === 'runtime' && rest[1] === 'validate')
    || (/^scripts\/checks\/[\w.-]+\.mjs$/.test(rel))
    || (rel === WORK_GRAPH_REL && WORK_GRAPH_READS.has(rest[0]))
    || WORK_CHECK_RELS.has(rel);
  if (mechanical) { const native = rel === CLI_REL ? mechanismCommand(rest, skillRoot) : mechanismScript(rel, rest, skillRoot); if (native) return native; }
  const viaCli = rel === CLI_REL ? workCheckOf(rest, skillRoot) : null;
  if (viaCli) return viaCli;
  if (!ok) return { kind: 'foreign', why: `not-a-check-script:${rel}` };
  return { kind: 'runtime', script: path.join(skillRoot, ...rel.split('/')), argv: rest, rel };
};

/**
 * One declared check, classified: {kind: 'action'} (evidence of an action, not a check), {kind: 'runtime', argv, script}
 * (re-runnable), or {kind: 'foreign', why}.
 */
export function classifyCheck(check, { skillRoot = DEFAULT_ROOT, mechanical = false } = {}) {
  const command = String(check?.command ?? '').trim();
  if (!command || isAction(command)) return { kind: 'action' };
  const argv = argvOf(command);
  if (!argv) return { kind: 'foreign', why: 'shell-or-placeholder' };
  if (/^starci(?:\.cmd|\.exe)?$/i.test(path.basename(argv[0]))) return classifyStarciArgv(argv.slice(1), skillRoot, mechanical);
  return classifyNodeArgv(argv, skillRoot, mechanical);
}


// Removing an output destination keeps the independent run from rewriting a filed
// immutable attachment. Verification selection flags and their exact values remain.
const withoutOutput = (args) => {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--out') {
      if (i + 1 >= args.length) return null;
      i += 1;
    }
    else if (!args[i].startsWith('--out=')) out.push(args[i]);
  }
  return out;
};
const proofOwners = (root) => Object.values(loadOpGate({ base: root }).proofs ?? {});
const catalogCommands = (root) => loadCatalog(root).groups.flatMap((group) => group.verbs.map((verb) => ({ ...verb, group: group.group })));
const mechanismScript = (rel, args, root) => {
  const proof = proofOwners(root).find((row) => row.script === rel);
  if (!proof || args.some((arg) => MUTATING_FLAG.test(arg) || /^--(?:cwd|sonar)(?:=|$)/.test(arg))) return null;
  const argv = withoutOutput(args);
  return argv ? { kind: 'runtime', mechanical: true, runtimeRoot: root, schema: proof.schema, rel, script: path.join(root, rel), argv } : null;
};
const mechanismCommand = (args, root) => {
  const command = catalogCommands(root).find((row) => row.group === args[0] && row.verb === args[1]);
  if (!command || command.removed === true) return null;
  if (command.impl?.script) return mechanismScript(command.impl.script, args.slice(2), root);
  // HFS owns lint through the real physical CLI; its catalog schema and the proof
  // declaration identify the result. No in-process proof-owner is launched here.
  const proof = proofOwners(root).find((row) => row.schema === command.json);
  if (!proof || command.owner !== '@starci/hfs' || args.some((arg) => MUTATING_FLAG.test(arg) || /^--(?:cwd|sonar)(?:=|$)/.test(arg))) return null;
  return { kind: 'runtime', mechanical: true, runtimeRoot: root, schema: proof.schema, rel: 'packages/cli/bin/starci.mjs',
    script: path.join(root, 'packages/cli/bin/starci.mjs'), argv: args };
};
