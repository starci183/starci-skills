function proseBlocks(text) {
  if (typeof text !== 'string') return [];
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (!trimmed) return [];
  return trimmed.split(/\n{2,}/).map(part => part.trim()).filter(Boolean);
}

function caseAction(item) {
  return item.write ?? item.assert ?? item.observe ?? item.render ?? '';
}

function caseTable(cases = []) {
  if (!cases.length) return [];
  const rows = [
    '| Case | When | Write |',
    '| --- | --- | --- |',
    ...cases.map(item => `| ${item.id} | ${singleLine(item.when)} | ${singleLine(caseAction(item))} |`)
  ];
  return [rows.join('\n')];
}

function singleLine(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\n+/g, ' ').trim();
}

function listBlock(label, items) {
  if (!Array.isArray(items) || !items.length) return [];
  return [`${label}: ${items.map(singleLine).join('; ')}`];
}

function topicRulesText(topic) {
  if (Array.isArray(topic.ruleIds) && topic.ruleIds.length) return topic.ruleIds.join(', ');
  if (Array.isArray(topic.rules)) return topic.rules.join(', ');
  if (typeof topic.rules === 'string') return topic.rules;
  return '';
}

/** Project structured knowledge-source YAML into runtime `starci/knowledge@1` plus structured fields. */
export function projectKnowledgeTopic(doc) {
  const sections = [];
  const purposeBlocks = proseBlocks(doc.purpose);
  if (purposeBlocks.length) sections.push({ title: doc.title, blocks: purposeBlocks });

  for (const guide of doc.guidance ?? []) {
    sections.push({
      title: guide.title ? `${guide.id} — ${guide.title}` : guide.id,
      blocks: [...proseBlocks(guide.requirement), ...proseBlocks(guide.rationale ?? '')]
    });
  }

  if (Array.isArray(doc.branches) && doc.branches.length) {
    const rows = [
      '| Branch | Use |',
      '| --- | --- |',
      ...doc.branches.map(branch => `| [${branch.title}](${toPublicLink(branch.path)}) | ${singleLine(branch.use ?? '')} |`)
    ];
    sections.push({ title: 'Knowledge', blocks: rows });
  }

  for (const rule of doc.rules ?? []) {
    const body = rule.requirement ?? rule.governs ?? '';
    const blocks = [
      ...proseBlocks(body),
      ...proseBlocks(rule.rationale ?? ''),
      ...proseBlocks(rule.applicability ?? ''),
      ...listBlock('Required structures', rule.required),
      ...listBlock('Forbidden', rule.forbidden),
      ...caseTable(rule.cases),
      ...listBlock('Automated verification', (rule.verification?.automated ?? []).map(item => typeof item === 'string' ? item : JSON.stringify(item))),
      ...listBlock('Manual verification', (rule.verification?.manual ?? []).map(item => typeof item === 'string' ? item : JSON.stringify(item))),
      ...listBlock('Related examples', rule.relatedExamples),
      ...listBlock('Related rules', rule.relatedRules)
    ].filter(Boolean);
    sections.push({ title: `${rule.id} — ${rule.title}`, blocks });
  }

  if (Array.isArray(doc.topics) && doc.topics.length) {
    const catalogTopics = doc.topics.filter(topic => typeof topic.path === 'string' && typeof topic.title === 'string');
    if (catalogTopics.length) {
      const rows = [
        '| Knowledge | Path | Summary | Rules |',
        '| --- | --- | --- | --- |',
        ...catalogTopics.map(topic => {
          const summary = topic.summary ?? topic.decides ?? topic.question ?? '';
          return `| ${topic.title} | ${toPublicLink(topic.path)} | ${singleLine(summary)} | ${singleLine(topicRulesText(topic))} |`;
        })
      ];
      sections.push({ title: 'Catalog', blocks: [rows.join('\n')] });
    }
  }

  if (doc.provenance?.limitations) {
    sections.push({ title: 'Provenance', blocks: proseBlocks(doc.provenance.limitations) });
  }

  const { schema: _schema, ...rest } = doc;
  return {
    schema: 'starci/knowledge@1',
    ...rest,
    sections
  };
}

