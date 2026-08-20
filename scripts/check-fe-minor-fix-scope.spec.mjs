import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = resolve(fileURLToPath(new URL("./check-fe-minor-fix-scope.mjs", import.meta.url)));

function command(args, cwd) {
  return execFileSync(process.execPath, [script, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "starci-minor-fix-"));
  const target = join(root, "src/components/blocks/Widget");
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "index.tsx"), "export const Widget = () => null;\n", "utf8");
  writeFileSync(join(target, "index.test.tsx"), "export {};\n", "utf8");
  execFileSync("git", ["init"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: root });
  return { root, target: "src/components/blocks/Widget" };
}

test("accepts one clean existing component identity", () => {
  const { root, target } = fixture();
  const result = JSON.parse(command(["--root", root, "--target", target], root));
  assert.equal(result.state, "eligible");
  assert.equal(result.target, target);
});

test("accepts a namespaced block identity", () => {
  const { root } = fixture();
  const source = join(root, "src/components/blocks/learn/LearnRail");
  mkdirSync(source, { recursive: true });
  writeFileSync(join(source, "component.tsx"), "export const LearnRail = () => null;\n", "utf8");
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-m", "namespaced"], { cwd: root });
  const result = JSON.parse(command(["--root", root, "--target", "src/components/blocks/learn/LearnRail"], root));
  assert.equal(result.state, "eligible");
});

test("accepts a bounded production and colocated-test patch", () => {
  const { root, target } = fixture();
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  writeFileSync(join(root, target, "index.tsx"), "export const Widget = () => <span />;\n", "utf8");
  writeFileSync(join(root, target, "index.test.tsx"), "export const proof = true;\n", "utf8");
  const result = JSON.parse(command(["--root", root, "--target", target, "--base", base], root));
  assert.equal(result.productionFiles, 1);
  assert.equal(result.testFiles, 1);
  assert.ok(result.productionChurn <= 40);
});

test("rejects a dirty target before the first write", () => {
  const { root, target } = fixture();
  writeFileSync(join(root, target, "index.tsx"), "export const Widget = () => <span />;\n", "utf8");
  assert.throws(() => command(["--root", root, "--target", target], root), /target must be clean before write/);
});

test("rejects layout and page folders before source inspection", () => {
  const { root } = fixture();
  assert.throws(() => command(["--root", root, "--target", "src/components/layouts/Shell"], root), /not one existing block, composite, or leaf/);
});

test("rejects production churn above forty lines", () => {
  const { root, target } = fixture();
  const file = join(root, target, "index.tsx");
  writeFileSync(file, Array.from({ length: 25 }, (_, index) => `export const value${index} = ${index};`).join("\n") + "\n", "utf8");
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-m", "large-baseline"], { cwd: root });
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  writeFileSync(file, Array.from({ length: 25 }, (_, index) => `export const replacement${index} = ${index + 100};`).join("\n") + "\n", "utf8");
  assert.throws(() => command(["--root", root, "--target", target, "--base", base], root), /production churn limit exceeded/);
});
