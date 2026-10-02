// cli-arg.mjs — the `--name value` and `--flag` readers of the thin CLI entries (the scripts/api call files run as
// commands, scripts/agent/send.mjs). Pure.

/** The value after `--<name>` in argv, else `fallback`. */
export const arg = (argv, name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};

/** True when argv holds `--<name>`. */
export const flag = (argv, name) => argv.includes(`--${name}`);
