// proves: HFS_AGE_KEY_CUSTODY@lite HFS_AGE_KEY_CUSTODY@full
// proves: HFS_CANON_COPY_DRIFT@lite HFS_CANON_COPY_DRIFT@full
// proves: HFS_SECRET_PLAINTEXT_FILE@lite HFS_SECRET_PLAINTEXT_FILE@full
// proves: HFS_SECRET_OUTSIDE_ENC@full
// Names and paths may be printed. Compare private test data only as booleans.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runGit } from "../runtime/scripts/api/git/lib.mjs";
import { judge } from "../sync/hygiene.mjs";
import { app, run, privateAbsent } from "./helpers/hfs-secret-fixture.mjs";
import {
  secretHits,
  secretNameLike,
} from "../runtime/scripts/lib/secret-patterns.mjs";
import {
  ageKeyCustodyFindings,
  secretFileFindings,
} from "../runtime/scripts/hfs/rules/secrets.mjs";
import { canonCopyDriftFindings } from "../runtime/scripts/hfs/rules/canon-copy-drift.mjs";
import { secretCustodyOnlyFindings } from "../runtime/scripts/hfs/rules/secret-custody-only.mjs";
import { liteSecretCustodyFindings } from "../runtime/scripts/hfs/rules/supabase-secrets.mjs";
import { secretRoots } from "../runtime/scripts/hfs/secret-files.mjs";

const RECIPIENT = `age1${"q".repeat(58)}`;
const PRIVATE_KEY = `AGE-SECRET-KEY-1${"Q".repeat(58)}`;
const OTHER_KEY = `AGE-SECRET-KEY-1${"P".repeat(58)}`;
const ENC = "ENC[AES256_GCM,data:AA==,iv:AA==,tag:AA==,type:str]";
const AGE_PAYLOAD =
  "-----BEGIN AGE ENCRYPTED FILE-----\nYWdlLWJsb2Nr\n-----END AGE ENCRYPTED FILE-----";
const sealedDotenv = (keys, recipient = RECIPIENT) => {
  const members = keys.map((key) => `${key}=${ENC}`).join("\n");
  const payload = AGE_PAYLOAD.replaceAll("\n", String.raw`\n`);
  return `${members}\n` +
    `sops_age__list_0__map_recipient=${recipient}\n` +
    `sops_age__list_0__map_enc=${payload}\n` +
    `sops_mac=${ENC}\nsops_version=3.13.2\nsops_lastmodified=2026-01-01T00:00:00Z\n`;
};

const write = (root, file, text = "x\n") => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};
const codes = (findings) => findings.map((finding) => finding.code);
const ctx = (root, files, edition) => ({
  repoRoot: root,
  files,
  repo: { profile: "app", edition },
  inScope: undefined,
});

// The canon template bytes a scaffolded file must equal (sha256-judged, never content-compared).
const TEMPLATE = path.resolve(
  import.meta.dirname,
  "../templates/be/skeleton",
);
const CANON = [
  "src/modules/platform/config/env-source.config.ts",
  "src/modules/platform/http-security/origin.guard.ts",
  "src/modules/platform/http-security/webhook-signature.service.ts",
];

