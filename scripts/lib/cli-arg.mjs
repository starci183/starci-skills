// cli-arg.mjs — the `--name value` and `--flag` readers of the thin CLI entries (the scripts/api call files run as
// commands, scripts/agent/send.mjs). Pure.

/** The value after `--<name>` in argv, else `fallback`. */
export const arg = (argv, name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};

/** True when argv holds `--<name>`. */
export const flag = (argv, name) => argv.includes(`--${name}`);

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
