// Names and paths may be printed. Compare private test data only as booleans.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "../helpers/tmpdir.mjs";
import { app, run, privateAbsent } from "../helpers/hfs-secret-fixture.mjs";
import {
  envelopeOf,
  formatOf,
  plaintextOf,
  setSecretValues,
} from "../../scripts/hfs/secret.mjs";
import { secretRoots } from "../../scripts/hfs/secret-files.mjs";
import { parseYaml } from "../../engine/yaml.mjs";
import { ageIdentityEnv, configuredRecipients } from "../../scripts/hfs/secret-init.mjs";
import { isSopsEnvelope, selectedAgeEnvelope } from "../../scripts/lib/sops-envelope.mjs";
import { selectedAgeRecipient } from "../../scripts/api/sops/selected-age-recipient.mjs";

const RECIPIENT = `age1${"q".repeat(58)}`;
const OTHER_RECIPIENT = `age1${"p".repeat(58)}`;
const PRIVATE_KEY = `AGE-SECRET-KEY-1${"Q".repeat(58)}`;
const ENC = "ENC[AES256_GCM,data:AA==,iv:AA==,tag:AA==,type:str]";
const sealedJson = (keys) =>
  `${JSON.stringify({ ...Object.fromEntries(keys.map((key) => [key, ENC])), sops: { mac: ENC, age: [{ recipient: RECIPIENT, enc: "x" }] } })}\n`;
const sealedDotenv = (keys, recipients = [RECIPIENT]) => {
  const members = keys.map((key) => `${key}=${ENC}`).join("\n");
  const metadata = recipients.map((recipient, i) => `sops_age__list_${i}__map_recipient=${recipient}`).join("\n");
  return `${members}\n${metadata}\nsops_mac=${ENC}\n`;
};
const CONFIG = `creation_rules:\n  - path_regex: '\\.starcistacks[/\\\\][^/\\\\]+[/\\\\]secrets[/\\\\][^/\\\\]+\\.enc$'\n    age: ${RECIPIENT}\n`;

function fakeSops(plain = {}) {
  const sealed = [];
  const decrypted = [];
  return {
    sealed,
    decrypted,
    decrypt: (file, format) => {
      decrypted.push({ file, format });
      return { ...plain[path.basename(file)] };
    },
    seal: (request) => {
      sealed.push(request);
      const keys =
        request.inputType === "dotenv"
          ? request.plaintext
              .split("\n")
              .filter(Boolean)
              .map((line) => line.split("=")[0])
          : Object.keys(JSON.parse(request.plaintext));
      if (request.inputType === "dotenv") {
        const recipients = request.recipients.length ? request.recipients : [RECIPIENT];
        return sealedDotenv(keys, recipients);
      }
      return sealedJson(keys);
    },
  };
}

function fakeTools() {
  const calls = [];
  return {
    calls,
    resolveSops: () => "fixture-sops",
    resolveRealTool: () => "fixture-age-keygen",
    runProgram: (file, args) => {
      calls.push({ file, args });
      if (args[0] === "-o") {
        fs.writeFileSync(
          args[1],
          `# public key: ${RECIPIENT}\n${PRIVATE_KEY}\n`,
          { mode: 0o600 },
        );
        return { status: 0, stdout: "", stderr: "" };
      }
      if (args[0] === "-y")
        return { status: 0, stdout: `${RECIPIENT}\n`, stderr: "" };
      return { status: 1, stdout: "", stderr: "" };
    },
  };
}

const selectedEnvelope = (recipient) => {
  const payload = "-----BEGIN AGE ENCRYPTED FILE-----\nYWdlLWJsb2Nr\n-----END AGE ENCRYPTED FILE-----";
  const encodedPayload = payload.replaceAll("\n", String.raw`\n`);
  return sealedDotenv(["TOKEN"], [recipient]) +
    `sops_age__list_0__map_enc=${encodedPayload}\n` +
    "sops_version=3.13.2\nsops_lastmodified=2026-01-01T00:00:00Z\n";
};

function selectedInitTools(calls, {
  identity = PRIVATE_KEY,
  recipient = RECIPIENT,
  failDerivation = false,
} = {}) {
  return {
    resolveSops: () => process.execPath,
    resolveRealTool: () => process.execPath,
    runProgram: (file, args, options) => {
      const result = {
        status: 0,
        signal: null,
        error: null,
        stdout: Buffer.alloc(0),
        stderr: Buffer.alloc(0),
      };
      const call = {
        args: [...args],
        input: options.input,
        result,
        hasAgeKey: Object.hasOwn(options.env, "SOPS_AGE_KEY"),
        hasKeyFile: Object.hasOwn(options.env, "SOPS_AGE_KEY_FILE"),
        keyMatches: options.env.SOPS_AGE_KEY === identity,
      };
      calls.push(call);
      if (args[0] === "--disable-version-check") result.stdout = Buffer.from("sops 3.13.2\n");
      else if (args[0] === "--version") result.stdout = Buffer.from("1.3.1\n");
      else if (args[0] === "-y") {
        const matches = Buffer.isBuffer(options.input) && options.input.equals(Buffer.from(identity));
        if (failDerivation || !matches) {
          result.status = 1;
          result.stderr = Buffer.from(identity);
        } else result.stdout = Buffer.from(`${recipient}\n`);
      } else if (args[0] === "encrypt") result.stdout = Buffer.from(selectedEnvelope(recipient));
      else if (args[0] === "decrypt") result.stdout = Buffer.from("TOKEN=private-initialized-value\n");
      else result.status = 1;
      return result;
    },
  };
}

const selectedCapturesWiped = (calls) => {
  for (const call of calls) {
    if (Buffer.isBuffer(call.input))
      assert.ok(call.input.every((byte) => byte === 0), "identity/document input was wiped");
    assert.ok(call.result.stdout.every((byte) => byte === 0), "stdout capture was wiped");
    assert.ok(call.result.stderr.every((byte) => byte === 0), "stderr capture was wiped");
    assert.ok(call.args.every((arg) => !arg.includes(PRIVATE_KEY)), "identity never rides argv");
  }
};

