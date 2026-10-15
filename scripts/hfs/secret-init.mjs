// secret-init.mjs — initialize the public app rule and an age identity outside Git.
import fs from "node:fs";
import path from "node:path";
import { parseYaml, stringifyYaml } from "../../engine/yaml.mjs";
import { secretEnv } from "../../engine/secrets.mjs";
import { resolveSops } from "../api/sops/resolve-sops.mjs";
import { selectedAgeRecipient } from "../api/sops/selected-age-recipient.mjs";
import { resolveRealTool } from "../api/process/resolve-real-tool.mjs";
import { runProgram } from "../api/process/run-program.mjs";
import { claimFile } from "../api/fs/claim-file.mjs";
import { generateAppIdentity } from "./secret-bootstrap-crypto.mjs";
import { materializeDeclaredPlaceholders } from "./sealed-members.mjs";
import { defaultSops } from "./secret-sops.mjs";
import {
  outsideRepository,
  privateDirectory,
  secretRoots,
} from "./secret-files.mjs";

const PATH_RULE = String.raw`\.starcistacks[/\\][^/\\]+[/\\]secrets[/\\][^/\\]+\.enc$`;
const AGE_IDENTITY_NAME = /^SOPS_AGE_KEY(?:_FILE)?$/i;

/** Bootstrap a new app with its own age identity; only its public recipient leaves this owner. */


/** Bootstrap a new app with its own age identity; only the public recipient leaves this owner. */
export function initializeAppIdentity(repoRoot, { write, tools } = {}) {
  const privateDirectory = path.join(repoRoot, ".claude");
  const privateFile = path.join(privateDirectory, "secret.env");
  const directoryStat = fs.lstatSync(privateDirectory, { throwIfNoEntry: false });
  if (directoryStat && (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()))
    throw new Error("the app private identity directory must be an ordinary directory");
  const privateStat = fs.lstatSync(privateFile, { throwIfNoEntry: false });
  if (privateStat && (!privateStat.isFile() || privateStat.isSymbolicLink() || privateStat.nlink !== 1))
    throw new Error("the app private identity must be an ordinary unlinked file");
  let local;
  try { local = privateStat ? (tools?.secretEnv ?? secretEnv)(privateDirectory, {}) : {}; }
  catch { throw new Error("the app private environment could not be loaded safely"); }
  if (Object.keys(local ?? {}).some((name) => AGE_IDENTITY_NAME.test(name)))
    throw new Error("the app already has a private age identity; initialization must not rotate it");
  const config = readInitializationConfig(path.join(repoRoot, ".sops.yaml"));
  if ((config.creation_rules ?? []).some((rule) => rule?.age))
    throw new Error("the app already has an age recipient; initialization must not rotate it");
  const publish = write ?? ((file, content) => {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const append = file === privateFile || file === path.join(privateDirectory, ".gitignore");
    fs.writeFileSync(file, content, { mode: 0o600, flag: append ? "a" : "w" });
  });
  const generated = generateAppIdentity();
  let privateContent;
  try {
    const prefix = privateStat ? "\nSOPS_AGE_KEY=" : "SOPS_AGE_KEY=";
    privateContent = Buffer.concat([Buffer.from(prefix), generated.identity, Buffer.from("\n")]);
    publish(path.join(privateDirectory, ".gitignore"), "\nsecret.env\n");
    publish(privateFile, privateContent);
    if (process.platform !== "win32") fs.chmodSync(privateFile, 0o600);
    config.creation_rules = [{ path_regex: PATH_RULE, age: generated.recipient }];
    publish(path.join(repoRoot, ".sops.yaml"), stringifyYaml(config));
    return { recipient: generated.recipient, files: [".claude/.gitignore", ".claude/secret.env", ".sops.yaml"] };
  } finally {
    privateContent?.fill(0);
    generated.identity.fill(0);
  }
}

