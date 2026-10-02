const optionName = (token) => token.slice(2).split('=', 1)[0];

// A value may start with a single dash; one that is `--` or names a known flag is a missing value (use --flag=value).
const looksLikeFlag = (token, known) => token === '--' || (token.startsWith('--') && known.has(optionName(token)));

const optionValue = (argv, index, flag, known) => {
  const token = argv[index];
  const equals = token.indexOf('=');
  if (equals >= 0) return { value: token.slice(equals + 1), consumed: 0 };
  if (flag.type === 'boolean') return { value: true, consumed: 0 };
  if (index + 1 >= argv.length || looksLikeFlag(argv[index + 1], known)) {
    throw new Error(`--${flag.name} needs a value (use --${flag.name}=<value> for a value that looks like an option)`);
  }
  return { value: argv[index + 1], consumed: 1 };
};

const typedValue = (flag, raw) => {
  if (flag.type === 'boolean') {
    if (raw === true || raw === 'true') return true;
    if (raw === 'false') return false;
    throw new Error(`--${flag.name} expects true or false`);
  }
  if (flag.type === 'number') {
    const value = String(raw).trim() === '' ? Number.NaN : Number(raw);
    if (!Number.isFinite(value)) throw new Error(`--${flag.name} expects a number`);
    return value;
  }
  if (flag.type === 'enum' && !flag.enum?.includes(raw)) {
    throw new Error(`--${flag.name} expects one of: ${(flag.enum ?? []).join(', ')}`);
  }
  return raw;
};

/**
 * Validate the arguments after a catalog group and verb.
 *
 * Global options are returned separately so dispatchers can implement them once;
 * localArgs contains only the verb's positionals and local options, in input order.
 * Everything after a bare `--` is passed through unchanged: it is never parsed as an option and
 * only fills positional slots the verb declares.
 */
export function validateArgs(argv, verb, globalFlags = []) {
  const globals = new Map(globalFlags.map((flag) => [flag.name, { ...flag, global: true }]));
  const locals = new Map((verb.flags ?? []).map((flag) => [flag.name, flag]));
  const known = new Map([...globals, ...locals]);
  const values = {};
  const global = {};
  const localArgs = [];
  const positionals = [];
  const passthrough = [];
  let positionalOnly = false;

  try {
    for (let index = 0; index < argv.length; index += 1) {
      const token = argv[index];
      if (positionalOnly) {
        passthrough.push(token);
        localArgs.push(token);
        continue;
      }
      if (token === '--') {
        positionalOnly = true;
        localArgs.push(token);
        continue;
      }
      if (token.startsWith('--')) {
        const name = optionName(token);
        const flag = known.get(name);
        if (!flag) throw new Error(`unknown option --${name}`);
        const { value: raw, consumed } = optionValue(argv, index, flag, known);
        const value = typedValue(flag, raw);
        index += consumed;
        if (flag.type === 'list') {
          values[name] = [...(values[name] ?? []), value];
        } else if (Object.hasOwn(values, name)) {
          throw new Error(`--${name} may be given only once`);
        } else {
          values[name] = value;
        }
        if (flag.global) global[name] = values[name];
        else {
          localArgs.push(token);
          if (consumed) localArgs.push(argv[index]);
        }
        continue;
      }
      if (token.startsWith('-')) throw new Error(`unknown option ${token}`);
      positionals.push(token);
      localArgs.push(token);
    }

    for (const flag of locals.values()) {
      if (flag.required && !Object.hasOwn(values, flag.name)) throw new Error(`missing required option --${flag.name}`);
    }

    const positionalSchema = verb.positional ?? [];
    const variadicAt = positionalSchema.findIndex((entry) => entry.variadic === true);
    const maximum = variadicAt >= 0 ? Infinity : positionalSchema.length;
    if (positionals.length > maximum) throw new Error(`too many positional arguments for ${verb.verb ?? 'command'}`);
    positionals.push(...passthrough.slice(0, Math.max(0, maximum - positionals.length)));
    for (let index = 0; index < positionalSchema.length; index += 1) {
      const schema = positionalSchema[index];
      const supplied = variadicAt === index ? positionals.slice(index) : positionals[index];
      const empty = Array.isArray(supplied) ? supplied.length === 0 : supplied === undefined;
      if (schema.required && empty) throw new Error(`missing required positional ${schema.name}`);
      const candidates = Array.isArray(supplied) ? supplied : supplied === undefined ? [] : [supplied];
      for (const candidate of candidates) {
        if (schema.enum && !schema.enum.includes(candidate)) {
          throw new Error(`${schema.name} expects one of: ${schema.enum.join(', ')}`);
        }
      }
    }

    if (global.edition !== undefined && global.edition !== 'full') {
      throw new Error('--edition expects one of: full');
    }
    if (global.cwd === '') throw new Error('--cwd needs a value');
    if (global.json === true && verb.json === 'none') {
      throw new Error(`${verb.group ?? 'this command'} ${verb.verb ?? ''}`.trim() + ' has no machine output');
    }
    return { ok: true, values, global, localArgs, positionals };
  } catch (error) {
    return { ok: false, code: 2, error: String(error?.message ?? error) };
  }
}

/** Insert dispatcher-owned flags before a pass-through `--`, where handlers still parse them as options. */
export function withFlagsBeforeDashes(args, extra) {
  const at = args.indexOf('--');
  return at < 0 ? [...args, ...extra] : [...args.slice(0, at), ...extra, ...args.slice(at)];
}

const isHelpToken = (token) => token === '--help' || token === '-h' || token === '--help=true';

/**
 * Find the group and verb while allowing catalog global options before them.
 * `help` is true when --help or -h appears before any bare `--`; everything after `--` is pass-through.
 */
export function splitCommand(argv, globalFlags = []) {
  const globals = new Map(globalFlags.map((flag) => [flag.name, flag]));
  const command = [];
  const args = [];
  let help = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--') {
      args.push(...argv.slice(index));
      break;
    }
    if (isHelpToken(token)) {
      help = true;
      continue;
    }
    if (token.startsWith('--')) {
      const flag = globals.get(optionName(token));
      args.push(token);
      const next = argv[index + 1];
      if (flag && flag.type !== 'boolean' && !token.includes('=') && next !== undefined && !looksLikeFlag(next, globals)) args.push(argv[++index]);
    } else if (token.startsWith('-') && token.length > 1) {
      args.push(token);
    } else if (command.length < 2) command.push(token);
    else args.push(token);
  }
  return { group: command[0] ?? null, verb: command[1] ?? null, args, help };
}
