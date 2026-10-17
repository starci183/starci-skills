import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../runtime/engine/yaml.mjs';
import { readCiDeclaration, sealedKeyNames } from '../runtime/scripts/hfs/ci-declaration.mjs';
import { github, refuse } from './github.mjs';
import { setSecret } from './secret.mjs';
import { setVariable, syncVariables } from './vars.mjs';
import { badgeVisibilityNotices, verifyCi } from './verify.mjs';

const COMMANDS = {
  'secret set': ['env', 'dependabot', 'repo'],
  'var set': ['env', 'value', 'repo'],
  'var sync': ['execute', 'repo'],
  verify: ['json', 'repo'],
};
const BOOLEAN = new Set(['dependabot', 'execute', 'json']);

/** Invalid options never echo argv, because an extra argument may itself contain a secret. */
function parse(argv) {
  const command = argv[0] === 'verify' ? 'verify' : argv.slice(0, 2).join(' ');
  const allowed = COMMANDS[command];
  if (!allowed) throw refuse('CI_USAGE', 'use secret set, var set, var sync or verify');
  const positional = [], options = {};
  for (let i = command === 'verify' ? 1 : 2; i < argv.length; i += 1) {
    const arg = argv[i], match = /^--([^=]+)(?:=(.*))?$/s.exec(arg);
    if (!match && !arg.startsWith('-')) { positional.push(arg); continue; }
    const key = match?.[1];
    if (!allowed.includes(key) || Object.hasOwn(options, key)) throw refuse(command === 'secret set' ? 'CI_VALUE_ARGV' : 'CI_USAGE', 'unsupported or repeated option');
    if (BOOLEAN.has(key)) {
      if (match[2] !== undefined) throw refuse('CI_USAGE', 'boolean flags take no value');
      options[key] = true;
    } else {
      const value = match[2] ?? argv[++i];
      if (value === undefined || value.startsWith('--') || (key !== 'value' && !value.length)) throw refuse('CI_USAGE', 'an option value is required');
      options[key] = value;
    }
  }
  const named = command.endsWith(' set');
  if (positional.length !== (named ? 1 : 0)) throw refuse(command === 'secret set' && positional.length > 1 ? 'CI_VALUE_ARGV' : 'CI_USAGE', 'provide the declared name only for set');
  if (named && (!/^[A-Z][A-Z0-9_]*$/.test(positional[0]) || positional[0].startsWith('GITHUB_'))) throw refuse('CI_NAME_UNDECLARED', 'a declared uppercase CI name is required');
  if (options.dependabot && options.env) throw refuse('CI_SCOPE_MISMATCH', 'Dependabot secrets have repository scope');
  return { command, options, name: positional[0] };
}

/** Manifest and sealed key reads remain offline; only github.mjs may invoke the GitHub CLI. */
export async function ciMain(argv, { cwd = process.cwd(), stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s), stdin, env = process.env, tools = {} } = {}) {
  try {
    const parsed = parse(argv);
    let doc, declaration, sealed;
    try {
      doc = parseYaml(fs.readFileSync(path.join(cwd, '.starcistacks/application-stacks.yaml'), 'utf8'));
      declaration = readCiDeclaration(doc);
      sealed = sealedKeyNames(cwd, { fs });
    } catch { throw refuse('CI_DECLARATION_INVALID', 'the manifest or sealed key names could not be read'); }
    if (declaration.problems.length) throw refuse('CI_DECLARATION_INVALID', 'correct the CI declaration before using GitHub');
    const context = { ...parsed, declaration, sealed, gh: github({ cwd, env, spawn: tools.spawn }), stdin, stdout };
    if (parsed.command === 'secret set') return await setSecret(context);
    if (parsed.command === 'var set') return await setVariable(context);
    if (parsed.command === 'var sync') return syncVariables(context);
    context.notices = badgeVisibilityNotices({ doc, gh: context.gh, repo: context.gh.repository(parsed.options.repo) });
    return verifyCi(context);
  } catch (error) {
    stderr(`${error.code ? error.message : 'CI_USAGE: CI command could not complete'}\n`);
    return 2;
  }
}
