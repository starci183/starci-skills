// The `starci app check --edition full` view of a lite app. The app stays byte-for-byte untouched: its declaration is cloned without
// `edition`, then passed to the existing slot resolver, rule filter and architecture engine as an injected declaration.
import fs from "node:fs";
import path from "node:path";
import { checkArchitecture } from "../runtime/scripts/hfs/architecture/index.mjs";
import {
  checkDatabase,
  checkRepo,
  trackedFiles,
} from "../runtime/scripts/hfs/check.mjs";
import { loadSlotManifest, openHfs } from "../runtime/scripts/hfs/slots.mjs";
import { formatFindings } from "../sync/format.mjs";
import {
  checkTargets,
  loadHfs,
  renderTargets,
} from "../sync/index.mjs";
import {
  UPGRADE_PRESETS,
  UpgradeError,
  fullEditionDeclaration,
} from "./index.mjs";

const ONE_LINER = new Set(["eslint.config.mjs", "stylelint.config.mjs"]);

function fullManagedFindings(repoRoot, targets) {
  const findings = [];
  for (const result of checkTargets(repoRoot, targets)) {
    if (
      result.status === "ok" ||
      !fs.existsSync(path.join(repoRoot, ...result.path.split("/")))
    )
      continue;
    const target = targets.find((candidate) => candidate.path === result.path);
    const code =
      target.mode === "block"
        ? "HFS_GITIGNORE_BLOCK_DRIFT"
        : ONE_LINER.has(path.posix.basename(result.path))
          ? "HFS_RULE_OFF_WITHOUT_REPLACEMENT"
          : result.path === "sonar-project.properties"
            ? "HFS_SONAR_CONFIG"
            : "HFS_MANAGED_FILE_DRIFT";
    findings.push({
      code,
      level: "error",
      path: result.path,
      message: `${result.path} is not its full-edition render (expected sha256 ${result.expectedHash.slice(0, 12)}${result.actualHash ? `, found ${result.actualHash.slice(0, 12)}` : ""}); run starci app upgrade --edition full`,
    });
  }
  return findings;
}

const machineFinding = (side, item) => ({
  code: item.ruleId,
  level: "error",
  ...(item.path ? { path: `${side}/${item.path}` } : {}),
  ...(item.line ? { line: item.line, column: item.column } : {}),
  source: "machine",
  message: `${item.path ? `${side}/${item.path}${item.line ? `:${item.line}` : ""}: ` : ""}${item.message}`,
});

/**
 * Runs the normal check when the requested edition matches hfs.json. The sole override is lite -> full; every other mismatch is
 * a usage refusal. `normal` is the CLI's ordinary check closure, which keeps the existing full and lite paths unchanged.
 */
export async function checkEdition({
  repoRoot,
  edition,
  normal,
  presets,
  prettier,
  manifest = loadSlotManifest(),
}) {
  if (edition === undefined) return normal();
  if (!["full", "lite"].includes(edition))
    throw new UpgradeError(
      "HFS_EDITION_INVALID",
      `--edition is ${JSON.stringify(edition)}; expected full or lite`,
    );
  const declaration = loadHfs(repoRoot, manifest);
  const actual = declaration.edition ?? "full";
  if (edition === actual) return normal();
  if (!(actual === "lite" && edition === "full"))
    throw new UpgradeError(
      "HFS_EDITION_INVALID",
      `hfs.json edition is ${actual}; check may override only an edition lite app to full`,
    );

  const full = fullEditionDeclaration(declaration, manifest);
  const tracked = trackedFiles(repoRoot);
  // A lite app cannot have the full-only Jest preset installed yet. The upgrade model carries the preset's public sync inputs
  // specifically so both the dry full-edition view and the upgrade plan render the same targets before dependencies are added.
  const resolvedPresets = presets ?? UPGRADE_PRESETS;
  const managed = renderTargets(full, resolvedPresets, { manifest });
  const extra = [
    ...fullManagedFindings(repoRoot, managed),
    ...(await checkDatabase({ repoRoot, files: tracked })),
    ...(await formatFindings({ repoRoot, files: tracked, prettier })),
  ];
  const runs = [];
  for (const side of ["be", "fe"]) {
    const report = checkArchitecture({
      repositoryRoot: path.join(repoRoot, side),
      hfs: openHfs({ manifest, declaration: full, side }),
      surface: "check",
    });
    runs.push({
      side,
      status: "ran",
      files: report.files,
      kinds: report.kinds,
    });
    extra.push(
      ...report.errors.map((item) => machineFinding(side, item)),
      ...report.violations.map((item) => machineFinding(side, item)),
    );
  }
  const result = checkRepo({
    repoRoot,
    declaration: full,
    files: tracked,
    extraFindings: extra,
    manifest,
    surface: "check",
    tree: true,
  });
  return {
    ...result,
    machine: {
      status: "ran",
      files: runs.reduce((sum, run) => sum + run.files, 0),
      kinds: [...new Set(runs.flatMap((run) => run.kinds))],
      sides: runs,
    },
    editionOverride: { declared: actual, judged: edition },
  };
}
