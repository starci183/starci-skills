import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { CATALOG } from '../../packages/cli/src/catalog.generated.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');
const INSTALLS_CLI = /\b(?:npm\s+(?:install|i)|pnpm\s+(?:add|install)|yarn\s+add)\b[^\n;&|]*@starci\/cli\b/;
const INVOCATION = /(?<launcher>npm\s+run\s+starci\b(?:\s+--[a-z][a-z-]*)*\s+--|node\s+packages[\\/]cli[\\/]bin[\\/]starci\.mjs|\bstarci(?![\w-]))(?:\s+(?<args>[^\n;&|)>]+))?/g;

const workflowFiles = () => fs.readdirSync(WORKFLOWS)
  .filter((file) => file.endsWith('.yml'))
  .sort()
  .map((file) => path.join(WORKFLOWS, file));

const words = (source) => [...source.matchAll(/"(?:\\.|[^"])*"|'[^']*'|[^\s<>]+/g)]
  .map(([word]) => word.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, '$1$2'));

const flagName = (word) => word.startsWith('--') ? word.slice(2).split('=', 1)[0] : null;
const consumesValue = (flag) => flag && flag.type !== 'boolean';

function commandOf(argv, location, problems) {
  const globals = new Map(CATALOG.global.map((flag) => [flag.name, flag]));
  let index = 0;
  while (argv[index]?.startsWith('--')) {
    if (argv[index].includes('${{')) return null;
    const name = flagName(argv[index]);
    const flag = globals.get(name);
    if (!flag) {
      problems.push(`${location}: unknown global flag --${name}`);
      return null;
    }
    if (!argv[index].includes('=') && consumesValue(flag)) index += 1;
    index += 1;
  }
  const group = argv[index];
  const verb = argv[index + 1];
  if (group?.includes('${{') || verb?.includes('${{')) return null;
  if (!group || !verb) {
    problems.push(`${location}: StarCi invocation does not name a catalog group and verb`);
    return null;
  }
  const command = CATALOG.groups?.[group]?.verbs?.[verb];
  if (!command) {
    problems.push(`${location}: unknown command starci ${group} ${verb}`);
    return null;
  }
  return { command, group, verb, rest: argv.slice(index + 2) };
}

function validateFlags(parsed, location, problems) {
  if (!parsed) return;
  const allowed = new Set([
    ...CATALOG.global.map((flag) => flag.name),
    ...(parsed.command.flags ?? []).map((flag) => flag.name),
  ]);
  for (const word of parsed.rest) {
    if (word === '--') break;
    if (!word.startsWith('--') || word.includes('${{')) continue;
    const name = flagName(word);
    if (!allowed.has(name)) problems.push(`${location}: starci ${parsed.group} ${parsed.verb} uses unknown flag --${name}`);
  }
}

test('workflow StarCi commands resolve locally and match the generated catalog', () => {
  const problems = [];
  let commands = 0;
  for (const file of workflowFiles()) {
    const relative = path.relative(ROOT, file).split(path.sep).join('/');
    const workflow = YAML.parse(fs.readFileSync(file, 'utf8'));
    for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
      let cliInstalled = false;
      for (const [stepIndex, step] of (job.steps ?? []).entries()) {
        const run = typeof step.run === 'string' ? step.run : '';
        const location = `${relative} job ${jobName} step ${stepIndex + 1}`;
        for (const match of run.matchAll(INVOCATION)) {
          commands += 1;
          const launcher = match.groups.launcher;
          if (launcher === 'starci' && !cliInstalled && !INSTALLS_CLI.test(run.slice(0, match.index))) {
            problems.push(`${location}: bare starci requires an earlier npm install of @starci/cli in the same job`);
          }
          const parsed = commandOf(words(match.groups.args ?? ''), location, problems);
          validateFlags(parsed, location, problems);
        }
        if (INSTALLS_CLI.test(run)) cliInstalled = true;
      }
    }
  }
  assert.ok(commands > 0, 'expected at least one StarCi command in the workflows');
  assert.deepEqual(problems, []);
});
