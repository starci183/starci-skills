import {existsSync, readFileSync, readdirSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(value("--source") ?? join(trustRoot, ".."));
const excluded = new Set(args.flatMap((arg, index) => arg === "--exclude" ? [args[index + 1]] : []).filter(Boolean));
const registryPath = join(source, ".workspace", "ports.json");
const findings = [];
const rows = [];
const isIntegerPort = (port) => Number.isInteger(port) && port > 0 && port <= 65535;
const readJson = (path, label) => {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { findings.push(`${label}: invalid JSON — ${error.message}`); return null; }
};

if (!existsSync(registryPath)) {
  console.error(`port-offset stale: absent ${registryPath}`);
  process.exit(1);
}
const registry = readJson(registryPath, "registry");
if (!registry) process.exit(1);
if (registry.version !== 1 || !Number.isInteger(registry.slotStep) || registry.slotStep < 1 || !registry.families || typeof registry.families !== "object") {
  findings.push("registry: expected version=1, positive integer slotStep and families object");
}

for (const [family, allocation] of Object.entries(registry.families ?? {})) {
  if (excluded.has(family)) continue;
  if (!Number.isInteger(allocation?.offset) || allocation.offset < 0 || !allocation.applications || typeof allocation.applications !== "object") {
    findings.push(`${family}: invalid offset/applications allocation`);
    continue;
  }
  const occupied = new Map();
  for (const [application, slot] of Object.entries(allocation.applications)) {
    if (!Number.isInteger(slot) || slot < 0) findings.push(`${family}/${application}: slot must be a non-negative integer`);
    else if (occupied.has(slot)) findings.push(`${family}: applications ${occupied.get(slot)} and ${application} share slot ${slot}`);
    else occupied.set(slot, application);
  }
}

const workspaceRoot = join(source, ".workspace");
for (const family of existsSync(workspaceRoot) ? readdirSync(workspaceRoot, {withFileTypes: true}).filter((entry) => entry.isDirectory()).map((entry) => entry.name) : []) {
  if (excluded.has(family) || !registry.families?.[family]) continue;
  const routePath = join(workspaceRoot, family, "be", "config.json");
  if (!existsSync(routePath)) continue;
  const route = readJson(routePath, `${family}/be route`);
  const checkout = route?.repository?.diskPath;
  const metadataPath = checkout ? join(checkout, "metadata.json") : null;
  if (!metadataPath || !existsSync(metadataPath)) {
    findings.push(`${family}: routed backend metadata.json is absent`);
    continue;
  }
  const metadata = readJson(metadataPath, `${family} metadata`);
  if (!metadata) continue;
  for (const retired of ["portOffset", "portOffsetNote", "basePorts", "fixedPorts", "fixedPortsNote", "twoApplicationsNote"]) {
    if (Object.hasOwn(metadata, retired)) findings.push(`${family}: product metadata still owns retired field ${retired}`);
  }
  if (!metadata.portServices || typeof metadata.portServices !== "object") {
    findings.push(`${family}: metadata.portServices is absent`);
    continue;
  }
  const allocation = registry.families[family];
  for (const [service, declaration] of Object.entries(metadata.portServices)) {
    const scope = declaration?.scope;
    let expected;
    let local = true;
    if (scope === "shared") expected = declaration.basePort + allocation.offset;
    else if (scope === "application") {
      const slot = allocation.applications?.[declaration.application];
      if (!Number.isInteger(slot)) findings.push(`${family}/${service}: application ${declaration.application ?? "<absent>"} has no slot`);
      else expected = declaration.basePort + allocation.offset + slot * registry.slotStep;
    } else if (scope === "tool" || scope === "external") {
      expected = declaration.port;
      local = scope === "tool";
      if (typeof declaration.reason !== "string" || declaration.reason.trim() === "") findings.push(`${family}/${service}: ${scope} requires a non-empty reason`);
    } else findings.push(`${family}/${service}: unknown scope ${scope ?? "<absent>"}`);
    if (!isIntegerPort(expected)) {
      findings.push(`${family}/${service}: resolved port is invalid`);
      continue;
    }
    const projected = metadata.ports?.[service];
    if (projected !== expected) findings.push(`${family}/${service}: ports projection ${String(projected)} != ${expected}`);
    rows.push({family, service, scope, port: expected, local});
  }
  for (const service of Object.keys(metadata.ports ?? {})) {
    if (!Object.hasOwn(metadata.portServices, service)) findings.push(`${family}/${service}: ports projection has no declaration`);
  }
}

const listeners = new Map();
for (const row of rows.filter((item) => item.local)) {
  const prior = listeners.get(row.port);
  if (prior) findings.push(`collision ${row.port}: ${prior.family}/${prior.service} and ${row.family}/${row.service}`);
  else listeners.set(row.port, row);
}

console.log(`registry: ${registryPath}`);
console.log(`slot step: ${registry.slotStep}`);
console.log(`excluded: ${[...excluded].sort().join(", ") || "none"}`);
for (const [family, allocation] of Object.entries(registry.families ?? {}).filter(([family]) => !excluded.has(family)).sort()) {
  const slots = Object.entries(allocation.applications ?? {}).sort((a, b) => a[1] - b[1]).map(([name, slot]) => `${name}=+${slot * registry.slotStep}`).join(", ") || "none";
  console.log(`${family}: offset +${allocation.offset}; applications ${slots}`);
  for (const row of rows.filter((item) => item.family === family).sort((a, b) => a.port - b.port || a.service.localeCompare(b.service))) console.log(`  ${row.service}=${row.port} (${row.scope})`);
}
if (findings.length) {
  console.error(`port-offset stale: ${findings.length} finding(s)`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log(`port-offset clean: ${rows.filter((row) => row.local).length} local listener(s), no collision`);
