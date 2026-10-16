// starci app secret unset|rename|remove over a fake sops seam. Names and paths may be printed; values are compared as booleans only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { app, run, privateAbsent } from "../helpers/hfs-secret-fixture.mjs";
import { envelopeOf } from "../../scripts/hfs/secret.mjs";

const RECIPIENT = `age1${"q".repeat(58)}`;
const OTHER = `age1${"p".repeat(58)}`;
const ENC = "ENC[AES256_GCM,data:AA==,iv:AA==,tag:AA==,type:str]";
const PEM = "-----BEGIN OPENSSH PRIVATE KEY-----\nprivate-pem-line\n-----END OPENSSH PRIVATE KEY-----\n";
const VALUES = { A_TOKEN: "private-value-one", B_URL: "private-value-two", C_FLAG: "private-value-three" };

const sealedDotenv = (keys, recipients = [RECIPIENT]) =>
  `${keys.map((key) => `${key}=${ENC}`).join("\n")}\n${recipients.map((r, i) => `sops_age__list_${i}__map_recipient=${r}`).join("\n")}\nsops_mac=${ENC}\n`;
const sealedJson = (keys, recipients = [RECIPIENT]) =>
  `${JSON.stringify({ ...Object.fromEntries(keys.map((key) => [key, ENC])), sops: { mac: ENC, age: recipients.map((recipient) => ({ recipient, enc: "x" })) } })}\n`;

/** An in-memory sops: members by file name; seal returns a real-looking envelope for the keys it was given. */
function fakeSops({ plain = {}, binary = {}, recipientsBack = null, failDecrypt = false } = {}) {
  const seen = { sealed: [], decrypted: [], binary: [] };
  return {
    seen,
    decrypt(file, format) {
      seen.decrypted.push({ file: path.basename(file), format });
      if (failDecrypt) throw new Error("sops could not decrypt private-value-one");
      return { ...plain[path.basename(file)] };
    },
    decryptBinary(file) {
      seen.binary.push(path.basename(file));
      return binary[path.basename(file)];
    },
    seal(request) {
      seen.sealed.push(request);
      const recipients = recipientsBack ?? (request.recipients.length ? request.recipients : [RECIPIENT]);
      if (request.inputType === "dotenv")
        return sealedDotenv(request.plaintext.split("\n").filter(Boolean).map((line) => line.split("=")[0]), recipients);
      return sealedJson(Object.keys(JSON.parse(request.plaintext)), recipients);
    },
  };
}

const members = (t, files, environment = "production") => app(t, files, environment);
const never = () => assert.fail("a dry run or a refusal must not open sops");
const read = (dir, name) => fs.readFileSync(path.join(dir, name), "utf8");
const leftovers = (dir) => fs.readdirSync(dir).filter((name) => name.startsWith("."));

test("unset is a dry run by default: it names the key, needs no sops or identity, and changes nothing", (t) => {
  const { root, env, dir } = members(t, { "stack.enc": sealedDotenv(Object.keys(VALUES)) });
  const before = read(dir, "stack.enc");
  const result = run(["unset", "production", "stack", "B_URL"], { cwd: root, env, sops: never });
  assert.equal(result.code, 0, result.err);
  assert.match(result.out, /dry run: would unset B_URL from production\/stack \(2 keys remain\)/u);
  assert.equal(read(dir, "stack.enc"), before);
  privateAbsent(result, Object.values(VALUES));
});

test("unset --execute re-seals the member without the key, to the same recipients and format, and prints no value", (t) => {
  const { root, env, dir } = members(t, { "stack.enc": sealedDotenv(Object.keys(VALUES), [RECIPIENT, OTHER]) });
  const sops = fakeSops({ plain: { "stack.enc": VALUES } });
  const result = run(["unset", "production", "stack", "B_URL", "--execute"], { cwd: root, env, sops });
  assert.equal(result.code, 0, result.err);
  assert.match(result.out, /unset production\/stack \(B_URL\); 2 keys remain/u);
  const [request] = sops.seen.sealed;
  assert.equal(request.inputType, "dotenv");
  assert.deepEqual(request.recipients, [RECIPIENT, OTHER]);
  assert.equal(request.plaintext, `A_TOKEN=${VALUES.A_TOKEN}\nC_FLAG=${VALUES.C_FLAG}\n`);
  assert.deepEqual(envelopeOf(read(dir, "stack.enc")), { format: "dotenv", keys: ["A_TOKEN", "C_FLAG"], recipients: [RECIPIENT, OTHER] });
  assert.deepEqual(leftovers(dir), [], "no temporary or lock file stays behind");
  privateAbsent(result, Object.values(VALUES));
});

