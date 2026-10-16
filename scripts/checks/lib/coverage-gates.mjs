// Verify gate claims against the commands actually present in the gate owners.
import { parse } from 'acorn';
import { posix } from 'node:path';
import { parseYaml } from '../../../engine/yaml.mjs';
import { enforcerJudgedInEdition } from '../../hfs/edition-slots.mjs';
import { workflowRunCommands } from './coverage-workflows.mjs';
import { shellCommandSource as commandsOf } from '../../lib/shell-source.mjs';

const runtimeCheckCache = new WeakMap();
const runtimeEmitterCache = new WeakMap();
const STACKS_GATE_FILES = new Set(['scripts/hfs/stacks-gate.mjs', 'scripts/hfs/starcistacks-runtime.mjs', 'scripts/gates/stacks-gate.mjs', 'scripts/gates/starcistacks-runtime.mjs', 'scripts/gates/starcistacks.mjs']);
const SHELL_RUNNERS = new Set(['exec', 'execSync']);
const NODE_RUNNERS = new Set(['runNode', 'runNpm']);
const FILE_RUNNERS = new Set(['execFile', 'execFileSync', 'spawn', 'spawnSync']);

function argumentWords(array) {
  return array?.elements?.map((entry) => typeof entry?.value === 'string' ? entry.value : '<argument>') ?? [];
}

function runnerCommand(entry) {
  const name = entry.callee.name ?? entry.callee.property?.name;
  const args = entry.arguments;
  if (SHELL_RUNNERS.has(name)) return typeof args[0]?.value === 'string' ? commandsOf(args[0].value) : '';
  if (NODE_RUNNERS.has(name)) {
    const words = argumentWords(args[0]);
    if (name === 'runNode' && words[0] === '<argument>' && words[1] === 'app') words[0] = 'starci.mjs';
    return [name === 'runNode' ? 'node' : 'npm', ...words].join(' ');
  }
  if (FILE_RUNNERS.has(name) && typeof args[0]?.value === 'string') return [args[0].value, ...argumentWords(args[1])].join(' ');
  return '';
}

function processCommands(node) {
  const commands = [];
  visitNodes(node, (entry) => {
    if (entry.type === 'FunctionDeclaration' || (entry.type === 'VariableDeclarator' && callable(entry.init))) return false;
    if (entry.type !== 'CallExpression') return;
    const command = runnerCommand(entry);
    if (command) commands.push(command);
  });
  return commands;
}

function gateArgumentCommands(ast) {
  const { functions, exports } = moduleFunctions(ast);
  const pending = [...invokedNames(ast), ...['runGate', 'run', 'gate'].map((name) => exports.get(name)).filter(Boolean)];
  const reached = new Set();
  const commands = processCommands(ast);
  while (pending.length) {
    const name = pending.pop();
    if (reached.has(name) || !functions.has(name)) continue;
    reached.add(name);
    const body = functions.get(name).body;
    commands.push(...processCommands(body));
    pending.push(...invokedNames(body));
  }
  return commands;
}

function executableSource(text) {
  try {
    const ast = parse(String(text ?? ''), { ecmaVersion: 'latest', sourceType: 'module' });
    return gateArgumentCommands(ast).join('\n');
  } catch { return ''; }
}

function workflowCommands(context, edition) {
  const group = edition === 'lite' ? 'ci-workflows-lite' : 'ci-workflows';
  return [...context.files]
    .filter(([file]) => file.startsWith(`packages/hfs/templates/app/${group}/`) && /\.ya?ml$/.test(file))
    .flatMap(([, text]) => workflowRunCommands(text).map(commandsOf)).join('\n');
}

function runtimeChecks(context) {
  const text = context.files.get('knowledge/hfs/runtime-slots.yaml');
  const cached = runtimeCheckCache.get(context.files);
  if (cached && cached.text === text) return cached.checks;
  let checks = [];
  try {
    const entries = parseYaml(text ?? '')?.ruleParams?.runtime?.selfChecks;
    if (Array.isArray(entries)) checks = entries.filter((entry) => typeof entry?.run === 'string');
  } catch { /* Invalid catalog data supplies no gate evidence. */ }
  runtimeCheckCache.set(context.files, { text, checks });
  return checks;
}

function visitNodes(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string' && visit(node) === false) return;
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) child.forEach((entry) => visitNodes(entry, visit));
    else if (child && typeof child === 'object') visitNodes(child, visit);
  }
}

const callable = (node) => ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node?.type);
const exportName = (node) => node?.name ?? node?.value;

