#!/usr/bin/env node

import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

const inside = (outer, inner) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

export function validateDesignBaseline(data) {
  const failures = [];
  if (data?.schemaVersion !== 1) failures.push("schemaVersion must be 1");
  const routes = data?.scope?.routes ?? [];
  if (data?.scope?.kind === "page" && routes.length !== 1) failures.push("page scope must name exactly one route");
  if (data?.scope?.kind === "flow" && routes.length < 2) failures.push("flow scope must name at least two routes");
  const references = data?.references ?? [];
  const referenceIds = new Set(references.map((item) => item.id));
  if (!references.length) failures.push("at least one reference is required");
  for (const reference of references) if (!routes.includes(reference.route)) failures.push(`reference ${reference.id} is outside scope routes`);

  const owner = data?.owner;
  const children = owner?.directChildren ?? [];
  const bounds = owner?.childBounds ?? {};
  if (children.length < 2) failures.push("owner must name at least two direct children");
  for (const child of children) {
    if (!bounds[child]) failures.push(`direct child ${child} has no measured bounds`);
    else if (!inside(owner.annotation, bounds[child])) failures.push(`direct child ${child} lies outside the highlighted owner annotation`);
  }
  for (const child of Object.keys(bounds)) if (!children.includes(child)) failures.push(`highlighted child ${child} is absent from owner.directChildren`);

  const preserve = new Set(data?.preserve ?? []);
  const deltas = new Set(data?.allowedDeltas ?? []);
  if (!deltas.size) failures.push("allowedDeltas must name the exact target");
  for (const id of deltas) if (preserve.has(id)) failures.push(`node ${id} cannot be both preserved and changed`);
  if (!data?.invariant?.statement) failures.push("Invariant lock is missing");

  const proofs = data?.proof ?? [];
  for (const referenceId of referenceIds) {
    const matching = proofs.filter((proof) => proof.referenceId === referenceId && proof.fullViewport === true && proof.targetRegion === true);
    if (matching.length !== 1) failures.push(`reference ${referenceId} requires exactly one full-viewport plus target-region proof`);
  }
  for (const proof of proofs) if (!referenceIds.has(proof.referenceId)) failures.push(`proof references unknown baseline ${proof.referenceId}`);
  return {ok: failures.length === 0, failures};
}

const parseArgs = (argv) => Object.fromEntries(argv.slice(2).flatMap((value, index, values) => value.startsWith("--") ? [[value.slice(2), values[index + 1]]] : []));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv);
  if (!args.input) throw new Error("Usage: --input <baseline.json>");
  const verdict = validateDesignBaseline(JSON.parse(readFileSync(resolve(args.input), "utf8")));
  if (!verdict.ok) {
    console.error(verdict.failures.join("\n"));
    process.exitCode = 1;
  } else console.log("design baseline holds");
}
