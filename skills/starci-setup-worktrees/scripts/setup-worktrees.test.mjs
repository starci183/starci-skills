import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "setup-worktrees.mjs")

function git(repository, args) {
  return execFileSync("git", ["-C", repository, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim()
}

async function makeSource(temporaryRoot) {
  const source = path.join(temporaryRoot, "source")
  await mkdir(path.join(source, ".claude"), { recursive: true })
  await mkdir(path.join(source, ".workflows"), { recursive: true })
  await writeFile(path.join(source, "AGENTS.md"), "# test\n", "utf8")
  await writeFile(path.join(source, ".gitignore"), "/.worktrees/\n", "utf8")
  git(source, ["init"])
  git(source, ["config", "user.name", "StarCi Test"])
  git(source, ["config", "user.email", "test@starci.local"])
  git(source, ["add", "AGENTS.md", ".gitignore"])
  git(source, ["commit", "-m", "test source"])
  return source
}

function run(source, ...args) {
  return JSON.parse(execFileSync(process.execPath, [script, "--source", source, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }))
}

test("installs and verifies one project-scoped registry, sessions, and cache root", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "starci-worktrees-install-"))
  try {
    const source = await makeSource(temporaryRoot)
    const installed = run(source, "--project", "academy")
    const checked = run(source, "--project", "academy", "--check")

    assert.equal(installed.mode, "install")
    assert.equal(checked.ok, true)
    assert.equal(checked.branch, "codex/fe-design-registry/academy")
    assert.match(checked.root, /[\\/]\.worktrees[\\/]academy$/)
    assert.match(checked.registry, /[\\/]academy[\\/]registries$/)
    assert.match(checked.sessions, /[\\/]academy[\\/]sessions$/)
    assert.match(checked.cache, /[\\/]academy[\\/]cache$/)
    assert.equal(await readFile(path.join(checked.registry, "registry.json"), "utf8").then(JSON.parse).then((value) => value.project), "academy")
    assert.equal(git(checked.registry, ["status", "--porcelain"]), "")
    assert.match(git(source, ["worktree", "list", "--porcelain"]), /locked StarCi FE design registry: academy/)
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})

test("requires an explicit project", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "starci-worktrees-project-"))
  try {
    const source = await makeSource(temporaryRoot)
    const result = spawnSync(process.execPath, [script, "--source", source], { encoding: "utf8" })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Provide --project/)
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})

test("migrates the verified legacy registry behind the project segment", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "starci-worktrees-migrate-"))
  try {
    const source = await makeSource(temporaryRoot)
    const legacy = path.join(source, ".worktrees", "registries")
    git(source, ["worktree", "add", "--orphan", "-b", "codex/fe-design-registry", legacy])
    await writeFile(path.join(legacy, "legacy.txt"), "preserve me\n", "utf8")
    git(legacy, ["add", "legacy.txt"])
    git(legacy, ["commit", "-m", "legacy registry"])
    const legacyHead = git(legacy, ["rev-parse", "HEAD"])
    git(source, ["worktree", "lock", "--reason", "legacy test", legacy])

    const migrated = run(source, "--project", "academy", "--migrate-legacy")

    assert.equal(migrated.mode, "migrate-legacy")
    assert.equal(migrated.head, legacyHead)
    assert.equal(git(migrated.registry, ["branch", "--show-current"]), "codex/fe-design-registry/academy")
    assert.equal(await readFile(path.join(migrated.registry, "legacy.txt"), "utf8"), "preserve me\n")
    assert.equal(git(source, ["worktree", "list", "--porcelain"]).includes(`worktree ${legacy}`), false)
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})