function recordFunctions(statement, functions, exports) {
  const declaration = statement.declaration ?? statement;
  const declarations = declaration.type === 'VariableDeclaration' ? declaration.declarations : [declaration];
  for (const entry of declarations) {
    const value = entry.init ?? entry;
    if (!callable(value)) continue;
    const name = entry.id?.name ?? 'default';
    functions.set(name, value);
    if (statement.type === 'ExportNamedDeclaration') exports.set(name, name);
    if (statement.type === 'ExportDefaultDeclaration') exports.set('default', name);
  }
}

function moduleFunctions(ast) {
  const functions = new Map();
  const exports = new Map();
  for (const statement of ast.body) {
    recordFunctions(statement, functions, exports);
    for (const specifier of statement.specifiers ?? []) {
      if (statement.type === 'ExportNamedDeclaration') exports.set(exportName(specifier.exported), exportName(specifier.local));
    }
  }
  return { functions, exports };
}

/** Skip uncalled declarations; inline callbacks remain part of the invoking function. */
function invokedNames(node) {
  const invoked = new Set();
  visitNodes(node, (entry) => {
    if (entry.type === 'FunctionDeclaration' || (entry.type === 'VariableDeclarator' && callable(entry.init))) return false;
    if (entry.type !== 'CallExpression') return;
    if (entry.callee.type === 'Identifier') invoked.add(entry.callee.name);
    else if (entry.callee.type === 'MemberExpression' && entry.callee.object.type === 'Identifier') {
      invoked.add(`${entry.callee.object.name}.${exportName(entry.callee.property)}`);
    }
  });
  return invoked;
}

function moduleImports(ast, file) {
  const imports = new Map();
  for (const statement of ast.body) {
    if (statement.type !== 'ImportDeclaration' || !statement.source.value.startsWith('.')) continue;
    const target = posix.normalize(posix.join(posix.dirname(file), statement.source.value));
    for (const entry of statement.specifiers) {
      let name = exportName(entry.imported) ?? 'default';
      if (entry.type === 'ImportNamespaceSpecifier') name = '*';
      imports.set(entry.local.name, { file: target, name });
    }
  }
  return imports;
}

function invokedImport(imports, name) {
  const [local, member] = name.split('.');
  const entry = imports.get(local);
  if (!entry) return null;
  if (entry.name === '*') return member ? { file: entry.file, names: [member] } : null;
  return { file: entry.file, names: [entry.name] };
}

/** Trace the invoked export and its local helpers, rather than every function in the module. */
function invokedImports(file, text, entries) {
  let ast;
  try { ast = parse(text ?? '', { ecmaVersion: 'latest', sourceType: 'module' }); } catch { return []; }
  const { functions, exports } = moduleFunctions(ast);
  const imports = moduleImports(ast, file);
  const pending = [...invokedNames(ast), ...entries.map((entry) => exports.get(entry)).filter(Boolean)];
  const reached = new Set();
  const out = [];
  while (pending.length) {
    const name = pending.pop();
    if (reached.has(name)) continue;
    reached.add(name);
    if (functions.has(name)) pending.push(...invokedNames(functions.get(name).body));
    else {
      const entry = invokedImport(imports, name);
      if (entry) out.push(entry);
    }
  }
  return out;
}

function runtimeEmitters(context) {
  const cached = runtimeEmitterCache.get(context.files);
  if (cached && [...cached.sources].every(([file, text]) => context.files.get(file) === text)) return cached.reached;
  const reached = new Set();
  const invoked = new Set();
  const sources = new Map();
  const pending = [{ file: 'scripts/checks/check-runtime.mjs', names: ['run', 'check', 'checkRuntime', 'runtimeCheck', 'checkRuntimeMain'] }];
  while (pending.length) {
    const { file, names } = pending.pop();
    sources.set(file, context.files.get(file));
    const fresh = names.filter((name) => !invoked.has(`${file}#${name}`));
    if (!fresh.length || !context.files.has(file)) continue;
    fresh.forEach((name) => invoked.add(`${file}#${name}`));
    reached.add(file);
    pending.push(...invokedImports(file, context.files.get(file), fresh));
  }
  runtimeEmitterCache.set(context.files, { sources, reached });
  return reached;
}

function runtimeRunsEnforcer(context, rule, enforcer, emitters) {
  if (!enforcer.at || !context.files.has(enforcer.at)) return false;
  if (enforcer.kind === 'runtime' && emitters.has(enforcer.at)) return true;
  return rule.scope === 'runtime' && runtimeChecks(context).some((entry) => entry.run === enforcer.at);
}