test("envelope inspection reads format, key names and public recipients without decrypting", () => {
  assert.equal(formatOf(sealedJson(["TOKEN"])), "json");
  assert.equal(formatOf(sealedDotenv(["TOKEN"])), "dotenv");
  assert.equal(formatOf("A: ENC[x]\nsops:\n  age: []\n"), "yaml");
  assert.deepEqual(envelopeOf(sealedJson(["TOKEN"])), {
    format: "json",
    keys: ["TOKEN"],
    recipients: [RECIPIENT],
  });
  assert.deepEqual(envelopeOf(sealedDotenv(["DATABASE_URL", "REDIS_URL"])), {
    format: "dotenv",
    keys: ["DATABASE_URL", "REDIS_URL"],
    recipients: [RECIPIENT],
  });
  assert.ok(
    plaintextOf("dotenv", { A: "private-one", B: "private-two" }) ===
      "A=private-one\nB=private-two\n",
    "dotenv serialization preserves named values",
  );
  assert.ok(
    plaintextOf("dotenv", { A: "one\ntwo" }) === "A=one\\ntwo\n",
    "dotenv transports LF as an escaped value on one physical line",
  );
  for (const value of ["one\rtwo", String.raw`one\ntwo`])
    assert.throws(
      () => plaintextOf("dotenv", { A: value }),
      /cannot preserve/u,
    );
});

test("platform root defaults use roaming config, Linux config/data, and macOS application support", (t) => {
  const home = mkdtemp(t, "hfs-secret-roots-");
  const windows = secretRoots({ USERPROFILE: home }, "win32");
  assert.equal(
    windows.identity,
    path.join(home, "AppData", "Roaming", "sops", "age", "keys.txt"),
  );
  assert.equal(
    windows.local,
    path.join(home, "AppData", "Local", "StarCi", "secrets"),
  );
  const linux = secretRoots({ HOME: home }, "linux");
  assert.equal(
    linux.identity,
    path.join(home, ".config", "sops", "age", "keys.txt"),
  );
  assert.equal(
    linux.local,
    path.join(home, ".local", "share", "StarCi", "secrets"),
  );
  const mac = secretRoots({ HOME: home }, "darwin");
  assert.equal(
    mac.identity,
    path.join(
      home,
      "Library",
      "Application Support",
      "sops",
      "age",
      "keys.txt",
    ),
  );
  assert.equal(
    mac.local,
    path.join(home, "Library", "Application Support", "StarCi", "secrets"),
  );
});

test("init creates an ignored app-owned key and canonical path rule, then reuses both without disclosing the identity", (t) => {
  const { root, env } = app(t);
  fs.writeFileSync(
    path.join(root, ".sops.yaml"),
    "# Run starci app secret init\ncreation_rules: []\n",
  );
  const unavailable = {
    resolveSops: () => assert.fail("fresh init needs no native SOPS tool"),
    resolveRealTool: () => assert.fail("fresh init needs no native age tool"),
  };
  const result = run(["init"], { cwd: root, env, tools: unavailable, platform: "win32" });
  assert.equal(result.code, 0, result.err);
  const keyFile = path.join(root, ".claude", "secret.env");
  const identity = ageIdentityEnv(root, {}).SOPS_AGE_KEY;
  assert.ok(/^AGE-SECRET-KEY-1[A-Z0-9]+$/u.test(identity), "init installs an app-owned age identity");
  assert.ok(
    fs.readFileSync(path.join(root, ".claude", ".gitignore"), "utf8").split(/\r?\n/u).includes("secret.env"),
    "the private identity is ignored by git",
  );
  assert.ok(!fs.existsSync(secretRoots(env, "win32").identity), "fresh init creates no machine-level identity");
  const config = fs.readFileSync(path.join(root, ".sops.yaml"), "utf8");
  const [recipient] = configuredRecipients(root, path.join(root, ".starcistacks", "dev", "secrets", "app.enc"));
  assert.match(recipient, /^age1[a-z0-9]{58}$/u);
  assert.ok(
    config.includes(
      String.raw`\.starcistacks[/\\][^/\\]+[/\\]secrets[/\\][^/\\]+\.enc$`,
    ),
    "config uses the canonical custody path regex",
  );
  assert.ok(!config.includes(identity), "config contains no private identity");
  privateAbsent(result, [identity]);
  const before = fs.readFileSync(keyFile, "utf8");
  const calls = [];
  const repeated = run(["init"], {
    cwd: root, env, platform: "win32", tools: selectedInitTools(calls, { identity, recipient }),
  });
  assert.equal(repeated.code, 0, repeated.err);
  assert.ok(calls.every((call) => call.args[0] !== "-o"), "repeated init generates no new identity");
  assert.ok(fs.readFileSync(keyFile, "utf8") === before, "rerunning init preserves the app identity");
  assert.deepEqual(parseYaml(fs.readFileSync(path.join(root, ".sops.yaml"), "utf8")), parseYaml(config));
  selectedCapturesWiped(calls);
  privateAbsent(repeated, [identity]);
});

