// proves: RT_RULING_STALE_CITE@lite
// proves: RT_RULING_STALE_CITE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { byCodeUnit } from '../../scripts/lib/list.mjs';
import { CODE, buildRulingIndex, rulingCiteFindings } from '../../scripts/checks/lib/ruling-cites.mjs';
import { checkRulingCites, checkRulingCitesMain } from '../../scripts/checks/check-ruling-cites.mjs';

const rules = {
  rules: [
    {
      id: 'R212',
      cases: [
        { id: 'case-1', date: '2026-10-12' },
        { id: 'case-2', date: '2026-10-13', supersedes: ['case-1'] },
        { id: 'case-4', date: '2026-10-14', supersedes: ['case-1', 'case-2'] },
      ],
    },
  ],
};
const ownerRulings = {
  rulings: [
    { id: 'old-custody', date: '2026-10-10' },
    { id: 'current-custody', date: '2026-10-15', supersedes: ['old-custody'] },
  ],
};
const catalogs = { rules, ownerRulings };
const findingsFor = (text, file = 'docs/guide.md', metadata = catalogs) =>
  rulingCiteFindings({ [file]: text }, metadata);
const tempBase = fs.realpathSync(os.tmpdir());
const tempPrefix = 'A10-ruling-spec-';

function fixtureTree(files, edition = 'lite', includeCatalogs = true) {
  const root = fs.mkdtempSync(path.join(tempBase, tempPrefix));
  const defaults = {
    'hfs.json': JSON.stringify({ edition }),
    ...(includeCatalogs
      ? {
          'knowledge/hfs/rules.yaml': JSON.stringify(rules),
          'modules/kernel/owner-rulings.yaml': JSON.stringify(ownerRulings),
        }
      : {}),
  };
  for (const [rel, body] of Object.entries({ ...defaults, ...files })) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }
  const init = spawnSync('git', ['init', '--quiet'], { cwd: root, encoding: 'utf8' });
  assert.equal(init.status, 0, init.stdout + init.stderr);
  return root;
}

function removeFixture(root) {
  assert.equal(path.dirname(root), tempBase);
  assert.ok(path.basename(root).startsWith(tempPrefix), 'remove only the exact fixture root');
  fs.rmSync(root, { recursive: true, force: true });
}

for (const edition of ['lite', 'full']) {
  test(`RT_RULING_STALE_CITE: ${edition} refuses a superseded citation in working-tree prose`, () => {
    const root = fixtureTree({ 'docs/guide.md': '# Guide\n\nUse ruling:R212/case-1.\n' }, edition);
    try {
      const staged = spawnSync('git', ['add', '.'], { cwd: root, encoding: 'utf8' });
      assert.equal(staged.status, 0, staged.stdout + staged.stderr);
      fs.writeFileSync(path.join(root, 'docs/guide.md'), '# Guide\n\nUse ruling:R212/case-2.\n');
      fs.writeFileSync(path.join(root, 'docs/untracked.md'), 'R212 case-1 remains the model.\n');
      const report = checkRulingCites(root);
      assert.equal(report.ok, false);
      assert.equal(typeof report.schema, 'string');
      assert.ok(report.filesScanned >= 2);
      assert.deepEqual(
        report.findings.map(({ code, path: file, line }) => [code, file, line]),
        [
          [CODE, 'docs/guide.md', 3],
          [CODE, 'docs/untracked.md', 1],
        ]
      );
      const result = checkRulingCitesMain(['--root', root]);
      assert.equal(result.exitCode, 1);
      assert.match(result.text, /RT_RULING_STALE_CITE/);
      assert.match(result.text, /docs\/guide\.md:3/);
      const json = checkRulingCitesMain(['--root', root, '--json']);
      assert.equal(json.exitCode, 1);
      assert.deepEqual(JSON.parse(json.text), report);
    } finally {
      removeFixture(root);
    }
  });

  test(`RT_RULING_STALE_CITE: ${edition} accepts a superseded citation with its live successor`, () => {
    const root = fixtureTree(
      {
        'docs/guide.md': '# Guide\n\nUse ruling:R212/case-4, which replaces ruling:R212/case-1.\n',
        'examples/fixture/README.md': 'R212 case-2 was amended by R212 case-4.\n',
      },
      edition
    );
    try {
      assert.deepEqual(checkRulingCites(root).findings, []);
      const result = checkRulingCitesMain(['--root', root, '--json']);
      assert.equal(result.exitCode, 0);
      assert.equal(JSON.parse(result.text).ok, true);
    } finally {
      removeFixture(root);
    }
  });
}

