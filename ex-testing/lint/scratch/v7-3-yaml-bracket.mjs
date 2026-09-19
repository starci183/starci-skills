// v7-3: does core/yaml.mjs round-trip a bracketed path in a flow mapping, quoted and unquoted?
import {parseYaml} from '../../../core/yaml.mjs';

const cases = {
  unquoted: `owners:\n  - {role: route, path: src/app/[lang]/tasks}\n`,
  quoted: `owners:\n  - {role: route, path: "src/app/[lang]/tasks"}\n`,
  blockStyle: `owners:\n  - role: route\n    path: src/app/[lang]/tasks\n`,
  nested: `owners:\n  - {role: route, path: src/app/[lang]/tasks/[taskId]/share}\n`,
};

for (const [name, src] of Object.entries(cases)) {
  try {
    const parsed = parseYaml(src);
    console.log(`${name}: ${JSON.stringify(parsed)}`);
  } catch (e) {
    console.log(`${name}: THREW ${e.message}`);
  }
}
