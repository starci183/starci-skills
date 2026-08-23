import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {existsSync, readFileSync, readdirSync} from "node:fs";
import {basename, dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {test} from "node:test";

const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = join(trustRoot, "docs");
const contentRoot = join(docsRoot, "content");
const skillSourceRoot = join(trustRoot, "skills");

function filesBelow(directory) {
  return readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

test("Nextra publishes EN and VI without module context pages", () => {
  execFileSync(process.execPath, [join(docsRoot, "scripts", "sync-content.mjs")], {
    cwd: docsRoot,
    stdio: "pipe",
  });

  const moduleMeta = readFileSync(join(contentRoot, "mcp", "clients", "_meta.js"), "utf8");
  assert.ok(moduleMeta.indexOf('"index": "EN"') < moduleMeta.indexOf('"vi": "VI"'));
  assert.doesNotMatch(moduleMeta, /context|Agent/);
  assert.equal(filesBelow(contentRoot).some((path) => basename(path) === "context.mdx"), false);

  const skillRoot = join(contentRoot, "skills", "starci-init");
  const skillMeta = readFileSync(join(skillRoot, "_meta.js"), "utf8");
  assert.ok(skillMeta.indexOf('"index": "EN"') < skillMeta.indexOf('"vi": "VI"'));
  assert.ok(skillMeta.indexOf('"vi": "VI"') < skillMeta.indexOf('"agent": "Agent (EN)"'));
  assert.equal(existsSync(join(skillRoot, "agent.mdx")), true);
});

test("every StarCi capability entry publishes its own executable pipeline contract", () => {
  const capabilities = readdirSync(skillSourceRoot, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("starci-"))
    .map((entry) => entry.name)
    .sort();
  assert.equal(capabilities.length, 18);
  assert.deepEqual(
    capabilities.filter((name) => name.startsWith("starci-fe-")),
    ["starci-fe-design-block", "starci-fe-design-layout", "starci-fe-layout-refactor", "starci-fe-ui-reconcile"],
  );
  const refactorBinding = readFileSync(join(skillSourceRoot, "starci-fe-layout-refactor", "SKILL.md"), "utf8");
  assert.match(refactorBinding, /Feedback is an investigation signal, not proof/);
  assert.match(refactorBinding, /at least two independent cases|explicitly rules that the correction is systemic/);
  assert.match(refactorBinding, /Grammar owns product-family facts[\s\S]*Principles own only/);
  assert.match(refactorBinding, /authority-to-write map/);
  const uiReconcileBinding = readFileSync(join(skillSourceRoot, "starci-fe-ui-reconcile", "SKILL.md"), "utf8");
  assert.match(uiReconcileBinding, /Declared authority and observed product evidence remain independent/);
  assert.match(uiReconcileBinding, /at least two independent cases[\s\S]*explicitly rules it\s+systemic/);
  assert.match(uiReconcileBinding, /Grammar owns product-family meaning[\s\S]*Principles own only/);
  assert.match(uiReconcileBinding, /one writer per target/);

  for (const capability of capabilities) {
    for (const file of ["SKILL.md", "en.md", "vi.md"]) {
      const content = readFileSync(join(skillSourceRoot, capability, file), "utf8");
      assert.match(content, /^## PIPELINE$/m, `${capability}/${file} has no pipeline section`);
      assert.match(content, /^Topology:/m, `${capability}/${file} has no explicit topology`);
      if (file === "vi.md") {
        assert.match(content, /\| Bước \| Nhánh \| Đầu vào \| Cách thực hiện \| Đầu ra bắt buộc \| Điều kiện kiểm tra \|/);
      } else {
        assert.match(content, /\| Step \| Track \| Input \| Transform \| Required output \| Gate \|/);
      }
    }
  }
});

test("frontend progress uses the compact public vocabulary instead of internal methodology columns", () => {
  const shape = readFileSync(join(skillSourceRoot, "skill-shape", "en.md"), "utf8");
  assert.match(shape, /`Step`, `Work`, `Evidence`, `Status`/);
  assert.match(shape, /Scope.*Decision.*Source boundary.*Test evidence.*Approval.*Result/);
  assert.doesNotMatch(shape, /exactly these columns: `Step`, `Track`/);
});
