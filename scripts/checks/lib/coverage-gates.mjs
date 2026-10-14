// Verify gate claims against the commands actually present in the gate owners.
import { parse } from 'acorn';
import { parseYaml } from '../../../engine/yaml.mjs';
import { enforcerJudgedInEdition } from '../../hfs/edition-slots.mjs';

const commandsOf = (text) => String(text ?? '').split(/\r?\n/).filter((line) => !/^\s*#/.test(line)).join('\n');
function executableSource(text) {
  const comments = [];
  try {
    parse(String(text ?? ''), { ecmaVersion: 'latest', sourceType: 'module', onComment: (_block, _text, start, end) => comments.push([start, end]) });
    let source = String(text ?? '');
    for (const [start, end] of comments.reverse()) source = source.slice(0, start) + ' '.repeat(end - start) + source.slice(end);
    return source;
  } catch { return ''; }
}

// Template variables outside YAML scalars are replaced before parsing; only run steps count.
function jobRunCommands(text) {
  let document;
  try { document = parseYaml(text.replaceAll('{{header}}', '').replace(/\{\{[^{}\n]*\}\}/g, 'template')); } catch { return []; }
  const commands = [];
  for (const job of Object.values(document?.jobs ?? {})) {
    if (job?.if === false || /^(?:false|\$\{\{\s*false\s*\}\})$/.test(String(job?.if))) continue;
    for (const step of job.steps ?? []) if (step.run && step.if !== false && String(step.if) !== 'false') commands.push(commandsOf(step.run));
  }
  return commands;
}

function workflowCommands(context, edition) {
  const group = edition === 'lite' ? 'ci-workflows-lite' : 'ci-workflows';
  return [...context.files]
    .filter(([file]) => file.startsWith(`packages/hfs/templates/app/${group}/`) && /\.ya?ml$/.test(file))
    .flatMap(([, text]) => jobRunCommands(text)).join('\n');
}

function runtimeRuns(context) {
  const text = context.files.get('knowledge/hfs/runtime-slots.yaml');
  try { return (parseYaml(text ?? '')?.ruleParams?.runtime?.selfChecks ?? []).map((entry) => entry.run); } catch { return []; }
}

function runsEnforcer(source, enforcer) {
  if (enforcer.at && source.includes(enforcer.at)) return true;
  const id = enforcer.id;
  if (enforcer.kind === 'runtime') return new RegExp(`\\bruntime\\s+check(?:[^\n]*--only\\s+${id}\\b)?`).test(source) && (!/--only\s/.test(source) || source.includes(`--only ${id}`));
  if (enforcer.kind === 'eslint-be' || enforcer.kind === 'eslint-fe') return /\beslint\b|\bapp\s+lint\b|npm\s+run\s+lint\b/.test(source);
  if (enforcer.kind === 'stylelint') return /\bstylelint\b|npm\s+run\s+lint\b/.test(source);
  if (enforcer.kind === 'hfs' || enforcer.kind === 'machine') return /\bapp\s+check\b/.test(source);
  if (enforcer.kind === 'work-validate') return /\bwork\s+validate\b/.test(source);
  if (enforcer.kind === 'sonar') return /\bsonar(?:-scanner)?\b/.test(source);
  return false;
}

/** Every claimed gate must run an applicable, built enforcer. A comment mentioning a command is no run. */
export function coverageGateFindings(context, rule, edition) {
  const active = (rule.enforcers ?? []).filter((enforcer) => enforcer.status !== 'planned' && !enforcer.planned
    && enforcerJudgedInEdition(context.catalog.rules, enforcer.kind, enforcer.id, edition));
  const out = [];
  const hooks = 'packages/hfs/templates/app/hooks/husky/';
  for (const gate of rule.gates ?? []) {
    let source = '';
    if (gate === 'pre-commit' || gate === 'pre-push') source = commandsOf(context.files.get(`${hooks}${gate}`));
    else if (gate === 'settle' || gate === 'land') source = executableSource(context.files.get('scripts/gates/gate.mjs'));
    else if (gate === 'ci') source = workflowCommands(context, edition);
    else if (gate === 'runtime') source = runtimeRuns(context).join('\n');
    else if (gate === 'sonar') source = workflowCommands(context, edition);
    const real = active.some((enforcer) => gate === 'runtime' ? enforcer.at && runtimeRuns(context).includes(enforcer.at) : runsEnforcer(source, enforcer));
    if (!real) out.push({ code: 'RT_COVERAGE_GATE_LIE', level: 'error', rule: rule.id, edition, path: 'knowledge/hfs/rules.yaml',
      message: `${rule.id} claims ${gate} in ${edition}, but that gate runs none of its applicable enforcers` });
  }
  return out;
}
