#!/usr/bin/env node
// check-port-once.mjs — PORT_ONCE (R208, RT_PORT_RESTATED; part of `npm run check`).
//   node scripts/checks/check-port-once.mjs [--json]
//
// A port number is stated once, by its owner, and every other file references the owner — the literal never
// restates it. The runtime owns three ports today:
//   - the harness UI ports: modules/models/runtimes.yaml `statusApp.port` / `statusApp.devPort`, read only by
//     ui/ports.mjs (its exports are the names everything else imports);
//   - the local SonarQube host: scripts/gates/sonar-local.mjs `DEFAULT_HOST`.
// This check refuses:
//   - an OWNED port literal in a port position of any in-scope file that is not the port's owner;
//   - any OTHER 4-5 digit port literal in a port position of two or more source files: a port spelled twice has
//     no owner, so every spelling site is refused.
// Port positions are the places a literal is a port: the authority part of a URL (`scheme://host:NNNN`), a bare
// `host:NNNN` (localhost, an IPv4 address or a dns name), a `*port*`/`PORT` assignment (`port: NNNN`,
// `PORT=NNNN`, `SONAR_PORT=NNNN`) or a `listen(NNNN)` call. A bare number elsewhere (a timeout, a byte budget, a
// grammar offset) is not a port.
// Scope: tracked sources and docs under scripts/, engine/, ui/ (minus dist), ext/, docs/, knowledge/, modules/,
// examples/ and packages/ (minus the generated packages/*/runtime and specs). Out of scope by design: specs and
// tests/ fixtures, node_modules, the append-only contract history (modules/kernel/contract-changes) and
// changelogs, work records (.starciwork) and product stack declarations (.starcistacks, starcistacks-services) —
// a product declares the ports of the services it runs; it is the owner of those declarations.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitOutputOf } from '../lib/git.mjs';

export const CODE = 'RT_PORT_RESTATED';
export const RUNTIMES_FILE = 'modules/models/runtimes.yaml';
export const UI_PORTS_FILE = 'ui/ports.mjs';
export const SONAR_FILE = 'scripts/gates/sonar-local.mjs';
export const SELF_FILES = Object.freeze(['scripts/checks/check-port-once.mjs', 'tests/checks/check-port-once.spec.mjs']);

const SCOPE = /^(?:scripts|engine|ui|ext|docs|knowledge|modules|examples|packages)\//;
const TEXT_EXT = /\.(?:mjs|cjs|js|ts|tsx|yaml|yml|json|md|cmd|ps1|sh|toml)$/;
const CODE_EXT = /\.(?:mjs|cjs|js|ts|tsx)$/;
// The "no owner" tier pairs runtime source only: the runtime's own processes bind or dial those literals. A
// packages/** file may still trip the owned tier, but service-side code declaring the vendor-fixed container port of
// the product it runs is a product declaration, not a runtime port restated.
const RUNTIME_CODE = /^(?:scripts|engine|ui|ext)\//;
const OUT = /node_modules\/|\/dist\/|^packages\/[^/]+\/runtime\/|^tests\/|\.spec\.|\.starciwork\/|\.starcistacks\/|starcistacks-services\/|contract-changes\/|CHANGELOG/;
const inScope = (rel) => SCOPE.test(rel) && TEXT_EXT.test(rel) && !OUT.test(rel) && !SELF_FILES.includes(rel);

