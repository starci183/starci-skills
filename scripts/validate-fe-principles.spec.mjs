import assert from "node:assert/strict";
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";
import {validatePrinciples} from "./validate-fe-principles.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("profile concerns resolve only to real principle modules", () => assert.equal(validatePrinciples(ROOT).ok, true));

test("a phantom principle concern is rejected", () => {
  const temp = mkdtempSync(join(tmpdir(), "principles-"));
  try {
    cpSync(join(ROOT, "compilers"), join(temp, "compilers"), {recursive: true});
    cpSync(join(ROOT, "grammars"), join(temp, "grammars"), {recursive: true});
    const schemaPath = join(temp, "grammars", "starci", "profiles", "profile.schema.json");
    const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
    schema.$defs.Concern.enum.push("taste-score");
    writeFileSync(schemaPath, JSON.stringify(schema));
    assert.match(validatePrinciples(temp).failures.join("\n"), /differs from real modules/);
  } finally { rmSync(temp, {recursive: true, force: true}); }
});

test("status metadata case remains one sentence, not a chip collection", () => {
  const verdict = validatePrinciples(ROOT);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.cases, 3);
});