test("unset keeps a JSON member JSON", (t) => {
  const { root, env, dir } = members(t, { "api.enc": sealedJson(["A_TOKEN", "B_URL"]) });
  const sops = fakeSops({ plain: { "api.enc": { A_TOKEN: VALUES.A_TOKEN, B_URL: VALUES.B_URL } } });
  const result = run(["unset", "production", "api", "A_TOKEN", "--execute"], { cwd: root, env, sops });
  assert.equal(result.code, 0, result.err);
  assert.equal(sops.seen.sealed[0].inputType, "json");
  assert.deepEqual(envelopeOf(read(dir, "api.enc")).keys, ["B_URL"]);
});

test("unset refuses an unknown member, an unknown key, an invalid key name, the last key and stray arguments without printing a value", (t) => {
  const { root, env, dir } = members(t, { "stack.enc": sealedDotenv(["A_TOKEN", "B_URL"]), "one.enc": sealedDotenv(["ONLY_KEY"]) });
  const before = read(dir, "stack.enc");
  const cases = [
    [["unset", "production", "ghost", "A_TOKEN", "--execute"], /ghost is not a sealed member|production\/ghost is not a sealed member/u],
    [["unset", "production", "stack", "MISSING_KEY", "--execute"], /has no KEY MISSING_KEY/u],
    [["unset", "production", "stack", "sops_mac", "--execute"], /KEY must be an environment variable name/u],
    [["unset", "production", "stack", "bad-key", "--execute"], /KEY must be an environment variable name/u],
    [["unset", "production", "one", "ONLY_KEY", "--execute"], /last KEY of production\/one/u],
    [["unset", "production", "stack"], /usage: starci app secret unset/u],
    [["unset", "production", "stack", "A_TOKEN", "B_URL"], /usage: starci app secret unset/u],
    [["unset", "production", "Bad_Slug", "A_TOKEN"], /not a secret slug/u],
    [["unset", "production", "stack", "A_TOKEN", "--force-nonempty"], /only valid for remove/u],
  ];
  for (const [argv, pattern] of cases) {
    const result = run(argv, { cwd: root, env, sops: never });
    assert.equal(result.code, 2, argv.join(" "));
    assert.match(result.err, pattern);
    privateAbsent(result, Object.values(VALUES));
  }
  assert.equal(read(dir, "stack.enc"), before);
});

test("a sops failure or a changed recipient set is refused, leaves the member untouched and leaks no value", (t) => {
  const { root, env, dir } = members(t, { "stack.enc": sealedDotenv(["A_TOKEN", "B_URL"]) });
  const before = read(dir, "stack.enc");
  const failing = run(["unset", "production", "stack", "A_TOKEN", "--execute"], { cwd: root, env, sops: fakeSops({ failDecrypt: true }) });
  assert.equal(failing.code, 2);
  const swapped = fakeSops({ plain: { "stack.enc": VALUES }, recipientsBack: [OTHER] });
  const result = run(["unset", "production", "stack", "A_TOKEN", "--execute"], { cwd: root, env, sops: { ...swapped, decrypt: () => ({ A_TOKEN: VALUES.A_TOKEN, B_URL: VALUES.B_URL }) } });
  assert.equal(result.code, 2);
  assert.match(result.err, /different recipients/u);
  assert.equal(read(dir, "stack.enc"), before);
  assert.deepEqual(leftovers(dir), []);
  privateAbsent(result, Object.values(VALUES));
});

test("a decrypted key set that differs from the envelope is refused", (t) => {
  const { root, env, dir } = members(t, { "stack.enc": sealedDotenv(["A_TOKEN", "B_URL"]) });
  const before = read(dir, "stack.enc");
  const result = run(["unset", "production", "stack", "A_TOKEN", "--execute"], { cwd: root, env, sops: fakeSops({ plain: { "stack.enc": { A_TOKEN: "x" } } }) });
  assert.equal(result.code, 2);
  assert.match(result.err, /differ from the envelope/u);
  assert.equal(read(dir, "stack.enc"), before);
});