/** The port-position contexts, each capturing the port literal in group 1. */
const CONTEXTS = [
  /:\/\/[\w.-]+:(\d{4,5})\b/g,                                          // scheme://host:port
  /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[(?:[0-9a-f:]*)\]|[a-z][\w.-]*\.[\w.-]+):(\d{4,5})\b/gi, // host:port
  /\b[a-z_]*port[a-z_]*\s*[:=]\s*['"`]?(\d{4,5})\b/gi,                  // port: NNNN / port = NNNN / containerPort
  /\b[A-Z][A-Z0-9_]*PORT\s*[:=]\s*['"`]?(\d{4,5})\b/g,                  // SOME_PORT = NNNN
  /\.listen\(\s*(\d{4,5})\b/g,                                        // .listen(NNNN)
];
const DECLARATION = /\bexport\s+const\s+[A-Za-z_$][\w$]*\s*=\s*['"`]?(\d{4,5})\b|\b(?:port|devPort|appPort)\s*:\s*(\d{4,5})\b/;

/** The port literals a text puts in a port position, as a Set of digit strings. */
export function portLiteralsOf(text) {
  const found = new Set();
  for (const re of CONTEXTS) { re.lastIndex = 0; for (const m of text.matchAll(re)) found.add(m[1]); }
  return found;
}

/** The owned ports of the runtime, as {port -> owner rel}. Derived from the owner files, never restated here. */
export function ownedPorts(root = skillRoot) {
  const owned = new Map();
  const runtimes = parseYaml(fs.readFileSync(path.join(root, RUNTIMES_FILE), 'utf8'));
  for (const key of ['port', 'devPort']) {
    const port = runtimes?.statusApp?.[key];
    if (Number.isInteger(port) && port >= 1000 && port <= 65535) owned.set(String(port), `${RUNTIMES_FILE} statusApp.${key} (read it through ${UI_PORTS_FILE})`);
  }
  const sonar = fs.readFileSync(path.join(root, SONAR_FILE), 'utf8');
  const host = /DEFAULT_HOST\s*=\s*'([^']+)'/.exec(sonar)?.[1];
  const port = /:(\d{4,5})/.exec(host ?? '')?.[1];
  if (port) owned.set(port, `${SONAR_FILE} DEFAULT_HOST`);
  return owned;
}

/** The owner files of an owned port: the file the literal is declared in and the one reader. */
const ownerFilesOf = (owner) => (owner.startsWith(RUNTIMES_FILE) ? [RUNTIMES_FILE, UI_PORTS_FILE] : [SONAR_FILE]);

/**
 * The PORT_ONCE findings over {rel: text}: [{code, path, message}].
 * `files` is {repoRelativePath: fileText}; only in-scope entries are read.
 */
export function portOnceFindings(files, { owned = null } = {}) {
  const literals = new Map(); // port -> Set<rel>
  for (const [rel, text] of Object.entries(files)) {
    if (!inScope(rel)) continue;
    for (const port of portLiteralsOf(text)) (literals.get(port) ?? literals.set(port, new Set()).get(port)).add(rel);
  }
  const findings = [];
  const codeFiles = new Set(Object.keys(files).filter((rel) => inScope(rel) && CODE_EXT.test(rel) && RUNTIME_CODE.test(rel)));
  for (const [port, rels] of [...literals].sort(([a], [b]) => a.localeCompare(b))) {
    const owner = owned?.get(port);
    if (owner) {
      const exempt = new Set(ownerFilesOf(owner));
      for (const rel of [...rels].sort()) {
        if (!exempt.has(rel)) findings.push({ code: CODE, path: rel, message: `${rel} restates port ${port} — read the owner (${owner}) instead of spelling the literal` });
      }
      continue;
    }
    const code = [...rels].filter((rel) => codeFiles.has(rel)).sort();
    if (code.length < 2) continue;
    // A file that declares the literal as an exported constant is its de-facto owner and is not itself a finding.
    const declarers = code.filter((rel) => DECLARATION.test(files[rel]));
    const guilty = declarers.length ? code.filter((rel) => !declarers.includes(rel)) : code;
    for (const rel of guilty) {
      findings.push({ code: CODE, path: rel, message: `${rel} spells port ${port}${declarers.length ? ` that ${declarers.join(', ')} owns — reference the constant` : ` in ${code.join(', ')} — declare one owning constant and reference it`}` });
    }
  }
  return findings;
}

/** Run PORT_ONCE on the runtime at `root`. */
export function checkPortOnce(root = skillRoot) {
  const tracked = gitOutputOf(lsFiles(['-z'], { dir: root, maxBuffer: 64 * 1024 * 1024 }), 'git ls-files -z').split('\0').filter(Boolean);
  const files = {};
  for (const rel of tracked) {
    if (!inScope(rel)) continue;
    try { files[rel] = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { /* a lane may hold an uncommitted deletion */ }
  }
  return portOnceFindings(files, { owned: ownedPorts(root) });
}

if (isMain(import.meta.url)) {
  const findings = checkPortOnce();
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  else {
    for (const f of findings) console.error(`${f.code} ${f.message}`);
    if (!findings.length) console.log(`OK: every port literal of the runtime is spelled by its owner only.`);
  }
  process.exit(findings.length ? 1 : 0);
}
