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
const workspaceRoot = join(source, ".workspaces");
const routeRoot = join(workspaceRoot, "local", "routes");
const registryRoot = join(workspaceRoot, "ports");
const configPath = join(registryRoot, "config.json");
const findings = [];
const rows = [];
const allocations = new Map();
const isIntegerPort = (port) => Number.isInteger(port) && port > 0 && port <= 65535;
const readJson = (path, label) => {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { findings.push(`${label}: invalid JSON — ${error.message}`); return null; }
};

if (!existsSync(registryRoot)) {
  console.error(`port-offset stale: absent ${registryRoot}`);
  process.exit(1);
}
if (!existsSync(configPath)) {
  console.error(`port-offset stale: absent ${configPath}`);
  process.exit(1);
}
const config = readJson(configPath, "registry config");
if (!config) process.exit(1);
if (config.version !== 1 || !Number.isInteger(config.slotStep) || config.slotStep < 1) {
  findings.push("registry config: expected version=1 and positive integer slotStep");
}

const allocationFiles = readdirSync(registryRoot, {withFileTypes: true})
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "config.json")
  .sort((left, right) => left.name.localeCompare(right.name));
for (const entry of allocationFiles) {
  const family = entry.name.slice(0, -".json".length);
  const allocation = readJson(join(registryRoot, entry.name), `${family} allocation`);
  if (!allocation) continue;
  if (allocation.version !== 1 || allocation.project !== family) {
    findings.push(`${family}: allocation must declare version=1 and project matching its filename`);
  }
  if (!Number.isInteger(allocation.offset) || allocation.offset < 0 || !allocation.applications || typeof allocation.applications !== "object" || Array.isArray(allocation.applications)) {
    findings.push(`${family}: invalid offset/applications allocation`);
    continue;
  }
  const occupied = new Map();
  for (const [application, slot] of Object.entries(allocation.applications)) {
    if (!Number.isInteger(slot) || slot < 0) findings.push(`${family}/${application}: slot must be a non-negative integer`);
    else if (occupied.has(slot)) findings.push(`${family}: applications ${occupied.get(slot)} and ${application} share slot ${slot}`);
    else occupied.set(slot, application);
  }
  allocations.set(family, allocation);
}

const routedFamilies = existsSync(routeRoot)
  ? readdirSync(routeRoot, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && (
      existsSync(join(routeRoot, entry.name, "be", "config.json"))
      || existsSync(join(routeRoot, entry.name, "fe", "config.json"))
    ))
    .map((entry) => entry.name)
    .sort()
  : [];
for (const family of routedFamilies) {
  if (excluded.has(family)) continue;
  const allocation = allocations.get(family);
  if (!allocation) {
    findings.push(`${family}: allocation record is absent at ${join(registryRoot, `${family}.json`)}`);
    continue;
  }
  const routePath = join(routeRoot, family, "be", "config.json");
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
  if (!metadata.portServices || typeof metadata.portServices !== "object" || Array.isArray(metadata.portServices)) {
    findings.push(`${family}: metadata.portServices is absent`);
    continue;
  }
  for (const [service, declaration] of Object.entries(metadata.portServices)) {
    const scope = declaration?.scope;
    let expected;
    let local = true;
    if (scope === "shared") expected = declaration.basePort + allocation.offset;
    else if (scope === "application") {
      const slot = allocation.applications?.[declaration.application];
      if (!Number.isInteger(slot)) findings.push(`${family}/${service}: application ${declaration.application ?? "<absent>"} has no slot`);
      else expected = declaration.basePort + allocation.offset + slot * config.slotStep;
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

console.log(`registry: ${registryRoot}`);
console.log(`slot step: ${config.slotStep}`);
console.log(`excluded: ${[...excluded].sort().join(", ") || "none"}`);
for (const [family, allocation] of [...allocations.entries()].filter(([family]) => !excluded.has(family)).sort(([left], [right]) => left.localeCompare(right))) {
  const slots = Object.entries(allocation.applications ?? {}).sort((a, b) => a[1] - b[1]).map(([name, slot]) => `${name}=+${slot * config.slotStep}`).join(", ") || "none";
  console.log(`${family}: offset +${allocation.offset}; applications ${slots}`);
  for (const row of rows.filter((item) => item.family === family).sort((a, b) => a.port - b.port || a.service.localeCompare(b.service))) console.log(`  ${row.service}=${row.port} (${row.scope})`);
}
if (findings.length) {
  console.error(`port-offset stale: ${findings.length} finding(s)`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log(`port-offset clean: ${rows.filter((row) => row.local).length} local listener(s), no collision`);
