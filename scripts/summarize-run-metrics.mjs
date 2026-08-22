import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function summarizeRunMetrics(receipts) {
  const groups = new Map();
  for (const receipt of receipts) {
    if (receipt?.status !== "complete" || !receipt?.metrics || !receipt?.impact?.level) continue;
    const group = groups.get(receipt.impact.level) ?? [];
    group.push(receipt.metrics);
    groups.set(receipt.impact.level, group);
  }
  return Object.fromEntries([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([level, rows]) => {
    const wall = rows.map((row) => row.wallTimeMs);
    const measuredTokens = rows.filter((row) => row.tokenUsage?.status === "measured").map((row) => row.tokenUsage.total);
    const sum = (field) => rows.reduce((total, row) => total + row[field], 0);
    return [level, {
      runs: rows.length,
      wallTimeMs: {average: Math.round(wall.reduce((a, b) => a + b, 0) / wall.length), median: median(wall)},
      tokenUsage: {measuredRuns: measuredTokens.length, average: measuredTokens.length ? Math.round(measuredTokens.reduce((a, b) => a + b, 0) / measuredTokens.length) : null},
      approvalsChangedDecision: sum("approvalsChangedDecision"),
      uniqueDefectsCaught: sum("uniqueDefectsCaught"),
      falsePositiveGates: sum("falsePositiveGates"),
      coordinatorReworkCount: sum("coordinatorReworkCount"),
      artifactsCreated: sum("artifactsCreated")
    }];
  }));
}

function readReceipts(targets) {
  const files = targets.flatMap((target) => {
    const absolute = path.resolve(target);
    const stat = fs.statSync(absolute);
    return stat.isDirectory()
      ? fs.readdirSync(absolute).filter((name) => name.endsWith(".json")).map((name) => path.join(absolute, name))
      : [absolute];
  });
  return files.map((file) => JSON.parse(fs.readFileSync(file, "utf8")));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.length < 3) throw new Error("usage: node scripts/summarize-run-metrics.mjs <receipt.json|directory> [...]");
  process.stdout.write(`${JSON.stringify(summarizeRunMetrics(readReceipts(process.argv.slice(2))), null, 2)}\n`);
}
