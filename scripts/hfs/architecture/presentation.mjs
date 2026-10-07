import fs from 'node:fs';
import path from 'node:path';
import { repositoryName } from '../repo-identity.mjs';
import { managedScriptNames } from './managed-scripts.mjs';

const RUNTIME_ROOT_MARKDOWN = new Set(['README.md', 'CONTEXT.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'THIRD_PARTY_NOTICES.md']);
const PRODUCT_ROOT_MARKDOWN = new Set(['README.md']);
const README_SECTIONS = ['Overview', 'Stack', 'Repository layout', 'Development'];
const DEVELOPMENT_SCRIPTS = ['typecheck', 'lint', 'build', 'test'];
const README_HEADING = new RegExp([String.raw`^## `, String.raw`(.+?)`, String.raw`\s*$`].join(''), 'u');
const README_URL = new RegExp([String.raw`https?:`, String.raw`\/\/`, String.raw`[^\s<>)"']+`].join(''), 'giu');

function privateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0' ||
      /(?:\.localhost|\.local|\.internal|\.lan)$/u.test(host)) return true;
  if (host.includes(':')) return /^(?:::|f[cd][0-9a-f]*:|fe[89ab][0-9a-f]*:)/iu.test(host);
  if (!host.includes('.')) return true;
  const octets = host.split('.');
  if (octets.length !== 4 || !octets.every(part => /^\d{1,3}$/u.test(part) && Number(part) <= 255)) return false;
  const [a, b] = octets.map(Number);
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127;
}

function scriptCommand(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  return new RegExp(name === 'test' ? String.raw`npm (?:run test|test)(?![\w:-])` : String.raw`npm run ${escaped}(?![\w:-])`, 'u');
}

function addFinding(state, ruleId, entry, message, line = 1) {
  state.violations.push({ ruleId, path: entry, line, column: 1, message });
}

function checkRootPresentation(state) {
  const { root, runtime, tree } = state;
  for (const entry of tree.top) {
    if (/\.md$/iu.test(entry) && !(runtime ? RUNTIME_ROOT_MARKDOWN : PRODUCT_ROOT_MARKDOWN).has(entry))
      addFinding(state, 'HFS_ROOT_MARKDOWN_FORBIDDEN', entry, `Root Markdown ${entry} belongs under docs/ or the owning Work record.`);
    if (state.nonNpmEntries.has(entry)) addFinding(state, 'HFS_PACKAGE_MANAGER_MIXED', entry, `${entry} contradicts the npm package manager contract.`);
  }
  for (const entry of ['.gitattributes', 'README.md']) {
    if (!tree.hasFile(entry)) addFinding(state, 'HFS_ROOT_ENTRY_MISSING', entry, `Repository presentation requires root ${entry}.`);
  }
  if (tree.hasFile('package.json')) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      if (pkg.packageManager && !/^npm@\d/u.test(pkg.packageManager))
        addFinding(state, 'HFS_PACKAGE_MANAGER_MIXED', 'package.json', `packageManager ${pkg.packageManager} contradicts the npm package-lock.json contract.`);
    } catch { /* The repository's package/config checks own unreadable or invalid JSON. */ }
  }
}

function readmeSectionBody(lines, headings, section) {
  const start = headings.find(item => item.name === section)?.index;
  if (start === undefined) return '';
  const end = headings.find(item => item.index > start)?.index ?? lines.length;
  return lines.slice(start + 1, end).join('\n');
}