test("rename moves the value to the new KEY in place, dry run first, and never prints it", (t) => {
  const { root, env, dir } = members(t, { "stack.enc": sealedDotenv(Object.keys(VALUES)) });
  const before = read(dir, "stack.enc");
  const dry = run(["rename", "production", "stack", "B_URL", "B_ENDPOINT"], { cwd: root, env, sops: never });
  assert.equal(dry.code, 0, dry.err);
  assert.match(dry.out, /dry run: would rename B_URL to B_ENDPOINT in production\/stack/u);
  assert.equal(read(dir, "stack.enc"), before);
  const sops = fakeSops({ plain: { "stack.enc": VALUES } });
  const done = run(["rename", "production", "stack", "B_URL", "B_ENDPOINT", "--execute"], { cwd: root, env, sops });
  assert.equal(done.code, 0, done.err);
  assert.equal(sops.seen.sealed[0].plaintext, `A_TOKEN=${VALUES.A_TOKEN}\nB_ENDPOINT=${VALUES.B_URL}\nC_FLAG=${VALUES.C_FLAG}\n`);
  assert.deepEqual(envelopeOf(read(dir, "stack.enc")).keys, ["A_TOKEN", "B_ENDPOINT", "C_FLAG"]);
  privateAbsent(dry, Object.values(VALUES));
  privateAbsent(done, Object.values(VALUES));
});

test("rename refuses an unknown key, an existing target, an identical name and an invalid name", (t) => {
  const { root, env, dir } = members(t, { "stack.enc": sealedDotenv(["A_TOKEN", "B_URL"]) });
  const before = read(dir, "stack.enc");
  const cases = [
    [["rename", "production", "stack", "MISSING", "NEW_KEY", "--execute"], /has no KEY MISSING/u],
    [["rename", "production", "stack", "A_TOKEN", "B_URL", "--execute"], /already has KEY B_URL/u],
    [["rename", "production", "stack", "A_TOKEN", "A_TOKEN", "--execute"], /equals the old KEY/u],
    [["rename", "production", "stack", "A_TOKEN", "sops_new", "--execute"], /KEY must be an environment variable name/u],
    [["rename", "production", "stack", "A_TOKEN"], /usage: starci app secret rename/u],
    [["rename", "production", "ghost", "A_TOKEN", "NEW_KEY"], /not a sealed member/u],
  ];
  for (const [argv, pattern] of cases) {
    const result = run(argv, { cwd: root, env, sops: never });
    assert.equal(result.code, 2, argv.join(" "));
    assert.match(result.err, pattern);
  }
  assert.equal(read(dir, "stack.enc"), before);
});

test("rename re-seals a binary data envelope as a JSON envelope under the new property name, byte for byte", (t) => {
  const { root, env, dir } = members(t, {
    "vps-ssh-key.enc": sealedJson(["data"], [RECIPIENT, OTHER]),
    "vps-known-hosts.enc": sealedJson(["data"]),
  });
  const sops = fakeSops({ binary: { "vps-ssh-key.enc": PEM, "vps-known-hosts.enc": "host ssh-ed25519 AAAA\r\n" } });
  const dry = run(["rename", "production", "vps-ssh-key", "data", "privateKey"], { cwd: root, env, sops: never });
  assert.match(dry.out, /re-sealed as a JSON envelope/u);
  assert.deepEqual(envelopeOf(read(dir, "vps-ssh-key.enc")).keys, ["data"]);
  for (const [slug, name, value] of [["vps-ssh-key", "privateKey", PEM], ["vps-known-hosts", "knownHosts", "host ssh-ed25519 AAAA\r\n"]]) {
    const result = run(["rename", "production", slug, "data", name, "--execute"], { cwd: root, env, sops });
    assert.equal(result.code, 0, result.err);
    const request = sops.seen.sealed.at(-1);
    assert.equal(request.inputType, "json");
    assert.deepEqual(JSON.parse(request.plaintext), { [name]: value });
    assert.deepEqual(envelopeOf(read(dir, `${slug}.enc`)).keys, [name]);
    privateAbsent(result, [PEM, "AAAA"]);
  }
  assert.deepEqual(envelopeOf(read(dir, "vps-ssh-key.enc")).recipients, [RECIPIENT, OTHER]);
  assert.deepEqual(sops.seen.decrypted, [], "a binary envelope is read as binary, never through the dotenv channel");
});

