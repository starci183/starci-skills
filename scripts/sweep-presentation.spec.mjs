// Proves sweep-presentation.mjs against the four defects it exists to catch, using the four shapes one
// application round actually shipped, plus a clean surface that must stay silent.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { sweepCheckout, loadScales, loadGrammarObjects, utilityOf, offScaleReason, isShellUnit } from './sweep-presentation.mjs';

function checkout(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'sweep-presentation-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}
const codesAt = (findings, file) => findings.filter((f) => f.file === file).map((f) => f.code);
const run = (files, writeSet) => {
  const dir = checkout(files);
  try { return sweepCheckout(dir, writeSet ?? Object.keys(files)); } finally { rmSync(dir, { recursive: true, force: true }); }
};

// A page: a layout stack layered onto SectionHeader, whose CSS already owns the
// collapse through a container query.
const OVERVIEW_CLASSNAMES = `import { cn } from "@heroui/react";
export const OVERVIEW_HEADER_CLASS_NAME = cn("flex-col", "items-start", "sm:flex-row", "sm:items-end", "sm:justify-between");
`;
const OVERVIEW_COMPONENT = `import { PageContainer, SectionHeader } from "@starci/grammar/core";
import { OVERVIEW_HEADER_CLASS_NAME } from "./classNames";
export const OverviewPageBase = (props: OverviewPageProps) => <PageContainer measure="product">
  <SectionHeader level={1} title={props.title} className={OVERVIEW_HEADER_CLASS_NAME} />
</PageContainer>;
`;

// A leaf: a field repaint pushed into a control through className, with two arbitrary values
// and a vendor radius utility that is not a ramp step.
const PRESSABLE = `import { Button } from "@starci/grammar/core";
export const PressableInputLike = (props: PressableInputLikeProps) => <Button
  variant="outline"
  className="h-9 min-h-9 w-64 justify-between gap-2 rounded-field border-[var(--field-border)] shadow-[var(--field-shadow)]">
  {props.props.placeholder}
</Button>;
`;

// A radius defect: a Tailwind 3 plugin name the compiled stylesheet emits no rule for.
const DRAWER = `export const DrawerBranch = () => <div className="min-h-10 rounded-large px-3">
  <span className="rounded-large">x</span>
</div>;
`;

// A product top bar: a band built out of divs, composing no Grammar shell object.
const TOP_BAR_CLASSNAMES = `import { cn } from "@heroui/react";
export const CONSOLE_TOP_BAR_CLASS_NAME = cn(
  "flex",
  "min-w-0",
  "items-center",
  "justify-between",
  "gap-3",
);
export const CONSOLE_TOP_BAR_IDENTITY_CLASS_NAME = cn("flex", "min-w-0", "items-center", "gap-3");
`;
const TOP_BAR_COMPONENT = `import { Text } from "@starci/grammar/core";
import { CONSOLE_TOP_BAR_CLASS_NAME } from "./classNames";
export const ConsoleTopBarBase = (props: ConsoleTopBarProps) => <div className={CONSOLE_TOP_BAR_CLASS_NAME}>
  <Text size="sm">{props.brandLabel}</Text>
</div>;
`;

// The same shell done the way the laws describe: the band is composed, and the classes arrange the
// application's own content inside a slot the composed renderer owns.
const SHELL_LAYOUT = `import { WorkspaceShell } from "@starci/grammar/core";
export const LearnShellLayoutBase = (props: LearnShellLayoutProps) => <WorkspaceShell
  navigationTrack="fixed"
  header={props.header}
  primary={props.children}
/>;
`;

// A page that writes nothing Grammar owns and stays on every closed scale.
const CLEAN_PAGE = `import { SurfaceCard, Text } from "@starci/grammar/common";
export const CleanPageBase = (props: CleanPageProps) => <section className="flex flex-col gap-6 p-4">
  <div className="rounded-2xl border border-separator p-4">
    <SurfaceCard depth="top"><Text size="sm">{props.label}</Text></SurfaceCard>
  </div>
</section>;
`;

test('the closed lists are read out of the knowledge tree, not typed here', () => {
  const scales = loadScales();
  assert.ok(scales.gap.has('6'), 'GAP-5 publishes gap-6');
  assert.ok(!scales.gap.has('5'), 'gap-5 is not on COMMON_SPACING_SCALE');
  assert.ok(scales.radius.has('2xl') && !scales.radius.has('large'));
  assert.ok(scales.maxWidth.has('3xl'));
  const { objects, geometryOwners, shellObjects } = loadGrammarObjects();
  for (const n of ['Button', 'Input', 'Card', 'SurfaceCard', 'SurfaceAccordionCard', 'SurfaceListCard', 'Badge', 'Heading', 'Text']) {
    assert.ok(objects.has(n), `${n} is a Grammar object the sweep knows`);
  }
  for (const n of ['SectionHeader', 'Rail', 'PrimaryRailLayout', 'PageContainer', 'StaticStateRow', 'HorizontalScrollRegion', 'VerticalScrollRegion']) {
    assert.ok(geometryOwners.has(n), `${n} already owns its geometry`);
  }
  for (const n of ['NavigationFeatureNav', 'WorkspaceShell', 'Sidebar', 'Rail', 'PageContainer']) {
    assert.ok(shellObjects.has(n), `${n} is a Grammar shell object a product shell may compose`);
  }
});

test('a variant is not a value: only the utility answers to a scale', () => {
  const scales = loadScales();
  assert.equal(utilityOf('data-[hovered=true]:bg-default'), 'bg-default');
  assert.equal(utilityOf('sm:flex-row'), 'flex-row');
  assert.equal(offScaleReason('data-[focus-visible=true]:ring-2', scales), null);
  assert.equal(offScaleReason('gap-6', scales), null);
  assert.equal(offScaleReason('m-auto', scales), null, 'MARGIN-AUTO is published beside the scale');
  assert.ok(offScaleReason('gap-5', scales));
  assert.ok(offScaleReason('p-[13px]', scales));
});

test('a layout stack on a Grammar object that owns its geometry is APP_REIMPLEMENTATION', () => {
  const { findings } = run({
    'src/components/pages/OverviewPage/classNames.ts': OVERVIEW_CLASSNAMES,
    'src/components/pages/OverviewPage/component.tsx': OVERVIEW_COMPONENT,
  });
  const hit = findings.find((f) => f.code === 'APP_REIMPLEMENTATION');
  assert.ok(hit, `expected APP_REIMPLEMENTATION, got ${JSON.stringify(findings)}`);
  assert.equal(hit.object, 'SectionHeader');
  assert.equal(hit.file, 'src/components/pages/OverviewPage/component.tsx');
  assert.equal(hit.line, 4);
  assert.ok(hit.token.includes('flex-col') && hit.token.includes('sm:justify-between'));
});

test('a className reaching into a Grammar object is APP_OVERRIDE, with its off-scale values named', () => {
  const { findings } = run({ 'packages/ui/src/leaves/PressableInputLike/index.tsx': PRESSABLE });
  const codes = codesAt(findings, 'packages/ui/src/leaves/PressableInputLike/index.tsx');
  assert.ok(codes.includes('APP_OVERRIDE'), `expected APP_OVERRIDE, got ${JSON.stringify(findings)}`);
  const over = findings.find((f) => f.code === 'APP_OVERRIDE');
  assert.equal(over.object, 'Button');
  const offScale = findings.filter((f) => f.code === 'OFF_SCALE').map((f) => f.token).sort();
  assert.deepEqual(offScale, ['border-[var(--field-border)]', 'rounded-field', 'shadow-[var(--field-shadow)]']);
});

test('a Tailwind 3 radius name that emits no CSS is OFF_SCALE at every occurrence', () => {
  const { findings } = run({ 'packages/ui/src/branches/DrawerBranch/index.tsx': DRAWER });
  const large = findings.filter((f) => f.token === 'rounded-large');
  assert.equal(large.length, 2);
  assert.deepEqual(large.map((f) => f.line), [1, 2]);
  assert.ok(large[0].statement.includes('renders square'));
});

test('a product shell that composes no Grammar shell object is SHELL_GEOMETRY', () => {
  const { findings } = run({
    'src/components/product-shells/ConsoleTopBar/classNames.ts': TOP_BAR_CLASSNAMES,
    'src/components/product-shells/ConsoleTopBar/component.tsx': TOP_BAR_COMPONENT,
  });
  const shell = findings.filter((f) => f.code === 'SHELL_GEOMETRY');
  assert.ok(shell.length >= 4, `expected SHELL_GEOMETRY, got ${JSON.stringify(findings)}`);
  assert.ok(shell.every((f) => f.file.endsWith('classNames.ts')));
  assert.deepEqual(shell.map((f) => f.token).sort(), ['flex', 'flex', 'gap-3', 'items-center', 'justify-between']);
});

test('a shell that composes WorkspaceShell is not a finding', () => {
  const { findings } = run({ 'src/components/product-shells/LearnShellLayout/component.tsx': SHELL_LAYOUT });
  assert.deepEqual(findings, []);
});

// A product shell layout: the application band handed to the page-level hero slot, so the rendered
// page carries two banner landmarks for one band.
const BAND_IN_HEADER = `import { WorkspaceShell } from "@starci/grammar/core";
import { ConsoleTopBar } from "../ConsoleTopBar";
export const ConsoleLayoutBase = (props: ConsoleLayoutProps) => <WorkspaceShell
  navigationTrack="fixed"
  header={<ConsoleTopBar />}
  primary={props.children}
/>;
`;

test('the application band inside WorkspaceShell\'s header slot is SHELL_GEOMETRY', () => {
  const { findings } = run({ 'src/components/product-shells/ConsoleLayout/component.tsx': BAND_IN_HEADER });
  assert.equal(findings.length, 1, JSON.stringify(findings));
  assert.equal(findings[0].code, 'SHELL_GEOMETRY');
  assert.equal(findings[0].object, 'WorkspaceShell');
  assert.equal(findings[0].token, 'header={<ConsoleTopBar …>}');
  assert.ok(findings[0].statement.includes('second banner'));
});

test('a clean surface produces nothing', () => {
  const { findings, scanned } = run({ 'src/components/pages/CleanPage/component.tsx': CLEAN_PAGE });
  assert.equal(scanned, 1);
  assert.deepEqual(findings, []);
});

test('the write set is the boundary, and the Grammar package is never the subject', () => {
  const files = {
    'packages/grammar/package.json': JSON.stringify({ name: '@starci/grammar' }),
    'packages/grammar/src/core/branch/Rail/classNames.ts': 'export const railClassName = "flex items-center gap-5 rounded-large"\n',
    'packages/ui/src/branches/DrawerBranch/index.tsx': DRAWER,
    'src/components/pages/CleanPage/component.tsx': CLEAN_PAGE,
  };
  const all = run(files, Object.keys(files).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx')));
  assert.equal(all.findings.filter((f) => f.file.startsWith('packages/grammar/')).length, 0);
  assert.equal(all.scanned, 2);

  const narrowed = run(files, ['src/components/pages/CleanPage/component.tsx']);
  assert.equal(narrowed.scanned, 1);
  assert.deepEqual(narrowed.findings, []);
});

test('a shell unit is recognised by its folder and by its name', () => {
  assert.ok(isShellUnit('src/components/product-shells/ConsoleTopBar/classNames.ts'));
  assert.ok(isShellUnit('apps/app/src/components/product-shells/Sidebar/index.tsx'));
  assert.ok(isShellUnit('src/components/layouts/LearnShellLayout/component.tsx'));
  assert.ok(!isShellUnit('src/components/pages/OverviewPage/component.tsx'));
});
