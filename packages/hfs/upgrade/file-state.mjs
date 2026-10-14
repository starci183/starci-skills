// Authored-file preservation, snapshots and rollback for an additive edition upgrade.
import fs from "node:fs";
import path from "node:path";
import { dockerfilePath } from "../runtime/scripts/hfs/rules/docker.mjs";

/** App-owned additions are preserved; only declared regular optional front-end images receive that treatment. */
export function authoredAdditionReasons(declaration, source) {
  const reasons = new Map([[
    ".starcistacks/application-stacks.yaml",
    "The app already declares its stacks; the declaration stays as the app wrote it.",
  ]]);
  for (const app of declaration.sides.fe.apps) {
    const file = dockerfilePath("fe", app.name);
    if (source.hasImage(file)) reasons.set(file,
      "The lite app already authors this optional front-end image; its Dockerfile stays as the app wrote it.");
  }
  return reasons;
}

export function remember(snapshot, target) {
  if (snapshot.has(target)) return;
  snapshot.set(
    target,
    fs.existsSync(target) && fs.statSync(target).isFile()
      ? fs.readFileSync(target)
      : null,
  );
}

export function ensureParent(root, target, directories) {
  const missing = [];
  for (
    let at = path.dirname(target);
    at.startsWith(root) && at !== root && !fs.existsSync(at);
    at = path.dirname(at)
  )
    missing.push(at);
  for (const directory of missing.reverse()) {
    fs.mkdirSync(directory);
    directories.push(directory);
  }
}

export function writeFile(root, file, content, snapshot, directories) {
  const target = path.join(root, ...file.split("/"));
  remember(snapshot, target);
  ensureParent(root, target, directories);
  fs.writeFileSync(target, content);
}

export function restore(snapshot, directories) {
  for (const [target, content] of [...snapshot.entries()].reverse()) {
    if (content === null) {
      if (fs.existsSync(target) && fs.statSync(target).isFile())
        fs.unlinkSync(target);
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
  }
  for (const directory of [...directories].reverse()) {
    try {
      fs.rmdirSync(directory);
    } catch {
      /* It is non-empty or already absent: preserve it. */
    }
  }
}
