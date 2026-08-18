#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {copyFileSync, existsSync, readFileSync, renameSync, writeFileSync} from "node:fs";
import {homedir} from "node:os";
import {delimiter, dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const args = process.argv.slice(2);
const valueFor = (flag) => {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : null;
};
const fail = (message) => {
  console.error(`mcp-client-setup: ${message}`);
  process.exit(1);
};
const name = valueFor("--name") ?? "starci-source-context";
const url = valueFor("--url");
const plan = args.includes("--plan");
if (!url) fail("--url is required");
if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) fail("--name must be lowercase letters, digits and hyphens");
let parsed;
try { parsed = new URL(url); } catch { fail("--url must be an absolute URL"); }
if (parsed.protocol !== "https:" || parsed.pathname !== "/mcp/" || parsed.search || parsed.hash || parsed.username || parsed.password) {
  fail("--url must be an HTTPS endpoint ending at /mcp/ without credentials, query or fragment");
}

const trustRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const smokeScript = join(trustRoot, "scripts", "qdrant-mcp-smoke.mjs");
const codexConfig = join(homedir(), ".codex", "config.toml");

const resolveCommand = (command) => {
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const directory of (process.env.PATH ?? "").split(delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = join(directory, `${command}${extension}`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
};
const spawnPortable = (command, commandArgs, options = {}) => {
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(command)) {
    return spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command, ...commandArgs], options);
  }
  return spawnSync(command, commandArgs, options);
};
const run = (command, commandArgs, options = {}) => {
  const result = spawnPortable(command, commandArgs, {
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const reason = String(result.stderr ?? "").trim().split(/\r?\n/)[0];
    fail(`${options.label ?? command} failed${reason ? `: ${reason}` : ""}`);
  }
  return result;
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mergeCodex = (source) => {
  const block = `[mcp_servers.${name}]\nurl = ${JSON.stringify(url)}\nrequired = true\nenabled_tools = ["qdrant-find"]\n`;
  const header = new RegExp(`^\\[mcp_servers\\.${escapeRegex(name)}\\]\\s*$`, "m");
  const match = header.exec(source);
  if (!match) return `${source.trimEnd()}\n\n${block}`;
  const afterHeader = match.index + match[0].length;
  const next = /^\[/m.exec(source.slice(afterHeader));
  const end = next ? afterHeader + next.index : source.length;
  return `${source.slice(0, match.index)}${block}\n${source.slice(end).replace(/^\s+/, "")}`;
};

console.log(`endpoint: ${url}`);
console.log(`Codex/OpenAI: ${codexConfig}`);
console.log(`Claude Code: user scope through claude mcp`);
console.log(`tools: qdrant-find only`);
if (plan) process.exit(0);

run(process.execPath, [smokeScript, url], {label: "public MCP smoke"});
if (!existsSync(codexConfig)) fail(`Codex config is absent: ${codexConfig}`);
const currentCodex = readFileSync(codexConfig, "utf8");
const nextCodex = mergeCodex(currentCodex);
if (nextCodex !== currentCodex) {
  const backup = `${codexConfig}.starci-backup`;
  const temporary = `${codexConfig}.starci-tmp`;
  copyFileSync(codexConfig, backup);
  writeFileSync(temporary, nextCodex, "utf8");
  const python = resolveCommand("python") ?? resolveCommand("python3");
  if (!python) fail("Python is required to validate Codex TOML before replacement");
  run(python, ["-c", "import pathlib,tomllib,sys; tomllib.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))", temporary], {label: "Codex TOML validation"});
  renameSync(temporary, codexConfig);
  console.log("Codex/OpenAI: updated");
} else {
  console.log("Codex/OpenAI: unchanged");
}

const claude = resolveCommand("claude");
if (!claude) fail("Claude Code CLI is absent from PATH");
const existing = spawnPortable(claude, ["mcp", "get", name], {encoding: "utf8", windowsHide: true});
if (existing.status === 0) {
  const details = String(existing.stdout ?? "");
  if (!details.includes("Scope: User")) fail(`${name} exists outside user scope; remove the higher-precedence entry deliberately`);
  if (!details.includes(`URL: ${url}`)) run(claude, ["mcp", "remove", name, "-s", "user"], {label: "Claude MCP remove"});
}
if (existing.status !== 0 || !String(existing.stdout ?? "").includes(`URL: ${url}`)) {
  run(claude, ["mcp", "add", "--transport", "http", "--scope", "user", name, url], {label: "Claude MCP add"});
}
const verified = run(claude, ["mcp", "get", name], {capture: true, label: "Claude MCP verification"});
if (!String(verified.stdout).includes("Connected")) fail("Claude Code did not report the MCP server connected");
console.log("Claude Code: connected");
