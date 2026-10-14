// secret.mjs - app secret init|set|get|materialize|list: sealed custody and private KEY files.
// SOPS plaintext travels on stdin and stays in memory; normal CLI output contains names and local file paths only.
// Every verb runs at the app root or --cwd. Exit 0 done, 2 refusal; --reveal is the only plaintext stdout path.
import fs from "node:fs";
import path from "node:path";
import { runProgram } from "../api/process/run-program.mjs";
import { resolveRealTool } from "../api/process/resolve-real-tool.mjs";
const sopsInvocation = Object.freeze({ runProgram, resolveRealTool });
import { randomBytes, randomUUID } from "node:crypto";
import { claimFile } from "../api/fs/claim-file.mjs";
import { isSopsEnvelope } from "../lib/sops-envelope.mjs";
import { decrypt as sopsDecrypt } from "../api/sops/decrypt.mjs";
import { seal as sopsSeal } from "../api/sops/seal.mjs";
import { byCodeUnit } from "../lib/list.mjs";
import {
  configuredRecipients,
  initializeSecrets,
  secretTools,
} from "./secret-init.mjs";
import {
  materializedDirectory,
  outsideRepository,
  secretRoots,
  writeSecretFile,
} from "./secret-files.mjs";

class SecretError extends Error {}

const SLUG = /^[a-z0-9][a-z0-9-]*$/u;
const KEY = /^[A-Za-z_]\w*$/u;
const WHITESPACE = String.raw`\s`;
const REQUIRED_INDENT = `${WHITESPACE}+`;
const OPTIONAL_DASH = "-?";
const OPTIONAL_SPACING = `${WHITESPACE}*`;
const RECIPIENT_NAME = "recipient:";
const RECIPIENT_VALUE = String.raw`(\S+)`;
const RECIPIENT_LINE = new RegExp(
  `^${REQUIRED_INDENT}${OPTIONAL_DASH}${OPTIONAL_SPACING}${RECIPIENT_NAME}${OPTIONAL_SPACING}${RECIPIENT_VALUE}`,
  "gmu",
);
const VERBS = new Set(["init", "list", "get", "set", "materialize"]);

/** The envelope format of a sealed secret, read from its text: json, yaml or dotenv. */
export function formatOf(text) {
  const body = String(text).trimStart();
  if (body.startsWith("{")) return "json";
  if (/^sops:\s*$/mu.test(text)) return "yaml";
  return "dotenv";
}

/** The key names a sealed document holds and the age recipients it is sealed to, read without decrypting anything. */
export function envelopeOf(text) {
  const format = formatOf(text);
  if (format === "json") {
    const doc = JSON.parse(text);
    return {
      format,
      keys: Object.keys(doc).filter((name) => name !== "sops"),
      recipients: (doc.sops?.age ?? [])
        .map((entry) => entry.recipient)
        .filter(Boolean),
    };
  }
  if (format === "yaml") {
    const keys = [...text.matchAll(/^([A-Za-z_]\w*):/gmu)]
      .map((match) => match[1])
      .filter((name) => name !== "sops");
    return {
      format,
      keys,
      recipients: [...text.matchAll(RECIPIENT_LINE)].map((match) => match[1]),
    };
  }
  const keys = [...text.matchAll(/^([A-Za-z_]\w*)=/gmu)]
    .map((match) => match[1])
    .filter((name) => !name.startsWith("sops_"));
  return {
    format,
    keys,
    recipients: [
      ...text.matchAll(/^sops_age__list_\d+__map_recipient=(\S+)/gmu),
    ].map((match) => match[1]),
  };
}

/** SOPS dotenv escapes LF as backslash-n; literal backslash-n has no distinct representation. */
export function plaintextOf(format, map) {
  if (format === "json") return `${JSON.stringify(map)}\n`;
  if (format === "yaml")
    return (
      Object.entries(map)
        .map(([name, value]) => name + ": " + JSON.stringify(value))
        .join("\n") + "\n"
    );
  for (const value of Object.values(map))
    if (/\r|\\n/u.test(value))
      throw new SecretError(
        "dotenv cannot preserve a carriage return or literal backslash-n; use an LF line break instead",
      );
  return (
    Object.entries(map)
      .map(
        ([name, value]) => name + "=" + value.replaceAll("\n", String.raw`\n`),
      )
      .join("\n") + "\n"
  );
}

/** The directory of the sealed secrets of the app at `repoRoot` for `env`; the one env that has secrets when none is named. */
function secretsDirectory(repoRoot, env) {
  const stacks = path.join(repoRoot, ".starcistacks");
  if (env) {
    if (!/^[a-z0-9][a-z0-9-]*$/u.test(env))
      throw new SecretError(`--env ${env} is not an environment name`);
    return path.join(stacks, env, "secrets");
  }
  if (!fs.existsSync(stacks))
    throw new SecretError(
      "this app has no .starcistacks; run starci app secret at the app root, or pass --cwd",
    );
  const withSecrets = fs
    .readdirSync(stacks, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        fs.existsSync(path.join(stacks, entry.name, "secrets")),
    )
    .map((entry) => entry.name);
  if (withSecrets.length === 1)
    return path.join(stacks, withSecrets[0], "secrets");
  throw new SecretError(
    withSecrets.length === 0
      ? "no environment of .starcistacks has a secrets folder; pass --env to create the first secret"
      : `more than one environment has secrets (${withSecrets.join(", ")}); pass --env`,
  );
}

