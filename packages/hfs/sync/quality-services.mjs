import fs from 'node:fs';
import path from 'node:path';
import { parseYaml as bundledParseYaml } from '../runtime/engine/yaml.mjs';
import { qualityServices } from '../runtime/scripts/hfs/ci-declaration.mjs';
import { isRuntimeExampleApp } from '../runtime/scripts/lib/runtime-example.mjs';
import { DECLARATION } from './sonar-key.mjs';

/** Apps without any service block retain the legacy CI defaults until they declare their services. */
export function hasDeclaredServices(root, { parseYaml = bundledParseYaml } = {}) {
  try {
    const doc = parseYaml(fs.readFileSync(path.join(root, DECLARATION), 'utf8'));
    return Object.keys(doc?.services ?? {}).length > 0;
  } catch {
    return false;
  }
}

/** Missing or unreadable manifests preserve the shared quality defaults; example apps use the runtime example policy. */
export function readDeclaredQuality(root, { parseYaml = bundledParseYaml } = {}) {
  try {
    const doc = parseYaml(fs.readFileSync(path.join(root, DECLARATION), 'utf8'));
    return qualityServices(doc, { example: isRuntimeExampleApp(root) });
  } catch {
    return qualityServices({});
  }
}

/** SonarCloud names its organization and public host; SonarQube uses the manifest host. */
export function sonarHostLine(sonar) {
  if (!sonar) return '';
  if (sonar.provider === 'sonarcloud') return [sonar.organization ? `sonar.organization=${sonar.organization}` : '', 'sonar.host.url=https://sonarcloud.io'].filter(Boolean).join('\n');
  return sonar.host ? `sonar.host.url=${sonar.host}` : '';
}

/** Dependabot groups minor and patch updates while majors remain per package; security updates have their own immediate group. */
export function dependabotUpdates(dependabot) {
  if (!dependabot.ecosystems.length) return '  []';
  return dependabot.ecosystems.map(ecosystem => [
    `  - package-ecosystem: ${ecosystem}`,
    ...(ecosystem === 'docker' ? ['    directories:', '      - /be/apps/*', '      - /fe/apps/*'] : ['    directory: /']),
    '    schedule:',
    `      interval: ${dependabot.schedule.interval}`,
    ...(dependabot.schedule.day ? [`      day: ${dependabot.schedule.day}`] : []),
    ...(dependabot.schedule.time ? [`      time: ${JSON.stringify(dependabot.schedule.time)}`] : []),
    '    groups:',
    ...(ecosystem === 'github-actions' ? ['      actions:', '        patterns: ["*"]'] : [
      ...(dependabot.groups.minorPatch === 'grouped' ? ['      minor-and-patch:', '        update-types: [minor, patch]'] : []),
      ...(dependabot.security === 'immediate' ? ['      security:', '        applies-to: security-updates', '        patterns: ["*"]', '        update-types: [minor, patch]'] : []),
    ]),
    ...(ecosystem === 'npm' && dependabot.ignore.length ? ['    ignore:', ...dependabot.ignore.map(name => `      - dependency-name: ${JSON.stringify(name)}`)] : []),
  ].join('\n')).join('\n');
}
