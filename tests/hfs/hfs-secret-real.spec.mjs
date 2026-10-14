// Names and paths may be printed. Compare private test data only as booleans.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveRealTool } from "../../scripts/api/process/resolve-real-tool.mjs";
import { resolveSops } from "../../scripts/api/sops/resolve-sops.mjs";
import { formatOf } from "../../scripts/hfs/secret.mjs";
import { app, run, privateAbsent } from "../helpers/hfs-secret-fixture.mjs";

test("real throwaway age identity runs init, set, generated set, get, list and materialize", (t) => {
  const missing = [];
  if (!resolveSops(process.env)) missing.push("sops");
  if (!resolveRealTool("age", { env: process.env })) missing.push("age");
  if (!resolveRealTool("age-keygen", { env: process.env }))
    missing.push("age-keygen");
  if (missing.length) {
    t.skip(
      `real secret custody lifecycle requires sops and age; missing: ${missing.join(", ")}`,
    );
    return;
  }
  const { root, env, dir, localDir } = app(t);
  fs.writeFileSync(
    path.join(root, ".sops.yaml"),
    "# Run starci app secret init\ncreation_rules: []\n",
  );
  const initialized = run(["init"], { cwd: root, env });
  assert.equal(initialized.code, 0);
  const base =
    process.platform === "darwin"
      ? path.join(env.HOME, "Library", "Application Support")
      : process.platform === "win32"
        ? env.APPDATA
        : env.XDG_CONFIG_HOME;
  const keyFile = path.join(base, "sops", "age", "keys.txt");
  const identity = fs.readFileSync(keyFile, "utf8");
  const privateLine = identity
    .split(/\r?\n/u)
    .find((line) => line.startsWith("AGE-SECRET-KEY-"));
  assert.ok(
    typeof privateLine === "string",
    "init generated a throwaway identity",
  );
  privateAbsent(initialized, [privateLine]);
  env.SOPS_AGE_KEY_FILE = keyFile;
  const values = {
    TOKEN: "throwaway-private-lifecycle-value",
    MULTILINE_TOKEN:
      "throwaway-private-first-line\nthrowaway-private-second-line",
    SPECIAL_TOKEN: '  "throwaway-private-quoted" = # value  ',
  };
  for (const [key, value] of Object.entries(values)) {
    const set = run(["set", "dev", "app-env", key], {
      cwd: root,
      env,
      stdin: () => `${value}\n`,
    });
    assert.equal(set.code, 0);
    privateAbsent(set, [...Object.values(values), privateLine]);
  }
  const generated = run(
    ["set", "dev", "session", "SESSION_SECRET", "--generate", "24"],
    { cwd: root, env },
  );
  assert.equal(generated.code, 0);
  const ciphertext = fs.readFileSync(path.join(dir, "app-env.enc"), "utf8");
  assert.ok(
    Object.values(values).every((value) => !ciphertext.includes(value)),
    "custody file contains ciphertext only",
  );
  assert.equal(formatOf(ciphertext), "dotenv");
  const listed = run(["list", "dev"], { cwd: root, env });
  assert.equal(listed.code, 0);
  assert.match(listed.out, /TOKEN/u);
  assert.match(listed.out, /SESSION_SECRET/u);
  const got = run(["get", "dev", "app-env", "TOKEN", "--to-file"], {
    cwd: root,
    env,
  });
  assert.equal(got.code, 0);
  assert.ok(
    fs.readFileSync(path.join(localDir, "TOKEN"), "utf8") === values.TOKEN,
    "real decryption materializes the original value",
  );
  const materialized = run(["materialize", "dev"], { cwd: root, env });
  assert.equal(materialized.code, 0);
  const generatedValue = fs.readFileSync(
    path.join(localDir, "SESSION_SECRET"),
    "utf8",
  );
  assert.ok(
    Buffer.from(generatedValue, "base64url").length === 24,
    "generated value has the requested byte count",
  );
  for (const [key, value] of Object.entries(values))
    assert.ok(
      fs.readFileSync(path.join(localDir, key), "utf8") === value,
      "real dotenv transport preserves multiline and punctuation values exactly",
    );
  for (const result of [generated, listed, got, materialized])
    privateAbsent(result, [
      ...Object.values(values),
      generatedValue,
      privateLine,
    ]);
  assert.ok(
    !fs.existsSync(path.join(root, "secrets.env")),
    "real lifecycle creates no root plaintext file",
  );
  const repeated = run(["init"], { cwd: root, env });
  assert.equal(repeated.code, 0);
  assert.ok(
    fs.readFileSync(keyFile, "utf8") === identity,
    "real init preserves an existing identity",
  );
  privateAbsent(repeated, [privateLine]);
});