test("assigned-secret flags the required names and unquoted values, never config names, references or stand-ins", () => {
  const flagged = [
    'DB_PASSWORD = "hunter2hunter2hunter2"',
    'const API_SECRET = "s3cr3t-v4lu3-extra"',
    'OPENAI_API_KEY = "sk-longvaluehere123"',
    'dbPassword = "s3cr3t-v4lu3-extra"',
    'mySecretKey = "s3cr3t-v4lu3-extra"',
    'SUPABASE_SERVICE_ROLE_KEY = "longservicekeyvalue"',
    'N8N_ENCRYPTION_KEY = "longencryptionvalue"',
    "DB_PASSWORD=hunter2hunter2hunter2",
    "- API_SECRET=s3cr3t-v4lu3-extra",
  ];
  for (const line of flagged)
    assert.ok(secretHits(line.includes('"') ? "src/app.ts" : ".env", line).includes("assigned-secret"), line);
  const benign = [
    'PASSWORD_MIN_LENGTH = "16"',
    'SECRET_FILE = "averylongpathnamehere"',
    "APP_SECRET_FILE=/run/secrets/app",
    "tokenBudget: 20000000000",
    "secretRef: sec.db.password",
    'secondary = "s3cr3t-v4lu3-extra"',
    'tokenize = "s3cr3t-v4lu3-extra"',
    "maxTokens = 100000000000",
    'secret = "env(APP_SECRET)"',
    "secret = process.env.APP_SECRET;",
    'secret = "$APP_SECRET"',
    "SECRET: ${{ secrets.APP_SECRET }}",
    "password: secret:db/password",
    "apiKey: ref:vault/api",
    "secret = buildSessionSecret()",
    "APP_SECRET = credentialsSource.current",
    "APP_SECRET = credentialsSource['current']",
    'password = "fixture-password-1234"',
    'SECRET="example-only-value"',
    "sops_mac=ENC[AES256_GCM,data:xyz]",
  ];
  for (const line of benign)
    assert.equal(secretHits("src/app.ts", line).length, 0, line);
  assert.equal(secretNameLike("DB_PASSWORD"), true);
  assert.equal(secretNameLike("dbPassword"), true);
  assert.equal(secretNameLike("SUPABASE_SERVICE_ROLE_KEY"), true);
  assert.equal(secretNameLike("PASSWORD_MIN_LENGTH"), false);
  assert.equal(secretNameLike("SECRET_FILE"), false);
  assert.equal(secretNameLike("tokenBudget"), false);
});

test("R06 keeps ownership of assigned-secret findings through secretFileFindings", () => {
  const findings = secretFileFindings({
    file: "src/auth/config.ts",
    text: 'const dbPassword = "s3cr3t-v4lu3-extra";\nconst OPENAI_API_KEY = "sk-longvaluehere123";\n',
  });
  // One finding per pattern per file; both widened names matched the one `assigned-secret` code.
  assert.deepEqual(
    findings.map((f) => [f.code, f.pattern, f.line]),
    [["HFS_PLAINTEXT_SECRET", "assigned-secret", 1]],
  );
});

test("R06 pre-commit scanner refuses widened names from the index", (t) => {
  const { root } = app(t);
  const git = (args) => {
    const result = runGit(args, { cwd: root });
    assert.equal(result.status, 0, "fixture git operation succeeds");
    return result.stdout;
  };
  git(["init", "-q"]);
  const names = ["DB_PASSWORD", "API_SECRET", "OPENAI_API_KEY", "dbPassword"];
  const value = ["Zk3pQ9vL2m", "X8aR5tY7uN"].join("");
  const files = names.map((name) => `src/${name}.ts`);
  for (const [index, file] of files.entries())
    write(root, file, `const ${names[index]} = "${value}";\n`);
  const clean = "src/clean.ts";
  write(root, clean, 'const PASSWORD_MIN_LENGTH = "123456789012";\nconst APP_SECRET_FILE = "/run/secrets/app";\nconst APP_SECRET = "fixture-password-1234";\n');
  git(["add", "--", "src"]);
  for (const file of files) write(root, file, "export const clean = true;\n");
  const staged = judge(root, [...files, clean]).findings;
  assert.deepEqual(staged.map((finding) => [finding.file, finding.code]),
    files.map((file) => [file, "HFS_PLAINTEXT_SECRET"]));
  assert.ok(!JSON.stringify(staged).includes(value));
});

