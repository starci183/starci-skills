// proves: HFS_MCP_TOOLS_SNAPSHOT@lite
// proves: HFS_MCP_TOOLS_SNAPSHOT@full
// R302 HFS_MCP_TOOLS_SNAPSHOT: a committed MCP tool catalog `contracts/<app>/<contract>.tools.json` has the canonical tools/list
// shape and belongs to a declared be app.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mcpToolsSnapshotFindings } from '../runtime/scripts/hfs/rules/mcp-tools.mjs';

const repo = { profile: 'be', apps: [{ name: 'api', kind: 'api' }, { name: 'mcp', kind: 'api' }] };
const catalog = (overrides = {}) => ({
  contract: 'shop-mcp@1',
  server: { name: 'shop-mcp', version: '1.0.0' },
  tools: [{ name: 'rooms.search', description: 'Search rooms', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } }],
  ...overrides,
});

/** The R302 findings of a be side holding `files` ({ be-relative path: JSON value or raw text }). */
function judge(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-r302-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return mcpToolsSnapshotFindings({ repoRoot: root, files: Object.keys(files), repo });
}

for (const edition of ['lite', 'full']) {
  test(`HFS_MCP_TOOLS_SNAPSHOT ${edition}: a canonical tools/list catalog of a declared app passes`, (t) => {
    assert.deepEqual(judge(t, { 'contracts/mcp/shop-mcp@1.tools.json': catalog(), 'contracts/api/schema.graphql': 'type Query { a: Int }' }), []);
  });

  test(`HFS_MCP_TOOLS_SNAPSHOT ${edition}: a catalog under an undeclared app is a violation`, (t) => {
    const findings = judge(t, { 'contracts/bot/shop-mcp@1.tools.json': catalog() });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, 'HFS_MCP_TOOLS_SNAPSHOT');
    assert.match(findings[0].message, /bot is not declared/);
  });

  test(`HFS_MCP_TOOLS_SNAPSHOT ${edition}: a contract that differs from the file name or the server name is a violation`, (t) => {
    const findings = judge(t, { 'contracts/mcp/shop-mcp@2.tools.json': catalog({ server: { name: 'other', version: '1.0.0' } }) });
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /differs from the file name shop-mcp@2\.tools\.json/);
  });

  test(`HFS_MCP_TOOLS_SNAPSHOT ${edition}: duplicate, undescribed or schema-less tools and unreadable JSON are violations`, (t) => {
    const tools = [
      { name: 'a', description: 'A', inputSchema: { type: 'object' } },
      { name: 'a', description: 'A again', inputSchema: { type: 'object' } },
      { name: 'b', inputSchema: { type: 'string' } },
    ];
    const [shape] = judge(t, { 'contracts/mcp/shop-mcp@1.tools.json': catalog({ tools }) });
    assert.deepEqual(shape.problems, ['tool a is listed twice', 'tool b has no description', 'tool b has no inputSchema of type object']);
    const [broken] = judge(t, { 'contracts/mcp/shop-mcp@1.tools.json': '{ not json' });
    assert.deepEqual(broken.problems, ['is not readable JSON']);
  });
}
