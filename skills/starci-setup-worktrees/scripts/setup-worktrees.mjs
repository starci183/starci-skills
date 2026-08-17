#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { access, mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const PROJECT = /^[a-z0-9][a-z0-9._-]*$/

const fail = (message) => { throw new Error(message) }
const exists = async (candidate) => { try { await access(candidate); return true } catch { return false } }

function parseArgs(argv) {
  const result = { check: false, migrateLegacy: false }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === "--check") { result.check = true; continue }
    if (token === "--migrate-legacy") { result.migrateLegacy = true; continue }
    if (!["--source", "--project", "--registry-branch"].includes(token)) fail(`Unknown argument: ${token}`)
    const value = argv[++index]
    if (!value || value.startsWith("--")) fail(`Missing value for ${token}`)
    result[token.slice(2).replace("registry-branch", "registryBranch")] = value
  }
  return result
}

function git(repository, args, required = true) {
  try {
    return execFileSync("git", ["-C", repository, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
  } catch (error) {
    if (required) fail(error.stderr?.toString().trim() || `git ${args.join(" ")} failed in ${repository}`)
    return null
  }
}

async function findSource(start) {
  let cursor = path.resolve(start)
  while (true) {
    const markers = ["AGENTS.md", ".claude", ".workflows"]
    if ((await Promise.all(markers.map((entry) => exists(path.join(cursor, entry))))).every(Boolean)) return realpath(cursor)
    const parent = path.dirname(cursor)
    if (parent === cursor) fail(`Cannot locate Source from ${start}`)
    cursor = parent
  }
}

const normalized = (value) => path.normalize(path.resolve(value)).toLowerCase()

function commonDirectory(repository) {
  const raw = git(repository, ["rev-parse", "--git-common-dir"])
  return normalized(path.isAbsolute(raw) ? raw : path.join(repository, raw))
}

function worktreeRecord(source, target) {
  const records = git(source, ["worktree", "list", "--porcelain"]).split(/\r?\n\r?\n/)
  const wanted = normalized(target)
  return records.map((record) => {
    const lines = record.split(/\r?\n/)
    return {
      path: lines.find((line) => line.startsWith("worktree "))?.slice(9),
      branch: lines.find((line) => line.startsWith("branch "))?.slice(7).replace("refs/heads/", ""),
      locked: lines.some((line) => line === "locked" || line.startsWith("locked ")),
    }
  }).find((record) => record.path && normalized(record.path) === wanted)
}

async function assertIgnored(source, candidate) {
  if (git(source, ["check-ignore", "--quiet", candidate], false) === null) {
    fail(`${candidate} must be ignored by Source before setup.`)
  }
}

async function seedRegistry(registry, project) {
  const files = new Map([
    ["registry.json", `${JSON.stringify({ schemaVersion: 1, project, hashAlgorithm: "sha256", canonicalization: "RFC8785-JCS", head: "0".repeat(64), lastSequence: 0 }, null, 2)}\n`],
    ["layouts/map/surface-graph.json", '{"nodes":[],"edges":[],"cycles":[]}\n'],
    ["layouts/map/current-heads.json", '{"heads":{}}\n'],
    ["blocks/map/by-surface.json", '{"surfaces":{}}\n'],
    ["blocks/map/current-heads.json", '{"heads":{}}\n'],
  ])
  for (const relative of [
    "objects/sha256/.gitkeep", "layouts/queued/.gitkeep", "layouts/rejected/.gitkeep",
    "layouts/approved/.gitkeep", "blocks/queued/.gitkeep", "blocks/rejected/.gitkeep",
    "blocks/approved/.gitkeep", "decisions/.gitkeep", "rejections/.gitkeep",
  ]) files.set(relative, "refs or immutable objects only\n")
  for (const [relative, bytes] of files) {
    const target = path.join(registry, relative)
    await mkdir(path.dirname(target), { recursive: true })
    if (!(await exists(target))) await writeFile(target, bytes, "utf8")
  }
}

async function verify(source, project, branch) {
  const root = path.join(source, ".worktrees", project)
  const registry = path.join(root, "registries")
  const sessions = path.join(root, "sessions")
  const cache = path.join(root, "cache")
  const forbidden = path.join(source, ".claude", "worktrees", project)
  if (await exists(forbidden)) fail(`Project worktree state is forbidden under Trust: ${forbidden}`)
  for (const candidate of [root, registry, sessions, cache]) if (!(await exists(candidate))) fail(`Missing project worktree path: ${candidate}`)
  await assertIgnored(source, path.join(sessions, ".privacy-probe"))
  await assertIgnored(source, path.join(cache, ".privacy-probe"))
  if (normalized(git(registry, ["rev-parse", "--show-toplevel"])) !== normalized(registry)) fail(`${registry} is not a linked worktree root.`)
  if (commonDirectory(registry) !== commonDirectory(source)) fail(`${registry} is owned by another Git common directory.`)
  const record = worktreeRecord(source, registry)
  if (!record) fail(`${registry} is absent from Source worktree list.`)
  if (record.branch !== branch) fail(`${registry} uses ${record.branch}, expected ${branch}.`)
  if (!record.locked) fail(`${registry} must be locked.`)
  if (git(registry, ["status", "--porcelain"])) fail(`${registry} must be clean.`)
  return { ok: true, source, project, root, registry, sessions, cache, branch, head: git(registry, ["rev-parse", "HEAD"]), locked: true }
}

async function install(source, project, branch, migrateLegacy) {
  const root = path.join(source, ".worktrees", project)
  const registry = path.join(root, "registries")
  const legacy = path.join(source, ".worktrees", "registries")
  await assertIgnored(source, path.join(root, "sessions", ".privacy-probe"))
  await mkdir(root, { recursive: true })

  if (migrateLegacy && await exists(legacy)) {
    if (await exists(registry)) fail(`Cannot migrate: target already exists: ${registry}`)
    if (normalized(git(legacy, ["rev-parse", "--show-toplevel"])) !== normalized(legacy)) fail(`Legacy path is not a worktree root: ${legacy}`)
    if (commonDirectory(legacy) !== commonDirectory(source)) fail(`Legacy registry belongs to another Git repository.`)
    if (git(legacy, ["status", "--porcelain"])) fail(`Legacy registry must be clean before migration.`)
    const current = git(legacy, ["branch", "--show-current"])
    if (![branch, "codex/fe-design-registry"].includes(current)) fail(`Legacy registry branch ${current} cannot migrate to ${branch}.`)
    git(source, ["worktree", "unlock", legacy], false)
    git(source, ["worktree", "move", legacy, registry])
    if (current !== branch) git(registry, ["branch", "-m", branch])
  } else if (!(await exists(registry))) {
    const local = git(source, ["show-ref", "--verify", `refs/heads/${branch}`], false) !== null
    const remote = git(source, ["show-ref", "--verify", `refs/remotes/origin/${branch}`], false) !== null
    if (local) git(source, ["worktree", "add", registry, branch])
    else if (remote) git(source, ["worktree", "add", "-b", branch, registry, `origin/${branch}`])
    else git(source, ["worktree", "add", "--orphan", "-b", branch, registry])
    await seedRegistry(registry, project)
    if (!git(registry, ["rev-parse", "--verify", "HEAD"], false)) {
      git(registry, ["add", "--all"])
      git(registry, ["commit", "-m", `chore(fe-design): initialize ${project} registry`])
    }
  }
  await mkdir(path.join(root, "sessions"), { recursive: true })
  await mkdir(path.join(root, "cache"), { recursive: true })
  git(source, ["worktree", "lock", "--reason", `StarCi FE design registry: ${project}`, registry], false)
  return verify(source, project, branch)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.project || !PROJECT.test(args.project)) fail("Provide --project using lowercase letters, digits, dots, underscores, or hyphens.")
  const source = await findSource(args.source ?? process.cwd())
  const branch = args.registryBranch ?? `codex/fe-design-registry/${args.project}`
  const result = args.check ? await verify(source, args.project, branch) : await install(source, args.project, branch, args.migrateLegacy)
  process.stdout.write(`${JSON.stringify({ ...result, mode: args.check ? "check" : args.migrateLegacy ? "migrate-legacy" : "install" }, null, 2)}\n`)
}

main().catch((error) => { process.stderr.write(`setup-worktrees: ${error.message}\n`); process.exitCode = 1 })