test('canonical and legacy case citations require a live successor in the same paragraph', () => {
  for (const cite of ['ruling:R212/case-1', 'R212 case-1']) {
    const findings = findingsFor(`Heading\n\n${cite} is the current model.\n`);
    assert.deepEqual(
      findings.map(({ code, path: file, line }) => [code, file, line]),
      [[CODE, 'docs/guide.md', 3]]
    );
    assert.match(findings[0].message, /R212\/case-1/);
    assert.match(findings[0].message, /R212\/case-4/);
    assert.deepEqual(findingsFor(`${cite} was replaced\nby ruling:R212/case-4.\n`), []);
    assert.equal(findingsFor(`${cite} is cited here.\n\nruling:R212/case-4 is elsewhere.\n`).length, 1);
  }
});

test('CRLF wrapping keeps one paragraph and blank comment lines separate paragraphs', () => {
  assert.deepEqual(findingsFor('ruling:R212/case-1 was replaced\r\nby ruling:R212/case-4.\r\n'), []);
  assert.deepEqual(
    findingsFor('// ruling:R212/case-1 was replaced\r\n// by ruling:R212/case-4.\r\n', 'scripts/hfs/sample.mjs'),
    []
  );
  assert.deepEqual(
    findingsFor(
      '// ruling:R212/case-1 applies.\r\n//\r\n// ruling:R212/case-4 is elsewhere.\r\n',
      'scripts/hfs/sample.mjs'
    ).map(({ line }) => line),
    [1]
  );
  assert.deepEqual(
    findingsFor(
      '/*\r\n * ruling:R212/case-1 applies.\r\n *\r\n * ruling:R212/case-4 is elsewhere.\r\n */\r\n',
      'scripts/hfs/sample.mjs'
    ).map(({ line }) => line),
    [2]
  );
});

test('blank separators preserve paragraph boundaries for spaces and marker-only CRLF lines', () => {
  const old = 'ruling:R212/case-1 applies.';
  const successor = 'ruling:R212/case-4 is current.';
  for (const separator of ['   ', '\t \t', '// \t ', '* \t ', '# \t ', '> \t ', '<!-- \t --> \t ']) {
    assert.deepEqual(
      findingsFor(`${old}\r\n${separator}\r\n${successor}\r\n`).map(({ line }) => line),
      [1],
      `separator ${JSON.stringify(separator)} separates paragraphs`
    );
  }
  assert.deepEqual(findingsFor(`${old}\r\n  ${successor}\r\n`), []);
  assert.deepEqual(
    findingsFor(`// ${old}\r\n// \t \r\n// ${successor}\r\n`, 'scripts/hfs/sample.mjs').map(({ line }) => line),
    [1]
  );
});

test('a long whitespace-only separator cannot join citations across paragraphs', () => {
  const separator = ' \t'.repeat(32_768);
  assert.deepEqual(
    findingsFor(`ruling:R212/case-1 applies.\n${separator}\nruling:R212/case-4 is current.\n`).map(({ line }) => line),
    [1]
  );
});

test('empty HTML comments and marker suffix whitespace separate paragraphs in LF and CRLF prose', () => {
  const old = 'ruling:R212/case-1 applies.';
  const successor = 'ruling:R212/case-4 is current.';
  for (const newline of ['\n', '\r\n']) {
    for (const separator of [
      ` \t<!--${newline}\t ${newline}  --> \t`,
      ' \t//\f',
      '\t*\v',
      ' >\f\v',
      ' \t<!--\f\v--> \v',
    ]) {
      assert.deepEqual(
        findingsFor(`${old}${newline}${separator}${newline} \t${successor}${newline}`).map(({ line, kind }) => [line, kind]),
        [[1, 'superseded']],
        `separator ${JSON.stringify(separator)} with ${JSON.stringify(newline)}`
      );
    }
    assert.deepEqual(findingsFor(`${old}${newline} \t${successor}${newline}`), []);
  }
});