test("new apps get distinct recipients and sealed members despite sharing host identity selections", (t) => {
  const first = app(t);
  const second = app(t);
  const sharedIdentityFile = secretRoots(first.env, process.platform).identity;
  fs.mkdirSync(path.dirname(sharedIdentityFile), { recursive: true });
  fs.writeFileSync(sharedIdentityFile, `${PRIVATE_KEY}\n`, { mode: 0o600 });
  const results = [];
  const recipients = [];
  const identities = [];
  for (const fixture of [first, second]) {
    fs.writeFileSync(path.join(fixture.root, ".starcistacks", "dev", "environment.json"), JSON.stringify({
      secrets: [{ where: "secrets/token", keys: ["TOKEN"] }],
    }));
    const env = { ...first.env, SOPS_AGE_KEY: PRIVATE_KEY, SOPS_AGE_KEY_FILE: sharedIdentityFile };
    const result = run(["init"], {
      cwd: fixture.root,
      env,
      tools: {
        resolveSops: () => assert.fail("app bootstrap must not reuse host tools or keys"),
        resolveRealTool: () => assert.fail("app bootstrap must not reuse host tools or keys"),
      },
    });
    assert.equal(result.code, 0, result.err);
    const file = path.join(fixture.dir, "token.enc");
    const [recipient] = configuredRecipients(fixture.root, file);
    const sealed = fs.readFileSync(file, "utf8");
    assert.ok(isSopsEnvelope(sealed), "the generated member contains only encrypted values");
    assert.deepEqual(envelopeOf(sealed), { format: "dotenv", keys: ["TOKEN"], recipients: [recipient] });
    assert.deepEqual(selectedAgeEnvelope(sealed, "dotenv", recipient), { ok: true });
    assert.notEqual(recipient, RECIPIENT, "host public recipient is not selected for a new app");
    results.push(result);
    recipients.push(recipient);
    identities.push(ageIdentityEnv(fixture.root, {}).SOPS_AGE_KEY);
  }
  assert.notEqual(recipients[0], recipients[1], "each new app has its own public recipient");
  assert.ok(identities[0] !== identities[1], "each new app has its own private identity");
  assert.ok(identities.every((identity) => identity !== PRIVATE_KEY), "host private identity is not copied");
  assert.ok(fs.readFileSync(sharedIdentityFile, "utf8") === `${PRIVATE_KEY}\n`, "shared host identity remains unchanged");
  for (const result of results) privateAbsent(result, [PRIVATE_KEY, ...identities]);
});
test("init and set share the secret.env inline identity ahead of legacy keys.txt", (t) => {
  for (const legacyExists of [false, true]) {
    const { root, env, dir } = app(t);
    const keyFile = secretRoots(env, process.platform).identity;
    const legacy = `AGE-SECRET-KEY-1${"P".repeat(58)}\n`;
    if (legacyExists) {
      fs.mkdirSync(path.dirname(keyFile), { recursive: true });
      fs.writeFileSync(keyFile, legacy, { mode: 0o600 });
    }
    const claude = path.join(root, ".claude");
    fs.mkdirSync(claude);
    fs.writeFileSync(path.join(claude, "secret.env"), `SOPS_AGE_KEY=${PRIVATE_KEY}\n`, { mode: 0o600 });
    const calls = [];
    const tools = selectedInitTools(calls);
    const initialized = run(["init"], { cwd: root, env, tools });
    assert.equal(initialized.code, 0, initialized.err);
    const file = path.join(dir, "app.enc");
    assert.deepEqual(configuredRecipients(root, file), [RECIPIENT]);
    assert.equal(fs.existsSync(keyFile), legacyExists, "inline init creates no legacy identity");
    if (legacyExists)
      assert.ok(fs.readFileSync(keyFile, "utf8") === legacy, "legacy identity stays untouched");
    assert.ok(calls.every((call) => !call.hasAgeKey && !call.hasKeyFile), "age derivation receives no identity environment");
    assert.ok(calls.every((call) => call.args[0] !== "-o"), "no other identity is generated");
    selectedCapturesWiped(calls);
    privateAbsent(initialized, [PRIVATE_KEY, legacy]);
    const sealed = run(["set", "dev", "app", "TOKEN"], {
      cwd: root, env, tools, stdin: () => "private-initialized-value",
    });
    assert.equal(sealed.code, 0, sealed.err);
    assert.deepEqual(envelopeOf(fs.readFileSync(file, "utf8")).recipients, [RECIPIENT]);
    const encrypt = calls.find((call) => call.args[0] === "encrypt");
    assert.ok(encrypt.keyMatches && !encrypt.hasKeyFile, "set selects the same inline identity");
    selectedCapturesWiped(calls);
    privateAbsent(sealed, [PRIVATE_KEY, legacy, "private-initialized-value"]);
  }
});

test("an app-owned inline identity stays selected over ambient host identity during first init", (t) => {
  const { root, env } = app(t);
  const hostIdentity = `AGE-SECRET-KEY-1${"P".repeat(58)}`;
  fs.mkdirSync(path.join(root, ".claude"));
  fs.writeFileSync(path.join(root, ".claude", "secret.env"), `SOPS_AGE_KEY=${PRIVATE_KEY}\n`, { mode: 0o600 });
  const calls = [];
  const initialized = run(["init"], {
    cwd: root, env: { ...env, SOPS_AGE_KEY: hostIdentity }, tools: selectedInitTools(calls),
  });
  assert.equal(initialized.code, 0, initialized.err);
  assert.deepEqual(configuredRecipients(root, path.join(root, ".starcistacks", "dev", "secrets", "app.enc")), [RECIPIENT]);
  assert.ok(ageIdentityEnv(root, {}).SOPS_AGE_KEY === PRIVATE_KEY, "the existing app-owned identity stays unchanged");
  selectedCapturesWiped(calls);
  privateAbsent(initialized, [PRIVATE_KEY, hostIdentity]);
});
test("init honours an explicit inline selection for an existing app and preserves its configured recipient", (t) => {
  const { root, env } = app(t);
  fs.writeFileSync(path.join(root, ".sops.yaml"), CONFIG.replace(RECIPIENT, OTHER_RECIPIENT));
  const explicit = `AGE-SECRET-KEY-1${"P".repeat(58)}`;
  env.SOPS_AGE_KEY = explicit;
  const claude = path.join(root, ".claude");
  fs.mkdirSync(claude);
  fs.writeFileSync(path.join(claude, "secret.env"), `SOPS_AGE_KEY=${PRIVATE_KEY}\n`, { mode: 0o600 });
  const calls = [];
  const tools = selectedInitTools(calls, { identity: explicit, recipient: OTHER_RECIPIENT });
  const initialized = run(["init"], { cwd: root, env, tools });
  assert.equal(initialized.code, 0, initialized.err);
  const target = path.join(root, ".starcistacks", "dev", "secrets", "app.enc");
  assert.deepEqual(configuredRecipients(root, target), [OTHER_RECIPIENT]);
  fs.writeFileSync(path.join(root, ".sops.yaml"), CONFIG);
  const repeated = run(["init"], { cwd: root, env, tools });
  assert.equal(repeated.code, 0, repeated.err);
  assert.deepEqual(configuredRecipients(root, target), [RECIPIENT], "initialization never rotates existing recipients");
  selectedCapturesWiped(calls);
  privateAbsent(initialized, [PRIVATE_KEY, explicit]);
  privateAbsent(repeated, [PRIVATE_KEY, explicit]);
});

test("disabled inline init refuses without generating a legacy key or changing recipient policy", (t) => {
  const { root, env } = app(t);
  const configFile = path.join(root, ".sops.yaml");
  fs.writeFileSync(configFile, CONFIG);
  const claude = path.join(root, ".claude");
  fs.mkdirSync(claude);
  fs.writeFileSync(path.join(claude, "secret.env"), "SOPS_AGE_KEY=\n", { mode: 0o600 });
  const calls = [];
  const refused = run(["init"], { cwd: root, env, tools: selectedInitTools(calls) });
  assert.equal(refused.code, 2);
  assert.match(refused.err, /SOPS_AGE_KEY.*disabled-inline/u);
  assert.equal(calls.length, 0, "disabled selection launches no key process");
  assert.equal(fs.readFileSync(configFile, "utf8"), CONFIG);
  assert.equal(fs.existsSync(secretRoots(env, process.platform).identity), false);
});

