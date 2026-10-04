import { parseArgs } from 'node:util';

export function workflowCaller(argv = []) {
  const options = {
    'caller-agent': { type: 'string' }, 'caller-model': { type: 'string' }, 'caller-effort': { type: 'string' }
  };
  const args = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--') break;
    if (!token.startsWith('--') || !Object.hasOwn(options, token.slice(2).split('=')[0])) continue;
    args.push(token);
    if (!token.includes('=') && argv[i + 1] !== undefined) args.push(argv[++i]);
  }
  const { values } = parseArgs({ args, options });
  return { agent: values['caller-agent'] ?? null, model: values['caller-model'] ?? null, effort: values['caller-effort'] ?? null };
}
