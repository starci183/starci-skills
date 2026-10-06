const usageTail = (verb) => {
  const positional = (verb.positional ?? []).map((entry) => {
    const value = entry.enum?.length ? entry.enum.join('|') : entry.name;
    const rendered = entry.variadic ? `${value}...` : value;
    return entry.required ? `<${rendered}>` : `[${rendered}]`;
  });
  return positional.length ? ` ${positional.join(' ')}` : '';
};

const rows = (entries) => {
  const width = Math.max(0, ...entries.map(([name]) => name.length));
  return entries.map(([name, summary]) => `  ${name.padEnd(width)}  ${summary}`).join('\n');
};

export function topHelp(catalog, version = null) {
  const groups = Object.entries(catalog.groups ?? {}).map(([name, group]) => [name, group.summary ?? '']);
  const options = (catalog.global ?? []).map((flag) => [`--${flag.name}${flag.type === 'boolean' ? '' : ` <${flag.name}>`}`, flag.summary ?? '']);
  const explainUsage = (catalog.commands ?? []).includes('explain') ? ['       starci explain <group> <verb>'] : [];
  return [
    `starci${version ? ` ${version}` : ''} - one CLI for apps and the StarCi runtime`,
    '',
    'Usage: starci <group> <verb> [options]',
    '       starci help',
    '       starci completion <bash|zsh|fish|powershell>',
    ...explainUsage,
    '',
    'Groups:',
    rows(groups),
    '',
    'Global options:',
    rows(options),
    '',
  ].join('\n');
}

export function groupHelp(catalog, groupName) {
  const group = catalog.groups?.[groupName];
  if (!group) return null;
  const verbs = Object.entries(group.verbs ?? {}).map(([name, verb]) => {
    const effect = verb.effect && verb.effect !== 'read' ? `[${verb.effect}] ` : '';
    return [name, `${effect}${verb.summary ?? ''}`];
  });
  return [
    `starci ${groupName} - ${group.summary ?? ''}`,
    '',
    `Usage: starci ${groupName} <verb> [options]`,
    '',
    'Verbs:',
    rows(verbs),
    '',
  ].join('\n');
}

export function verbHelp(catalog, groupName, verbName) {
  const verb = catalog.groups?.[groupName]?.verbs?.[verbName];
  if (!verb) return null;
  const local = (verb.flags ?? []).map((flag) => {
    const value = flag.type === 'boolean' ? '' : flag.type === 'enum' ? ` <${(flag.enum ?? []).join('|')}>` : ` <${flag.name}>`;
    const required = flag.required ? ' (required)' : '';
    return [`--${flag.name}${value}`, `${flag.summary ?? ''}${required}`];
  });
  const exits = Object.entries(verb.exit ?? {}).map(([code, summary]) => [code, summary]);
  return [
    `starci ${groupName} ${verbName} - ${verb.summary ?? ''}`,
    '',
    `Usage: starci ${groupName} ${verbName}${usageTail(verb)} [options]`,
    ...(local.length ? ['', 'Options:', rows(local)] : []),
    ...(verb.effect ? ['', `Effect: ${verb.effect}`] : []),
    ...(verb.roles?.length ? [`Roles: ${verb.roles.join(', ')}`] : []),
    ...(verb.conventions?.length ? ['', 'Conventions:', ...verb.conventions.map((line) => `  - ${line}`)] : []),
    ...(exits.length ? ['', 'Exit codes:', rows(exits)] : []),
    ...(verb.json ? ['', `JSON: ${verb.json}`] : []),
    ...((verb.examples ?? []).length ? ['', 'Examples:', ...(verb.examples ?? []).map((example) => `  ${example}`)] : []),
    '',
  ].join('\n');
}

/** Full verb help for a catalogued verb; null when the verb is unknown. */
export function explainHelp(catalog, groupName, verbName) {
  return verbHelp(catalog, groupName, verbName);
}