const fileOf = (directory, slug) => {
  if (!SLUG.test(slug ?? ""))
    throw new SecretError(
      `${slug === undefined ? "a secret name" : slug} is not a secret slug: lowercase letters, digits and dashes`,
    );
  return path.join(directory, `${slug}.enc`);
};

/** The default sops seam: the runtime's sops api, which finds the binary on this machine. */
function defaultSops(
  env = process.env,
  repoRoot = process.cwd(),
  platform = process.platform,
  tools,
) {
  const { sops: binary } = publicStorage(() => secretTools(env, tools));
  const selectedEnv = { ...env };
  const checkIdentity = (file) =>
    publicStorage(() => {
      outsideRepository(repoRoot, file);
      if (fs.existsSync(file)) {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)
          throw new Error(
            "the age identity must be an ordinary private file without hard links",
          );
      }
    });
  for (const [name, value] of Object.entries(env))
    if (/^SOPS_AGE_KEY_FILE$/i.test(name) && value) {
      if (!path.isAbsolute(value))
        throw new SecretError(
          "SOPS_AGE_KEY_FILE must be an absolute path outside the repository",
        );
      checkIdentity(value);
    }
  if (
    !Object.keys(env).some((name) => /^SOPS_AGE_KEY(?:_FILE)?$/i.test(name))
  ) {
    const identity = secretRoots(env, platform).identity;
    checkIdentity(identity);
    if (fs.existsSync(identity)) selectedEnv.SOPS_AGE_KEY_FILE = identity;
  }
  const refuse = (what, result) => {
    if (result.error?.identityRefusal)
      return Object.assign(new SecretError(result.error.message), {
        identityRefusal: result.error.identityRefusal,
      });
    if (result.error?.code === "SOPS_MISSING")
      return new SecretError(result.error.message);
    return new SecretError(
      `sops could not ${what} (exit ${String(result.status)})`,
    );
  };
  return {
    decrypt(file, format) {
      const result = sopsDecrypt(
        binary,
        ["decrypt", "--input-type", format, "--output-type", "dotenv", file],
        { env: selectedEnv, cwd: repoRoot, invocation: sopsInvocation },
      );
      if (result.status !== 0)
        throw refuse(
          `decrypt ${path.basename(file)}; is the age identity installed?`,
          result,
        );
      const map = Object.create(null);
      for (const line of String(result.stdout).split(/\r?\n/u)) {
        if (!line || line.startsWith("#")) continue;
        const match = /^([A-Za-z_]\w*)=(.*)$/u.exec(line);
        if (!match || Object.hasOwn(map, match[1]))
          throw new SecretError("sops returned an invalid dotenv document");
        map[match[1]] = match[2].replaceAll(String.raw`\n`, "\n");
      }
      return map;
    },
    seal(request) {
      const recipients = request.recipients.length
        ? request.recipients
        : publicStorage(() =>
            configuredRecipients(repoRoot, request.filenameOverride),
          );
      const result = sopsSeal(
        binary,
        { ...request, recipients },
        { env: selectedEnv, cwd: repoRoot, invocation: sopsInvocation },
      );
      if (result.status !== 0) throw refuse("seal the secret", result);
      return result.stdout;
    },
  };
}

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

