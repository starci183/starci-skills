import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { isIP } from 'node:net';
import { repositoryName } from '../../lib/repo-identity.mjs';

/**
 * HFS v1 repository-tree check (D:/starci-tmp/hfs/HFS-SPEC.md): every StarCi repository is an
 * apps/<app>/ monorepo on npm with a fixed root-entry allowlist; backend composition lives in
 * apps/<app>/src and shared source under src/{features,modules,tests} with the three module tiers
 * domain/platform/integrations; frontend source lives only under apps/<app>/src. The judged tree is
 * the tracked one (`git ls-files` from the target root); a target outside a work tree falls back to
 * the filesystem view so fixtures and un-tracked checkouts are judged the same way.
 */

export const HFS_RULE_IDS = [
  'HFS_APPS_REQUIRED',
  'HFS_APP_LAYOUT_INVALID',
  'HFS_MODULE_TIER_INVALID',
  'HFS_PACKAGE_MANAGER_MIXED',
  'HFS_README_BADGE_NOT_LIVE',
  'HFS_README_DESCRIPTION_INVALID',
  'HFS_README_DEVELOPMENT_INCOMPLETE',
  'HFS_README_PRIVATE_URL',
  'HFS_README_SECTION_MISSING',
  'HFS_README_SECTION_ORDER',
  'HFS_README_TITLE_INVALID',
  'HFS_README_WORK_POINTER_MISSING',
  'HFS_ROOT_ENTRY_FORBIDDEN',
  'HFS_ROOT_ENTRY_MISSING',
  'HFS_ROOT_MARKDOWN_FORBIDDEN',
  'HFS_ROOT_SRC_FORBIDDEN_FE',
  'HFS_SRC_LAYOUT_INVALID',
  'HFS_STACKS_IN_FE',
  'HFS_TEST_KIND_RETIRED',
  'HFS_WORK_IN_FE',
];

const REQUIRED_COMMON = ['.gitattributes', '.github', '.gitignore', '.husky', 'architecture.json',
  'codecov.yml', 'eslint.config.mjs', 'package-lock.json', 'package.json', 'README.md',
  'sonar-project.properties', 'tsconfig.json'];
const OPTIONAL_COMMON = new Set(['.dockerignore', '.editorconfig', '.npmrc', '.nvmrc', 'docs', 'e2e',
  'packages', 'scripts', 'tsconfig.build.json']);