for (const edition of ["lite", "full"]) {
  test(`HFS_AGE_KEY_CUSTODY (${edition}): tracked identity files are refused`, (t) => {
    const { root } = app(t);
    const files = [".claude/secret.env", "sops/keys.txt", "deploy/master.agekey"];
    for (const file of files) write(root, file);
    const findings = ageKeyCustodyFindings(ctx(root, files, edition));
    assert.deepEqual(codes(findings), [
      "HFS_AGE_KEY_CUSTODY",
      "HFS_AGE_KEY_CUSTODY",
      "HFS_AGE_KEY_CUSTODY",
    ]);
  });

  test(`HFS_AGE_KEY_CUSTODY (${edition}): an untracked host identity and ordinary source files pass`, (t) => {
    const { root } = app(t);
    write(root, ".claude/secret.env", `SOPS_AGE_KEY=${PRIVATE_KEY}\n`);
    write(root, "src/index.ts");
    assert.deepEqual(
      ageKeyCustodyFindings(ctx(root, ["src/index.ts"], edition)),
      [],
    );
  });

  test(`HFS_CANON_COPY_DRIFT (${edition}): a byte-equal canon copy and a drifted one`, (t) => {
    const { root } = app(t);
    const drifted = CANON[0];
    const pristine = CANON[1];
    for (const rel of CANON)
      write(root, rel, fs.readFileSync(path.join(TEMPLATE, rel)));
    write(root, drifted, "// locally edited\n");
    const findings = canonCopyDriftFindings(ctx(root, CANON, edition));
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, "HFS_CANON_COPY_DRIFT");
    assert.equal(findings[0].path, drifted);
    assert.ok(findings[0].expectedHash !== findings[0].actualHash);
    assert.ok(!findings[0].message.includes(fs.readFileSync(path.join(TEMPLATE, drifted), "utf8").slice(0, 40)));
    assert.equal(pristine !== drifted, true);
  });

  test(`HFS_CANON_COPY_DRIFT (${edition}): untouched canon copies and unrelated files pass`, (t) => {
    const { root } = app(t);
    for (const rel of CANON)
      write(root, rel, fs.readFileSync(path.join(TEMPLATE, rel)));
    write(root, "src/index.ts");
    assert.deepEqual(
      canonCopyDriftFindings(ctx(root, [...CANON, "src/index.ts"], edition)),
      [],
    );
  });

  test(`HFS_SECRET_PLAINTEXT_FILE (${edition}): every plaintext secret-file form is refused`, (t) => {
    const { root } = app(t);
    write(root, "secrets.env");
    write(root, "nested/secret.env");
    write(root, "deploy/prod.env", "DB_PASSWORD=hunter2hunter2hunter2\nPORT=3000\n");
    write(root, "config/app.env.local", "api_secret=s3cr3t-v4lu3-extra\n");
    write(root, "secrets/app.yaml", "token: hunter2hunter2hunter2\n");
    const files = [
      "secrets.env",
      "nested/secret.env",
      "deploy/prod.env",
      "config/app.env.local",
      "secrets/app.yaml",
    ];
    const findings = secretCustodyOnlyFindings(ctx(root, files, edition));
    assert.deepEqual(codes(findings), [
      "HFS_SECRET_PLAINTEXT_FILE",
      "HFS_SECRET_PLAINTEXT_FILE",
      "HFS_SECRET_PLAINTEXT_FILE",
      "HFS_SECRET_PLAINTEXT_FILE",
      "HFS_SECRET_PLAINTEXT_FILE",
    ]);
  });

  test(`HFS_SECRET_PLAINTEXT_FILE (${edition}): sealed custody, examples and config-only env files pass`, (t) => {
    const { root } = app(t);
    write(root, ".starcistacks/dev/secrets/app.enc", sealedDotenv(["TOKEN"]));
    write(root, "deploy/prod.env.example", "DB_PASSWORD=replace-me\n");
    write(root, "deploy/prod.env", "PORT=3000\nPASSWORD_MIN_LENGTH=16\n");
    write(root, ".starcistacks/dev/secrets/app.yaml", "token: x\n");
    write(root, "docs/readme.md");
    const files = [
      ".starcistacks/dev/secrets/app.enc",
      "deploy/prod.env.example",
      "deploy/prod.env",
      ".starcistacks/dev/secrets/app.yaml",
      "docs/readme.md",
    ];
    assert.deepEqual(
      secretCustodyOnlyFindings(ctx(root, files, edition)),
      [],
      `${edition} clean tree`,
    );
    // The invalid named-.enc still belongs to R06: this rule judges custody paths only.
    const findings = secretFileFindings({ file: "x/bad.enc", text: "plain\n" });
    assert.deepEqual(codes(findings), ["HFS_PLAINTEXT_SECRET"]);
  });
}

test("HFS_SECRET_OUTSIDE_ENC (full): a sealed file outside its home is refused; direct members pass", (t) => {
  const { root } = app(t);
  write(root, "x/app.enc", sealedDotenv(["TOKEN"]));
  write(root, ".starcistacks/dev/secrets/app.enc", sealedDotenv(["TOKEN"]));
  const findings = secretCustodyOnlyFindings(
    ctx(root, ["x/app.enc", ".starcistacks/dev/secrets/app.enc"], "full"),
  );
  assert.deepEqual(codes(findings), ["HFS_SECRET_OUTSIDE_ENC"]);
  assert.equal(findings[0].path, "x/app.enc");
  assert.deepEqual(
    secretCustodyOnlyFindings(ctx(root, [".starcistacks/dev/secrets/app.enc"], "full")),
    [],
  );
});