test('an intermediate successor that was superseded does not make the paragraph current', () => {
  const findings = findingsFor('ruling:R212/case-1 was replaced by ruling:R212/case-2.\n');
  assert.ok(findings.length > 0);
  assert.ok(findings.every(({ code }) => code === CODE));
  assert.deepEqual(
    findingsFor('ruling:R212/case-1 was replaced by ruling:R212/case-2 and then ruling:R212/case-4.\n'),
    []
  );
});

test('amendedBy and superseded status are honored even without reverse case links', () => {
  const metadata = {
    rules: {
      rules: [
        {
          id: 'R219',
          cases: [
            { id: 'case-1', date: '2026-10-10', amendedBy: 'case-2' },
            { id: 'case-2', date: '2026-10-14' },
            { id: 'case-3', date: '2026-10-09', status: 'superseded' },
          ],
        },
      ],
    },
    ownerRulings: { rulings: [] },
  };
  assert.equal(findingsFor('ruling:R219/case-1 applies.\n', 'docs/guide.md', metadata).length, 1);
  assert.deepEqual(
    findingsFor('ruling:R219/case-1 was amended by ruling:R219/case-2.\n', 'docs/guide.md', metadata),
    []
  );
  assert.equal(findingsFor('ruling:R219/case-3 applies.\n', 'docs/guide.md', metadata).length, 1);
});

test('supersession graphs reject dangling relationships and cycles', () => {
  for (const field of ['supersedes', 'amendedBy']) {
    assert.throws(
      () =>
        buildRulingIndex({
          rules: { rules: [{ id: 'R219', cases: [{ id: 'case-1', [field]: 'case-99' }] }] },
          ownerRulings: { rulings: [] },
        }),
      /no catalog entry/
    );
  }
  assert.throws(
    () =>
      buildRulingIndex({
        rules,
        ownerRulings: {
          rulings: [],
          supersedes: { 'ruling:R212/case-99': ['ruling:R212/case-1'] },
        },
      }),
    /no catalog entry/
  );
  assert.throws(
    () =>
      buildRulingIndex({
        rules: {
          rules: [
            {
              id: 'R219',
              cases: [
                { id: 'case-1', amendedBy: 'case-2' },
                { id: 'case-2', amendedBy: 'case-1' },
              ],
            },
          ],
        },
        ownerRulings: { rulings: [] },
      }),
    /cyclic ruling supersession/
  );
  assert.doesNotThrow(() => buildRulingIndex(catalogs));
});

test('owner catalog supersedes links can amend existing rule cases', () => {
  const metadata = {
    rules: { rules: [{ id: 'R212', cases: rules.rules[0].cases.map(({ id, date }) => ({ id, date })) }] },
    ownerRulings: {
      rulings: [],
      supersedes: {
        'ruling:R212/case-2': ['ruling:R212/case-1'],
        'ruling:R212/case-4': ['ruling:R212/case-1', 'ruling:R212/case-2'],
      },
    },
  };
  assert.equal(findingsFor('R212 case-1 applies.\n', 'docs/guide.md', metadata).length, 1);
  assert.equal(findingsFor('R212 case-2 applies.\n', 'docs/guide.md', metadata).length, 1);
  assert.deepEqual(
    findingsFor('R212 case-1 and R212 case-2 were replaced by R212 case-4.\n', 'docs/guide.md', metadata),
    []
  );
});

