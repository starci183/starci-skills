import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {inspectLintResults} from '../scripts/check-scoped-lint.mjs';

const file=path.resolve('owned.ts');
test('lint integrity accepts an exact unsuppressed clean result',()=>{
  assert.deepEqual(inspectLintResults([file],[{filePath:file,messages:[],suppressedMessages:[]}]),[]);
});
test('lint integrity rejects suppressed violations even when ordinary messages are empty',()=>{
  assert.equal(inspectLintResults([file],[{filePath:file,messages:[],suppressedMessages:[{ruleId:'canon/rule'}]}])[0].code,'SUPPRESSED_MESSAGE');
});
test('lint integrity rejects warning, fatal, missing, duplicate and unrelated results',()=>{
  for(const message of [{severity:1},{severity:2},{fatal:true}]) assert.equal(inspectLintResults([file],[{filePath:file,messages:[message]}])[0].code,'LINT_MESSAGE');
  assert.equal(inspectLintResults([file],[])[0].code,'MISSING_RESULT');
  assert.ok(inspectLintResults([file],[{filePath:file},{filePath:file}]).some(i=>i.code==='DUPLICATE_RESULT'));
  assert.ok(inspectLintResults([file],[{filePath:path.resolve('other.ts')}]).some(i=>i.code==='UNEXPECTED_FILE'));
});