test("HFS_SECRET_OUTSIDE_ENC (lite): an off-home .enc is already HFS_LITE_SECRET_CUSTODY, so R277 stays silent", (t) => {
  const { root } = app(t);
  write(root, "x/app.enc", sealedDotenv(["TOKEN"]));
  assert.deepEqual(
    secretCustodyOnlyFindings(ctx(root, ["x/app.enc"], "lite")),
    [],
  );
});

for (const edition of ["lite", "full"]) {
  test(`sealed custody (${edition}): nested envelopes are refused and direct members pass`, (t) => {
    const { root } = app(t);
    const nested = ".starcistacks/dev/secrets/nested/app.enc";
    const direct = ".starcistacks/dev/secrets/app.enc";
    for (const file of [nested, direct]) write(root, file, sealedDotenv(["TOKEN"]));
    const input = ctx(root, [nested, direct], edition);
    const findings = edition === "lite"
      ? liteSecretCustodyFindings(input)
      : secretCustodyOnlyFindings(input);
    assert.deepEqual(findings.map((finding) => [finding.path, finding.code]),
      [[nested, edition === "lite" ? "HFS_LITE_SECRET_CUSTODY" : "HFS_SECRET_OUTSIDE_ENC"]]);
  });

  test(`HFS_CANON_COPY_DRIFT (${edition}): packaged runtime resolves its published templates`, async (t) => {
    const { canonCopyDriftFindings: packagedFinder } = await import(
      "../runtime/scripts/hfs/rules/canon-copy-drift.mjs"
    );
    const { root } = app(t);
    for (const rel of CANON) write(root, rel, fs.readFileSync(path.join(TEMPLATE, rel)));
    const input = ctx(root, CANON, edition);
    assert.deepEqual(packagedFinder(input), []);
    write(root, CANON[2], "// locally edited\n");
    assert.deepEqual(packagedFinder(input).map((finding) => [finding.path, finding.code]),
      [[CANON[2], "HFS_CANON_COPY_DRIFT"]]);
  });
}

// A runProgram double of the selected-identity contract: version probes, the `age -y` recipient derivation and
// the one sops file action. It records every call's argv and child env so the custody assertions can name them.
const selectedTools = (calls) => ({
  resolveSops: () => process.execPath,
  resolveRealTool: () => process.execPath,
  secretEnv: () => ({ SOPS_AGE_KEY: PRIVATE_KEY }),
  runProgram: (program, args, options) => {
    // The selected-identity owner removes the key from the env map after the operation, so custody is
    // asserted on the snapshot taken while the child options are being built.
    calls.push({
      args: [...args],
      ageKey: options?.env?.SOPS_AGE_KEY,
      hasKeyFile: "SOPS_AGE_KEY_FILE" in (options?.env ?? {}),
    });
    const ok = (text) => ({
      status: 0,
      signal: null,
      error: null,
      stdout: Buffer.from(text),
      stderr: Buffer.alloc(0),
    });
    if (args[0] === "--disable-version-check") return ok("sops 3.13.2\n");
    if (args[0] === "--version") return ok("1.3.1\n");
    if (args[0] === "-y") return ok(`${RECIPIENT}\n`);
    if (args[0] === "decrypt") return ok("TOKEN=kept-private\n");
    return {
      status: 1,
      signal: null,
      error: null,
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
    };
  },
});
const keyNeverVisible = (calls, result, keys) => {
  for (const call of calls)
    for (const arg of call.args)
      for (const key of keys) assert.ok(!String(arg).includes(key), "key on argv");
  privateAbsent(result, keys);
};

