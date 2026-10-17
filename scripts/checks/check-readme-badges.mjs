#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import prettier from 'prettier';
import prettierConfig from '../../packages/prettier-config/index.cjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { discoverExampleApps, EXAMPLES_ROOT } from '../lib/example-refs.mjs';
import { isMain } from '../lib/is-main.mjs';

const CODE = 'RT_README_BADGE_MISSING';
const FORMAT_CODE = 'RT_README_NOT_PRETTIER';
const USAGE = 'usage: starci runtime check --only readme-badges [-- --root <runtime tree>]';
const REQUIRED = [
  { name: 'ci', image: /^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/workflows\/ci\.yml\/badge\.svg(?:\?|$)/u },
  { name: 'Sonar quality gate', image: /^https:\/\/[^/]+\/api\/project_badges\/measure\?[^\s]*\bmetric=alert_status(?:&|$)/u },
  { name: 'codecov', image: /^https:\/\/codecov\.io\/gh\/[^/]+\/[^/]+\/(?:branch\/[^/]+\/)?graph\/badge\.svg(?:\?|$)/u },
];
const DEPENDABOT = { name: 'Dependabot', image: /^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/workflows\/dependabot\/dependabot-updates\/badge\.svg(?:\?|$)/u };

/** Only linked Markdown badge lines in visible README prose satisfy the runtime badge contract. */
function badgeImages(readme) {
  const images = [];
  let fenced = false;
  const prose = readme.replace(/<!--[\s\S]*?-->/gu, '');
  for (const line of prose.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) { fenced = !fenced; continue; }
    if (fenced) continue;
    const match = /^\[!\[[^\]]*\]\((https:\/\/[^)\s]+)\)\]\([^\s)]+\)$/u.exec(trimmed);
    if (match) images.push(match[1]);
  }
  return images;
}

/** Return RT_README_BADGE_MISSING for each required badge absent from root README.md; Dependabot is required only with its config. */
function readmeBadgeFindings(root = skillRoot) {
  const file = path.join(root, 'README.md');
  const images = badgeImages(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
  const required = [...REQUIRED];
  if (fs.existsSync(path.join(root, '.github', 'dependabot.yml'))) required.push(DEPENDABOT);
  return required.filter(({ image }) => !images.some(url => image.test(url)))
    .map(({ name }) => ({ code: CODE, path: 'README.md', message: `Missing ${name} badge line.` }));
}

/** Every runtime and example README must be present and pass the canon Markdown formatter after sync. */
async function readmeFormatFindings(root) {
  const readmes = ['README.md', ...discoverExampleApps(root).map(name => `${EXAMPLES_ROOT}/${name}/README.md`)];
  const results = await Promise.all(readmes.map(async file => {
    const absolute = path.join(root, file);
    const formatted = fs.existsSync(absolute) && await prettier.check(fs.readFileSync(absolute, 'utf8'), { ...prettierConfig, parser: 'markdown' });
    return formatted ? [] : [{ code: FORMAT_CODE, path: file, message: 'README is missing or not formatted by prettier; run npm run format.' }];
  }));
  return results.flat();
}

/** Judge the selected runtime tree and refuse missing badges or unformatted READMEs with the code first. */
async function main(argv) {
  if (argv.length && (argv.length !== 2 || argv[0] !== '--root' || !argv[1])) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const root = argv.length ? path.resolve(argv[1]) : skillRoot;
  const findings = [...readmeBadgeFindings(root), ...await readmeFormatFindings(root)];
  for (const finding of findings) process.stdout.write(`${finding.code}: ${finding.path}: ${finding.message}\n`);
  if (!findings.length) process.stdout.write('readme-badges: required runtime badges present; runtime and example READMEs are prettier-clean\n');
  return findings.length ? 1 : 0;
}

if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