test('owner ruling 7 records the R245 clause amendment before and after R289 merges', () => {
  const metadata = {
    rules: { rules: [{ id: 'R245', law: 'Other composition clauses stay in force.' }] },
    ownerRulings: {
      rulings: [],
      supersedes: {
        'ruling:R289': [
          { id: 'ruling:R245', clause: 'parses inline or imports', ownerRuling: 7, date: '2026-10-14' },
        ],
      },
    },
  };
  assert.equal(buildRulingIndex(metadata).get('R289').external, true);
  assert.deepEqual(
    findingsFor('ruling:R245 was amended by ruling:R289 (owner ruling 2026-10-14).', 'docs/guide.md', metadata),
    []
  );
  assert.deepEqual(
    findingsFor('ruling:R245 applies.', 'docs/guide.md', metadata).map(({ kind, ruling }) => [kind, ruling]),
    [['superseded', 'R245']]
  );
  for (const evidence of [
    'ruling:R245',
    { id: 'ruling:R245', ownerRuling: 7, date: '2026-10-14' },
    { id: 'ruling:R245', clause: 'parses inline or imports', date: '2026-10-14' },
    { id: 'ruling:R245', clause: 'parses inline or imports', ownerRuling: 7 },
  ]) {
    assert.throws(
      () => buildRulingIndex({ ...metadata, ownerRulings: { rulings: [], supersedes: { 'ruling:R289': [evidence] } } }),
      /no catalog entry/
    );
  }
  metadata.rules.rules[0].amendedBy = 'R289';
  assert.deepEqual(findingsFor('ruling:R245 was amended by ruling:R289.', 'docs/guide.md', metadata), []);
  metadata.rules.rules.push({ id: 'R289', law: 'Typed env parsing is required.', amendedBy: 'R290' }, { id: 'R290' });
  assert.equal(buildRulingIndex(metadata).get('R289').external, undefined);
  assert.equal(findingsFor('ruling:R245 was amended by ruling:R289.', 'docs/guide.md', metadata).length, 2);
  assert.deepEqual(findingsFor('ruling:R245 was amended by ruling:R289 then ruling:R290.', 'docs/guide.md', metadata), []);
});

test('owner id citations resolve both supported spellings and require their successor', () => {
  for (const cite of ['owner:old-custody', 'ruling:old-custody']) {
    const findings = findingsFor(`${cite} applies.\n`);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /current-custody/);
    assert.deepEqual(findingsFor(`${cite} was replaced by owner:current-custody.\n`), []);
  }
});

test('a bare owner date must match a live case or owner ruling, or cite its live successor', () => {
  assert.equal(findingsFor('Use owner ruling 2099-01-01.\n').length, 1);
  assert.equal(findingsFor('Use owner ruling 2026-10-12.\n').length, 1);
  assert.deepEqual(findingsFor('Owner ruling 2026-10-12 was replaced by owner ruling 2026-10-14.\n'), []);
  assert.deepEqual(findingsFor('Use owner ruling 2026-10-14 and owner ruling 2026-10-15.\n'), []);
});

test('explicit rule and case citations must resolve in the catalog', () => {
  assert.equal(findingsFor('Use ruling:R999/case-1.\n').length, 1);
  assert.equal(findingsFor('Use ruling:R212/case-99.\n').length, 1);
  assert.deepEqual(findingsFor('Use ruling:R212/case-4.\n'), []);
});

test('staleWhen expressions fail independently of citations while current prose passes', () => {
  const metadata = {
    rules: {
      rules: [
        {
          id: 'R217',
          cases: [
            {
              id: 'case-1',
              date: '2026-10-14',
              staleWhen: [String.raw`Supabase\s+Realtime`, String.raw`\bkeys\.txt\b`],
            },
          ],
        },
      ],
    },
    ownerRulings: { rulings: [] },
  };
  const findings = findingsFor(
    'Current model.\nUse Supabase Realtime for data.\nKeep the key in keys.txt.\n',
    'knowledge/patterns/data.yaml',
    metadata
  );
  assert.deepEqual(
    findings.map(({ code, line }) => [code, line]),
    [
      [CODE, 2],
      [CODE, 3],
    ]
  );
  assert.deepEqual(
    findingsFor('Use the back end for data and secret.env for key custody.\n', 'docs/guide.md', metadata),
    []
  );
});

