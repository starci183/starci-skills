// The managed-file findings of `hfs check` (BE-CONVENTION 1.17, 3.1 principle 4): the rendered set of `hfs sync`, compared
// with the tracked repository, and the tool configuration nothing may add to it.
//   HFS_MANAGED_FILE_DRIFT (R05)  a managed file that exists but differs from its render: tsconfig*.json (but see R22),
//                                 jest.config.js, .prettierrc, .prettierignore, husky hooks, both workflows, sonar and codecov
//                                 files, and the `scripts` block of package.json (compared as parsed JSON, so key order is
//                                 not drift). A file that is absent is the slot manifest's finding (HFS_SLOT_REQUIRED_MISSING);
//                                 the `.gitignore` block is R04's.
//   HFS_GITIGNORE_BLOCK_DRIFT (R04)
//                                 the managed block of `.gitignore` differs from the rendered block, or is not there; the
//                                 repository's own lines around the block are not judged.
//   HFS_RULE_OFF_WITHOUT_REPLACEMENT (R17)
//                                 eslint.config.mjs differs from its render. The render is the one-liner that calls the canon
//                                 factory, and the factory takes no override, so a rule can be off, warned or redefined
//                                 in a repository only through a difference from the render: R17's proof is the comparison.
//                                 The file is judged here and not under R05, so one edit is one finding.
//   HFS_TOOL_CONFIG_LOCAL (R16)   what the render does not cover and could still weaken the canon: a tracked file that defines
//                                 an ESLint rule (`meta.type` plus `create(context)`), and a script or nested package.json
//                                 that runs eslint or prettier with a flag that swaps or switches off the configuration. Forbidden tool-config files (.eslintrc*, .eslintignore, a second
//                                 eslint.config.*) are refused by hfs-check through the slot manifest under the same code.
//   HFS_SONAR_CONFIG (R11)        sonar-project.properties differs from its render (the render names no host URL, sources and tests that
//                                 do not overlap, the coverage exclusions of the jest or vitest preset, the ESLint report and the
//                                 HFS import files Sonar reads), or the stack declaration names a quality gate other than the one
//                                 gate of knowledge/sonar-gate.yaml (bundled in the runtime copy). One edit is one finding.
//   HFS_TS_STRICT (R22)           the tsconfig.json drift, named by flag (ts-strict.mjs) instead of by hash.
import fs from 'node:fs';
import path from 'node:path';
import { SyncError, checkTargets, renderRepo } from './index.mjs';
import { parseYaml as bundledParseYaml } from '../runtime/engine/yaml.mjs';
import { readDeclaredSonarGate } from './sonar-key.mjs';
import { TS_STRICT_FILE, tsStrictFindings } from './ts-strict.mjs';