test("failed inline recipient derivation wipes captures and exposes only the refusal", (t) => {
  const { root, env } = app(t);
  env.SOPS_AGE_KEY = PRIVATE_KEY;
  const configFile = path.join(root, ".sops.yaml");
  fs.writeFileSync(configFile, CONFIG);
  const calls = [];
  const refused = run(["init"], {
    cwd: root, env, tools: selectedInitTools(calls, { failDerivation: true }),
  });
  assert.equal(refused.code, 2);
  assert.match(refused.err, /recipient-unproven/u);
  assert.equal(fs.readFileSync(configFile, "utf8"), CONFIG);
  assert.equal(fs.existsSync(secretRoots(env, process.platform).identity), false);
  selectedCapturesWiped(calls);
  privateAbsent(refused, [PRIVATE_KEY]);
});

test("selectedAgeRecipient returns only public data, wipes captures and refuses unqualified tools", (t) => {
  const { root, env } = app(t);
  const selected = { ...env, SOPS_AGE_KEY: PRIVATE_KEY };
  for (const failDerivation of [false, true]) {
    const calls = [];
    const tools = selectedInitTools(calls, { failDerivation });
    const result = selectedAgeRecipient({
      env: selected,
      cwd: root,
      invocation: {
        runProgram: tools.runProgram,
        resolveRealTool: tools.resolveRealTool,
      },
    });
    if (failDerivation)
      assert.deepEqual(result, { ok: false, reason: "recipient-unproven" });
    else assert.deepEqual(result, { ok: true, publicRecipient: RECIPIENT });
    selectedCapturesWiped(calls);
    assert.ok(calls.every((call) => !call.hasAgeKey && !call.hasKeyFile), "public derivation strips identity environment");
    assert.ok(!JSON.stringify(result).includes(PRIVATE_KEY), "only public data escapes the owner");
  }
  const refused = selectedAgeRecipient({
    env: selected,
    cwd: root,
    invocation: {
      resolveRealTool: () => path.join(root, "unavailable-age-keygen"),
      runProgram: () => assert.fail("unqualified tools must not launch"),
    },
  });
  assert.deepEqual(refused, { ok: false, reason: "native-tool-unavailable" });
});

test("init preserves existing recipients and keys, selects platform roots, and reports missing tools", (t) => {
  const { root, env } = app(t);
  const config = `creation_rules:\n  - path_regex: '\\.starcistacks.*\\.enc$'\n    age: ${OTHER_RECIPIENT}\n`;
  fs.writeFileSync(path.join(root, ".sops.yaml"), config);
  const keyFile = path.join(env.APPDATA, "sops", "age", "keys.txt");
  fs.mkdirSync(path.dirname(keyFile), { recursive: true });
  fs.writeFileSync(keyFile, `${PRIVATE_KEY}\n`);
  const tools = fakeTools();
  const result = run(["init"], { cwd: root, env, tools, platform: "win32" });
  assert.equal(result.code, 0);
  const updatedConfig = fs.readFileSync(path.join(root, ".sops.yaml"), "utf8");
  assert.ok(
    updatedConfig.includes(OTHER_RECIPIENT) &&
      !updatedConfig.includes(RECIPIENT),
    "init retains the existing recipient",
  );
  assert.ok(
    fs.readFileSync(keyFile, "utf8") === `${PRIVATE_KEY}\n`,
    "existing private identity is unchanged",
  );
  assert.equal(tools.calls.filter((call) => call.args[0] === "-o").length, 0);
  privateAbsent(result, [PRIVATE_KEY]);
  for (const platform of ["linux", "darwin"]) {
    const fixture = app(t);
    const initialized = run(["init"], {
      cwd: fixture.root,
      env: fixture.env,
      tools: fakeTools(),
      platform,
    });
    assert.equal(initialized.code, 0);
    const identity = ageIdentityEnv(fixture.root, {}).SOPS_AGE_KEY;
    assert.ok(typeof identity === "string" && identity.startsWith("AGE-SECRET-KEY-"), "fresh identity stays in the app on every platform");
    assert.ok(!fs.existsSync(secretRoots(fixture.env, platform).identity), "fresh init leaves platform key storage unused");
    privateAbsent(initialized, [identity]);
  }
  const noSops = run(["init"], {
    cwd: root,
    env,
    tools: { ...fakeTools(), resolveSops: () => null },
  });
  assert.equal(noSops.code, 2);
  assert.match(noSops.err, /sops.*(?:installed|missing|available)/iu);
  const noAge = run(["init"], {
    cwd: root,
    env,
    tools: { ...fakeTools(), resolveRealTool: () => null },
  });
  assert.equal(noAge.code, 2);
  assert.match(noAge.err, /age.*(?:installed|missing|available)/iu);
});

test("init refuses malformed recipient policy without printing or copying its contents", (t) => {
  const { root, env } = app(t);
  const config = `creation_rules:\n  - path_regex: '\\.starcistacks.*\\.enc$'\n    age: ${PRIVATE_KEY}\n`;
  fs.writeFileSync(path.join(root, ".sops.yaml"), config);
  const tools = fakeTools();
  const result = run(["init"], { cwd: root, env, tools });
  assert.equal(result.code, 2);
  assert.match(result.err, /valid public age recipients/u);
  privateAbsent(result, [PRIVATE_KEY]);
  assert.ok(
    fs.readFileSync(path.join(root, ".sops.yaml"), "utf8") === config,
    "invalid policy remains unchanged for deliberate repair",
  );
  assert.equal(tools.calls.length, 0);
  assert.ok(
    !fs.existsSync(secretRoots(env).identity),
    "invalid policy creates no identity",
  );
});

test("init preserves environment-specific SOPS rule precedence before its general custody rule", (t) => {
  const { root, env } = app(t);
  const productionRule = {
    path_regex: String.raw`\.starcistacks[/\\]production[/\\]secrets[/\\][^/\\]+\.enc$`,
    age: OTHER_RECIPIENT,
  };
  const developmentRule = {
    path_regex: String.raw`\.starcistacks[/\\]dev[/\\]secrets[/\\][^/\\]+\.enc$`,
    age: RECIPIENT,
  };
  const config = `creation_rules:\n  - path_regex: '${productionRule.path_regex}'\n    age: ${productionRule.age}\n  - path_regex: '${developmentRule.path_regex}'\n    age: ${developmentRule.age}\n`;
  fs.writeFileSync(path.join(root, ".sops.yaml"), config);
  const result = run(["init"], { cwd: root, env, tools: fakeTools() });
  assert.equal(result.code, 0);
  privateAbsent(result, [PRIVATE_KEY]);
  const rules = parseYaml(
    fs.readFileSync(path.join(root, ".sops.yaml"), "utf8"),
  ).creation_rules;
  assert.deepEqual(rules.slice(0, 2), [productionRule, developmentRule]);
  assert.equal(rules.length, 3);
  assert.equal(
    rules[2].path_regex,
    String.raw`\.starcistacks[/\\][^/\\]+[/\\]secrets[/\\][^/\\]+\.enc$`,
  );
  const recipientFor = (environment) =>
    rules.find((rule) =>
      new RegExp(rule.path_regex).test(
        `.starcistacks/${environment}/secrets/app.enc`,
      ),
    ).age;
  assert.equal(recipientFor("production"), OTHER_RECIPIENT);
  assert.equal(recipientFor("dev"), RECIPIENT);
});

