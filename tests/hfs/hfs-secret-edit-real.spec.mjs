// Real sops and a throwaway age identity: unset, rename and remove, and the binary envelope re-seal the stack verbs must still read.
// Names and paths may be printed. Compare private test data only as booleans.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { resolveRealTool } from "../../scripts/api/process/resolve-real-tool.mjs";
import { resolveSops } from "../../scripts/api/sops/resolve-sops.mjs";
import { envelopeOf } from "../../scripts/hfs/secret.mjs";
import { configuredRecipients } from "../../scripts/hfs/secret-init.mjs";
import { defaultSops } from "../../scripts/hfs/secret-sops.mjs";
import { app, run, privateAbsent } from "../helpers/hfs-secret-fixture.mjs";

const PEM = "-----BEGIN OPENSSH PRIVATE KEY-----\nthrowaway-private-line\r\nsecond-line\n-----END OPENSSH PRIVATE KEY-----\n";

test("real sops: unset and rename keep the other values, remove deletes, a binary data envelope is re-sealed and still readable", (t) => {
  const missing = [];
  if (!resolveSops(process.env)) missing.push("sops");
  if (!resolveRealTool("age-keygen", { env: process.env })) missing.push("age-keygen");
  if (missing.length && (process.env.STARCI_REQUIRE_NATIVE_CRYPTO === "1" || process.env.CI === "true"))
    assert.fail(`real secret edit lifecycle requires sops and age; missing: ${missing.join(", ")}`);
  if (missing.length) {
    t.skip(`real secret edit lifecycle requires sops and age; missing: ${missing.join(", ")}`);
    return;
  }
  const { root, env, dir, localDir } = app(t, {}, "production");
  fs.writeFileSync(path.join(root, ".sops.yaml"), "# Run starci app secret init\ncreation_rules: []\n");
  assert.equal(run(["init"], { cwd: root, env }).code, 0);
  const values = { FIRST_TOKEN: "throwaway-first-value", SECOND_TOKEN: "throwaway-second\nmultiline", THIRD_TOKEN: "throwaway-third-value" };
  for (const [key, value] of Object.entries(values))
    assert.equal(run(["set", "production", "stack", key], { cwd: root, env, stdin: () => `${value}\n` }).code, 0);
  const file = path.join(dir, "stack.enc");
  const [recipient] = configuredRecipients(root, file);

  const dry = run(["unset", "production", "stack", "FIRST_TOKEN"], { cwd: root, env });
  assert.equal(dry.code, 0, dry.err);
  assert.deepEqual(envelopeOf(fs.readFileSync(file, "utf8")).keys.length, 3);
  const unset = run(["unset", "production", "stack", "FIRST_TOKEN", "--execute"], { cwd: root, env });
  assert.equal(unset.code, 0, unset.err);
  const renamed = run(["rename", "production", "stack", "SECOND_TOKEN", "RENAMED_TOKEN", "--execute"], { cwd: root, env });
  assert.equal(renamed.code, 0, renamed.err);
  const sealed = envelopeOf(fs.readFileSync(file, "utf8"));
  assert.deepEqual(sealed.keys, ["RENAMED_TOKEN", "THIRD_TOKEN"]);
  assert.deepEqual(sealed.recipients, [recipient]);
  assert.equal(run(["get", "production", "stack", "--to-file"], { cwd: root, env }).code, 0);
  assert.ok(fs.readFileSync(path.join(localDir, "RENAMED_TOKEN"), "utf8") === values.SECOND_TOKEN, "the renamed key keeps its multiline value");
  assert.ok(fs.readFileSync(path.join(localDir, "THIRD_TOKEN"), "utf8") === values.THIRD_TOKEN, "the untouched key keeps its value");
  assert.ok(!fs.existsSync(path.join(localDir, "FIRST_TOKEN")), "the unset key is gone");
  for (const result of [dry, unset, renamed]) privateAbsent(result, Object.values(values));

  // A classic sops binary envelope, as the ssh key member of the deploy custody is sealed.
  const plainFile = path.join(path.dirname(root), "binary-plain.pem");
  fs.writeFileSync(plainFile, PEM);
  const binary = path.join(dir, "vps-ssh-key.enc");
  const sealedBinary = spawnSync(resolveSops(process.env), ["encrypt", "--age", recipient, "--input-type", "binary", "--output-type", "binary", "--filename-override", binary, plainFile], { encoding: "utf8" });
  assert.equal(sealedBinary.status, 0);
  fs.writeFileSync(binary, sealedBinary.stdout);
  fs.rmSync(plainFile);
  const seam = () => defaultSops(env, root);
  assert.ok(seam().decryptBinary(binary) === PEM, "the classic envelope reads as the file itself");
  const moved = run(["rename", "production", "vps-ssh-key", "data", "privateKey", "--execute"], { cwd: root, env });
  assert.equal(moved.code, 0, moved.err);
  assert.deepEqual(envelopeOf(fs.readFileSync(binary, "utf8")), { format: "json", keys: ["privateKey"], recipients: [recipient] });
  const text = seam().decryptBinary(binary);
  assert.ok(JSON.parse(text).privateKey === PEM, "the re-sealed envelope round-trips every byte, carriage return included");
  privateAbsent(moved, [PEM, "throwaway-private-line"]);

  const refused = run(["remove", "production", "vps-ssh-key", "--execute"], { cwd: root, env });
  assert.equal(refused.code, 2);
  assert.ok(fs.existsSync(binary));
  assert.equal(run(["remove", "production", "vps-ssh-key", "--force-nonempty", "--execute"], { cwd: root, env }).code, 0);
  assert.ok(!fs.existsSync(binary));
  assert.ok(fs.existsSync(file));
});
