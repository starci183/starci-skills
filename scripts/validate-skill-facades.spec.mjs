import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {validateFacades} from "./validate-skill-facades.mjs";

const trustRoot = path.resolve(import.meta.dirname, "..");

function withFacadeFixture(mutate, run) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "starci-facades-"));
  try {
    fs.cpSync(path.join(trustRoot, "skill-runtime"), path.join(temporary, "skill-runtime"), {recursive: true});
    const target = path.join(temporary, "skill-runtime", "facades", "analysis", "facade.json");
    const facade = JSON.parse(fs.readFileSync(target, "utf8"));
    mutate(facade);
    fs.writeFileSync(target, `${JSON.stringify(facade)}\n`);
    run(validateFacades(temporary));
  } finally {
    fs.rmSync(temporary, {recursive: true, force: true});
  }
}

test("semantic facades exactly cover the compact catalog without becoming skills", () => {
  const result = validateFacades();
  assert.deepEqual(result.failures, []);
  assert.equal(result.facadeCount, 7);
  assert.equal(result.skillCount, 20);
});

test("facade validator enforces additionalProperties false", () => {
  withFacadeFixture(
    (facade) => { facade.unexpectedAuthority = true; },
    (result) => assert.match(result.failures.join("\n"), /unexpectedAuthority is not allowed/),
  );
});

test("facade validator enforces nested selection fact cardinality", () => {
  withFacadeFixture(
    (facade) => { facade.modes[0].selectionFacts = []; },
    (result) => assert.match(result.failures.join("\n"), /selectionFacts must contain at least 1 item/),
  );
});