test("init preserves an existing canonical fallback recipient behind a production-specific rule", (t) => {
  const { root, env } = app(t);
  const production = {
    path_regex: String.raw`\.starcistacks[/\\]production[/\\]secrets[/\\][^/\\]+\.enc$`,
    age: OTHER_RECIPIENT,
  };
  const canonical = {
    path_regex: String.raw`\.starcistacks[/\\][^/\\]+[/\\]secrets[/\\][^/\\]+\.enc$`,
    age: RECIPIENT,
  };
  fs.writeFileSync(
    path.join(root, ".sops.yaml"),
    `creation_rules:\n  - path_regex: '${production.path_regex}'\n    age: ${production.age}\n  - path_regex: '${canonical.path_regex}'\n    age: ${canonical.age}\n`,
  );
  const result = run(["init"], { cwd: root, env, tools: fakeTools() });
  assert.equal(result.code, 0);
  privateAbsent(result, [PRIVATE_KEY]);
  const rules = parseYaml(
    fs.readFileSync(path.join(root, ".sops.yaml"), "utf8"),
  ).creation_rules;
  assert.deepEqual(rules, [production, canonical]);
  assert.deepEqual(
    configuredRecipients(
      root,
      path.join(root, ".starcistacks", "production", "secrets", "app.enc"),
    ),
    [OTHER_RECIPIENT],
  );
  assert.deepEqual(
    configuredRecipients(
      root,
      path.join(root, ".starcistacks", "dev", "secrets", "app.enc"),
    ),
    [RECIPIENT],
  );
});

test("configured recipients follow the first matching rule and preserve a comma-separated public recipient list", (t) => {
  const { root } = app(t);
  const configFile = path.join(root, ".sops.yaml");
  const production = String.raw`\.starcistacks[/\\]production[/\\]secrets[/\\][^/\\]+\.enc$`;
  fs.writeFileSync(
    configFile,
    `creation_rules:\n  - path_regex: '${production}'\n    age: '${OTHER_RECIPIENT}, ${RECIPIENT}'\n  - path_regex: '\\.starcistacks.*\\.enc$'\n    age: ${RECIPIENT}\n`,
  );
  const prodFile = path.join(
    root,
    ".starcistacks",
    "production",
    "secrets",
    "app.enc",
  );
  const devFile = path.join(root, ".starcistacks", "dev", "secrets", "app.enc");
  assert.deepEqual(configuredRecipients(root, prodFile), [
    OTHER_RECIPIENT,
    RECIPIENT,
  ]);
  assert.deepEqual(configuredRecipients(root, devFile), [RECIPIENT]);
  fs.writeFileSync(
    configFile,
    `creation_rules:\n  - age: ${OTHER_RECIPIENT}\n  - path_regex: '\\.starcistacks.*\\.enc$'\n    age: ${RECIPIENT}\n`,
  );
  assert.deepEqual(configuredRecipients(root, devFile), [OTHER_RECIPIENT]);
});

test("configured recipients refuse invalid policy and never leak malformed recipient contents", (t) => {
  const { root } = app(t);
  const file = path.join(root, ".starcistacks", "dev", "secrets", "app.enc");
  const configFile = path.join(root, ".sops.yaml");
  assert.throws(() => configuredRecipients(root, file), /valid \.sops\.yaml/u);
  for (const config of [
    "creation_rules: [",
    "creation_rules: {}",
    `creation_rules:\n  - path_regex: '['\n    age: ${RECIPIENT}\n`,
    `creation_rules:\n  - path_regex: 'does-not-match'\n    age: ${RECIPIENT}\n`,
    `creation_rules:\n  - path_regex: '\\.starcistacks'\n  - age: ${RECIPIENT}\n`,
  ]) {
    fs.writeFileSync(configFile, config);
    let refused = false;
    try {
      configuredRecipients(root, file);
    } catch {
      refused = true;
    }
    assert.ok(
      refused,
      "invalid or missing first-match public age policy is refused",
    );
  }
  fs.writeFileSync(configFile, `creation_rules:\n  - age: ${PRIVATE_KEY}\n`);
  let refusal;
  try {
    configuredRecipients(root, file);
  } catch (error) {
    refusal = error;
  }
  assert.ok(refusal instanceof Error, "malformed recipient is refused");
  assert.ok(
    !refusal.message.includes(PRIVATE_KEY),
    "policy refusal contains no malformed private contents",
  );
});

test("list takes an environment and exposes key names without decrypting any envelope", (t) => {
  const { root, env } = app(t, {
    "app-env.enc": sealedDotenv(["DATABASE_URL", "REDIS_URL"]),
    "token.enc": sealedJson(["TOKEN"]),
    "notes.txt": "ignored",
  });
  const sops = {
    decrypt: () => assert.fail("list must not decrypt"),
    seal: () => assert.fail("list must not seal"),
  };
  const result = run(["list", "dev"], { cwd: root, env, sops });
  assert.equal(result.code, 0);
  assert.deepEqual(result.out.trim().split(/\r?\n/u), [
    "DATABASE_URL",
    "REDIS_URL",
    "TOKEN",
  ]);
  assert.ok(
    !result.out.includes(ENC),
    "list contains no encrypted member data",
  );
  assert.doesNotMatch(result.out, /notes/);
  assert.equal(run(["list"], { cwd: root, env, sops }).code, 2);
});

