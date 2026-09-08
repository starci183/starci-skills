import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateAgainst } from './json-schema.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const contract = root => JSON.parse(readFileSync(path.join(root, 'templates/kinds/goal-discovery.schema.json'), 'utf8')).properties.architecture;

// Discovery citations describe the reading, not accepted implementation or delivery proof.
export function architectureErrors(discovery, root = ROOT) {
  if (discovery?.architecture === undefined) return [];
  const graph = discovery.architecture;
  const errors = validateAgainst(contract(root), graph, 'mission.discovery.architecture');
  if (errors.length) return errors;
  const ids = new Set(graph.nodes.map(node => node.id));
  const roles = new Set(discovery.repositories?.map(repo => repo.role));
  const evidence = new Set(discovery.impacts?.flatMap(impact => impact.evidence ?? []));
  if (ids.size !== graph.nodes.length) errors.push('architecture: node ids must be unique');
  for (const node of graph.nodes) {
    if (node.role !== null && !roles.has(node.role)) errors.push(`architecture ${node.id}: unknown repository role`);
    if (node.status === 'discovered' && (!node.owner?.trim() || (node.kind !== 'external' && node.role === null))) errors.push(`architecture ${node.id}: discovered ownership must be identified`);
  }
  for (const edge of graph.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) errors.push('architecture: edge endpoint must name a declared node');
  }
  for (const item of [...graph.nodes, ...graph.edges]) {
    if (item.status === 'discovered' && !item.evidence.length) errors.push('architecture: discovered statements require discovery evidence');
    for (const ref of item.evidence) if (!evidence.has(ref)) errors.push('architecture: citation must belong to reviewed impact evidence');
  }
  return errors;
}

// Only generated identifiers and fixed Mermaid syntax enter the graph. User content is a label.
const label = value => String(value).replace(/[\r\n]+/g, ' ').replace(/[^\p{L}\p{N} .,:/_-]/gu, char => `#${char.codePointAt(0)};`);
const markdown = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[|`\[\]\\]/g, char => `&#${char.charCodeAt(0)};`).replace(/[\r\n]+/g, ' ');

export function renderArchitecture(discovery, language = 'en') {
  const errors = architectureErrors(discovery);
  if (errors.length) throw Error(errors.join('\n'));
  const vi = language === 'vi';
  if (!discovery?.architecture) return vi
    ? 'Kiến trúc: chưa xác định — cần khảo sát chủ sở hữu UI/API/dịch vụ/dữ liệu và phụ thuộc ngoài.'
    : 'Architecture: unresolved — UI/API/service/data owners and external dependencies need discovery.';
  const names = vi
    ? {ui:'Giao diện',api:'API',service:'Dịch vụ',data:'Dữ liệu',external:'Phụ thuộc ngoài',discovered:'Đã khảo sát',proposed:'Đề xuất',unverified:'Chưa kiểm chứng',owner:'Chủ sở hữu',unknown:'Chưa xác định'}
    : {ui:'UI',api:'API',service:'Service',data:'Data',external:'External dependency',discovered:'Discovered',proposed:'Proposed',unverified:'Unverified',owner:'Owner',unknown:'Not established'};
  const graph = discovery.architecture;
  const ids = new Map(graph.nodes.map((node, index) => [node.id, `n${index}`]));
  const refs = [...new Set([...graph.nodes, ...graph.edges].flatMap(item => item.evidence))];
  const citations = item => item.evidence.length ? ` [${item.evidence.map(ref => refs.indexOf(ref) + 1).join(', ')}]` : '';
  const lines = graph.nodes.map(node => `  ${ids.get(node.id)}["${label(`${names[node.kind]}: ${node.label} | ${names.owner}: ${node.owner ?? names.unknown}${node.role ? ` (${node.role})` : ''} | ${names[node.status]}${citations(node)}`)}"]`);
  for (const edge of graph.edges) lines.push(`  ${ids.get(edge.from)} ${edge.status === 'discovered' ? '-->' : '-.->'}|"${label(`${edge.label} | ${names[edge.status]}${citations(edge)}`)}"| ${ids.get(edge.to)}`);
  return [
    vi ? 'Kiến trúc — bản khảo sát, không phải bằng chứng triển khai' : 'Architecture — discovery sketch, not implementation proof',
    '', '```mermaid', 'flowchart LR', ...lines, '```', '',
    vi ? 'Nét liền: đã khảo sát, có trích dẫn. Nét đứt: đề xuất/chưa kiểm chứng. Quan hệ còn thiếu: chưa xác định.' : 'Solid: cited discovery. Dashed: proposed/unverified. Missing relationships: unresolved.',
    ...refs.map((ref, index) => `${index + 1}. ${markdown(ref)}`),
  ].join('\n');
}
