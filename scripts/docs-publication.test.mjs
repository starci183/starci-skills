import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {existsSync, readFileSync, readdirSync} from "node:fs";
import {basename, dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {test} from "node:test";

const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = join(trustRoot, "docs");
const contentRoot = join(docsRoot, "content");

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