function commandWords(source) {
  return source.split(/\r?\n|&&|\|\||;/).map((command) =>
    (command.match(/"[^"\n]*"|'[^'\n]*'|[^\s]+/g) ?? []).map((word) => word.replace(/^['"]|['"]$/g, '')));
}

function directlyRuns(source, enforcer) {
  if (!enforcer.at) return false;
  return commandWords(source).some(([command, ...args]) => command === 'node'
    && !args.some((arg) => ['--check', '-c', '--eval', '-e', '--print', '-p', '--help', '-h', '--version', '-v'].includes(arg))
    && args.find((arg) => !arg.startsWith('-'))?.replace(/^\.\//, '') === enforcer.at);
}

function runtimeCommand(words, at) {
  if (words[at + 1] !== 'check') return false;
  if (words[0] === 'starci') return at === 1;
  if (words[0] === 'npx') return at === 2 && words[1] === 'starci';
  return words[0] === 'node' && at === 2 && words[1].endsWith('/starci.mjs');
}

function runtimeCommandRuns(context, rule, enforcer, source, emitters) {
  return commandWords(source).some((words) => {
    const at = words.indexOf('runtime');
    if (!runtimeCommand(words, at)) return false;
    const only = words.slice(at + 2).find((word) => word === '--only' || word.startsWith('--only='));
    if (!only) return runtimeRunsEnforcer(context, rule, enforcer, emitters);
    const id = only === '--only' ? words[words.indexOf(only) + 1] : only.slice('--only='.length);
    const run = runtimeChecks(context).find((entry) => entry.id === id)?.run ?? `scripts/checks/check-${id}.mjs`;
    return rule.scope === 'runtime' && enforcer.at === run && context.files.has(run);
  });
}

function runsEnforcer(context, rule, source, enforcer, emitters) {
  if (directlyRuns(source, enforcer)) return true;
  if (runtimeCommandRuns(context, rule, enforcer, source, emitters)) return true;
  if (enforcer.kind === 'eslint-be' || enforcer.kind === 'eslint-fe') return /\beslint\b|\bapp\s+lint\b|npm\s+run\s+lint\b/.test(source);
  if (enforcer.kind === 'stylelint') return /\bstylelint\b|npm\s+run\s+lint\b/.test(source);
  if (enforcer.kind === 'hfs' || enforcer.kind === 'machine') return appRunsEnforcer(source, enforcer);
  if (enforcer.kind === 'work-validate') return /\bwork\s+validate\b/.test(source);
  if (enforcer.kind === 'sonar') return /\bsonar(?:-scanner)?\b/.test(source);
  return false;
}

function appRunsEnforcer(source, enforcer) {
  // Hygiene has its own CLI route; lint/check do not invoke the staged-file guard.
  if (enforcer.at === 'packages/hfs/sync/hygiene.mjs') {
    return commandWords(source).some((words) => appCommandVerb(words) === 'hygiene' && words[0] !== 'npm');
  }
  // app lint runs the fast content checks and the architecture machine; app check adds the stacks gate.
  const verbs = STACKS_GATE_FILES.has(enforcer.at) ? ['check'] : ['lint', 'check'];
  return commandWords(source).some((words) => verbs.includes(appCommandVerb(words)));
}

function appCommandVerb(words) {
  const [command, first, second, third] = words;
  if (command === 'npm' && first === 'run') return second;
  if (command === 'starci' && first === 'app') return second;
  if (command === 'npx' && first === 'starci' && second === 'app') return third;
  if (command === 'node' && second === 'app' && /(?:^|\/)starci\.mjs$/.test(first ?? '')) return third;
  return null;
}

function gateSource(context, gate, edition) {
  const hooks = 'packages/hfs/templates/app/hooks/husky/';
  if (gate === 'pre-commit' || gate === 'pre-push') return commandsOf(context.files.get(`${hooks}${gate}`));
  if (gate === 'settle' || gate === 'land') return executableSource(context.files.get('scripts/gates/gate.mjs'));
  if (gate === 'ci' || gate === 'sonar') return workflowCommands(context, edition);
  return '';
}

/** Every claimed gate must run an applicable, built enforcer. A comment mentioning a command is no run. */
export function coverageGateFindings(context, rule, edition) {
  const active = (rule.enforcers ?? []).filter((enforcer) => enforcer.status !== 'planned' && !enforcer.planned
    && enforcerJudgedInEdition(context.catalog.rules, enforcer.kind, enforcer.id, edition));
  const out = [];
  const emitters = runtimeEmitters(context);
  for (const gate of rule.gates ?? []) {
    const source = gateSource(context, gate, edition);
    const real = active.some((enforcer) => gate === 'runtime'
      ? runtimeRunsEnforcer(context, rule, enforcer, emitters)
      : runsEnforcer(context, rule, source, enforcer, emitters));
    if (!real) out.push({ code: 'RT_COVERAGE_GATE_LIE', level: 'error', rule: rule.id, edition, path: 'knowledge/hfs/rules.yaml',
      message: `${rule.id} claims ${gate} in ${edition}, but that gate runs none of its applicable enforcers` });
  }
  return out;
}