function checkReadmeHeadings(state, lines) {
  const { root, runtime, tree } = state;
  const name = runtime ? 'StarCi' : repositoryName(root);
  if (lines[0].trim().toLowerCase() !== `# ${name}`.toLowerCase())
    addFinding(state, 'HFS_README_TITLE_INVALID', 'README.md', `README.md must start with # ${name}.`);
  const description = lines.slice(1).find(line => line.trim());
  if (!description || /^\s*(?:#|!\[|\[!\[)/u.test(description) || description.trim().length > 240)
    addFinding(state, 'HFS_README_DESCRIPTION_INVALID', 'README.md', 'Place one concise description line directly below the repository name.');
  const headings = lines.map((line, index) => ({ name: README_HEADING.exec(line)?.[1], index })).filter(item => item.name);
  const required = [...README_SECTIONS, ...(tree.hasDir('.starciwork') ? ['Work'] : [])];
  let previous = -1;
  for (const section of required) {
    const found = headings.find(item => item.name === section);
    if (!found) addFinding(state, 'HFS_README_SECTION_MISSING', 'README.md', `README.md requires a ## ${section} section.`);
    else if (found.index <= previous) addFinding(state, 'HFS_README_SECTION_ORDER', 'README.md', `## ${section} must follow the preceding standard section.`, found.index + 1);
    else previous = found.index;
  }
  return headings;
}

function checkReadmeDevelopment(state, lines, headings) {
  if (state.runtime || !headings.some(item => item.name === 'Development')) return;
  const development = readmeSectionBody(lines, headings, 'Development');
  const scripts = DEVELOPMENT_SCRIPTS.filter(name => managedScriptNames(state.profile, state.edition).has(name));
  const commands = [/npm (?:ci|install)/u, ...scripts.map(scriptCommand)];
  if (commands.some(command => !command.test(development))) {
    addFinding(state, 'HFS_README_DEVELOPMENT_INCOMPLETE', 'README.md', 'Development must show npm install and the managed script commands: '
      + scripts.map(name => (name === 'test' ? 'npm test' : `npm run ${name}`)).join(', ') + '.');
  }
}

function checkReadmeWorkPointer(state, lines, headings) {
  if (state.tree.hasDir('.starciwork') && headings.some(item => item.name === 'Work') &&
      !/\.starciwork\b/u.test(readmeSectionBody(lines, headings, 'Work')))
    addFinding(state, 'HFS_README_WORK_POINTER_MISSING', 'README.md', 'Work must point at the backend .starciwork tree.');
}

function inspectReadmeUrl(state, value, line) {
  try {
    if (privateHost(new URL(value).hostname))
      addFinding(state, 'HFS_README_PRIVATE_URL', 'README.md', `README URL ${value} points at a local or private host.`, line);
  } catch { /* Malformed URLs are outside this presentation rule. */ }
}

function badgeTargets(prose) {
  return [
    ...[...prose.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/gu)].map(match => ({ alt: match[1], target: match[2] })),
    ...[...prose.matchAll(/<img\b[^>]*>/giu)].map(match => ({
      alt: /\balt=["']([^"']*)["']/iu.exec(match[0])?.[1] ?? '',
      target: /\bsrc=["']([^"']*)["']/iu.exec(match[0])?.[1] ?? '',
    })),
  ];
}

function inspectBadgeTarget(state, alt, rawTarget, line) {
  const target = rawTarget.trim().replace(/^<|>$/gu, '');
  if (!/badge/iu.test(alt) && !/badge|shields\.io|badgen\.net/iu.test(target)) return;
  try {
    const url = new URL(target);
    if (url.protocol !== 'https:' || privateHost(url.hostname) ||
        /^(?:img\.shields\.io|badgen\.net)$/iu.test(url.hostname) && url.pathname.startsWith('/badge/'))
      addFinding(state, 'HFS_README_BADGE_NOT_LIVE', 'README.md', `Badge ${target} must represent a live external HTTPS service.`, line);
  } catch { addFinding(state, 'HFS_README_BADGE_NOT_LIVE', 'README.md', `Badge ${target} must use a live external HTTPS service.`, line); }
}

function inspectReadmeLine(state, line, index, scan) {
  if (/^\s*```/u.test(line)) {
    scan.fenced = !scan.fenced;
    return;
  }
  if (scan.fenced) return;
  const prose = line.replace(/`[^`]*`/gu, '');
  for (const match of prose.matchAll(README_URL)) inspectReadmeUrl(state, match[0].replace(/[.,;!?]+$/u, ''), index + 1);
  for (const badge of badgeTargets(prose)) inspectBadgeTarget(state, badge.alt, badge.target, index + 1);
}

function checkReadmeLines(state, lines) {
  const scan = { fenced: false };
  for (let index = 0; index < lines.length; index += 1) inspectReadmeLine(state, lines[index], index, scan);
}

function presentationResult(state) {
  return { violations: state.violations, coverage: { status: 'checked', source: state.tree.source } };
}

export function checkRepoPresentationImpl({ root, runtime, tree, profile, edition, nonNpmEntries }) {
  const state = { root, runtime, tree, profile, edition, nonNpmEntries, violations: [] };
  checkRootPresentation(state);
  if (!tree.hasFile('README.md')) return presentationResult(state);
  let readme;
  try { readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8'); }
  catch {
    addFinding(state, 'HFS_ROOT_ENTRY_MISSING', 'README.md', 'Tracked README.md is not readable.');
    return presentationResult(state);
  }
  const lines = readme.split(/\r?\n/u);
  const headings = checkReadmeHeadings(state, lines);
  checkReadmeDevelopment(state, lines, headings);
  checkReadmeWorkPointer(state, lines, headings);
  checkReadmeLines(state, lines);
  return presentationResult(state);
}
