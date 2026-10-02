const optionName = (token) => token.slice(2).split('=', 1)[0];

const optionValue = (argv, index, flag) => {
  const token = argv[index];
  const equals = token.indexOf('=');
  if (equals >= 0) return { value: token.slice(equals + 1), consumed: 0 };
  if (flag.type === 'boolean') return { value: true, consumed: 0 };
  if (index + 1 >= argv.length || argv[index + 1] === '--') {
    throw new Error(`--${flag.name} needs a value`);
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
    const value = Number(raw);
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
 */
export function validateArgs(argv, verb, globalFlags = []) {
  const globals = new Map(globalFlags.map((flag) => [flag.name, { ...flag, global: true }]));
  const locals = new Map((verb.flags ?? []).map((flag) => [flag.name, flag]));
  const known = new Map([...globals, ...locals]);
  const values = {};
  const global = {};
  const localArgs = [];
  const positionals = [];
  let positionalOnly = false;

  try {
    for (let index = 0; index < argv.length; index += 1) {
      const token = argv[index];
      if (!positionalOnly && token === '--') {
        positionalOnly = true;
        localArgs.push(token);
        continue;
      }
      if (!positionalOnly && token.startsWith('--')) {
        const name = optionName(token);
        const flag = known.get(name);
        if (!flag) throw new Error(`unknown option --${name}`);
        const { value: raw, consumed } = optionValue(argv, index, flag);
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
      if (!positionalOnly && token.startsWith('-')) throw new Error(`unknown option ${token}`);
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
    if (global.json === true && verb.json === 'none') {
      throw new Error(`${verb.group ?? 'this command'} ${verb.verb ?? ''}`.trim() + ' has no machine output');
    }
    return { ok: true, values, global, localArgs, positionals };
  } catch (error) {
    return { ok: false, code: 2, error: String(error?.message ?? error) };
  }
}

/** Find the group and verb while allowing catalog global options before them. */
export function splitCommand(argv, globalFlags = []) {
  const globals = new Map(globalFlags.map((flag) => [flag.name, flag]));
  const command = [];
  const args = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith('--')) {
      const flag = globals.get(optionName(token));
      args.push(token);
      if (flag && flag.type !== 'boolean' && !token.includes('=') && index + 1 < argv.length) args.push(argv[++index]);
    } else if (command.length < 2) command.push(token);
    else args.push(token);
  }
  return { group: command[0] ?? null, verb: command[1] ?? null, args };
}
