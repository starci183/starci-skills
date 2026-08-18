#!/usr/bin/env node

import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, delimiter, extname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const fail = (message) => {
  throw new Error(message);
};

process.on("uncaughtException", (error) => {
  console.error(`init-identity: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

const args = process.argv.slice(2);
const take = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) fail(`${name} requires a value`);
  args.splice(index, 2);
  return value;
};
const flag = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
};

const source = resolve(take("--source") ?? process.cwd());
const fromFileArg = take("--from-file");
const plan = flag("--plan");
if (args.length > 0) fail(`unknown argument: ${args[0]}`);
if (!existsSync(source) || !statSync(source).isDirectory()) fail(`Source is not a directory: ${source}`);

const identityDir = join(homedir(), ".starci");
const identityPath = join(identityDir, "master.identity");
const ignoredDirectories = new Set([
  ".git",
  ".claude",
  ".claude_legacy",
  ".workspace",
  ".worktrees",
  "node_modules",
  "coverage",
  "dist",
  "build",
  ".next",
  ".cache",
]);

function resolveCommand(name) {
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")
    : [""];
  for (const directory of (process.env.PATH ?? "").split(delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = join(directory, process.platform === "win32" ? `${name}${extension}` : name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function commandWorks(command) {
  if (!command) return false;
  const result = spawnSync(command, ["--version"], {
    windowsHide: true,
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
  });
  return !result.error && result.status === 0;
}

function findCiphertext(root) {
  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) walk(path);
      } else if (entry.isFile() && entry.name.endsWith(".enc")) {
        found.push(path);
      }
    }
  };
  walk(root);
  return found.sort();
}

function sopsFormat(pathWithoutEnc) {
  if (pathWithoutEnc.endsWith(".env")) return "dotenv";
  if (/\.json$/i.test(pathWithoutEnc)) return "json";
  if (/\.ya?ml$/i.test(pathWithoutEnc)) return "yaml";
  return "binary";
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    windowsHide: true,
    encoding: "utf8",
    ...options,
  });
  if (result.error) fail(`${basename(command)} could not start: ${result.error.message}`);
  return result;
}

function publicRecipient(ageKeygen, keyPath) {
  const result = run(ageKeygen, ["-y", keyPath], { stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0 || !/^age1[0-9a-z]+$/m.test(result.stdout ?? "")) {
    fail("master.identity is not a valid age identity");
  }
  return result.stdout.trim();
}

function verifyExistingSample(sops, keyPath, encryptedPath, scratch) {
  const target = encryptedPath.replace(/\.enc$/i, "");
  const format = sopsFormat(target);
  const output = join(scratch, `decrypted${extname(target) || ".bin"}`);
  const result = run(sops, [
    "--decrypt",
    "--input-type", format,
    "--output-type", format,
    "--output", output,
    encryptedPath,
  ], {
    env: { ...process.env, SOPS_AGE_KEY_FILE: keyPath },
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (result.status !== 0 || !existsSync(output)) fail("identity could not decrypt the Source sample");
}

function verifyTemporarySample(sops, recipient, keyPath, scratch) {
  const plain = join(scratch, "identity-check.txt");
  const encrypted = join(scratch, "identity-check.txt.enc");
  const decrypted = join(scratch, "identity-check.out");
  const config = join(scratch, ".sops.yaml");
  const marker = `starci-identity-check-${process.pid}\n`;
  writeFileSync(plain, marker, { mode: 0o600 });
  writeFileSync(config, `creation_rules:\n  - path_regex: .*\n    input_type: binary\n    age: ${recipient}\n`);
  let result = run(sops, [
    "--encrypt",
    "--config", config,
    "--input-type", "binary",
    "--output-type", "binary",
    "--output", encrypted,
    plain,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  if (result.status !== 0) fail("sops could not create the encrypted identity sample");
  result = run(sops, [
    "--decrypt",
    "--input-type", "binary",
    "--output-type", "binary",
    "--output", decrypted,
    encrypted,
  ], {
    env: { ...process.env, SOPS_AGE_KEY_FILE: keyPath },
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (result.status !== 0 || readFileSync(decrypted, "utf8") !== marker) {
    fail("identity failed the encrypted sample round trip");
  }
}

async function hiddenIdentity() {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    fail("hidden input requires an interactive terminal; use --from-file instead");
  }
  process.stderr.write("original age identity (hidden): ");
  return await new Promise((resolveInput, reject) => {
    let value = "";
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          cleanup();
          process.stderr.write("\n");
          reject(new Error("cancelled"));
          return;
        }
        if (character === "\r" || character === "\n") return finish();
        if (character === "\b" || character === "\u007f") value = value.slice(0, -1);
        else value += character;
      }
    };
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    const finish = () => {
      cleanup();
      process.stderr.write("\n");
      resolveInput(value.trim());
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", onData);
  });
}

const ciphertext = findCiphertext(source);
const commands = {
  sops: resolveCommand("sops"),
  age: resolveCommand("age"),
  ageKeygen: resolveCommand("age-keygen"),
};
const missing = Object.entries(commands).filter(([, value]) => !commandWorks(value)).map(([name]) => name);
const identityExists = existsSync(identityPath);
const sample = ciphertext[0] ?? null;
const relativeSample = sample ? relative(source, sample).split(sep).join("/") : "temporary round-trip";
const verdict = missing.length > 0
  ? "blocked"
  : identityExists
    ? "ready"
    : ciphertext.length > 0
      ? "import-required"
      : "generate";

console.log(`identity: ${identityExists ? "present" : "absent"}`);
console.log(`tools: ${missing.length === 0 ? "sops + age + age-keygen available" : `missing ${missing.join(", ")}`}`);
console.log(`ciphertext: ${ciphertext.length} record(s)`);
console.log(`decrypt sample: ${relativeSample}`);
console.log(`verdict: ${verdict}`);

if (plan) process.exit(missing.length > 0 ? 1 : 0);
if (missing.length > 0) fail(`install required tools before identity setup: ${missing.join(", ")}`);
if (identityExists && fromFileArg) fail("master.identity already exists; replacement is refused");

const scratch = mkdtempSync(join(tmpdir(), "starci-identity-"));
try {
  if (identityExists) {
    publicRecipient(commands.ageKeygen, identityPath);
    if (sample) verifyExistingSample(commands.sops, identityPath, sample, scratch);
    else verifyTemporarySample(commands.sops, publicRecipient(commands.ageKeygen, identityPath), identityPath, scratch);
    console.log("verification: identity valid; encrypted sample decrypted");
  } else {
    mkdirSync(identityDir, { recursive: true, mode: 0o700 });
    const candidate = join(scratch, "master.identity");
    if (ciphertext.length > 0) {
      if (fromFileArg && !existsSync(resolve(fromFileArg))) fail("--from-file does not exist");
      const imported = fromFileArg
        ? readFileSync(resolve(fromFileArg), "utf8")
        : await hiddenIdentity();
      if (!imported.trim()) fail("imported identity is empty");
      writeFileSync(candidate, `${imported.trim()}\n`, { mode: 0o600 });
    } else {
      if (fromFileArg) fail("--from-file is reserved for importing the original identity when ciphertext exists");
      const result = run(commands.ageKeygen, ["-o", candidate], { stdio: ["ignore", "ignore", "ignore"] });
      if (result.status !== 0 || !existsSync(candidate)) fail("age-keygen could not generate master.identity");
    }

    const recipient = publicRecipient(commands.ageKeygen, candidate);
    if (sample) verifyExistingSample(commands.sops, candidate, sample, scratch);
    else verifyTemporarySample(commands.sops, recipient, candidate, scratch);
    chmodSync(candidate, 0o600);
    renameSync(candidate, identityPath);
    try { chmodSync(identityPath, 0o600); } catch {}
    console.log(`installed: ${identityPath}`);
    console.log("verification: identity valid; encrypted sample decrypted");
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