const ESLINT_CONFIG_FILE = 'eslint.config.mjs';
const SONAR_PROPERTIES_FILE = 'sonar-project.properties';
const SONAR_GATE_FILE = new URL('../runtime/knowledge/sonar-gate.yaml', import.meta.url);
const MAX_SCANNED_BYTES = 1024 * 1024;
const RULE_FILE = /\.[cm]?[jt]s$/;
// The places a command line can still live: the repository's scripts (repo.scripts) and its nested package.json files. The
// root package.json, the hooks and the workflows are managed files, and no other hook, workflow or shell script has a slot.
const SCRIPT_FILE = /^scripts\/[^/]+\.mjs$/;
// An ESLint rule module: `meta` with an ESLint rule type, and a `create` that takes the rule context.
const RULE_META = /\bmeta\s*:\s*\{[^}]*\btype\s*:\s*["'`](?:problem|suggestion|layout)["'`]/s;
const RULE_CREATE = /\bcreate\s*(?:\(|:\s*(?:async\s+)?(?:function\s*)?\()\s*\w+/;
// Flags that swap the configuration or switch a rule or a directive off. Only a line that runs the tool is judged.
const TOOL_FLAGS = [
  { tool: /\beslint\b/, flag: /(?<![\w-])(--rule|--no-inline-config|--no-eslintrc|--no-config-lookup|--config|-c|--ignore-pattern|--ignore-path|--no-ignore|--rulesdir|--plugin|--parser|--parser-options|--env|--global)(?![\w-])/ },
  { tool: /\bprettier\b/, flag: /(?<![\w-])(--config|--no-config|--ignore-path|--no-editorconfig|--plugin)(?![\w-])/ },
];

const readText = (root, file) => {
  try {
    const target = path.join(root, file);
    return fs.statSync(target).size > MAX_SCANNED_BYTES ? null : fs.readFileSync(target, 'utf8');
  } catch {
    return null;
  }
};

const local = (file, message) => ({ code: 'HFS_TOOL_CONFIG_LOCAL', level: 'error', path: file, message });

/** Every managed target that exists on disk but differs from its render, as one finding each. */
function driftFindings(repoRoot, targets, profile) {
  const findings = [];
  for (const result of checkTargets(repoRoot, targets)) {
    const target = targets.find(candidate => candidate.path === result.path);
    if (!fs.existsSync(path.join(repoRoot, result.path)) || result.status === 'ok') continue;
    if (profile === 'be' && result.path === TS_STRICT_FILE) {
      const flags = tsStrictFindings(fs.readFileSync(path.join(repoRoot, result.path), 'utf8'), target.content);
      if (flags.length) {
        findings.push(...flags);
        continue;
      }
    }
    const code = target.mode === 'block' ? 'HFS_GITIGNORE_BLOCK_DRIFT' : profile === 'be' && result.path === ESLINT_CONFIG_FILE ? 'HFS_RULE_OFF_WITHOUT_REPLACEMENT' : result.path === SONAR_PROPERTIES_FILE ? 'HFS_SONAR_CONFIG' : 'HFS_MANAGED_FILE_DRIFT';
    const where = result.difference ? `; line ${result.difference.line} expected ${JSON.stringify(result.difference.expected)}, found ${JSON.stringify(result.difference.actual)}` : '';
    const what = target.mode === 'block' ? `the managed block of ${result.path} is ${result.status === 'missing' ? 'missing' : 'not its render'}` : target.mode === 'scripts' ? 'the scripts block of package.json is not the rendered one' : `${result.path} is not its render${code === 'HFS_RULE_OFF_WITHOUT_REPLACEMENT' ? ', so a rule can be off or redefined in it' : ''}`;
    findings.push({ code, level: 'error', path: result.path, mode: target.mode, expectedHash: result.expectedHash, ...(result.actualHash ? { actualHash: result.actualHash } : {}), message: `${what} (expected sha256 ${result.expectedHash.slice(0, 12)}${result.actualHash ? `, found ${result.actualHash.slice(0, 12)}` : ''}${where}); run "npx hfs sync --write"` });
  }
  return findings;
}

/** R11: the quality gate the stack declaration names is the one gate of the bundled knowledge/sonar-gate.yaml. */
function sonarGateFindings(repoRoot, hfs, parseYaml) {
  const declared = readDeclaredSonarGate(repoRoot, { parseYaml, stacks: hfs.stacks });
  if (declared === null) return [];
  const gate = (parseYaml ?? bundledParseYaml)(fs.readFileSync(SONAR_GATE_FILE, 'utf8'))?.gate?.name;
  if (declared.qualityGate === gate) return [];
  return [{ code: 'HFS_SONAR_CONFIG', level: 'error', path: declared.file, message: `${declared.file} services.sonar.qualityGate is ${declared.qualityGate ?? 'absent'}; every product names the one gate ${gate} of knowledge/sonar-gate.yaml and states no threshold of its own` }];
}

function ruleFileFindings(repoRoot, tracked) {
  const findings = [];
  for (const file of tracked.filter(candidate => RULE_FILE.test(candidate))) {
    const text = readText(repoRoot, file);
    if (text !== null && RULE_META.test(text) && RULE_CREATE.test(text)) findings.push(local(file, `${file} defines an ESLint rule; a repository defines no rule, the canon plugin is the only source`));
  }
  return findings;
}

function flagFindings(repoRoot, tracked, managed) {
  const findings = [];
  const commandLines = (file, text) => {
    if (file.endsWith('package.json')) {
      try {
        return Object.entries(JSON.parse(text).scripts ?? {}).map(([name, command]) => [`script ${name}`, String(command)]);
      } catch {
        return [];
      }
    }
    return text.split('\n').map((line, index) => [`line ${index + 1}`, line]);
  };
  for (const file of tracked.filter(candidate => !managed.has(candidate) && (SCRIPT_FILE.test(candidate) || candidate.endsWith('/package.json')))) {
    const text = readText(repoRoot, file);
    if (text === null) continue;
    for (const [where, line] of commandLines(file, text)) {
      for (const { tool, flag } of TOOL_FLAGS) {
        const hit = tool.test(line) && flag.exec(line);
        if (hit) findings.push(local(file, `${file} (${where}) runs ${tool.source.replace(/\\b/g, '')} with ${hit[1]}, which swaps or switches off the canon configuration; run the tool with no such flag`));
      }
    }
  }
  return findings;
}

/**
 * The managed-file findings of the repository at `repoRoot` whose tracked paths are `tracked`. A repository whose hfs.json
 * is unreadable has none: the slot check reports the declaration. A missing preset or an unreadable stack declaration is
 * a SyncError the caller reports as a refusal.
 */
export async function managedFindings({ repoRoot, tracked, presets, parseYaml }) {
  let rendered;
  try {
    rendered = await renderRepo(repoRoot, { presets, parseYaml });
  } catch (error) {
    if (error instanceof SyncError && error.code === 'HFS_SYNC_HFS_INVALID') return [];
    throw error;
  }
  const { hfs, targets } = rendered;
  const findings = driftFindings(repoRoot, targets, hfs.profile);
  findings.push(...sonarGateFindings(repoRoot, hfs, parseYaml));
  if (hfs.profile === 'be') {
    findings.push(...ruleFileFindings(repoRoot, tracked));
    findings.push(...flagFindings(repoRoot, tracked, new Set(targets.map(target => target.path))));
  }
  return findings;
}