test("a JSON member with a literal backslash-n or carriage return is refused instead of corrupted", (t) => {
  const { root, env, dir } = members(t, { "api.enc": sealedJson(["A_TOKEN", "B_URL"]) });
  const before = read(dir, "api.enc");
  const sops = fakeSops({ plain: { "api.enc": { A_TOKEN: String.raw`one\ntwo`, B_URL: "x" } } });
  const result = run(["unset", "production", "api", "B_URL", "--execute"], { cwd: root, env, sops });
  assert.equal(result.code, 2);
  assert.match(result.err, /cannot preserve/u);
  assert.equal(read(dir, "api.enc"), before);
});

test("remove refuses a member that still holds keys unless --force-nonempty, and is a dry run until --execute", (t) => {
  const { root, env, dir } = members(t, { "web.enc": sealedDotenv(["NEXT_PUBLIC_X", "NEXT_PUBLIC_Y"]), "keep.enc": sealedDotenv(["KEEP_ME"]) });
  const refused = run(["remove", "production", "web", "--execute"], { cwd: root, env, sops: never });
  assert.equal(refused.code, 2);
  assert.match(refused.err, /still holds 2 keys \(NEXT_PUBLIC_X, NEXT_PUBLIC_Y\).*--force-nonempty/u);
  assert.ok(fs.existsSync(path.join(dir, "web.enc")));
  const dry = run(["remove", "production", "web", "--force-nonempty"], { cwd: root, env, sops: never });
  assert.equal(dry.code, 0, dry.err);
  assert.match(dry.out, /dry run: would remove production\/web\.enc \(2 keys\)/u);
  assert.ok(fs.existsSync(path.join(dir, "web.enc")));
  const done = run(["remove", "production", "web", "--force-nonempty", "--execute"], { cwd: root, env, sops: never });
  assert.equal(done.code, 0, done.err);
  assert.match(done.out, /removed production\/web\.enc/u);
  assert.ok(!fs.existsSync(path.join(dir, "web.enc")));
  assert.ok(fs.existsSync(path.join(dir, "keep.enc")), "other members stay");
  assert.deepEqual(leftovers(dir), []);
});

test("remove refuses an unknown member, a KEY argument, a non-envelope file and a symlink", (t) => {
  const { root, env, dir } = members(t, { "plain.enc": "A=plaintext-not-sealed\n", "real.enc": sealedDotenv(["A_KEY"]) });
  try { fs.symlinkSync(path.join(dir, "real.enc"), path.join(dir, "link.enc")); } catch { /* symlinks are optional on this host */ }
  const cases = [
    [["remove", "production", "ghost", "--force-nonempty"], /not a sealed member/u],
    [["remove", "production", "real", "A_KEY", "--force-nonempty"], /usage: starci app secret remove/u],
    [["remove", "production", "plain", "--force-nonempty", "--execute"], /not a sops envelope/u],
  ];
  if (fs.existsSync(path.join(dir, "link.enc"))) cases.push([["remove", "production", "link", "--force-nonempty", "--execute"], /ordinary sealed file/u]);
  for (const [argv, pattern] of cases) {
    const result = run(argv, { cwd: root, env, sops: never });
    assert.equal(result.code, 2, argv.join(" "));
    assert.match(result.err, pattern);
  }
  assert.ok(fs.existsSync(path.join(dir, "plain.enc")) && fs.existsSync(path.join(dir, "real.enc")));
});

test("--execute and --force-nonempty are refused on the other verbs", (t) => {
  const { root, env } = members(t, { "stack.enc": sealedDotenv(["A_TOKEN"]) });
  for (const argv of [["list", "production", "--execute"], ["set", "production", "stack", "A_TOKEN", "--execute"], ["rename", "production", "stack", "A_TOKEN", "B_TOKEN", "--force-nonempty"]]) {
    const result = run(argv, { cwd: root, env, sops: never, stdin: () => "x" });
    assert.equal(result.code, 2, argv.join(" "));
    assert.match(result.err, /only valid for/u);
  }
});