/** Load host-local age selections below the explicit environment, without copying any other credentials. */
export function ageIdentityEnv(repoRoot, env, tools) {
  const load = tools?.secretEnv ?? secretEnv;
  let resolved = {};
  try {
    resolved = load(path.join(repoRoot, ".claude"), env) ?? {};
  } catch {
    return { ...env };
  }
  const own = new Set(Object.keys(env).map((name) => name.toUpperCase()));
  const local = Object.fromEntries(
    Object.entries(resolved).filter(
      ([name]) => AGE_IDENTITY_NAME.test(name) && !own.has(name.toUpperCase()),
    ),
  );
  return { ...env, ...local };
}

/** Select the first matching public age rule, including for SOPS's isolated CI identity path. */
export function configuredRecipients(repoRoot, file) {
  let config;
  try {
    config = parseYaml(
      fs.readFileSync(path.join(repoRoot, ".sops.yaml"), "utf8"),
    );
  } catch {
    throw new Error(
      "a valid .sops.yaml is required; run starci app secret init",
    );
  }
  const relative = path.relative(repoRoot, file).split(path.sep).join("/");
  if (!Array.isArray(config?.creation_rules))
    throw new Error(
      ".sops.yaml requires creation_rules; run starci app secret init",
    );
  const rule = config.creation_rules.find((entry) => {
    try {
      return (
        !entry.path_regex ||
        new RegExp(entry.path_regex).test(relative) ||
        new RegExp(entry.path_regex).test(relative.replaceAll("/", "\\"))
      );
    } catch {
      throw new Error(".sops.yaml has an invalid path_regex");
    }
  });
  const recipients =
    typeof rule?.age === "string"
      ? rule.age.split(",").map((value) => value.trim())
      : [];
  if (
    !recipients.length ||
    recipients.some((value) => !/^age1[a-z0-9]+$/.test(value))
  )
    throw new Error(
      ".sops.yaml must supply public age recipients for this secret; run starci app secret init",
    );
  return recipients;
}

/** Resolve required tools without exposing subprocess output (which can contain private data). */
export function secretTools(env, tools = {}) {
  const sops = (tools.resolveSops ?? resolveSops)(env);
  if (!sops)
    throw new Error(
      "sops is not installed; install SOPS and put sops on PATH (Windows: winget install Mozilla.SOPS)",
    );
  const resolve = tools.resolveRealTool ?? resolveRealTool;
  const age = resolve("age", { env });
  const keygen = resolve("age-keygen", { env });
  if (!age || !keygen)
    throw new Error(
      "age or age-keygen is not installed; install age and put age and age-keygen on PATH",
    );
  return { sops, keygen, run: tools.runProgram ?? runProgram };
}

function readInitializationConfig(configFile) {
  let config = {};
  try {
    if (fs.existsSync(configFile))
      config = parseYaml(fs.readFileSync(configFile, "utf8")) ?? {};
  } catch {
    throw new Error(
      ".sops.yaml is invalid; repair it before initializing secrets",
    );
  }
  if (
    typeof config !== "object" ||
    Array.isArray(config) ||
    (config.creation_rules !== undefined &&
      !Array.isArray(config.creation_rules))
  )
    throw new Error(".sops.yaml must hold a creation_rules list");
  return config;
}

function existingInitializationRule(rules) {
  const canonical = rules.find(
    (rule) =>
      rule?.path_regex === PATH_RULE &&
      typeof rule.age === "string" &&
      rule.age.trim(),
  );
  return (
    canonical ??
    rules.find((rule) => {
      if (typeof rule?.age !== "string" || !rule.age.trim()) return false;
      try {
        return (
          !rule.path_regex ||
          new RegExp(rule.path_regex).test(
            ".starcistacks/production/secrets/app.enc",
          )
        );
      } catch {
        return false;
      }
    })
  );
}

