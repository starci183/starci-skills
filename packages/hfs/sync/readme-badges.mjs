import { qualityServices } from '../runtime/scripts/hfs/ci-declaration.mjs';

/** Package repository fallbacks must name a GitHub HTTPS or Git transport URL. */
function githubRepository(repository) {
  const url = typeof repository === 'string' ? repository : repository?.url;
  const match = /^(?:git\+)?https:\/\/github\.com\/([^/]+\/[^/#?]+)|^git@github\.com:([^/]+\/[^/#?]+)/.exec(url ?? '');
  return (match?.[1] ?? match?.[2] ?? '').replace(/\.git$/, '');
}

/** Notice code (never an error) of a private repository badge rendered without its read-only badge token. */
const BADGE_TOKEN_NOTICE = 'README_BADGE_TOKEN_MISSING';

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
    const params = [];
    if (quality.codecov.flag) params.push(`flag=${encodeURIComponent(quality.codecov.flag)}`);
    if (doc?.services?.codecov?.badgeToken) params.push(`token=${encodeURIComponent(doc.services.codecov.badgeToken)}`);
    const flag = params.length ? `?${params.join('&')}` : '';
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
  const token = doc?.services?.sonar?.badgeToken ? `&token=${encodeURIComponent(doc.services.sonar.badgeToken)}` : '';
  return badge('Quality Gate', `${host}/api/project_badges/measure?project=${key}&metric=alert_status${token}`, `${host}/dashboard?id=${key}`);
}

/** Private repositories need public-safe badge tokens only for badges the renderer actually emits; examples never receive notices. */
export function badgeTokenNotices(doc, { example = false, repository } = {}) {
  if (example || doc?.ci?.github?.visibility !== 'private') return [];
  const rendered = renderReadmeBadges(doc, { example, repository });
  return [['codecov', 'Codecov', 'Codecov'], ['sonar', 'Sonar', 'Quality Gate']]
    .filter(([id, , label]) => !doc?.services?.[id]?.badgeToken && rendered.includes(`[![${label}](`))
    .map(([id, name]) => `${BADGE_TOKEN_NOTICE} notice: the ${name} badge of a private repository renders "unknown" without services.${id}.badgeToken (a read-only badge token, not a CI secret)`);
}
