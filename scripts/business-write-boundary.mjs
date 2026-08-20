import {existsSync, readFileSync} from "node:fs";
import {join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

export const effectiveStatus = (model) => model.schemaVersion === 2 ? model.authority?.status : "implemented";

export function boundaryFailures({featureId, entry, model, businessImpact, expectedStatus, role, baseline}) {
  const failures = [];
  if (!entry || !model) return [`business feature is absent: ${featureId}`];
  const status = effectiveStatus(model);
  if (entry.head !== model.__head) failures.push("registry head and immutable object disagree");
  if (entry.authorityStatus && entry.authorityStatus !== status) failures.push("registry authorityStatus and object disagree");
  if (businessImpact === "none") {
    if (status !== "implemented") failures.push(`businessImpact none requires implemented truth, got ${status}`);
  } else {
    if (status === "rejected") failures.push("rejected business intent never authorizes source writes");
    if (status !== (expectedStatus ?? "in-progress")) failures.push(`business-affecting write requires ${expectedStatus ?? "in-progress"}, got ${status}`);
    if (model.schemaVersion !== 2 || !model.authority?.baseHead || !model.authority?.previousHead) failures.push("business-affecting write requires schema-v2 baseHead and previousHead");
  }
  if (role) {
    const source = model.sources?.find((item) => item.role === role);
    if (!source) failures.push(`business feature does not bind routed role ${role}`);
    else if (baseline && source.head !== baseline) failures.push(`${role} baseline ${baseline} does not match business source head ${source.head}`);
  }
  return failures;
}

function flag(args, name) {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
}

export function runBoundary(args = process.argv.slice(2)) {
  const sourceRoot = resolve(flag(args, "source") ?? process.cwd());
  const project = flag(args, "project");
  const featureId = flag(args, "feature");
  const businessImpact = flag(args, "business-impact");
  const expectedStatus = flag(args, "expect");
  const role = flag(args, "role");
  const baseline = flag(args, "baseline");
  if (!project || !featureId || !["none", "affects"].includes(businessImpact)) {
    throw new Error("usage: business-write-boundary.mjs --source <Source> --project <project> --feature <featureId> --business-impact <none|affects> [--expect in-progress] [--role <role> --baseline <sha>]");
  }
  const businessRoot = join(sourceRoot, ".worktrees", project, "businesses");
  const registryPath = join(businessRoot, "business-registry-v1.json");
  if (!existsSync(registryPath)) throw new Error(`business registry is absent: ${registryPath}`);
  const registry = JSON.parse(readFileSync(registryPath, "utf8"));
  const entry = registry.featureHeads?.[featureId];
  let model;
  if (entry) {
    const objectRef = registry.objects?.byHash?.[entry.head]?.path;
    if (!objectRef) throw new Error(`immutable object reference is absent for ${featureId}@${entry.head}`);
    model = JSON.parse(readFileSync(join(businessRoot, objectRef), "utf8"));
    model.__head = entry.head;
  }
  const failures = boundaryFailures({featureId, entry, model, businessImpact, expectedStatus, role, baseline});
  if (failures.length) throw new Error(failures.join("\n"));
  return {featureId, head: entry.head, status: effectiveStatus(model), businessImpact};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = runBoundary();
    console.log(`business boundary ${result.featureId}@${result.head}: ${result.status} (${result.businessImpact})`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
