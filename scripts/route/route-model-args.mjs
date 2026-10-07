import fs from 'node:fs';
import { byCodeUnit } from '../lib/list.mjs';
import { normalizeDifficulty } from '../agent/models.mjs';

const VALUE_OPTIONS = new Map([
  ['--kind', 'kind'], ['--role', 'role'], ['--domain', 'domain'], ['--risk', 'risk'], ['--floor', 'floor'],
  ['--tools', 'tools'], ['--contextTokens', 'contextTokens'], ['--difficulty', 'difficulty'],
  ['--modelsDir', 'modelsDir'], ['--repo', 'repo'],
]);
const FLAG_OPTIONS = new Map([
  ['--external', ['external', true]], ['--unapproved', ['approved', false]], ['--no-review', ['review', false]],
  ['--no-checks', ['checks', false]], ['--plan', ['plan', true]], ['--json', ['json', true]], ['--verbose', ['verbose', true]],
]);

function printHelp(helpFile) {
  const header = fs.readFileSync(helpFile, 'utf8').split('\n');
  const from = header.findIndex((line) => line.startsWith('// Internal entry:'));
  const to = header.findIndex((line) => line.startsWith('// Owner config:'));
  console.log(header.slice(from, to).map((line) => line.replace(/^\/\/ ?/, '')).join('\n').trimEnd());
}

// A value option lands on its property: --tools is a list, --context-tokens a number.
function setOption(args, property, value) {
  if (property === 'tools') args.tools.push(...value.split(','));
  else args[property] = property === 'contextTokens' ? Number(value) : value;
}

export function parseArgs(argv, helpFile) {
  const args = { tools: [] };
  const take = (i) => {
    const value = argv[i + 1];
    if (value === undefined) { console.error(`missing value for ${argv[i]}`); process.exit(2); }
    return value;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--help' || key === '-h') {
      printHelp(helpFile);
      process.exit(0);
    }
    const property = VALUE_OPTIONS.get(key);
    if (property) {
      setOption(args, property, take(i));
      i += 1;
      continue;
    }
    const flag = FLAG_OPTIONS.get(key);
    if (flag) { args[flag[0]] = flag[1]; continue; }
    console.error(`unknown arg ${key}`);
    process.exit(2);
  }
  args.tools = [...new Set(args.tools.map((value) => value.trim()).filter(Boolean))].sort(byCodeUnit);
  if (args.difficulty != null) args.difficulty = normalizeDifficulty(args.difficulty) ?? args.difficulty;
  return args;
}
