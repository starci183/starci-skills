// secret.mjs - app secret init|set|get|materialize|list|verify: sealed custody and private KEY files.
// SOPS plaintext travels on stdin and stays in memory; normal CLI output contains names and local file paths only.
// Every verb runs at the app root or --cwd. Exit 0 done, 2 refusal; --reveal is the only plaintext stdout path.
// verify decrypts each member in memory and names only keys and violated shapes, never a value (R249).
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { invocationDir } from "../lib/roots.mjs";
import { initializeSecrets } from "./secret-init.mjs";
import { validateKey } from "./secret-document.mjs";
import { defaultSops } from "./secret-sops.mjs";
import { fileOf, secretsDirectory, writeSecret } from "./secret-store.mjs";
import { getSecret, listSecrets, materializeSecrets } from "./secret-output.mjs";
import { SecretError, publicStorage, secretErrorMessage } from "./secret-errors.mjs";
import { verifySecrets } from "./rules/env-value-shape.mjs";

export { envelopeOf, formatOf, plaintextOf } from "./secret-document.mjs";
export { setSecretValues } from "./secret-store.mjs";

const VERBS = new Set(["init", "list", "get", "set", "materialize", "verify"]);

function valueOption(opts, flag, value) {
  if (value === undefined || value.startsWith("--"))
    throw new SecretError(`${flag} needs a value`);
  if (Object.hasOwn(opts, flag.slice(2)))
    throw new SecretError(`${flag} may be given only once`);
  opts[flag.slice(2)] = value;
}

function parse(argv) {
  const opts = { positional: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [flag, inline] = arg.split(/=(.*)/su);
    if (["--cwd", "--generate"].includes(flag)) {
      valueOption(opts, flag, inline ?? argv[++i]);
    } else if (["--to-file", "--reveal"].includes(flag)) {
      if (inline !== undefined && !["true", "false"].includes(inline))
        throw new SecretError(`${flag} expects true or false`);
      opts[flag.slice(2)] = inline !== "false";
    } else if (arg.startsWith("--"))
      throw new SecretError(`unknown flag ${arg}`);
    else opts.positional.push(arg);
  }
  return opts;
}

const readStdin = () => {
  if (process.stdin.isTTY)
    throw new SecretError(
      "set reads a value from redirected stdin; use --generate <bytes> to generate one",
    );
  return fs.readFileSync(0, "utf8");
};

function usageArguments(verb) {
  if (verb === "init") return "";
  if (verb === "set") return "<env> <slug> <KEY> [--generate <bytes>]";
  if (verb === "get") return "<env> <slug> [KEY] --to-file [--reveal]";
  return "<env>";
}

function outputOptionsFor(verb, opts) {
  if (
    (opts["to-file"] !== undefined || opts.reveal !== undefined) &&
    verb !== "get"
  )
    throw new SecretError("--to-file and --reveal are only valid for get");
  if (verb === "get" && !opts["to-file"] && !opts.reveal)
    throw new SecretError("get requires --to-file or explicit --reveal");
}

function optionsFor(verb, opts) {
  const count = opts.positional.length;
  const bounds = {
    init: [0, 0],
    list: [1, 1],
    materialize: [1, 1],
    verify: [1, 1],
    set: [3, 3],
    get: [2, 3],
  }[verb];
  if (count < bounds[0] || count > bounds[1])
    throw new SecretError(
      `usage: starci app secret ${verb} ${usageArguments(verb)}`,
    );
  if (opts.generate !== undefined && verb !== "set")
    throw new SecretError("--generate is only valid for set");
  outputOptionsFor(verb, opts);
  if (verb === "set") validateKey(opts.positional[2]);
  if (verb === "get" && opts.positional[2] !== undefined)
    validateKey(opts.positional[2]);
}

function secretValue(opts, stdin, random) {
  let value;
  if (opts.generate !== undefined) {
    const bytes = Number(opts.generate);
    if (!Number.isInteger(bytes) || bytes < 1 || bytes > 1024)
      throw new SecretError(
        "--generate must be a whole byte count from 1 to 1024",
      );
    value = random(bytes).toString("base64url");
  } else {
    if (typeof stdin !== "function" && stdin?.isTTY)
      throw new SecretError("set requires redirected stdin");
    value = String(
      typeof stdin === "function"
        ? stdin()
        : fs.readFileSync(stdin?.fd ?? 0, "utf8"),
    ).replace(/\r?\n$/u, "");
  }
  if (!value) throw new SecretError("the value on stdin is empty");
  return value;
}

/** All app secrets verbs; stdin, sops, random and tool ports permit isolated custody specs. */
export function secretMain(
  argv,
  {
    stdout = (s) => process.stdout.write(s),
    stderr = (s) => process.stderr.write(s),
    stdin = readStdin,
    sops = null,
    random = randomBytes,
    env = process.env,
    cwd = invocationDir(),
    platform = process.platform,
    tools,
  } = {},
) {
  const [verb, ...rest] = argv;
  try {
    if (!VERBS.has(verb))
      throw new SecretError(
        "usage: starci app secret init | set <env> <slug> <KEY> | get <env> <slug> [KEY] --to-file | materialize <env> | list <env> | verify <env>",
      );
    const opts = parse(rest);
    optionsFor(verb, opts);
    const repoRoot = path.resolve(cwd, opts.cwd ?? ".");
    if (verb === "init")
      return publicStorage(() =>
        initializeSecrets(repoRoot, { env, platform, tools, stdout }),
      );
    const [environment, slug, key] = opts.positional;
    const directory = secretsDirectory(repoRoot, environment);
    if (verb === "list") return listSecrets(directory, stdout);
    const seam = sops ?? defaultSops(env, repoRoot, platform, tools);
    if (verb === "verify")
      return verifySecrets({ repoRoot, directory, environment, sops: seam, stdout });
    const output = { repoRoot, environment, env, platform, stdout };
    if (verb === "materialize")
      return materializeSecrets(directory, seam, output);
    const file = fileOf(directory, slug);
    if (verb === "get") return getSecret(file, key, seam, opts, output, stderr);
    const value = secretValue(opts, stdin, random);
    writeSecret({ file, values: { [key]: value }, age: [], sops: seam });
    stdout(`sealed ${environment}/${slug} (${key})\n`);
    return 0;
  } catch (error) {
    const message = secretErrorMessage(error);
    stderr(`starci app secret: ${message}\n`);
    return 2;
  }
}