// These seed fixtures exercise the patterns Z01 will backfill; this batch does not edit existing cases.
const deltaSeeds = [
  'platform scheduler of the host',
  'parses inline or imports',
  String.raw`\bx-locale\b`,
  String.raw`^([ \t]*)liteAdapter:[^\r\n]*(?:\r?\n\1[ \t]+[^\r\n]*)*?owner ruling 2026-10-12, R212 case-1\b`,
];
for (const edition of ['lite', 'full']) {
  test(`RT_RULING_STALE_CITE: ${edition} refuses delta seed statements and accepts their replacements`, () => {
    const seedRules = { rules: [...rules.rules, { id: 'R274', staleWhen: deltaSeeds }] };
    const root = fixtureTree(
      {
        'knowledge/hfs/rules.yaml': JSON.stringify(seedRules),
        'knowledge/patterns/be/background.yaml': 'summary: Use the platform scheduler of the host.\n',
        'docs/composition.md': 'main.ts parses inline or imports the env helper.\n',
        'knowledge/patterns/be/jobs.yaml': 'liteAdapter:\n  summary: owner ruling 2026-10-12, R212 case-1\n',
        'packages/hfs/templates/served.ts.tpl': "export const localeHeader = 'x-locale';\n",
        'CHANGELOG.md': 'x-locale; parses inline or imports; platform scheduler of the host.\n',
      },
      edition
    );
    try {
      const report = checkRulingCites(root);
      assert.equal(report.ok, false);
      assert.deepEqual(
        report.findings.filter(({ kind }) => kind === 'staleWhen').map(({ path: file }) => file),
        [
          'docs/composition.md',
          'knowledge/patterns/be/background.yaml',
          'knowledge/patterns/be/jobs.yaml',
          'packages/hfs/templates/served.ts.tpl',
        ]
      );
      for (const [rel, body] of Object.entries({
        'knowledge/patterns/be/background.yaml': 'summary: Use an app-owned scheduler.\n',
        'docs/composition.md': 'main.ts calls readAppEnv from app.env.ts.\n',
        'knowledge/patterns/be/jobs.yaml': 'liteAdapter:\n  summary: ruling:R212/case-4\n',
        'packages/hfs/templates/served.ts.tpl': "export const localeHeader = 'Accept-Language';\n",
      })) fs.writeFileSync(path.join(root, rel), body);
      assert.deepEqual(checkRulingCites(root).findings, []);
    } finally {
      removeFixture(root);
    }
  });
}

test('the liteAdapter seed is confined to its indented block', () => {
  const metadata = { ...catalogs, rules: { rules: [...rules.rules, { id: 'R274', staleWhen: [deltaSeeds[3]] }] } };
  const hits = (body) => findingsFor(body, 'knowledge/patterns/be/jobs.yaml', metadata)
    .filter(({ kind }) => kind === 'staleWhen');
  assert.equal(hits('liteAdapter:\n  summary: >-\n    owner ruling 2026-10-12, R212 case-1\n').length, 1);
  assert.equal(hits('  liteAdapter:\r\n    summary: owner ruling 2026-10-12, R212 case-1\r\n').length, 1);
  assert.deepEqual(hits('liteAdapter:\n  summary: Current model.\nother:\n  summary: owner ruling 2026-10-12, R212 case-1\n'), []);
});

test('retired source syntax is scanned while spec fixture strings stay exempt', () => {
  const metadata = {
    ...catalogs,
    rules: { rules: [...rules.rules, { id: 'R274', staleWhen: [String.raw`\bretired-header\b`] }] },
  };
  assert.equal(findingsFor("export const header = 'retired-header';", 'packages/hfs/header.ts', metadata).length, 1);
  assert.deepEqual(findingsFor("const fixture = 'retired-header';", 'tests/hfs/header.spec.mjs', metadata), []);
  assert.equal(
    findingsFor("test('retired-header is the current header', () => {});", 'tests/hfs/header.spec.mjs', metadata).length,
    1
  );
});

test('catalog case text and changelogs preserve historical citations and stale expressions', () => {
  const metadata = {
    rules: {
      rules: [
        {
          id: 'R212',
          cases: [
            { id: 'case-1', date: '2026-10-12', text: 'Supabase Realtime', staleWhen: [String.raw`Supabase\s+Realtime`] },
            { id: 'case-4', date: '2026-10-14', supersedes: ['case-1'] },
          ],
        },
      ],
    },
    ownerRulings,
  };
  assert.deepEqual(
    rulingCiteFindings(
      {
        'knowledge/hfs/rules.yaml': JSON.stringify(metadata.rules),
        'modules/kernel/owner-rulings.yaml': JSON.stringify(ownerRulings),
        'CHANGELOG.md': 'ruling:R212/case-1 used Supabase Realtime.\n',
        'packages/hfs/CHANGELOG-alpha.md': 'R212 case-1 used Supabase Realtime.\n',
      },
      metadata
    ),
    []
  );
});

