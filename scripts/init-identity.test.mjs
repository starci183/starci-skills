import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = mkdtempSync(join(tmpdir(), "starci-init-identity-test-"));
const source = join(root, "source");
const profile = join(root, "profile");
const script = new URL("./init-identity.mjs", import.meta.url).pathname.replace(/^\/(.:\/)/, "$1");
const env = { ...process.env, HOME: profile, USERPROFILE: profile };

const run = (command, args, options = {}) => spawnSync(command, args, {
  encoding: "utf8",
  windowsHide: true,
  ...options,
});

try {
  mkdirSync(source, { recursive: true });
  mkdirSync(profile, { recursive: true });

  let result = run(process.execPath, [script, "--source", source], { env });
  assert.equal(result.status, 0, result.stderr);
  const identity = join(profile, ".starci", "master.identity");
  assert.equal(existsSync(identity), true);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /AGE-SECRET-KEY-/);

  const recipientResult = run("age-keygen", ["-y", identity]);
  assert.equal(recipientResult.status, 0, recipientResult.stderr);
  const credentialDir = join(source, ".stacks", "dev", "runtime", "files");
  mkdirSync(credentialDir, { recursive: true });
  const plain = join(credentialDir, "sample.key");
  const encrypted = `${plain}.enc`;
  const config = join(root, ".sops.yaml");
  writeFileSync(plain, "identity-test-value\n");
  writeFileSync(config, `creation_rules:\n  - path_regex: .*\n    input_type: binary\n    age: ${recipientResult.stdout.trim()}\n`);
  result = run("sops", [
    "--encrypt", "--config", config,
    "--input-type", "binary", "--output-type", "binary",
    "--output", encrypted, plain,
  ]);
  assert.equal(result.status, 0, result.stderr);
  unlinkSync(plain);

  const original = join(root, "original.identity");
  renameSync(identity, original);
  result = run(process.execPath, [script, "--source", source, "--from-file", original], { env });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /verification: identity valid; encrypted sample decrypted/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /AGE-SECRET-KEY-/);
  assert.equal(readFileSync(identity, "utf8"), readFileSync(original, "utf8"));

  result = run(process.execPath, [script, "--source", source], { env });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /verdict: ready/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /AGE-SECRET-KEY-/);

  console.log("init-identity tests passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