test("set seals stdin as dotenv and updates preserve other keys and existing recipients", (t) => {
  const { root, dir, env } = app(t, {
    "app-env.enc": sealedDotenv(["DATABASE_URL"]),
  });
  fs.writeFileSync(path.join(root, ".sops.yaml"), CONFIG);
  const oldValue = "private-existing-database";
  const newValue = "private-new-token";
  const sops = fakeSops({ "app-env.enc": { DATABASE_URL: oldValue } });
  const created = run(["set", "dev", "webhook", "WEBHOOK_SECRET"], {
    cwd: root,
    env,
    sops,
    stdin: () => `${newValue}\n`,
  });
  assert.equal(created.code, 0);
  assert.equal(sops.sealed[0].inputType, "dotenv");
  assert.ok(
    sops.sealed[0].plaintext === `WEBHOOK_SECRET=${newValue}\n`,
    "stdin is sealed under its named key",
  );
  assert.equal(sops.sealed[0].filenameOverride, path.join(dir, "webhook.enc"));
  assert.ok(fs.existsSync(path.join(dir, "webhook.enc")));
  privateAbsent(created, [newValue]);
  const updated = run(["set", "dev", "app-env", "REDIS_URL"], {
    cwd: root,
    env,
    sops,
    stdin: () => newValue,
  });
  assert.equal(updated.code, 0);
  assert.equal(sops.sealed[1].inputType, "dotenv");
  assert.deepEqual(sops.sealed[1].recipients, [RECIPIENT]);
  assert.ok(
    sops.sealed[1].plaintext ===
      `DATABASE_URL=${oldValue}\nREDIS_URL=${newValue}\n`,
    "an update preserves the other key",
  );
  privateAbsent(updated, [oldValue, newValue]);
  const empty = run(["set", "dev", "empty", "TOKEN"], {
    cwd: root,
    env,
    sops,
    stdin: () => "\n",
  });
  assert.equal(empty.code, 2);
  assert.match(empty.err, /empty/u);
});

test("set --generate seals the requested random bytes without reading stdin or disclosing them", (t) => {
  const { root, env } = app(t);
  const sops = fakeSops();
  let requested;
  const value = Buffer.alloc(24, 0xfb).toString("base64url");
  const result = run(
    ["set", "dev", "session", "SESSION_SECRET", "--generate", "24"],
    {
      cwd: root,
      env,
      sops,
      stdin: () => assert.fail("generation must not read stdin"),
      random: (n) => {
        requested = n;
        return Buffer.alloc(n, 0xfb);
      },
    },
  );
  assert.equal(result.code, 0);
  assert.equal(requested, 24);
  assert.ok(
    sops.sealed[0].plaintext === `SESSION_SECRET=${value}\n`,
    "generated bytes are sealed",
  );
  privateAbsent(result, [value]);
  for (const size of ["0", "-1", "1.5", "not-a-number", "1025"])
    assert.equal(
      run(["set", "dev", "session", "SESSION_SECRET", "--generate", size], {
        cwd: root,
        env,
        sops,
      }).code,
      2,
    );
});

test("get --to-file writes local files with empty stdout; --reveal explicitly permits captured value output", (t) => {
  const values = {
    DATABASE_URL: "private-database-location",
    REDIS_URL: "private-cache-location",
  };
  const { root, env, localDir } = app(t, {
    "app-env.enc": sealedDotenv(Object.keys(values)),
  });
  const sops = fakeSops({ "app-env.enc": values });
  const result = run(["get", "dev", "app-env", "REDIS_URL", "--to-file"], {
    cwd: root,
    env,
    sops,
  });
  assert.equal(result.code, 0);
  const file = path.join(localDir, "REDIS_URL");
  assert.ok(
    fs.readFileSync(file, "utf8") === values.REDIS_URL,
    "selected file contains the decrypted value",
  );
  assert.ok(
    !fs.existsSync(path.join(localDir, "DATABASE_URL")),
    "get of one key does not write another",
  );
  assert.equal(result.out, "");
  assert.deepEqual(result.err.trim().split(/\r?\n/u), [
    `REDIS_URL_FILE=${file}`,
  ]);
  privateAbsent(result, Object.values(values));
  if (process.platform !== "win32")
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  const all = run(["get", "dev", "app-env", "--to-file"], {
    cwd: root,
    env,
    sops,
  });
  assert.equal(all.code, 0);
  assert.equal(all.out, "");
  assert.deepEqual(fs.readdirSync(localDir).sort(), [
    "DATABASE_URL",
    "REDIS_URL",
  ]);
  privateAbsent(all, Object.values(values));
  const revealed = run(
    ["get", "dev", "app-env", "REDIS_URL", "--to-file", "--reveal"],
    { cwd: root, env, sops },
  );
  assert.equal(revealed.code, 0);
  assert.ok(
    revealed.out.includes(values.REDIS_URL),
    "explicit reveal reaches captured stdout",
  );
  assert.ok(
    !revealed.err.includes(values.REDIS_URL),
    "reveal does not reach stderr",
  );
  for (const args of [
    ["get", "dev", "app-env"],
    ["get", "dev", "app-env", "MISSING", "--to-file"],
    ["get", "dev", "absent", "--to-file"],
  ])
    assert.equal(run(args, { cwd: root, env, sops }).code, 2);
});

test("materialize decrypts every environment envelope into one local file per KEY and prints paths only", (t) => {
  const maps = {
    "database.enc": {
      DATABASE_URL: "private-database-value",
      DATABASE_PASSWORD: "private-password-value",
    },
    "session.enc": { SESSION_SECRET: "private-session-value" },
  };
  const { root, env, localDir } = app(t, {
    "database.enc": sealedDotenv(Object.keys(maps["database.enc"])),
    "session.enc": sealedDotenv(["SESSION_SECRET"]),
    "notes.txt": "ignored",
  });
  const other = path.join(root, ".starcistacks", "production", "secrets");
  fs.mkdirSync(other, { recursive: true });
  fs.writeFileSync(
    path.join(other, "other.enc"),
    sealedDotenv(["PRODUCTION_TOKEN"]),
  );
  const sops = fakeSops(maps);
  const result = run(["materialize", "dev"], { cwd: root, env, sops });
  assert.equal(result.code, 0);
  assert.equal(sops.decrypted.length, 2);
  assert.deepEqual(fs.readdirSync(localDir).sort(), [
    "DATABASE_PASSWORD",
    "DATABASE_URL",
    "SESSION_SECRET",
  ]);
  for (const map of Object.values(maps))
    for (const [key, value] of Object.entries(map))
      assert.ok(
        fs.readFileSync(path.join(localDir, key), "utf8") === value,
        "materialized file contains the named value",
      );
  privateAbsent(result, Object.values(maps).flatMap(Object.values));
  assert.ok(
    result.out
      .trim()
      .split(/\r?\n/u)
      .every(
        (line) => path.dirname(line.slice(line.indexOf("=") + 1)) === localDir,
      ),
    "materialize emits only KEY_FILE paths",
  );
  assert.ok(
    !fs.existsSync(path.join(root, "secrets.env")),
    "materialize leaves no root plaintext secret file",
  );
});

