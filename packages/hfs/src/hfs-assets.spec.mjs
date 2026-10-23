// proves: HFS_ASSET_OVERSIZE@lite HFS_ASSET_OVERSIZE@full HFS_ASSET_KIND@lite HFS_ASSET_KIND@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assetsFindings, DEFAULT_ASSET_BYTES } from '../runtime/scripts/hfs/rules/assets.mjs';

const tree = (t, files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-assets-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), typeof content === 'number' ? Buffer.alloc(content) : content);
  }
  return dir;
};
const judge = (t, edition, files, extra = {}) => assetsFindings({ repoRoot: tree(t, files), files: Object.keys(files), repo: { profile: 'be', edition }, ...extra });
const forCode = (findings, code) => findings.filter((finding) => finding.code === code);

for (const edition of ['lite', 'full']) {
  test(`HFS_ASSET_OVERSIZE ${edition}: a binary one byte over the default cap is refused; the exact boundary passes`, (t) => {
    const findings = judge(t, edition, { 'src/assets/fonts/large.ttf': DEFAULT_ASSET_BYTES + 1, 'src/assets/fonts/exact.ttf': DEFAULT_ASSET_BYTES });
    assert.deepEqual(findings.map((finding) => [finding.code, finding.path, finding.bytes, finding.maxBytes]), [
      ['HFS_ASSET_OVERSIZE', 'src/assets/fonts/large.ttf', DEFAULT_ASSET_BYTES + 1, DEFAULT_ASSET_BYTES],
    ]);
    assert.match(findings[0].message, /512000-byte per-file/);
    assert.equal(findings[0].level, 'error');
  });

  test(`HFS_ASSET_OVERSIZE ${edition}: ruleParams.be.assets.bytes and extensions govern other small build-time binaries`, (t) => {
    const findings = judge(t, edition, { 'src/assets/render/over.bin': 17, 'src/assets/render/exact.bin': 16 }, {
      manifest: { ruleParams: { be: { assets: { bytes: 16, extensions: ['bin'] } } } },
    });
    assert.deepEqual(findings.map((finding) => [finding.code, finding.path]), [['HFS_ASSET_OVERSIZE', 'src/assets/render/over.bin']]);
    assert.equal(findings[0].maxBytes, 16);
  });

  test(`HFS_ASSET_KIND ${edition}: ordinary media elsewhere in the back end, music and video are refused`, (t) => {
    const files = { 'src/modules/domain/catalog/photo.PNG': 'image', 'src/tests/fixtures/sample.mp4': 'video', 'docs/demo.mp3': 'audio', 'src/assets/audio/sound.ogg': 'audio' };
    const findings = judge(t, edition, files);
    assert.deepEqual(findings.map((finding) => [finding.code, finding.path]), Object.keys(files).map((file) => ['HFS_ASSET_KIND', file]));
    assert.ok(findings.every((finding) => finding.level === 'error'));
  });

  test(`HFS_ASSET_KIND ${edition}: the build-time allowlist and the per-kind folder are enforced`, (t) => {
    const files = { 'src/assets/fonts/example.json': '{}', 'src/assets/page/template.html': '<p>copy</p>', 'src/assets/font.ttf': 'font', 'src/assets/uploads/user.png': 'user image' };
    assert.deepEqual(judge(t, edition, files).map((finding) => finding.path), Object.keys(files));
  });

  test(`HFS_ASSET_KIND ${edition}: small fonts, watermarks and the declared docs-media formats pass`, (t) => {
    const files = { 'src/assets/fonts/example.ttf': 16, 'src/assets/fonts/nested/example.WOFF2': 16, 'src/assets/watermarks/logo.png': 'image', 'src/assets/watermarks/logo.svg': '<svg/>', 'docs/guides/diagram.png': 'image', 'docs/guides/diagram.svg': '<svg/>', 'docs/guides/diagram.webp': 'image', 'docs/guides/datasets/diagram.png': 'image', 'docs/guides/weights/diagram.svg': '<svg/>', 'docs/guides/checkpoints/diagram.webp': 'image' };
    assert.deepEqual(judge(t, edition, files), []);
  });

  test(`HFS_ASSET_KIND ${edition}: model weights and datasets are refused outside assets, including compressed artifacts`, (t) => {
    const files = { 'src/modules/integrations/ai/model/weights.ONNX': 'model', 'src/modules/integrations/ai/model/model.bin': 'model', 'src/models/resnet.bin': 'model', 'src/modules/integrations/ai/model/resnet.bin.gz': 'model', 'src/models/model.safetensors.gz': 'model', 'src/models/model.gguf.zip': 'model', 'src/models/resnet.keras': 'model', 'src/models/resnet.caffemodel': 'model', 'src/data/samples.parquet.gz': 'dataset', 'src/datasets/rows.csv': 'dataset', 'src/dataset/records.json': '{}', 'src/training-data/rows.tsv': 'dataset', 'docs/guides/datasets/samples.parquet': 'dataset' };
    assert.deepEqual(judge(t, edition, files).map((finding) => [finding.code, finding.path]), Object.keys(files).map((file) => ['HFS_ASSET_KIND', file]));
  });

  test(`HFS_ASSET_KIND ${edition}: clients, dataset capability source, ordinary CSV fixtures and templates remain legal`, (t) => {
    const files = { 'src/modules/integrations/ai/model/response.type.ts': 'export interface Response {}', 'src/modules/integrations/uploads/upload.client.ts': 'export class UploadClient {}', 'src/modules/domain/datasets/dataset.service.ts': 'export class DatasetService {}', 'src/datasets/README.md': 'Document external dataset location.', 'src/tests/fixtures/response.csv': 'id,name\n1,a', 'src/modules/domain/mail/mail.templates.ts': "export const TEMPLATE = '<p>Hello</p>';" };
    assert.deepEqual(judge(t, edition, files), []);
  });

  test(`HFS_ASSET_KIND ${edition}: an extension override cannot permit user media, model weights or datasets`, (t) => {
    const files = { 'src/assets/media/demo.mp4': 'media', 'src/assets/models/demo.onnx': 'model', 'src/assets/data/demo.parquet': 'dataset' };
    const findings = judge(t, edition, files, { manifest: { ruleParams: { be: { assets: { bytes: 64, extensions: ['.mp4', '.onnx', '.parquet'] } } } } });
    assert.deepEqual(findings.map((finding) => finding.code), ['HFS_ASSET_KIND', 'HFS_ASSET_KIND', 'HFS_ASSET_KIND']);
  });

  test(`HFS_ASSET_OVERSIZE HFS_ASSET_KIND ${edition}: only files and inScope paths are judged, without root or FE duplicates`, (t) => {
    const files = { 'src/assets/fonts/large.ttf': DEFAULT_ASSET_BYTES + 1, 'src/media/video.mp4': 'media' };
    const repoRoot = tree(t, files);
    const context = { repoRoot, files: Object.keys(files), repo: { profile: 'be', edition } };
    assert.deepEqual(assetsFindings({ ...context, files: [] }), []);
    assert.deepEqual(assetsFindings({ ...context, inScope: () => false }), []);
    assert.deepEqual(assetsFindings({ ...context, files: ['src/assets/fonts/missing.ttf'], all: Object.keys(files) }), []);
    assert.deepEqual(assetsFindings({ ...context, repo: { profile: 'app', edition }, isRoot: true }), []);
    assert.deepEqual(assetsFindings({ ...context, repo: { profile: 'fe', edition } }), []);
    assert.deepEqual(assetsFindings({ ...context, inScope: (file) => file.endsWith('.mp4') }).map((finding) => finding.code), ['HFS_ASSET_KIND']);
  });
}

test('HFS_ASSET_OVERSIZE: maxBytes and edition overlays are supported; the absent edition means full', (t) => {
  const files = { 'src/assets/fonts/font.ttf': 9 };
  const manifest = { ruleParams: { be: { assets: { maxBytes: 8 }, lite: { assets: { maxBytes: 10 } } } } };
  assert.equal(forCode(judge(t, undefined, files, { manifest }), 'HFS_ASSET_OVERSIZE').length, 1);
  assert.deepEqual(judge(t, 'lite', files, { manifest }), []);
});

test('HFS_ASSET_KIND: backslash paths and uppercase media extensions are normalized', (t) => {
  const findings = assetsFindings({ repoRoot: tree(t, {}), files: ['src\\media\\clip.MP4'], repo: { profile: 'be', edition: 'full' } });
  assert.deepEqual(findings.map((finding) => [finding.code, finding.path]), [['HFS_ASSET_KIND', 'src/media/clip.MP4']]);
});
