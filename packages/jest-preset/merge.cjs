"use strict"

// merge.cjs - the coverage of a sharded unit run merged into the one report the coverage proof, Codecov and Sonar read (`starci app coverage merge`).
// Each shard runs with STARCI_COVERAGE_SHARD=1 (starciJestConfig): it measures ONLY the files its tests load (no collectCoverageFrom all-files
// instrumentation, whose fallback transform gives an unloaded file another function and branch set) and writes istanbul JSON (coverage-final.json).
// The maps of one file come from the same v8 transform in every shard; istanbul-lib-coverage merges them by source location (FileCoverage.merge), and the
// merged map is written as lcov through this preset's own lcov reporter (lcov.cjs: stable function ids, the generated metadata source left out), exactly
// as an unsharded run writes it. A measured file no shard loaded is absent from the merged map: the coverage proof refuses it (no lcov record, 0%).
const fs = require("node:fs")
const path = require("node:path")
const { createRequire } = require("node:module")

const fromJest = createRequire(require.resolve("jest"))
const fromCore = createRequire(fromJest.resolve("@jest/core"))
const fromReporters = createRequire(fromCore.resolve("@jest/reporters"))
const libCoverage = fromReporters("istanbul-lib-coverage")
const libReport = fromReporters("istanbul-lib-report")
const StarciLcovReport = require("./lcov.cjs")

/** Every coverage-final.json at or below `target` (a file or a directory), sorted. */
function coverageFilesUnder(target) {
  if (!fs.statSync(target).isDirectory()) return [target]
  return fs.readdirSync(target, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name === "coverage-final.json")
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name))
    .sort()
}

/**
 * Merge the shard reports `inputs` (coverage-final.json files or directories holding them) and write `<outDir>/lcov.info` and `<outDir>/coverage-final.json`.
 * Returns { reports, files }; throws when no report is found (an empty merge would read as "nothing to measure").
 */
function mergeCoverage({ inputs, outDir }) {
  const reports = inputs.flatMap((input) => coverageFilesUnder(input))
  if (!reports.length) throw new Error(`no coverage-final.json under ${inputs.join(", ")}: the unit shards wrote none (run them with STARCI_COVERAGE_SHARD=1)`)
  const map = libCoverage.createCoverageMap({})
  for (const report of reports) map.merge(JSON.parse(fs.readFileSync(report, "utf8")))
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, "coverage-final.json"), JSON.stringify(map.toJSON()))
  const context = libReport.createContext({ dir: outDir, coverageMap: map })
  new StarciLcovReport({ file: "lcov.info", projectRoot: process.cwd() }).execute(context)
  return { reports: reports.length, files: map.files().length }
}

module.exports = { mergeCoverage, coverageFilesUnder }
