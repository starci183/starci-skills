import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import {mkdtemp, mkdir, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import test from "node:test";
import {migrateDesignRegistry} from "./migrate-design-registry.mjs";

const layoutHash = "a".repeat(64);
const blockHash = "b".repeat(64);
const rejectedHash = "c".repeat(64);

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "starci-design-registry-"));
  await mkdir(join(root, "layouts", "map"), {recursive: true});
  await mkdir(join(root, "blocks", "map"), {recursive: true});
  await mkdir(join(root, "decisions"), {recursive: true});
  await mkdir(join(root, "objects", "sha256"), {recursive: true});
  await writeFile(join(root, "registry.json"), JSON.stringify({schemaVersion: 1, project: "example-app"}));
  await writeFile(join(root, "layouts", "map", "current-heads.json"), JSON.stringify({heads: {"course-home": layoutHash}}));
  await writeFile(join(root, "blocks", "map", "current-heads.json"), JSON.stringify({heads: {[`${layoutHash}/hero`]: blockHash}}));
  await writeFile(join(root, "decisions", "course-home.json"), JSON.stringify({
    schema: 1,
    id: "course-home/2026-08-19",
    project: "example-app",
    surface: "course-home",
    routePattern: "/courses/:courseId",
    rounds: [
      {number: 1, phase: "layout", prompt: "choose layout", produced: [{id: "wide", hash: layoutHash}], verdict: {state: "accepted", acceptedHash: layoutHash}},
      {number: 2, phase: "block", region: "hero", layoutHash, prompt: "choose hero", produced: [{id: "hero-card", hash: blockHash}], verdict: {state: "accepted", acceptedHash: blockHash, rejected: [{hash: rejectedHash, reason: "owner chose the first anatomy"}]}},
    ],
    queue: [],
  }));
  await writeFile(join(root, "objects", "sha256", `${layoutHash}.json`), JSON.stringify({regions: [{name: "hero"}]}));
  await writeFile(join(root, "objects", "sha256", `${blockHash}.json`), JSON.stringify({id: "hero-card"}));
  await writeFile(join(root, "objects", "sha256", `${rejectedHash}.json`), JSON.stringify({id: "rejected-hero"}));
  return root;
}

test("migration is non-destructive and idempotent", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, {recursive: true, force: true}));

  const planned = await migrateDesignRegistry(root, "plan");
  assert.equal(planned.applied, false);
  assert.equal(planned.changes.length, 8);
  assert.equal(existsSync(join(root, "design-registry-v2.json")), false);

  const applied = await migrateDesignRegistry(root, "apply");
  assert.equal(applied.changes.length, 8);
  const checked = await migrateDesignRegistry(root, "check");
  assert.equal(checked.changes.length, 0);
  const repeated = await migrateDesignRegistry(root, "apply");
  assert.equal(repeated.changes.length, 0);

  const registry = JSON.parse(readFileSync(join(root, "design-registry-v2.json"), "utf8"));
  assert.equal(registry.schemaVersion, 2);
  assert.equal(registry.layoutHeads["course-home"].layoutId, "course-home");
  assert.equal(registry.layoutHeads["course-home"].routePattern, "/courses/:courseId");
  assert.deepEqual(registry.layoutHeads["course-home"].regions, ["hero"]);
  assert.deepEqual(registry.blockHeads["course-home/hero"], {layoutId: "course-home", blockId: "hero", layoutHash, head: blockHash});
  assert.equal(registry.objects.immutable, true);
  assert.equal(registry.objects.byHash[rejectedHash].path, `objects/sha256/${rejectedHash}.json`);
  assert.equal(registry.reviewHistory.blocks["course-home/hero"][0].acceptedHash, blockHash);
  assert.equal(existsSync(join(root, "layouts", "map", "current-heads.json")), true);
  assert.equal(existsSync(join(root, "blocks", "map", "current-heads.json")), true);
  assert.equal(JSON.parse(readFileSync(join(root, "layouts", "by-id", "course-home.json"), "utf8")).head, layoutHash);
  assert.equal(JSON.parse(readFileSync(join(root, "blocks", "by-id", "course-home", "hero.json"), "utf8")).head, blockHash);
  assert.equal(JSON.parse(readFileSync(join(root, "reviews", "layouts", "course-home.json"), "utf8"))[0].acceptedHash, layoutHash);
});

test("migration does not promote a block accepted under a stale layout", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, {recursive: true, force: true}));

  const staleLayoutHash = "d".repeat(64);
  const sessionPath = join(root, "decisions", "course-home.json");
  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  session.rounds[1].layoutHash = staleLayoutHash;
  await writeFile(sessionPath, JSON.stringify(session));
  await writeFile(join(root, "blocks", "map", "current-heads.json"), JSON.stringify({heads: {}}));
  await migrateDesignRegistry(root, "apply");

  const registry = JSON.parse(readFileSync(join(root, "design-registry-v2.json"), "utf8"));
  assert.equal(registry.blockHeads["course-home/hero"], undefined);
  assert.equal(registry.layoutHeads["course-home"].regions.hero, undefined);
  assert.equal(registry.reviewHistory.blocks["course-home/hero"][0].acceptedHash, blockHash);
});