/** Seal `key = value` into the secret `slug`: an existing document keeps its other keys and its recipients. */
function writeSecret({ file, values, age, sops }) {
  for (const key of Object.keys(values)) validateKey(key);
  const held = claimFile(path.resolve(file));
  if (!held.ok)
    throw new SecretError(
      "the sealed secret is being updated; retry after that write settles",
    );
  try {
    const format = "dotenv";
    let map = Object.create(null);
    let recipients = age;
    if (fs.existsSync(file)) {
      const text = fs.readFileSync(file, "utf8");
      const envelope = envelopeOf(text);
      map = sops.decrypt(file, envelope.format);
      if (!age.length) recipients = envelope.recipients;
    }
    validateMap(map);
    map = { ...map, ...values };
    const sealed = sops.seal({
      inputType: format,
      plaintext: plaintextOf(format, map),
      recipients,
      filenameOverride: file,
    });
    let parsed;
    try {
      parsed = envelopeOf(sealed);
    } catch {
      throw new SecretError("sops returned an invalid sealed document");
    }
    if (
      !isSopsEnvelope(sealed) ||
      parsed.keys.length !== Object.keys(map).length ||
      !parsed.keys.every((key) => Object.hasOwn(map, key))
    )
      throw new SecretError("sops returned an invalid sealed document");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = path.join(
      path.dirname(file),
      `.${path.basename(file)}-${randomUUID()}.tmp`,
    );
    try {
      fs.writeFileSync(temporary, sealed, {
        flag: "wx",
        mode: 0o600,
        flush: true,
      });
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  } finally {
    held.release();
  }
}

/** Update named keys through the same canonical sealed-secret owner used by the CLI. */
export function setSecretValues(
  repoRoot,
  { slug, values, env = null },
  { sops = null, age = [], processEnv = process.env } = {},
) {
  const directory = secretsDirectory(repoRoot, env);
  const file = fileOf(directory, slug);
  if (
    !values ||
    typeof values !== "object" ||
    Array.isArray(values) ||
    !Object.keys(values).length
  )
    throw new SecretError("secret update requires named values");
  for (const value of Object.values(values))
    if (typeof value !== "string" || value === "")
      throw new SecretError("secret values must be nonempty strings");
  writeSecret({
    file,
    values,
    age,
    sops: sops ?? defaultSops(processEnv, repoRoot),
  });
  return { file, via: "sealed-secret" };
}

function validateKey(key) {
  if (!KEY.test(key ?? "") || key.startsWith("sops_"))
    throw new SecretError(
      "KEY must be an environment variable name outside the reserved sops_ namespace",
    );
}

function validateMap(map) {
  if (!map || typeof map !== "object" || Array.isArray(map))
    throw new SecretError("sops returned an invalid secret map");
  for (const [key, value] of Object.entries(map)) {
    validateKey(key);
    if (typeof value !== "string")
      throw new SecretError("secret values must be strings");
  }
}

function sealedFiles(directory) {
  return fs.existsSync(directory)
    ? fs
        .readdirSync(directory)
        .filter((name) => name.endsWith(".enc"))
        .sort(byCodeUnit)
    : [];
}

function readMap(file, sops) {
  if (!fs.existsSync(file))
    throw new SecretError(
      "the requested secret is not sealed in this environment",
    );
  const map = sops.decrypt(
    file,
    envelopeOf(fs.readFileSync(file, "utf8")).format,
  );
  validateMap(map);
  return map;
}

const publicStorage = (action) => {
  try {
    return action();
  } catch (error) {
    throw new SecretError(
      error.code ? `private storage failed (${error.code})` : error.message,
    );
  }
};

function validateWindowsKeys(map) {
  const names = new Set();
  for (const key of Object.keys(map)) {
    const normalized = key.toUpperCase();
    if (names.has(normalized))
      throw new SecretError(
        "KEY names differing only by case cannot be materialized on Windows",
      );
    if (/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(normalized))
      throw new SecretError(
        "a KEY uses a reserved Windows file name and cannot be materialized",
      );
    names.add(normalized);
  }
}

function exportValues(
  map,
  {
    repoRoot,
    environment,
    env,
    platform,
    stdout,
    fileOutput = stdout,
    reveal = false,
    toFile = true,
  },
) {
  if (toFile && platform === "win32") validateWindowsKeys(map);
  const directory = toFile
    ? publicStorage(() =>
        materializedDirectory(repoRoot, environment, env, platform),
      )
    : null;
  for (const key of Object.keys(map).sort(byCodeUnit)) {
    if (toFile) {
      const file = publicStorage(() =>
        writeSecretFile(directory, key, map[key]),
      );
      fileOutput(`${key}_FILE=${file}\n`);
    }
    if (reveal) stdout(`${key}=${map[key]}\n`);
  }
  return 0;
}

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

function listSecrets(directory, stdout) {
  const keys = new Set();
  for (const name of sealedFiles(directory)) {
    for (const item of envelopeOf(
      fs.readFileSync(path.join(directory, name), "utf8"),
    ).keys) {
      validateKey(item);
      keys.add(item);
    }
  }
  for (const item of [...keys].sort(byCodeUnit)) stdout(`${item}\n`);
  return 0;
}

function materializeSecrets(directory, sops, output) {
  const map = Object.create(null);
  for (const name of sealedFiles(directory)) {
    for (const [item, value] of Object.entries(
      readMap(fileOf(directory, name.slice(0, -4)), sops),
    )) {
      if (Object.hasOwn(map, item))
        throw new SecretError(
          `duplicate KEY ${item} across secret slugs; each materialized KEY needs one owner`,
        );
      map[item] = value;
    }
  }
  return exportValues(map, output);
}

function getSecret(file, key, sops, opts, output, stderr) {
  let map = readMap(file, sops);
  if (key !== undefined) {
    if (!Object.hasOwn(map, key))
      throw new SecretError(`the secret has no KEY ${key}`);
    map = { [key]: map[key] };
  }
  return exportValues(map, {
    ...output,
    fileOutput: stderr,
    reveal: opts.reveal,
    toFile: opts["to-file"] === true,
  });
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

function secretErrorMessage(error) {
  if (error instanceof SecretError) return error.message;
  if (error instanceof SyntaxError) return "invalid secret document";
  const code = error.code ? ` (${error.code})` : "";
  return `operation failed${code}; no secret values were printed`;
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
    cwd = process.cwd(),
    platform = process.platform,
    tools,
  } = {},
) {
  const [verb, ...rest] = argv;
  try {
    if (!VERBS.has(verb))
      throw new SecretError(
        "usage: starci app secret init | set <env> <slug> <KEY> | get <env> <slug> [KEY] --to-file | materialize <env> | list <env>",
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