test("invalid verb, flag, env, slug and KEY refuse before decrypt or seal", (t) => {
  const { root, env } = app(t, { "token.enc": sealedDotenv(["TOKEN"]) });
  const sops = {
    decrypt: () => assert.fail("bad usage must not decrypt"),
    seal: () => assert.fail("bad usage must not seal"),
  };
  for (const argv of [
    ["show", "token"],
    ["gen", "token"],
    ["frobnicate"],
    ["list", "dev", "--bogus"],
    ["list", "../production"],
    ["get", "dev", "../token", "--to-file"],
    ["get", "dev", "Bad_Slug", "--to-file"],
    ["set", "dev", "token", "../TOKEN"],
    ["set", "dev", "token"],
    ["list", "dev", "extra"],
    ["materialize", "dev", "extra"],
  ])
    assert.equal(
      run(argv, { cwd: root, env, sops, stdin: () => "unused-private" }).code,
      2,
    );
});

test("invalid sealing preserves ciphertext and publishes no plaintext", (t) => {
  const prior = sealedDotenv(["TOKEN"]);
  const replacement = "private-replacement-value";
  const { root, dir, env } = app(t, { "token.enc": prior });
  const result = run(["set", "dev", "token", "TOKEN"], {
    cwd: root,
    env,
    stdin: () => replacement,
    sops: {
      decrypt: () => ({ TOKEN: "private-old-value" }),
      seal: () => "TOKEN=private-invalid-envelope\n",
    },
  });
  assert.equal(result.code, 2);
  privateAbsent(result, [
    replacement,
    "private-old-value",
    "private-invalid-envelope",
  ]);
  assert.equal(fs.readFileSync(path.join(dir, "token.enc"), "utf8"), prior);
  assert.deepEqual(fs.readdirSync(dir), ["token.enc"]);
});

test("a failing seal redacts subprocess diagnostics and preserves ciphertext", (t) => {
  const prior = sealedDotenv(["TOKEN"]);
  const value = "private-subprocess-diagnostic";
  const { root, dir, env } = app(t, { "token.enc": prior });
  const result = run(["set", "dev", "token", "TOKEN"], {
    cwd: root,
    env,
    stdin: () => value,
    sops: {
      decrypt: () => ({ TOKEN: "private-existing-value" }),
      seal: () => {
        throw new Error(value);
      },
    },
  });
  assert.equal(result.code, 2);
  privateAbsent(result, [value]);
  assert.equal(fs.readFileSync(path.join(dir, "token.enc"), "utf8"), prior);
  assert.deepEqual(fs.readdirSync(dir), ["token.enc"]);
});

test("default SOPS refuses explicit repository identities and external hard-linked identities before decrypting", (t) => {
  const { root, env, localDir } = app(t, {
    "token.enc": sealedDotenv(["TOKEN"]),
  });
  const tools = fakeTools();
  const repositoryKey = path.join(root, "age-identity.txt");
  fs.writeFileSync(repositoryKey, `${PRIVATE_KEY}\n`);
  const inside = run(["get", "dev", "token", "--to-file"], {
    cwd: root,
    env: { ...env, SOPS_AGE_KEY_FILE: repositoryKey },
    tools,
  });
  assert.equal(inside.code, 2);
  assert.match(inside.err, /outside the repository/u);
  privateAbsent(inside, [PRIVATE_KEY]);
  const externalKey = path.join(env.APPDATA, "sops", "age", "keys.txt");
  fs.mkdirSync(path.dirname(externalKey), { recursive: true });
  fs.writeFileSync(externalKey, `${PRIVATE_KEY}\n`);
  fs.linkSync(externalKey, path.join(root, "linked-age-identity.txt"));
  const linked = run(["get", "dev", "token", "--to-file"], {
    cwd: root,
    env: { ...env, SOPS_AGE_KEY_FILE: externalKey },
    tools,
  });
  assert.equal(linked.code, 2);
  assert.match(linked.err, /without hard links/u);
  privateAbsent(linked, [PRIVATE_KEY]);
  assert.equal(tools.calls.length, 0);
  assert.ok(
    !fs.existsSync(localDir),
    "invalid identity custody creates no decrypted files",
  );
});

test("duplicate materialized KEY ownership and repository-local plaintext storage are refused", (t) => {
  const value = "private-refused-materialization";
  const { root, env, localDir } = app(t, {
    "first.enc": sealedDotenv(["TOKEN"]),
    "second.enc": sealedDotenv(["TOKEN"]),
  });
  const sops = fakeSops({
    "first.enc": { TOKEN: value },
    "second.enc": { TOKEN: value },
  });
  const duplicate = run(["materialize", "dev"], { cwd: root, env, sops });
  assert.equal(duplicate.code, 2);
  assert.match(duplicate.err, /duplicate KEY/u);
  assert.ok(
    !fs.existsSync(localDir),
    "duplicate ownership is refused before creating plaintext files",
  );
  privateAbsent(duplicate, [value]);
  const local = run(["get", "dev", "first", "--to-file"], {
    cwd: root,
    env: {
      ...env,
      LOCALAPPDATA: root,
      XDG_DATA_HOME: root,
      HOME: root,
      USERPROFILE: root,
    },
    sops,
  });
  assert.equal(local.code, 2);
  assert.match(local.err, /outside.*repository/u);
  privateAbsent(local, [value]);
  const tty = run(["set", "dev", "first", "TOKEN"], {
    cwd: root,
    env,
    sops,
    stdin: { isTTY: true },
  });
  assert.equal(tty.code, 2);
  assert.match(tty.err, /redirected stdin/u);
});

