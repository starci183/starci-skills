import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { compileContext } from "./compile-context.mjs";

const scripts = dirname(fileURLToPath(import.meta.url));

test("context, English and Vietnamese dependency graphs validate independently", () => {
  const output = execFileSync(process.execPath, [join(scripts, "check-deps.mjs"), "--all"], {
    cwd: join(scripts, "..", ".."),
    encoding: "utf8",
  });
  assert.match(output, /Runtime context dependency graph holds/);
  assert.match(output, /English publication dependency graph holds/);
  assert.match(output, /Vietnamese publication dependency graph holds/);
});

test("runtime graph rejects a path into an English publication record", () => {
  const fixture = mkdtempSync(join(tmpdir(), "starci-deps-lanes-"));
  try {
    const fixtureScripts = join(fixture, "scripts");
    const module = join(fixture, "sample");
    mkdirSync(fixtureScripts);
    mkdirSync(module);
    copyFileSync(join(scripts, "check-deps.mjs"), join(fixtureScripts, "check-deps.mjs"));
    copyFileSync(join(scripts, "compile-context.mjs"), join(fixtureScripts, "compile-context.mjs"));
    const en = "# Sample\n\n## LOADS\n\nNone.\n\n## Record\n\nEnglish publication.\n";
    const vi = "# Mẫu\n\n## LOADS\n\nKhông có.\n\n## Bản ghi\n\nPublication tiếng Việt.\n";
    writeFileSync(join(module, "en.md"), en, "utf8");
    writeFileSync(join(module, "vi.md"), vi, "utf8");
    writeFileSync(
      join(module, "context.md"),
      compileContext(en, join(module, "en.md")).replace("English publication.", "Do not load `sample/en.md`."),
      "utf8",
    );
    const result = spawnSync(process.execPath, [join(fixtureScripts, "check-deps.mjs"), "--context"], {
      cwd: fixture,
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /context graph crosses into en\.md/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