test("SOPS_AGE_KEY of .claude/secret.env reaches the sops child env only, and wins over keys.txt", (t) => {
  const { root, dir, env } = app(t);
  write(dir, "app.enc", sealedDotenv(["TOKEN"]));
  const keys = secretRoots(env, process.platform).identity;
  fs.mkdirSync(path.dirname(keys), { recursive: true });
  fs.writeFileSync(keys, `${OTHER_KEY}\n`, { mode: 0o600 });
  const calls = [];
  const result = run(["get", "dev", "app", "TOKEN", "--to-file"], {
    cwd: root,
    env,
    tools: selectedTools(calls),
  });
  assert.equal(result.code, 0, result.err);
  const decrypt = calls.find((call) => call.args[0] === "decrypt");
  assert.ok(decrypt, "sops ran once");
  assert.equal(decrypt.ageKey, PRIVATE_KEY);
  assert.equal(decrypt.hasKeyFile, false);
  for (const call of calls.filter((c) => c.args[0] !== "decrypt"))
    assert.equal(call.ageKey, undefined, "the key rides only the sops call");
  keyNeverVisible(calls, result, [PRIVATE_KEY, OTHER_KEY]);
});

test("an explicit environment SOPS_AGE_KEY is not displaced by secret.env", (t) => {
  const { root, dir, env } = app(t);
  write(dir, "app.enc", sealedDotenv(["TOKEN"]));
  env.SOPS_AGE_KEY = OTHER_KEY;
  const calls = [];
  const result = run(["get", "dev", "app", "TOKEN", "--to-file"], {
    cwd: root,
    env,
    tools: selectedTools(calls),
  });
  assert.equal(result.code, 0, result.err);
  const decrypt = calls.find((call) => call.args[0] === "decrypt");
  assert.equal(decrypt.ageKey, OTHER_KEY);
  keyNeverVisible(calls, result, [PRIVATE_KEY, OTHER_KEY]);
});

test("the CLI loads .claude/secret.env itself before considering legacy keys.txt", (t) => {
  const { root, dir, env } = app(t);
  write(dir, "app.enc", sealedDotenv(["TOKEN"]));
  write(root, ".claude/secret.env", `SOPS_AGE_KEY=${PRIVATE_KEY}\n`);
  const keys = secretRoots(env, process.platform).identity;
  fs.mkdirSync(path.dirname(keys), { recursive: true });
  fs.writeFileSync(keys, `${OTHER_KEY}\n`, { mode: 0o600 });
  const calls = [];
  const tools = selectedTools(calls);
  delete tools.secretEnv;
  const result = run(["get", "dev", "app", "TOKEN", "--to-file"], {
    cwd: root, env, tools,
  });
  assert.equal(result.code, 0, "the real local credential loader resolves the identity");
  const decrypt = calls.find((call) => call.args[0] === "decrypt");
  assert.ok(decrypt);
  assert.ok(decrypt.ageKey === PRIVATE_KEY, "local identity reaches only the sops environment");
  assert.equal(decrypt.hasKeyFile, false);
  keyNeverVisible(calls, result, [PRIVATE_KEY, OTHER_KEY]);
});

test("an empty SOPS_AGE_KEY in secret.env refuses instead of falling back to keys.txt", (t) => {
  const { root, dir, env } = app(t);
  write(dir, "app.enc", sealedDotenv(["TOKEN"]));
  const keys = secretRoots(env, process.platform).identity;
  fs.mkdirSync(path.dirname(keys), { recursive: true });
  fs.writeFileSync(keys, `${OTHER_KEY}\n`, { mode: 0o600 });
  const calls = [];
  const tools = { ...selectedTools(calls), secretEnv: () => ({ SOPS_AGE_KEY: "" }) };
  const result = run(["get", "dev", "app", "TOKEN", "--to-file"], {
    cwd: root,
    env,
    tools,
  });
  assert.equal(result.code, 2);
  assert.match(result.err, /SOPS_AGE_KEY/);
  assert.equal(calls.length, 0, "no sops process launches");
  privateAbsent(result, [OTHER_KEY]);
});

test("assigned-secret ignores identifiers and types in TypeScript source (DI tokens, public error codes)", () => {
  for (const line of ["readonly verifyAccessToken: VerifySupabaseAccessToken", "token: InjectionToken", "MODULE_OPTIONS_TOKEN: DATABASE_OPTIONS_TOKEN"])
    assert.deepEqual(secretHits("src/file.ts", line), [], line);
  assert.ok(secretHits(".env", "DB_PASSWORD=hunter2hunter2hunter2").includes("assigned-secret"));
});
