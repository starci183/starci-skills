import {relative} from "node:path";

const normalized = (path) => path.replaceAll("\\", "/");

export function candidateModelPath(businessRoot, inputPath) {
  if (!inputPath) return undefined;
  const candidate = normalized(relative(businessRoot, inputPath));
  if (candidate.startsWith("../") || candidate === "..") return undefined;
  return /^features\/[^/]+\/model\.json$/.test(candidate) ? candidate : undefined;
}

export function isCandidateOnlyDirtyStatus(status, businessRoot, inputPath) {
  const candidate = candidateModelPath(businessRoot, inputPath);
  if (!candidate) return false;
  const rows = status.split(/\r?\n/).filter(Boolean);
  if (rows.length !== 1) return false;
  const code = rows[0].slice(0, 2);
  if (code !== " M" && code !== "??") return false;
  const path = normalized(rows[0].slice(3).split(" -> ").at(-1));
  return path === candidate;
}
