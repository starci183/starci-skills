// The footer shows the tree's own version: .claude/package.json is the published version of
// StarCi Skills, and the docs follow it rather than carrying a second number.
import Link from 'next/link';

import tree from '../../package.json';

const REPO = 'https://github.com/starci183/starci-skills';

export default {
  logo: <span style={{ fontWeight: 600 }}>StarCi Skills</span>,
  project: { link: REPO },
  docsRepositoryBase: `${REPO}/tree/main/docs`,
  navbar: {
    extraContent: (
      <Link href="/vi" style={{ fontSize: '0.85rem', padding: '0 0.5rem' }} title="Tiếng Việt">
        VI
      </Link>
    ),
  },
  sidebar: { defaultMenuCollapseLevel: 1 },
  editLink: { content: 'Edit this page on GitHub' },
  feedback: { content: null },
  footer: {
    content: (
      <span>
        StarCi Skills {tree.version} —{' '}
        <a href={REPO} target="_blank" rel="noreferrer">
          {REPO.replace('https://', '')}
        </a>
      </span>
    ),
  },
  useNextSeoProps: () => ({ titleTemplate: '%s — StarCi Skills' }),
};
