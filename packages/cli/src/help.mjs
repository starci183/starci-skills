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
  return [
    `starci${version ? ` ${version}` : ''} - one CLI for apps and the StarCi runtime`,
    '',
    'Usage: starci <group> <verb> [options]',
    '       starci help',
    '       starci completion <bash|zsh|fish|powershell>',
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
  const verbs = Object.entries(group.verbs ?? {}).map(([name, verb]) => [name, verb.summary ?? '']);
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
  return [
    `starci ${groupName} ${verbName} - ${verb.summary ?? ''}`,
    '',
    `Usage: starci ${groupName} ${verbName}${usageTail(verb)} [options]`,
    ...(local.length ? ['', 'Options:', rows(local)] : []),
    ...((verb.examples ?? []).length ? ['', 'Examples:', ...(verb.examples ?? []).map((example) => `  ${example}`)] : []),
    '',
  ].join('\n');
}
