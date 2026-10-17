import { qualityServices } from '../runtime/scripts/hfs/ci-declaration.mjs';

/** Package repository fallbacks must name a GitHub HTTPS or Git transport URL. */
function githubRepository(repository) {
  const url = typeof repository === 'string' ? repository : repository?.url;
  const match = /^(?:git\+)?https:\/\/github\.com\/([^/]+\/[^/#?]+)|^git@github\.com:([^/]+\/[^/#?]+)/.exec(url ?? '');
  return (match?.[1] ?? match?.[2] ?? '').replace(/\.git$/, '');
}

const badge = (name, image, link) => `[![${name}](${image})](${link})`;

/** Render live CI, coverage, quality gate and Dependabot badges only when a GitHub repository is declared or inferable; no network is used. */
export function renderReadmeBadges(doc, { repository, example = false } = {}) {
  const github = doc?.ci?.github ?? {};
  const repo = github.repository ?? githubRepository(repository);
  if (!repo) return '';
  const branch = encodeURIComponent(github.defaultBranch ?? 'main');
  const workflow = encodeURIComponent(github.workflow ?? 'ci.yml');
  const base = `https://github.com/${repo}`;
  const quality = qualityServices(doc, { example });
  const lines = [badge('CI', `${base}/actions/workflows/${workflow}/badge.svg?branch=${branch}`, `${base}/actions/workflows/${workflow}`)];
  if (quality.codecov.enabled) {
    const flag = quality.codecov.flag ? `?flag=${encodeURIComponent(quality.codecov.flag)}` : '';
    lines.push(badge('Codecov', `https://codecov.io/gh/${repo}/branch/${branch}/graph/badge.svg${flag}`, `https://codecov.io/gh/${repo}`));
  }
  const sonar = sonarBadge(doc, quality.sonar, example);
  if (sonar) lines.push(sonar);
  if (quality.dependabot.ecosystems.length) {
    const updates = `${base}/actions/workflows/dependabot/dependabot-updates`;
    lines.push(badge('Dependabot', `${updates}/badge.svg`, updates));
  }
  return lines.join('\n');
}

/** Runtime examples use the organization-qualified key passed by examples.yml; products declare their complete project key. */
function sonarBadge(doc, sonar, example) {
  if (!sonar?.projectKey) return '';
  const host = sonar.provider === 'sonarcloud' ? 'https://sonarcloud.io' : sonar.host?.replace(/\/$/, '');
  if (!host) return '';
  const organization = sonar.organization ?? doc?.ci?.vars?.find(entry => entry.name === sonar.organizationVar)?.value;
  const prefix = example && organization ? `${organization}_` : '';
  const key = encodeURIComponent(prefix + sonar.projectKey);
  return badge('Quality Gate', `${host}/api/project_badges/measure?project=${key}&metric=alert_status`, `${host}/dashboard?id=${key}`);
}
