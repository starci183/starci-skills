// cli-arg.mjs — the `--name value` and `--flag` readers of the thin CLI entries (the scripts/api call files run as
// commands, scripts/agent/send.mjs). Pure.

/** The value after `--<name>` in argv, else `fallback`. */
export const arg = (argv, name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};

/** True when argv holds `--<name>`. */
export const flag = (argv, name) => argv.includes(`--${name}`);

/** The token after the literal `token` in argv, else `fallback` (absent or last). */
export const valueAfter = (argv, token, fallback = null) => {
  const i = argv.indexOf(token);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback;
};

/**
 * The `--name value` / boolean-flag scan the multi-option CLIs share: `spec` maps each accepted token to a setter
 * `(opts, take)` where `take()` consumes the next token as the value (a missing one reports
 * `<token> needs a value` through `fail`); boolean flags are setters that never call `take`. An unrecognized
 * token reports `unrecognized argument: <token>` through `fail` (its return is ignored, so a non-throwing `fail`
 * keeps scanning). Returns `opts`.
 */
export function parseOpts(argv, spec, fail) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const set = spec[token];
    if (!set) { fail(`unrecognized argument: ${token}`); continue; }
    const take = () => {
      i += 1;
      if (argv[i] === undefined) fail(`${token} needs a value`);
      return argv[i];
    };
    set(opts, take);
  }
  return opts;
}

/**
 * The `--<name> value` pairs of `names` read from argv: every other token, a missing value and a `--`-led value throw
 * an error suffixed with `usage`.
 */
export const valueFlags = (argv, names, usage) => {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (names.includes(arg)) {
      if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`${arg} needs a value; ${usage}`);
      opts[arg.slice(2)] = argv[++i];
    } else throw new Error(`unknown argument ${arg}; ${usage}`);
  }
  return opts;
};

/** A parseOpts `fail` that throws `Error(message)`. */
export const argThrow = (message) => { throw new Error(message); };

/** Throw `Error('--<name> is required')` for the first of `names` `args` lacks a value for. */
export const needArgs = (args, names) => {
  for (const name of names) if (!args[name]) throw new Error(`--${name} is required`);
};

/** Setter entries the `.starciwork`-record CLIs share: `--work <dir> --record <id> --cwd <dir>`. */
export const workRecordSpec = {
  '--work': (o, take) => { o.work = take(); },
  '--record': (o, take) => { o.record = take(); },
  '--cwd': (o, take) => { o.cwd = take(); },
};

/** `--work --record --cwd` for the example-record CLIs; throws on an unknown token or a missing value. */
export function parseExampleArgs(argv) {
  const args = parseOpts(argv, workRecordSpec, argThrow);
  needArgs(args, ['work', 'record', 'cwd']);
  return args;
}

/** Setter entries the record-scoped op CLIs share: `--op`, `--records` (csv, accumulated), `--state`, `--json`, `--help`/`-h` (calls `help`). */
export const opRecordSpec = (help) => ({
  '--op': (o, take) => { o.op = take(); },
  '--records': (o, take) => { o.records = [...(o.records ?? []), ...take().split(',')]; },
  '--state': (o, take) => { o.state = take(); },
  '--json': (o) => { o.json = true; },
  '--help': () => help(), '-h': () => help(),
});

/** The final value of an accumulated `--records` list: trimmed, blanks dropped, deduplicated. */
export const recordsList = (args) => [...new Set((args.records ?? []).map((s) => s.trim()).filter(Boolean))];

/**
 * The `usage` + `parseArgs` pair the record-scoped op CLIs share: `usage` prints `usageText` to stderr and exits
 * with the code; `parseArgs` scans the opRecordSpec options plus the CLI's own `spec` setters and resolves
 * `records` to its deduplicated list (recordsList).
 */
export function opCli(usageText, spec) {
  const usage = (code) => { console.error(usageText); process.exit(code); };
  const parseArgs = (argv) => {
    const a = parseOpts(argv, { ...opRecordSpec(() => usage(0)), ...spec }, () => usage(2));
    a.records = recordsList(a);
    return a;
  };
  return { usage, parseArgs };
}

/**
 * The prelude the multi-verb lesson CLIs share (scripts/machine/lessons.mjs, scripts/supervisor/lesson-actions.mjs):
 * `verb` is argv[0]; `value(n)` the token after `--n` (null when absent); `csv(v)` a trimmed non-empty list;
 * `print(result, human)` logs the human text, or the JSON record under `--json`.
 */
export function verbCli(argv = process.argv.slice(2)) {
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const csv = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const asJson = argv.includes('--json');
  const print = (r, human) => console.log(asJson ? JSON.stringify(r) : human);
  return { argv, verb: argv[0], value, csv, asJson, print };
}
