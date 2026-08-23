import assert from "node:assert/strict";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import test from "node:test";
import {buildSkillCatalog, checkSkillCatalog, writeSkillCatalog} from "./build-skill-catalog.mjs";

const sourceRoot = resolve(import.meta.dirname, "../..");

function syntheticSource(mutator = (value) => value) {
  const root = mkdtempSync(join(tmpdir(), "starci-skill-catalog-"));
  for (const id of ["alpha-skill", "beta-skill"]) {
    const directory = join(root, ".claude", "skills", id);
    mkdirSync(directory, {recursive: true});
    writeFileSync(join(directory, "SKILL.md"), `---\nname: ${id}\ndescription: ${id} description\n---\n`, "utf8");
  }
  const metadata = {
    schemaVersion: 1,
    macros: [{id: "workflow", aliases: ["workflow-entry"]}],
    skills: {
      "alpha-skill": {
        macro: "workflow", macroMode: "alpha", aliases: ["alpha-entry"], intent: ["perform alpha analysis"],
        excludes: ["perform beta analysis"], modes: ["analyze"], risk: "read-only",
        read: ["alpha evidence"], write: [], knowledge: ["alpha knowledge"], tools: ["alpha tool"]
      },
      "beta-skill": {
        macro: "workflow", macroMode: "beta", aliases: ["beta-entry"], intent: ["perform beta delivery"],
        excludes: ["perform alpha delivery"], modes: ["deliver"], risk: "local-write",
        read: ["beta evidence"], write: ["beta artifact"], knowledge: ["beta knowledge"], tools: ["beta tool"]
      }
    }
  };
  const changed = mutator(structuredClone(metadata));
  const catalogDirectory = join(root, ".claude", "runtime", "skill-runtime", "catalog");
  mkdirSync(catalogDirectory, {recursive: true});
  writeFileSync(join(catalogDirectory, "overrides.json"), `${JSON.stringify(changed, null, 2)}\n`, "utf8");
  return root;
}

test("catalog inventories every physical skill with deterministic compact bytes", () => {
  const first = buildSkillCatalog(sourceRoot);
  const second = buildSkillCatalog(sourceRoot);
  assert.equal(first.catalog.skills.length, 20);
  assert.equal(first.catalogText, second.catalogText);
  assert.equal(first.schemaText, second.schemaText);
  assert(!first.catalogText.includes("\n  "));
  assert(first.catalogText.length < 50_000, `catalog grew beyond its compact runtime budget: ${first.catalogText.length}`);
  assert.match(first.catalog.sourceDigest, /^[a-f0-9]{64}$/);
});

test("every skill id, alias, intent and macro route is unambiguous", () => {
  const {catalog} = buildSkillCatalog(sourceRoot);
  assert.equal(new Set(catalog.skills.map(({id}) => id)).size, catalog.skills.length);
  const discoveryNames = [
    ...catalog.macros.flatMap(({id, aliases}) => [id, ...aliases]),
    ...catalog.skills.flatMap(({id, aliases}) => [id, ...aliases])
  ].map((value) => value.toLowerCase());
  assert.equal(new Set(discoveryNames).size, discoveryNames.length);
  const intents = catalog.skills.flatMap(({intent}) => intent.map((value) => value.toLowerCase()));
  assert.equal(new Set(intents).size, intents.length);
  const routed = catalog.macros.flatMap(({routes}) => Object.values(routes));
  assert.equal(routed.length, catalog.skills.length);
  assert.deepEqual([...routed].sort(), catalog.skills.map(({id}) => id).sort());
});

test("generated catalog and schema are byte-identical to a fresh build", () => {
  const built = checkSkillCatalog(sourceRoot);
  assert.equal(readFileSync(join(sourceRoot, ".claude/runtime/skill-runtime/catalog/catalog.json"), "utf8"), built.catalogText);
  assert.equal(readFileSync(join(sourceRoot, ".claude/runtime/skill-runtime/catalog/schema.json"), "utf8"), built.schemaText);
});

test("writer output passes its own stale check", () => {
  const root = syntheticSource();
  try {
    writeSkillCatalog(root);
    assert.doesNotThrow(() => checkSkillCatalog(root));
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test("builder refuses obvious catchall intents", () => {
  const root = syntheticSource((metadata) => {
    metadata.skills["alpha-skill"].intent = ["help"];
    return metadata;
  });
  try {
    assert.throws(() => buildSkillCatalog(root), /catchall phrase/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test("builder refuses ambiguous aliases", () => {
  const root = syntheticSource((metadata) => {
    metadata.skills["beta-skill"].aliases = ["alpha-entry"];
    return metadata;
  });
  try {
    assert.throws(() => buildSkillCatalog(root), /ambiguous skill discovery name/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test("builder refuses an override set that does not exactly cover physical skills", () => {
  const root = syntheticSource((metadata) => {
    delete metadata.skills["beta-skill"];
    return metadata;
  });
  try {
    assert.throws(() => buildSkillCatalog(root), /skills missing catalog overrides/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
