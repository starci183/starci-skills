import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const checker = fileURLToPath(new URL("./check-port-offsets.mjs", import.meta.url));
const writeJson = (path, value) => {
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const fixture = (t) => {
  const root = mkdtempSync(join(tmpdir(), "starci-port-offset-"));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  writeJson(join(root, ".workspace", "ports", "config.json"), {version: 1, slotStep: 1000});
  return root;
};

test("application slots shift both sides of a pair by the Source slot step", () => {
  const resolvePort = (basePort, offset, slot, slotStep) => basePort + offset + slot * slotStep;
  assert.equal(resolvePort(2999, 67, 1, 1000), 4066);
  assert.equal(resolvePort(3000, 67, 1, 1000), 4067);
});

test("shared services ignore application slots", () => {
  assert.equal(5432 + 67, 5499);
});

test("per-project allocation resolves application and shared projections", (t) => {
  const root = fixture(t);
  const repository = join(root, "tedo-backend");
  mkdirSync(join(root, ".workspace", "cache"), {recursive: true});
  mkdirSync(join(root, ".workspace", "credentials"), {recursive: true});
  writeJson(join(root, ".workspace", "ports", "tedo.json"), {
    version: 1, project: "tedo", offset: 2, applications: {main: 0},
  });
  writeJson(join(root, ".workspace", "tedo", "be", "config.json"), {repository: {diskPath: repository}});
  writeJson(join(repository, "metadata.json"), {
    ports: {web: 3002, postgres: 5434},
    portServices: {
      web: {scope: "application", application: "main", basePort: 3000},
      postgres: {scope: "shared", basePort: 5432},
    },
  });

  const result = spawnSync(process.execPath, [checker, "--source", root], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /tedo: offset \+2; applications main=\+0/);
  assert.match(result.stdout, /web=3002 \(application\)/);
  assert.match(result.stdout, /postgres=5434 \(shared\)/);
});

test("a routed project without its own allocation record is stale", (t) => {
  const root = fixture(t);
  writeJson(join(root, ".workspace", "tedo", "be", "config.json"), {repository: {diskPath: join(root, "tedo-backend")}});

  const result = spawnSync(process.execPath, [checker, "--source", root], {encoding: "utf8"});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /tedo: allocation record is absent/);
});
