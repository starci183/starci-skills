import assert from "node:assert/strict";
import {execFileSync, spawnSync} from "node:child_process";
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import test from "node:test";

const script = new URL("./workspace-portable.mjs", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1));
const writeJson = (path, value) => {
  mkdirSync(join(path, ".."), {recursive: true});
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

function git(repo, ...args) {
  return execFileSync("git", ["-C", repo, ...args], {encoding: "utf8", windowsHide: true}).trim();
}

function repository(path, remote) {
  mkdirSync(path, {recursive: true});
  execFileSync("git", ["init", "-b", "main", path], {stdio: "ignore", windowsHide: true});
  git(path, "config", "user.name", "Test");
  git(path, "config", "user.email", "test@example.com");
  git(path, "remote", "add", "origin", remote);
  writeFileSync(join(path, "package.json"), "{}\n");
  git(path, "add", "package.json");
  git(path, "commit", "-m", "fixture");
}

function fixture(t) {
  const repositories = mkdtempSync(join(tmpdir(), "starci-workspaces-"));
  const source = join(repositories, "source");
  const frontend = join(repositories, "frontend");
  t.after(() => rmSync(repositories, {recursive: true, force: true}));
  repository(source, "https://github.com/starci-lab/source.git");
  repository(frontend, "https://github.com/starci-lab/frontend.git");
  mkdirSync(join(source, ".claude", "knowledge", "grammars", "starci", "profiles"), {recursive: true});
  writeFileSync(join(source, ".claude", "knowledge", "grammars", "starci", "grammar.json"), "{}\n");
  writeFileSync(join(source, ".claude", "knowledge", "grammars", "starci", "profiles", "demo.json"), "{}\n");
  mkdirSync(join(frontend, "src", "components", "contracts"), {recursive: true});
  writeFileSync(join(frontend, "src", "components", "contracts", "index.ts"), "export {};\n");
  const legacy = join(source, ".workspace");
  writeJson(join(legacy, "config.json"), {version: 1, defaultLang: "vi"});
  writeJson(join(legacy, "ports", "config.json"), {version: 1, slotStep: 1000});
  writeJson(join(legacy, "ports", "demo.json"), {version: 1, project: "demo", offset: 4, applications: {main: 0}});
  const route = (role, repo, remote, context) => ({
    version: 1,
    project: "demo",
    role,
    source: {path: source, trust: join(source, ".claude"), skills: join(source, ".claude", "skills"), workspaceRoot: legacy},
    repository: {diskPath: repo, gitRoot: repo, gitRepository: remote, branch: "main", head: git(repo, "rev-parse", "HEAD")},
    context,
    updatedAt: new Date().toISOString(),
  });
  writeJson(join(legacy, "demo", "be", "config.json"), route("be", source, "https://github.com/starci-lab/source.git", {
    instructions: [], contract: null, contractSource: null, manifests: [join(source, "package.json")], grammar: null, grammarProfile: null,
  }));
  writeJson(join(legacy, "demo", "fe", "config.json"), route("fe", frontend, "https://github.com/starci-lab/frontend.git", {
    instructions: [], contract: join(frontend, "src", "components", "contracts", "index.ts"), contractSource: "declared:src/components/contracts/index.ts",
    manifests: [join(frontend, "package.json")], grammar: "starci", grammarProfile: "demo",
  }));
  mkdirSync(join(legacy, "credentials"), {recursive: true});
  writeFileSync(join(legacy, "credentials", "provider.key.enc"), "ciphertext");
  return {repositories, source, frontend, legacy};
}

test("exports only portable declarations and hydrates local routes without touching credentials", (t) => {
  const f = fixture(t);
  let result = spawnSync(process.execPath, [script, "export", "--source", f.source, "--repositories-root", f.repositories, "--legacy-root", f.legacy, "--apply"], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr);
  const portablePath = join(f.source, ".workspaces", "projects", "demo", "fe.json");
  const portableText = readFileSync(portablePath, "utf8");
  assert.doesNotMatch(portableText, /starci-workspaces-|diskPath|gitRoot|updatedAt|head/);
  assert.match(portableText, /https:\/\/github\.com\/starci-lab\/frontend\.git/);
  assert.equal(existsSync(join(f.source, ".workspaces", "credentials")), false);

  result = spawnSync(process.execPath, [script, "hydrate", "--source", f.source, "--repositories-root", f.repositories, "--apply"], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr);
  const local = JSON.parse(readFileSync(join(f.source, ".workspaces", "local", "routes", "demo", "fe", "config.json"), "utf8"));
  assert.equal(local.repository.diskPath, f.frontend);
  assert.equal(local.repository.head, git(f.frontend, "rev-parse", "HEAD"));
  assert.equal(local.context.grammarProfile, "demo");
  assert.equal(readFileSync(join(f.legacy, "credentials", "provider.key.enc"), "utf8"), "ciphertext");

  result = spawnSync(process.execPath, [script, "check", "--source", f.source, "--repositories-root", f.repositories], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr);
});

test("rejects credential-bearing GitHub URLs", async () => {
  const {validatePortableRoute} = await import("./workspace-portable.mjs");
  assert.throws(() => validatePortableRoute({
    version: 1,
    project: "demo",
    role: "fe",
    repository: {kind: "sibling", directory: "frontend", gitRepository: "https://token@github.com/org/repo.git", branch: "main"},
    context: {instructions: [], contract: null, contractSource: null, manifests: ["package.json"], grammar: null, grammarProfile: null},
  }), /credential-free GitHub HTTPS URL/);
});

test("rejects machine state hidden in portable port declarations", (t) => {
  const f = fixture(t);
  writeJson(join(f.legacy, "ports", "unsafe.json"), {
    version: 1,
    project: "unsafe",
    updatedAt: new Date().toISOString(),
  });
  const result = spawnSync(process.execPath, [script, "export", "--source", f.source, "--repositories-root", f.repositories, "--legacy-root", f.legacy, "--apply"], {encoding: "utf8"});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /observed machine state/);
});