test('a live catalog law remains subject to staleWhen while the historical case body is exempt', () => {
  const metadata = {
    rules: {
      rules: [
        {
          id: 'R217',
          law: 'Use Supabase Realtime.',
          cases: [
            {
              id: 'case-1',
              date: '2026-10-14',
              text: 'Supabase Realtime was once the data door.',
              staleWhen: [String.raw`Supabase\s+Realtime`],
            },
          ],
        },
      ],
    },
    ownerRulings: { rulings: [] },
  };
  const source = [
    'rules:',
    '  - id: R217',
    '    law: Use Supabase Realtime.',
    '    cases:',
    '      - id: case-1',
    '        date: 2026-10-14',
    '        text: Supabase Realtime was once the data door.',
    String.raw`        staleWhen: ['Supabase\s+Realtime']`,
    '',
  ].join('\n');
  assert.deepEqual(
    findingsFor(source, 'knowledge/hfs/rules.yaml', metadata).map(({ line, kind }) => [line, kind]),
    [[3, 'staleWhen']]
  );
  assert.deepEqual(
    findingsFor(
      source.replace('law: Use Supabase Realtime.', 'law: Use the back end.'),
      'knowledge/hfs/rules.yaml',
      metadata
    ),
    []
  );
});

test('a cases-first YAML rule masks its history without masking sibling laws', () => {
  const source = [
    'rules:',
    '  - cases:',
    '      - id: case-1',
    '        date: 2026-10-14',
    '        ruling: Supabase Realtime was historical.',
    '        staleWhen: [Supabase Realtime]',
    '    id: R217',
    '    law: Use Supabase Realtime.',
    '  - id: R218',
    '    law: Use Supabase Realtime.',
    '',
  ].join('\n');
  const metadata = {
    rules: { rules: [{ id: 'R217', cases: [{ id: 'case-1', staleWhen: ['Supabase Realtime'] }] }, { id: 'R218' }] },
    ownerRulings: { rulings: [] },
  };
  assert.deepEqual(
    findingsFor(source, 'knowledge/hfs/rules.yaml', metadata).map(({ line, kind }) => [line, kind]),
    [[8, 'staleWhen'], [10, 'staleWhen']]
  );
});

test('the scan reads docs, knowledge, templates, package comments, hfs comments and example readmes', () => {
  const stale = 'ruling:R212/case-1';
  const files = {
    'docs/guide.md': `${stale}\n`,
    'knowledge/patterns/x.yaml': `note: "${stale}"\n`,
    'templates/app/README.md': `${stale}\n`,
    'packages/hfs/templates/app/skeleton/README.md': `${stale}\n`,
    'packages/hfs/scaffold/sample.mjs': `// ${stale}\nexport const ordinary = '${stale}';\n`,
    'scripts/hfs/rules/sample.mjs': `export const ordinary = '${stale}';\n/* ${stale} */\n`,
    'examples/fixture/README.md': `${stale}\n`,
  };
  assert.deepEqual(
    rulingCiteFindings(files, catalogs)
      .map(({ path: file }) => file)
      .sort(byCodeUnit),
    Object.keys(files).sort(byCodeUnit)
  );
  assert.deepEqual(findingsFor(`export const ordinary = '${stale}';\n`, 'packages/hfs/scaffold/sample.mjs'), []);
});

test('spec titles and source comments are scanned while fixture string data is ignored', () => {
  const source = [
    "const fixture = 'ruling:R212/case-1';",
    "test('ruling:R212/case-1 applies', () => {});",
    '// ruling:R212/case-2 is current.',
    "test('ruling:R212/case-1 was replaced by ruling:R212/case-4', () => {});",
    '',
  ].join('\n');
  assert.deepEqual(
    findingsFor(source, 'tests/hfs/fixture.spec.mjs').map(({ line }) => line),
    [2, 3]
  );
  assert.deepEqual(
    findingsFor(
      "const fixture = 'ruling:R212/case-1';\ntest('a fixture is rejected', () => {});\n",
      'tests/hfs/fixture.spec.mjs'
    ),
    []
  );
});