function legacyInitializationRecipient(repoRoot, env, platform, tool) {
  const identity = secretRoots(env, platform).identity;
  outsideRepository(repoRoot, identity);
  privateDirectory(repoRoot, path.dirname(identity));
  const held = claimFile(identity);
  if (!held.ok)
    throw new Error(
      "the age identity is being initialized; retry after that operation settles",
    );
  try {
    if (!fs.existsSync(identity)) {
      const generated = tool.run(tool.keygen, ["-o", identity], {
        env,
        cwd: repoRoot,
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (generated.error || generated.status !== 0)
        throw new Error(
          "age-keygen could not create the private identity outside the repository",
        );
    }
    const stat = fs.lstatSync(identity);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)
      throw new Error("the age identity must be an ordinary private file");
    if (process.platform !== "win32") fs.chmodSync(identity, 0o600);
    const publicKey = tool.run(tool.keygen, ["-y", identity], {
      env,
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (publicKey.error || publicKey.status !== 0)
      throw new Error(
        "age-keygen could not read the public recipient from the existing identity",
      );
    const recipients = String(publicKey.stdout ?? "")
      .trim()
      .split(/\s+/);
    if (
      !recipients.length ||
      recipients.some((value) => !/^age1[a-z0-9]+$/.test(value))
    )
      throw new Error("age-keygen returned an invalid public recipient");
    return recipients.join(",");
  } finally {
    held.release();
  }
}

function initializationRecipient(repoRoot, env, platform, tool, tools) {
  const selectedEnv = ageIdentityEnv(repoRoot, env, tools);
  if (!Object.keys(selectedEnv).some((name) => /^SOPS_AGE_KEY$/i.test(name)))
    return legacyInitializationRecipient(repoRoot, env, platform, tool);
  const result = selectedAgeRecipient({
    env: selectedEnv,
    cwd: repoRoot,
    invocation: {
      runProgram: tool.run,
      resolveRealTool: tools?.resolveRealTool ?? resolveRealTool,
    },
  });
  if (!result.ok)
    throw new Error(`SOPS_AGE_KEY public recipient could not be derived (${result.reason})`);
  return result.publicRecipient;
}

/** Reuse an existing matching age rule; initialization must not rotate an app's recipient. */
export function initializeSecrets(repoRoot, { env, platform, tools, stdout }) {
  const configFile = path.join(repoRoot, ".sops.yaml");
  const config = readInitializationConfig(configFile);
  const rules = config.creation_rules ?? [];
  const existing = existingInitializationRule(rules);
  if (
    existing?.age
      .split(",")
      .some((value) => !/^age1[a-z0-9]+$/.test(value.trim()))
  )
    throw new Error(
      ".sops.yaml must name valid public age recipients; initialization never prints private key material",
    );
  const localEnv = ageIdentityEnv(repoRoot, {}, tools);
  const selectedEnv = ageIdentityEnv(repoRoot, existing ? env : { ...env, ...localEnv }, tools);
  if (!existing && !Object.keys(localEnv).some((name) => /^SOPS_AGE_KEY$/i.test(name))) {
    const initialized = initializeAppIdentity(repoRoot, { tools });
    materializeDeclaredPlaceholders(repoRoot, { recipient: initialized.recipient, processEnv: selectedEnv });
    stdout('secrets initialized; public recipient: ' + initialized.recipient + '\n');
    return 0;
  }
  const tool = secretTools(env, tools);
  const inline = Object.keys(selectedEnv).some((name) => /^SOPS_AGE_KEY$/i.test(name));
  const derived = existing && !inline ? existing.age : initializationRecipient(repoRoot, selectedEnv, platform, tool, tools);
  const recipient = existing?.age ?? derived;
  const exact = rules.findIndex((rule) => rule?.path_regex === PATH_RULE);
  if (exact >= 0) rules[exact] = { ...rules[exact], age: recipient };
  // SOPS uses the first matching rule: keep any existing environment-specific recipients in force.
  else rules.push({ path_regex: PATH_RULE, age: recipient });
  config.creation_rules = rules;
  fs.writeFileSync(
    configFile,
    `# Initialized by starci app secret init; private age identities stay outside Git.\n${stringifyYaml(config)}`,
  );
  materializeDeclaredPlaceholders(repoRoot, {
    recipient,
    recipientsForFile: (file) => configuredRecipients(repoRoot, file),
    processEnv: selectedEnv,
    sops: { seal: (request) => defaultSops(selectedEnv, repoRoot, platform, tools).seal(request) },
  });
  stdout(`secrets initialized; public recipient: ${recipient}\n`);
  if (existing)
    stdout(
      "existing app recipient retained; use its matching age identity for decryption\n",
    );
  return 0;
}