test("Windows get and materialize refuse case-colliding KEY names before writing any files", (t) => {
  const value = "private-case-collision-value";
  const maps = {
    "both.enc": { TOKEN: value, token: value },
    "upper.enc": { TOKEN: value },
    "lower.enc": { token: value },
  };
  const getFixture = app(t, { "both.enc": sealedDotenv(["TOKEN", "token"]) });
  const get = run(["get", "dev", "both", "--to-file"], {
    cwd: getFixture.root,
    env: getFixture.env,
    platform: "win32",
    sops: fakeSops(maps),
  });
  assert.equal(get.code, 2);
  assert.ok(
    /case|collid/iu.test(get.err),
    "get explains the incompatible KEY names",
  );
  const getDirectory = path.join(
    secretRoots(getFixture.env, "win32").local,
    "custody-spec",
    "dev",
  );
  assert.ok(
    !fs.existsSync(getDirectory),
    "get refuses before creating any private files",
  );
  privateAbsent(get, [value]);
  const materializeFixture = app(t, {
    "upper.enc": sealedDotenv(["TOKEN"]),
    "lower.enc": sealedDotenv(["token"]),
  });
  const materialized = run(["materialize", "dev"], {
    cwd: materializeFixture.root,
    env: materializeFixture.env,
    platform: "win32",
    sops: fakeSops(maps),
  });
  assert.equal(materialized.code, 2);
  assert.ok(
    /case|collid/iu.test(materialized.err),
    "materialize explains the incompatible KEY names",
  );
  const materializedDirectory = path.join(
    secretRoots(materializeFixture.env, "win32").local,
    "custody-spec",
    "dev",
  );
  assert.ok(
    !fs.existsSync(materializedDirectory),
    "materialize refuses before creating any private files",
  );
  privateAbsent(materialized, [value]);
});

test("Linux materialization preserves distinct upper and lower case KEY names", (t) => {
  const maps = {
    "both.enc": {
      TOKEN: "private-uppercase-value",
      token: "private-lowercase-value",
    },
  };
  const { root, env } = app(t, {
    "both.enc": sealedDotenv(["TOKEN", "token"]),
  });
  const localDir = path.join(
    secretRoots(env, "linux").local,
    "custody-spec",
    "dev",
  );
  const result = run(["materialize", "dev"], {
    cwd: root,
    env,
    platform: "linux",
    sops: fakeSops(maps),
  });
  assert.equal(result.code, 0);
  privateAbsent(result, Object.values(maps["both.enc"]));
  assert.deepEqual(result.out.trim().split(/\r?\n/u), [
    `TOKEN_FILE=${path.join(localDir, "TOKEN")}`,
    `token_FILE=${path.join(localDir, "token")}`,
  ]);
  if (process.platform === "linux") {
    assert.deepEqual(fs.readdirSync(localDir).sort(), ["TOKEN", "token"]);
    for (const [key, value] of Object.entries(maps["both.enc"]))
      assert.ok(
        fs.readFileSync(path.join(localDir, key), "utf8") === value,
        "Linux keeps the distinct case-sensitive KEY files",
      );
  }
});

test("library compatibility preserves related keys and excludes concurrent writers", (t) => {
  const { root, dir } = app(t, { "app-env.enc": sealedJson(["OTHER"]) });
  const sops = fakeSops({ "app-env.enc": { OTHER: "private-existing-value" } });
  const seal = sops.seal;
  sops.seal = (request) => {
    assert.throws(
      () =>
        setSecretValues(
          root,
          { slug: "app-env", values: { SECOND: "private-conflict-value" } },
          {
            sops: {
              decrypt: () =>
                assert.fail("held update must refuse before decrypt"),
              seal,
            },
          },
        ),
      /being updated/,
    );
    return seal(request);
  };
  setSecretValues(
    root,
    { slug: "app-env", values: { FIRST: "private-new-value" } },
    { sops },
  );
  assert.equal(sops.sealed[0].inputType, "dotenv");
  assert.ok(
    sops.sealed[0].plaintext ===
      "OTHER=private-existing-value\nFIRST=private-new-value\n",
    "library update retains all named values when converting to dotenv",
  );
  assert.deepEqual(
    envelopeOf(fs.readFileSync(path.join(dir, "app-env.enc"), "utf8")).keys,
    ["OTHER", "FIRST"],
  );
});

test("dotenv LF is encoded within one member and cannot inject an extra key", (t) => {
  const prior = sealedDotenv(["OTHER"]);
  const { root, dir } = app(t, { "app-env.enc": prior });
  const sops = fakeSops({ "app-env.enc": { OTHER: "private-existing-value" } });
  setSecretValues(
    root,
    { slug: "app-env", values: { FIRST: "one\nINJECTED=two" } },
    { sops },
  );
  assert.equal(sops.sealed.length, 1);
  assert.ok(
    sops.sealed[0].plaintext ===
      "OTHER=private-existing-value\nFIRST=one\\nINJECTED=two\n",
    "the apparent injected key remains inside the escaped value",
  );
  assert.deepEqual(
    envelopeOf(fs.readFileSync(path.join(dir, "app-env.enc"), "utf8")).keys,
    ["OTHER", "FIRST"],
  );
  const ciphertext = fs.readFileSync(path.join(dir, "app-env.enc"), "utf8");
  for (const value of ["one\rINJECTED=two", String.raw`one\nINJECTED=two`]) {
    assert.throws(
      () =>
        setSecretValues(
          root,
          { slug: "app-env", values: { FIRST: value } },
          { sops },
        ),
      /cannot preserve/u,
    );
    assert.equal(
      fs.readFileSync(path.join(dir, "app-env.enc"), "utf8"),
      ciphertext,
    );
  }
  assert.equal(sops.sealed.length, 1);
});

test("another process holding the ciphertext claim refuses before decrypt or seal", async (t) => {
  const { root, dir } = app(t, { "token.enc": sealedDotenv(["TOKEN"]) });
  const owner = pathToFileURL(
    path.resolve(import.meta.dirname, "../../scripts/api/fs/claim-file.mjs"),
  ).href;
  const source = `import {claimFile} from ${JSON.stringify(owner)};const held=claimFile(${JSON.stringify(path.resolve(dir, "token.enc"))});if(!held.ok)process.exit(2);console.log('held');setInterval(()=>{},1000);`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", source], {
    env: { ...process.env },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = new Promise((resolve) => child.once("close", resolve));
  t.after(async () => {
    if (child.exitCode === null) child.kill("SIGTERM");
    await exited;
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("the other writer did not become ready")),
        10_000,
      );
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk;
        if (output.includes("held")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once("error", () => {
        clearTimeout(timer);
        reject(new Error("the other writer could not start"));
      });
      child.once("close", () => {
        clearTimeout(timer);
        reject(new Error("the other writer exited before becoming ready"));
      });
    });
    assert.throws(
      () =>
        setSecretValues(
          root,
          { slug: "token", values: { TOKEN: "private-refused-value" } },
          {
            sops: {
              decrypt: () =>
                assert.fail("held write must refuse before decrypt"),
              seal: () => assert.fail("held write must refuse before seal"),
            },
          },
        ),
      /being updated/,
    );
    assert.equal(
      fs.readFileSync(path.join(dir, "token.enc"), "utf8"),
      sealedDotenv(["TOKEN"]),
    );
  } finally {
    if (child.exitCode === null) child.kill("SIGTERM");
    await exited;
  }
});