test('generated copies and secret paths are excluded before filesystem reads', (t) => {
  const excluded = [
    'packages/hfs/runtime/docs/guide.md',
    'knowledge/secrets/custody.yaml',
    'packages/hfs/.secrets/custody.yaml',
    'packages/hfs/dist/guide.md',
    'scripts/hfs/secret.env',
    '.starcistacks/production/secrets/custody.enc',
  ];
  const files = Object.fromEntries(excluded.map((rel) => [rel, 'ruling:R212/case-1\n']));
  files['knowledge/hfs/runtime-slots.yaml'] = JSON.stringify({
    ruleParams: {
      runtime: {
        generated: [{ root: 'packages/hfs/runtime' }],
      },
    },
  });
  const root = fixtureTree(files);
  try {
    const blocked = new Set(excluded.map((rel) => path.join(root, rel)));
    const readFile = fs.readFileSync;
    t.mock.method(fs, 'readFileSync', function (target, ...args) {
      if (typeof target === 'string' && blocked.has(path.resolve(target))) {
        assert.fail(`excluded path was read: ${path.relative(root, target)}`);
      }
      return readFile.call(this, target, ...args);
    });
    assert.deepEqual(checkRulingCites(root).findings, []);
  } finally {
    removeFixture(root);
  }
});

test('unrendered templates preserve original comment and spec-title lines', () => {
  const source = [
    'const @@Name@@ = { value: @@connectionUpper@@_VALUE };',
    '// ruling:R212/case-1 applies.',
    "test('ruling:R212/case-2 applies to @@Name@@', () => {});",
    '',
  ].join('\n');
  assert.deepEqual(
    findingsFor(source, 'packages/hfs/templates/example.spec.ts.tpl').map(({ line }) => line),
    [2, 3]
  );
});

test('separate YAML values cannot supply the successor to another value', () => {
  assert.deepEqual(
    findingsFor('law: ruling:R212/case-1\nnote: ruling:R212/case-4\n', 'knowledge/example.yaml').map(
      ({ line }) => line
    ),
    [1]
  );
  assert.deepEqual(
    findingsFor('law: >-\n  ruling:R212/case-1 was amended\n  by ruling:R212/case-4\n', 'knowledge/example.yaml'),
    []
  );
  assert.deepEqual(
    findingsFor('law: >-\n  ruling:R212/case-1 was amended by\n  ruling:R212/case-4\n', 'knowledge/example.yaml'),
    []
  );
});

test('separate Markdown blocks cannot supply another paragraph with its successor', () => {
  for (const text of [
    '- ruling:R212/case-1 applies.\n- ruling:R212/case-4 applies.\n',
    '1. ruling:R212/case-1 applies.\n2. ruling:R212/case-4 applies.\n',
    'ruling:R212/case-1 applies.\n# ruling:R212/case-4\n',
    '# ruling:R212/case-1\nruling:R212/case-4 applies.\n',
    '| ruling:R212/case-1 | applies |\n| ruling:R212/case-4 | applies |\n',
  ]) {
    assert.deepEqual(findingsFor(text).map(({ line }) => line), [1]);
  }
  assert.deepEqual(findingsFor('- ruling:R212/case-1 was replaced\n  by ruling:R212/case-4.\n'), []);
});

test('malformed canonical case citations cannot fall back to a live whole rule', () => {
  for (const cite of ['ruling:R212/case-missing', 'ruling:R212/case-99junk']) {
    const findings = findingsFor(cite);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /no matching catalog ruling/);
  }
});

test('bad arguments and missing or malformed catalogs are usage errors', () => {
  assert.equal(checkRulingCitesMain(['--nope']).exitCode, 2);
  assert.equal(checkRulingCitesMain(['--root']).exitCode, 2);
  for (const [files, includeCatalogs] of [
    [{ 'docs/guide.md': 'Current prose.\n' }, false],
    [{ 'knowledge/hfs/rules.yaml': 'rules: [\n' }, true],
  ]) {
    const root = fixtureTree(files, 'lite', includeCatalogs);
    try {
      assert.equal(checkRulingCitesMain(['--root', root]).exitCode, 2);
    } finally {
      removeFixture(root);
    }
  }
});
