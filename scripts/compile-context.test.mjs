import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { checkContextFile, compileContext, contextManifestEntry, refreshContextMetadata, sourceHash } from "./compile-context.mjs";

const scratch = mkdtempSync(join(tmpdir(), "starci-context-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const source = `---
title: Contract
---

# Contract

## LOADS

None.

## Record

Keep the record.

## Situation codes

| Code | Need |
|---|---|
| \`CONTRACT-1\` | structure |

## \`CONTRACT-1\` — structure

**Situation.** A real trigger.

**Boundary.** Not CONTRACT-2.

**Common business situations.** Avatar row; card grid.

## Rules

1. Keep the rule.

## Worked example

Remove this example.

## Anchor

Remove this anchor.

## Scope

Remove this scope.
`;

test("compiler retains runtime law and removes optional teaching prose", () => {
  const result = compileContext(source, join(scratch, "compilers", "patterns", "fe", "contract", "en.md"));
  assert.doesNotMatch(result, /^---|sourceHash:|contextVersion:|runtime:/m);
  assert.match(result, /## Situation codes/);
  assert.match(result, /\*\*Boundary\.\*\* Not CONTRACT-2\./);
  assert.match(result, /## Rules/);
  assert.doesNotMatch(result, /Common business situations|Worked example|Anchor|Scope|Remove this/);
});

test("source hash is line-ending stable", () => {
  assert.equal(sourceHash(source), sourceHash(source.replaceAll("\n", "\r\n")));
});

test("checker validates manifest source hash and binding sections", () => {
  const directory = join(scratch, "hash-check");
  mkdirSync(directory);
  const sourcePath = join(directory, "en.md");
  const contextPath = join(directory, "context.md");
  writeFileSync(sourcePath, source, "utf8");
  writeFileSync(contextPath, compileContext(source, sourcePath), "utf8");
  const entry = contextManifestEntry(sourcePath);
  const valid = checkContextFile(sourcePath, entry);
  assert.equal(valid.ok, true, valid.reason);
  assert.match(checkContextFile(sourcePath, {...entry, sourceHash: "0".repeat(64)}).reason, /manifest sourceHash does not match en\.md/);
});

test("checker accepts curated wording but rejects removed codes and teaching sections", () => {
  const directory = join(scratch, "curated-check");
  mkdirSync(directory);
  const sourcePath = join(directory, "en.md");
  const contextPath = join(directory, "context.md");
  writeFileSync(sourcePath, source, "utf8");
  const generated = compileContext(source, sourcePath).replace("Keep the record.", "A shorter binding record.");
  writeFileSync(contextPath, generated, "utf8");
  const entry = contextManifestEntry(sourcePath);
  const valid = checkContextFile(sourcePath, entry);
  assert.equal(valid.ok, true, valid.reason);
  writeFileSync(contextPath, generated.replace("## `CONTRACT-1` — structure", "## Worked example"), "utf8");
  const reason = checkContextFile(sourcePath, entry).reason;
  assert.match(reason, /missing binding section: `CONTRACT-1` — structure/);
  assert.match(reason, /forbidden teaching section: Worked example/);
});

test("manifest refresh preserves curated context body", () => {
  const fixture = mkdtempSync(join(tmpdir(), "starci-context-refresh-"));
  try {
    const sourcePath = join(fixture, "en.md");
    const contextPath = join(fixture, "context.md");
    writeFileSync(sourcePath, source, "utf8");
    const curated = compileContext(source, sourcePath).replace("Keep the record.", "Curated binding sentence.");
    writeFileSync(contextPath, curated, "utf8");
    const manifest = {version: 1, records: {}};
    assert.equal(refreshContextMetadata(sourcePath, manifest).ok, true);
    const refreshed = readFileSync(contextPath, "utf8");
    assert.match(refreshed, /Curated binding sentence\./);
    assert.equal(Object.values(manifest.records)[0].sourceHash, sourceHash(source));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