function toPublicLink(authoredPath) {
  const normalized = String(authoredPath).replaceAll('\\', '/');
  if (/\/index\.yaml$/i.test(normalized) || /^index\.yaml$/i.test(normalized)) {
    return normalized.replace(/index\.yaml$/i, 'INDEX.json');
  }
  if (normalized.endsWith('.yaml')) return `${normalized.slice(0, -5)}.json`;
  if (normalized.endsWith('.json')) return normalized;
  return `${normalized}.json`;
}

/** Project a code-example catalog into runtime knowledge JSON. */
export function projectCodeExampleCatalog(doc) {
  const rows = [
    '| Example | Path | Summary |',
    '| --- | --- | --- |',
    ...doc.examples.map(example => {
      const summary = example.summary ?? example.title ?? '';
      const link = toPublicLink(example.path.endsWith('.yaml') || example.path.endsWith('.json') || example.path.endsWith('/')
        ? example.path
        : `${example.path}/index.yaml`);
      return `| ${example.title ?? example.id} | ${link} | ${singleLine(summary)} |`;
    })
  ];
  return {
    schema: 'starci/knowledge@1',
    title: doc.title,
    purpose: doc.purpose,
    examples: doc.examples,
    sections: [
      { title: doc.title, blocks: [...proseBlocks(doc.purpose), rows.join('\n')] }
    ]
  };
}

/** Bundle a code-example manifest and file contents into runtime JSON. Never executes example code. */
export function projectCodeExample(doc, fileContents) {
  const blocks = [
    ...proseBlocks(doc.purpose),
    ...listBlock('Related rules', doc.relatedRules),
    ...listBlock('Adapt before reuse', (doc.adapt ?? []).map(item => typeof item === 'string' ? item : Object.entries(item).map(([k, v]) => `${k} ${v}`).join(' '))),
    ...proseBlocks(doc.dependencies?.assumptions ?? ''),
    ...proseBlocks(doc.verification?.limitations ?? ''),
    ...proseBlocks(doc.provenance?.simplifications ?? '')
  ];
  for (const file of doc.files) {
    const body = fileContents[file.path] ?? '';
    const fence = guessFence(file.path);
    blocks.push(`${file.role} (\`${file.path}\`):`);
    blocks.push(`\`\`\`${fence}\n${body.replace(/\r\n/g, '\n').replace(/\n$/, '')}\n\`\`\``);
  }
  return {
    schema: 'starci/knowledge@1',
    id: doc.id,
    title: doc.title,
    purpose: doc.purpose,
    appliesTo: doc.appliesTo,
    relatedRules: doc.relatedRules,
    files: doc.files,
    entrypoint: doc.entrypoint,
    adapt: doc.adapt,
    dependencies: doc.dependencies,
    verification: doc.verification,
    provenance: doc.provenance,
    contents: Object.fromEntries(
      Object.keys(fileContents).sort((a, b) => a.localeCompare(b)).map(key => [key, fileContents[key].replace(/\r\n/g, '\n')])
    ),
    sections: [{ title: doc.title, blocks }]
  };
}

function guessFence(filePath) {
  if (filePath.endsWith('.tsx')) return 'tsx';
  if (filePath.endsWith('.ts')) return 'ts';
  if (filePath.endsWith('.jsx')) return 'jsx';
  if (filePath.endsWith('.js')) return 'js';
  if (filePath.endsWith('.json')) return 'json';
  if (filePath.endsWith('.css')) return 'css';
  return '';
}

/** Pass through already-public `starci/knowledge@1` JSON with stable key order. */
export function projectPassthroughJson(doc) {
  if (!doc || doc.schema !== 'starci/knowledge@1' || typeof doc.title !== 'string' || !Array.isArray(doc.sections)) {
    throw Error('JSON fallback requires schema starci/knowledge@1 with title and sections');
  }
  return doc;
}