const REQUIRED_BACKEND = ['.sops.yaml', '.starcistacks', '.starciwork', 'jest.config.js', 'nest-cli.json', 'src'];
const OPTIONAL_FRONTEND = new Set(['turbo.json', 'vitest.config.ts', 'vitest.setup.ts']);
const OPTIONAL_FRONTEND_PATTERN = /^playwright\.config\.ts$/;
const NON_NPM_ENTRIES = new Set(['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb']);
const RUNTIME_ROOT_MARKDOWN = new Set(['README.md', 'CONTEXT.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'THIRD_PARTY_NOTICES.md']);
const PRODUCT_ROOT_MARKDOWN = new Set(['README.md']);
const README_SECTIONS = ['Overview', 'Stack', 'Repository layout', 'Development'];
const BACKEND_SRC_CHILDREN = new Set(['features', 'modules', 'tests']);
const MODULE_TIERS = new Set(['domain', 'integrations', 'platform']);
const TEST_CHILDREN = new Set(['e2e', 'fixtures']);
// Owner ruling 2026-09-29: exactly two test kinds - unit `<name>.spec.ts` and e2e `*.e2e-spec.ts`.
const RETIRED_TEST_SUFFIX = /\.(?:int|harness)-spec\.[cm]?[jt]sx?$/u;
const RETIRED_TEST_FOLDER = /^src\/tests\/(?:integration|harness)(?:\/|$)/u;
const EXTRA_TEST_CONFIG = /(?:^|\/)(?:jest[.-][^/]*(?:config\.[cm]?[jt]s|\.json)|jest-(?:e2e|int|integration|harness)[^/]*)$/u;
const NODE_ENTRIES_SKIPPED = new Set(['node_modules', '.git']);

function gitPaths(root) {
  try {
    // An empty index is still a Git tree. Falling back to disk in that case would count
    // untracked build output as repository content.
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out = execFileSync('git', ['ls-files', '--cached', '-z', '--', '.'], {
      cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out.split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

function fsHasDir(root, relative) {
  try { return fs.statSync(path.join(root, ...relative.split('/'))).isDirectory(); } catch { return false; }
}

function fsHasFile(root, relative) {
  try { return fs.statSync(path.join(root, ...relative.split('/'))).isFile(); } catch { return false; }
}

function fsChildren(root, relative) {
  try {
    return fs.readdirSync(path.join(root, ...relative.split('/')), { withFileTypes: true })
      .map(entry => entry.name);
  } catch {
    return [];
  }
}

function fsFiles(root, relative = '') {
  const out = [];
  for (const name of fsChildren(root, relative || '.')) {
    if (NODE_ENTRIES_SKIPPED.has(name)) continue;
    const child = relative ? `${relative}/${name}` : name;
    if (fsHasDir(root, child)) out.push(...fsFiles(root, child));
    else out.push(child);
  }
  return out;
}

/** Uniform tree view: top entries plus children(dir)/hasDir/hasFile answers over posix relatives. */
function treeView(root) {
  const tracked = gitPaths(root);
  if (tracked !== null) {
    const files = new Set(tracked);
    return {
      source: 'git',
      top: [...new Set(tracked.map(file => file.split('/')[0]))],
      children: dir => {
        const prefix = `${dir}/`;
        const names = new Set();
        for (const file of tracked) if (file.startsWith(prefix)) names.add(file.slice(prefix.length).split('/')[0]);
        return [...names];
      },
      hasDir: dir => tracked.some(file => file.startsWith(`${dir}/`)),
      hasFile: file => files.has(file),
      files: () => tracked,
    };
  }
  return {
    source: 'fs',
    top: fsChildren(root, '.'),
    children: dir => fsChildren(root, dir),
    hasDir: dir => fsHasDir(root, dir),
    hasFile: file => fsHasFile(root, file),
    files: () => fsFiles(root),
  };
}

function privateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0' ||
      /(?:\.localhost|\.local|\.internal|\.lan)$/u.test(host)) return true;
  if (isIP(host) === 6) return /^(?:::|f[cd][0-9a-f]*:|fe[89ab][0-9a-f]*:)/iu.test(host);
  if (!host.includes('.')) return true;
  const octets = host.split('.');
  if (octets.length !== 4 || !octets.every(part => /^\d{1,3}$/u.test(part) && Number(part) <= 255)) return false;
  const [a, b] = octets.map(Number);
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127;
}

/** Presentation checks shared by the product HFS gate and this runtime's own standalone gate. */
export function checkRepoPresentation({ root, runtime = false, tree = treeView(root) }) {
  const violations = [];
  const finding = (ruleId, entry, message, line = 1) => violations.push({ ruleId, path: entry, line, column: 1, message });
  for (const entry of tree.top) {
    if (/\.md$/iu.test(entry) && !(runtime ? RUNTIME_ROOT_MARKDOWN : PRODUCT_ROOT_MARKDOWN).has(entry))
      finding('HFS_ROOT_MARKDOWN_FORBIDDEN', entry, `Root Markdown ${entry} belongs under docs/ or the owning Work record.`);
    if (NON_NPM_ENTRIES.has(entry))
      finding('HFS_PACKAGE_MANAGER_MIXED', entry, `${entry} contradicts the npm package manager contract.`);
  }
  for (const entry of ['.gitattributes', 'README.md']) {
    if (!tree.hasFile(entry)) finding('HFS_ROOT_ENTRY_MISSING', entry, `Repository presentation requires root ${entry}.`);
  }
  if (tree.hasFile('package.json')) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      if (pkg.packageManager && !/^npm@\d/u.test(pkg.packageManager))
        finding('HFS_PACKAGE_MANAGER_MIXED', 'package.json', `packageManager ${pkg.packageManager} contradicts the npm package-lock.json contract.`);
    } catch { /* The repository's package/config checks own unreadable or invalid JSON. */ }
  }
  if (!tree.hasFile('README.md')) return { violations, coverage: { status: 'checked', source: tree.source } };
  let readme;
  try { readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8'); }
  catch {
    finding('HFS_ROOT_ENTRY_MISSING', 'README.md', 'Tracked README.md is not readable.');
    return { violations, coverage: { status: 'checked', source: tree.source } };
  }
  const lines = readme.split(/\r?\n/u);
  const name = runtime ? 'StarCi' : repositoryName(root);
  if (lines[0].trim().toLowerCase() !== `# ${name}`.toLowerCase())
    finding('HFS_README_TITLE_INVALID', 'README.md', `README.md must start with # ${name}.`);
  const description = lines.slice(1).find(line => line.trim());
  if (!description || /^\s*(?:#|!\[|\[!\[)/u.test(description) || description.trim().length > 240)
    finding('HFS_README_DESCRIPTION_INVALID', 'README.md', 'Place one concise description line directly below the repository name.');
  const headings = lines.map((line, index) => ({ name: /^## (.+?)\s*$/u.exec(line)?.[1], index })).filter(item => item.name);
  const required = [...README_SECTIONS, ...(tree.hasDir('.starciwork') ? ['Work'] : [])];
  let previous = -1;
  for (const section of required) {
    const found = headings.find(item => item.name === section);
    if (!found) finding('HFS_README_SECTION_MISSING', 'README.md', `README.md requires a ## ${section} section.`);
    else if (found.index <= previous) finding('HFS_README_SECTION_ORDER', 'README.md', `## ${section} must follow the preceding standard section.`, found.index + 1);
    else previous = found.index;
  }
  const sectionBody = section => {
    const start = headings.find(item => item.name === section)?.index;
    if (start === undefined) return '';
    const end = headings.find(item => item.index > start)?.index ?? lines.length;
    return lines.slice(start + 1, end).join('\n');
  };
  if (!runtime && headings.some(item => item.name === 'Development')) {
    const development = sectionBody('Development');
    const commands = [/npm (?:ci|install)/u, /npm run typecheck/u, /npm run lint:check/u,
      /npm run build/u, /npm run test:unit/u];
    if (commands.some(command => !command.test(development)))
      finding('HFS_README_DEVELOPMENT_INCOMPLETE', 'README.md',
        'Development must show npm install, typecheck, lint:check, build and test:unit commands.');
  }
  if (tree.hasDir('.starciwork') && headings.some(item => item.name === 'Work') &&
      !/\.starciwork\b/u.test(sectionBody('Work')))
    finding('HFS_README_WORK_POINTER_MISSING', 'README.md', 'Work must point at the backend .starciwork tree.');
  let fenced = false;
  lines.forEach((line, index) => {
    if (/^\s*```/u.test(line)) { fenced = !fenced; return; }
    if (fenced) return;
    const prose = line.replace(/`[^`]*`/gu, '');
    for (const match of prose.matchAll(/https?:\/\/[^\s<>)"']+/giu)) {
      const value = match[0].replace(/[.,;!?]+$/u, '');
      try {
        if (privateHost(new URL(value).hostname))
          finding('HFS_README_PRIVATE_URL', 'README.md', `README URL ${value} points at a local or private host.`, index + 1);
      } catch { /* Malformed URLs are outside this presentation rule. */ }
    }
    const badgeTargets = [
      ...[...prose.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/gu)].map(match => ({ alt: match[1], target: match[2] })),
      ...[...prose.matchAll(/<img\b[^>]*>/giu)].map(match => ({
        alt: /\balt=["']([^"']*)["']/iu.exec(match[0])?.[1] ?? '',
        target: /\bsrc=["']([^"']*)["']/iu.exec(match[0])?.[1] ?? '',
      })),
    ];
    for (const { alt, target: rawTarget } of badgeTargets) {
      const target = rawTarget.trim().replace(/^<|>$/gu, '');
      if (!/badge/iu.test(alt) && !/badge|shields\.io|badgen\.net/iu.test(target)) continue;
      try {
        const url = new URL(target);
        if (url.protocol !== 'https:' || privateHost(url.hostname) ||
            /^(?:img\.shields\.io|badgen\.net)$/iu.test(url.hostname) && /^\/badge\//u.test(url.pathname))
          finding('HFS_README_BADGE_NOT_LIVE', 'README.md', `Badge ${target} must represent a live external HTTPS service.`, index + 1);
      } catch { finding('HFS_README_BADGE_NOT_LIVE', 'README.md', `Badge ${target} must use a live external HTTPS service.`, index + 1); }
    }
  });
  return { violations, coverage: { status: 'checked', source: tree.source } };
}

export function checkHfs(config) {
  const kinds = config.kinds ?? [];
  const backend = kinds.includes('backend');
  const frontend = kinds.includes('frontend');
  if (!backend && !frontend) return { violations: [], coverage: { status: 'not-applicable' } };
  const tree = treeView(config.root);
  const violations = [];
  const finding = (ruleId, entry, message) => violations.push({ ruleId, path: entry, line: 1, column: 1, message });
  const presentation = checkRepoPresentation({ root: config.root, tree });
  violations.push(...presentation.violations);

  const allowed = new Set(['apps', ...REQUIRED_COMMON, ...OPTIONAL_COMMON,
    ...(backend ? REQUIRED_BACKEND : []), ...(frontend ? OPTIONAL_FRONTEND : [])]);
  for (const entry of [...tree.top].sort()) {
    if (NON_NPM_ENTRIES.has(entry) || /\.md$/iu.test(entry)) continue;
    if (frontend && !backend) {
      if (entry === '.starciwork') { finding('HFS_WORK_IN_FE', entry, 'A frontend repository must not hold a .starciwork tree; Work records live in the backend repository.'); continue; }
      if (entry === '.starcistacks') { finding('HFS_STACKS_IN_FE', entry, 'A frontend repository must not hold .starcistacks; stack declarations live in the backend repository.'); continue; }
      if (entry === 'src') { finding('HFS_ROOT_SRC_FORBIDDEN_FE', entry, 'A frontend repository keeps source only under apps/<app>/src; the root src/ tree must move.'); continue; }
    }
    if (!allowed.has(entry) && !(frontend && OPTIONAL_FRONTEND_PATTERN.test(entry))) {
      finding('HFS_ROOT_ENTRY_FORBIDDEN', entry, `Root entry ${entry} is not in the HFS ${backend ? 'backend' : 'frontend'} allowlist.`);
    }
  }

  const required = new Set(REQUIRED_COMMON);
  if (backend) for (const entry of REQUIRED_BACKEND) required.add(entry);
  for (const entry of [...required].sort()) {
    if (entry === 'apps' || entry === 'README.md' || entry === '.gitattributes') continue;
    if (!tree.top.includes(entry)) finding('HFS_ROOT_ENTRY_MISSING', entry, `The ${backend ? 'backend' : 'frontend'} HFS tree requires root entry ${entry}.`);
  }

  const apps = tree.children('apps').sort();
  if (!tree.hasDir('apps') || apps.length === 0) {
    finding('HFS_APPS_REQUIRED', 'apps', 'Every HFS repository is an apps/<app>/ monorepo; apps/ must hold at least one application.');
  }
  for (const app of apps) {
    const missing = [];
    if (!tree.hasDir(`apps/${app}`)) {
      finding('HFS_APP_LAYOUT_INVALID', `apps/${app}`, `Application entry apps/${app} must be a directory.`);
      continue;
    }
    if (!tree.hasDir(`apps/${app}/src`)) missing.push('src/');
    if (backend) for (const entry of ['src/main.ts', 'src/app.module.ts']) {
      if (!tree.hasFile(`apps/${app}/${entry}`)) missing.push(entry);
    }
    // next-env.d.ts is generated by Next and commonly ignored by Git; it is not
    // a reliable tracked-tree input.
    if (frontend) for (const entry of ['package.json', 'next.config.ts', 'tsconfig.json', 'postcss.config.mjs']) {
      if (!tree.hasFile(`apps/${app}/${entry}`)) missing.push(entry);
    }
    if (missing.length) finding('HFS_APP_LAYOUT_INVALID', `apps/${app}`, `Application apps/${app} lacks ${missing.join(', ')} required by the HFS app layout.`);
  }

  if (backend) {
    for (const child of tree.children('src').sort()) {
      if (!BACKEND_SRC_CHILDREN.has(child)) {
        finding('HFS_SRC_LAYOUT_INVALID', `src/${child}`, `Backend src/ holds only features/, modules/ and tests/; ${child} must move to its owner.`);
      }
    }
    for (const tier of tree.children('src/modules').sort()) {
      if (!MODULE_TIERS.has(tier)) {
        finding('HFS_MODULE_TIER_INVALID', `src/modules/${tier}`, `Module tier ${tier} is not one of domain, platform, integrations.`);
      }
    }
    for (const child of tree.children('src/tests').sort()) {
      if (!TEST_CHILDREN.has(child)) {
        finding('HFS_SRC_LAYOUT_INVALID', `src/tests/${child}`, `Backend tests/ holds only e2e and fixtures; ${child} must move.`);
      }
    }
  }

  // Two test kinds only, on both profiles. The retired kinds are e2e now: rename to *.e2e-spec.ts and
  // move under src/tests/e2e/ (backend) or e2e/ (frontend); environment code goes in src/tests/e2e/setup/.
  for (const file of tree.files()) {
    if (RETIRED_TEST_SUFFIX.test(file))
      finding('HFS_TEST_KIND_RETIRED', file, `${file} uses a retired test kind. Only unit *.spec.ts and e2e *.e2e-spec.ts exist; integration and harness specs are e2e.`);
    else if (backend && RETIRED_TEST_FOLDER.test(file))
      finding('HFS_TEST_KIND_RETIRED', file, `${file} sits in a retired test folder. Move specs under src/tests/e2e/ and environment code under src/tests/e2e/setup/.`);
    else if (backend && /^src\/tests\//u.test(file) && EXTRA_TEST_CONFIG.test(file))
      finding('HFS_TEST_KIND_RETIRED', file, `${file} is a per-lane test config. One root jest.config.js declares exactly the unit and e2e projects.`);
    else if (frontend && file !== 'playwright.config.ts' && /(?:^|\/)playwright[^/]*\.config\.[cm]?[jt]s$/u.test(file))
      finding('HFS_TEST_KIND_RETIRED', file, `${file} is a second Playwright config. One root playwright.config.ts runs every e2e spec.`);
    else if (frontend && /^e2e\/.+\.(?:spec|test)\.[cm]?[jt]sx?$/u.test(file))
      finding('HFS_TEST_KIND_RETIRED', file, `${file} is a Playwright spec that is not named *.e2e-spec.ts.`);
  }

  return {
    violations,
    coverage: {
      status: 'checked',
      source: tree.source,
      rootEntries: tree.top.length,
      apps,
      ruleIds: [...HFS_RULE_IDS],
    },
  };
}

/** Keep tree findings visible even when the TypeScript architecture config is invalid. */
export function checkHfsWithoutConfig(repositoryRoot, configFile) {
  let root;
  try { root = fs.realpathSync(path.resolve(repositoryRoot)); } catch {
    return { violations: [], coverage: { status: 'unavailable', reason: 'repository root is unavailable' } };
  }
  let kinds = [];
  try {
    const authored = JSON.parse(fs.readFileSync(path.resolve(root, configFile ?? 'architecture.json'), 'utf8'));
    if (Array.isArray(authored.kinds)) kinds = authored.kinds.filter(kind => kind === 'backend' || kind === 'frontend');
  } catch { /* A malformed config remains an ARCH_CONFIG_INVALID error. */ }
  if (!kinds.length) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['@nestjs/core']) kinds.push('backend');
      if (deps.next) kinds.push('frontend');
    } catch { /* The architecture error still reports the missing input. */ }
  }
  return checkHfs({ root, kinds });
}
