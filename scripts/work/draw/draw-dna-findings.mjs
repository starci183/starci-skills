export function appendDnaFindings({ all, dna, proposals, label, assetRequests, tree, helpers }) {
  const groups = new Map();
  const add = (code, kind, el, why) => {
    const key = `${code}|${kind}`;
    if (!groups.has(key)) groups.set(key, { code, kind, items: [] });
    groups.get(key).items.push(helpers.describe(el) + (why ? ' (' + why + ')' : ''));
  };
  mappingFindings(all, dna, proposals, add, helpers);
  noticeFindings(all, add, helpers);
  ratioFindings(all, add, helpers);
  const rules = helpers.styleRulesOf(tree);
  alertFindings(all, dna, rules, add, helpers);
  meterTrackFindings(all, rules, add, helpers);
  artworkFindings(all, assetRequests, add, helpers);
  badgeDotFindings(all, rules, add, helpers);
  return groupedFindings(groups, label);
}

function mappingFindings(all, dna, proposals, add, h) {
  for (const el of all) mappingFindingFor(el, dna, proposals, add, h);
}

function mappingFindingFor(el, dna, proposals, add, h) {
  if (h.insideSvg(el)) return;
  const name = h.componentNameOf(el);
  const part = (el.attrs[h.PART_ATTR] ?? '').trim();
  const proposal = (el.attrs[h.PROPOSAL_ATTR] ?? '').trim();
  if (!h.mappedSelf(el)) {
    if (!(h.plainPhrasing(el) && el.parent && el.parent.tag !== '#root')) {
      add(h.DRAW_OFF_GRAMMAR_COMPONENT, 'unmapped element', el, 'no data-grammar-component, data-grammar-part or data-grammar-proposal');
    }
    return;
  }
  if (name && !dna.components.has(name)) add(h.DRAW_OFF_GRAMMAR_COMPONENT, 'unknown DNA component', el, `"${name}" is not one of the ${dna.components.size} DNA components`);
  if (proposal && !hasProposal(proposals, proposal)) {
    add(h.DRAW_OFF_GRAMMAR_COMPONENT, 'proposal without an entry', el, `data-grammar-proposal="${proposal}" has no complete entry (name, gap, anatomy, tokens, claims, isolated render) in grammar-proposal.md/.yaml`);
  }
  if (part && !h.proposalOf(el)) addUnknownPartFinding(el, part, dna, add, h);
  const spec = name ? dna.components.get(name) : null;
  if (spec) closedValueFindings(el, name, spec, add, h);
}

function hasProposal(proposals, proposal) {
  if (proposals.has(proposal)) return true;
  if (proposals.has(proposal.split('.')[0])) return true;
  return [...proposals].some((p) => p.toLowerCase() === proposal.toLowerCase());
}

function addUnknownPartFinding(el, part, dna, add, h) {
  const owners = [el, ...h.ancestorsOf(el)].map((a) => h.componentNameOf(a)).filter(Boolean).map((n) => dna.components.get(n)).filter(Boolean);
  const judged = owners.filter((c) => c.parts.size);
  if (judged.length && judged.length === owners.length && !judged.some((c) => c.parts.has(part))) {
    add(h.DRAW_OFF_GRAMMAR_COMPONENT, 'unknown anatomy part', el, `part "${part}" is none of ${[...new Set(judged.map((c) => c.name))].slice(0, 3).join('/')}'s anatomy`);
  }
}

function closedValueFindings(el, name, spec, add, h) {
  for (const [prop, closed] of spec.closed) {
    const raw = el.attrs[`data-${h.kebab(prop)}`] ?? el.attrs[`data-grammar-${h.kebab(prop)}`];
    if (raw == null || raw === '') continue;
    if (!closedValueIsValid(closed, raw, h)) {
      add(h.DRAW_OFF_GRAMMAR_COMPONENT, 'closed value off DNA', el, `${name} ${prop}="${raw}" is not one of ${closed.values ? closed.values.join('|') : 'the PresentationState values'}`);
    }
  }
}

function closedValueIsValid(closed, raw, h) {
  if (closed.values) return closed.values.includes(raw);
  if (closed.type === 'PresentationState') return Boolean(h.presentationStateOf(raw));
  return true;
}

function noticeFindings(all, add, h) {
  for (const el of all.filter((e) => h.componentRootOf(e) === 'Alert')) {
    if (!h.toneOf(el)) add(h.DRAW_NOTICE_NOT_ALERT, 'Alert without a tone', el, 'DNA Alert carries tone (PresentationState): data-tone="warning|success|danger|info|neutral"');
  }
  for (const el of all) noticeFindingFor(el, add, h);
}

function noticeFindingFor(el, add, h) {
  if (h.insideSvg(el)) return;
  const name = h.componentNameOf(el);
  if (h.inComponent(el, ['Alert', 'AlertDialog', 'Toast', 'Toaster'])) return;
  const container = h.CONTAINERS.has(name);
  if (!container && !(!name && ['div', 'section', 'aside', 'article'].includes(el.tag))) return;
  if (h.walkElements(el).some((d) => h.componentRootOf(d) === 'Alert')) return;
  const reasons = noticeReasons(el, name, container, h);
  if (reasons.length) add(h.DRAW_NOTICE_NOT_ALERT, 'notice posing as another component', el, `${reasons.join(', ')}: a notice is DNA Alert with tone + alert-actions, never ${name || 'a hand-built box'}`);
}

function noticeReasons(el, name, container, h) {
  const role = String(el.attrs.role ?? '').toLowerCase();
  const reasons = [];
  if (['alert', 'status', 'alertdialog'].includes(role)) reasons.push(`role=${role}`);
  if (el.attrs['aria-live'] && el.attrs['aria-live'] !== 'off') reasons.push(`aria-live=${el.attrs['aria-live']}`);
  const noticeClass = h.classesOf(el).find((c) => h.NOTICE_CLASS.test(c));
  if (noticeClass) reasons.push(`class ${noticeClass}`);
  const tone = container ? h.toneOf(el) : null;
  if (tone && tone.tone !== 'neutral') reasons.push(`a ${tone.raw}-toned ${name}`);
  if (container) addOutcomeTileReason(el, reasons, h);
  return reasons;
}

function addOutcomeTileReason(el, reasons, h) {
  const tiles = h.walkElements(el).filter((d) => h.componentNameOf(d) === 'IconTile' && h.ancestorsOf(d).find((a) => h.CONTAINERS.has(h.componentNameOf(a))) === el);
  const outcomeTile = tiles.find((t) => h.OUTCOME_STATES.has(h.toneOf(t)?.tone));
  if (outcomeTile && h.walkElements(el).some((d) => h.isAction(d))) reasons.push(`an ${h.toneOf(outcomeTile).raw}-toned IconTile beside an action`);
}

function ratioFindings(all, add, h) {
  for (const el of all) ratioFindingFor(el, add, h);
}

function ratioFindingFor(el, add, h) {
  if (h.insideSvg(el)) return;
  const name = h.componentNameOf(el);
  const role = String(el.attrs.role ?? '').toLowerCase();
  const inMeter = h.inComponent(el, ['Meter']);
  if ((el.tag === 'meter' || role === 'meter') && !inMeter) add(h.DRAW_RATIO_NOT_METER, 'meter outside Meter', el, 'a measured ratio renders through DNA Meter');
  if ((el.tag === 'progress' || role === 'progressbar') && !inMeter && !h.inComponent(el, ['Progress', 'ProgressCircle', 'Slider'])) add(h.DRAW_RATIO_NOT_METER, 'hand-made progress', el, 'a hand-built progress bar; a ratio is DNA Meter');
  if (name === 'Progress' || name === 'ProgressCircle') progressRatioFinding(el, add, h);
  if (!name && !inMeter && !h.inComponent(el, ['Progress', 'ProgressCircle', 'Slider', 'Rating']) && h.classesOf(el).some((c) => h.BAR_CLASS.test(c))) handMadeBarFinding(el, add, h);
  if (h.componentRootOf(el) === 'Meter') meterComponentFindings(el, add, h);
}

function progressRatioFinding(el, add, h) {
  const scope = el.parent ?? el;
  if (h.RATIO_RX.test(h.textOf(scope))) add(h.DRAW_RATIO_NOT_METER, 'ratio as Progress', el, `"${h.RATIO_RX.exec(h.textOf(scope))[0]}" is a ratio: Meter, never Progress`);
}

function handMadeBarFinding(el, add, h) {
  const scope = el.parent?.parent ?? el.parent ?? el;
  if (h.RATIO_RX.test(h.textOf(scope))) add(h.DRAW_RATIO_NOT_METER, 'hand-made bar', el, `a bar beside the ratio "${h.RATIO_RX.exec(h.textOf(scope))[0]}": one DNA Meter`);
}

function meterComponentFindings(el, add, h) {
  // Grammar 0.5.2: a segmented Meter is DNA `Meter segments` - valid when its segments carry the DNA anatomy
  // (meter-segment part, starci-core-meter-segment class or the data-grammar-meter-segment hook); a hand-cut one fails.
  const segments = h.walkElements(el).filter((d) => /segment/i.test(`${d.attrs[h.PART_ATTR] ?? ''} ${h.classesOf(d).join(' ')}`));
  const handCut = segments.filter((d) => !h.dnaSegment(d) && (d.attrs[h.PROPOSAL_ATTR] ?? '').trim() !== h.METER_SEGMENTS_PROPOSAL);
  if (handCut.length) add(h.DRAW_RATIO_NOT_METER, 'hand-segmented Meter', el, 'a segmented Meter is DNA Meter segments (2..12): its segments carry data-grammar-part="meter-segment", never hand-cut bars');
  const meterEl = [el, ...h.walkElements(el)].find((d) => d.tag === 'meter' || String(d.attrs.role ?? '').toLowerCase() === 'meter');
  if (!meterEl) add(h.DRAW_RATIO_NOT_METER, 'Meter without role=meter', el, 'one role=meter (or <meter>) carries the value (DNA claims A11Y-3)');
  else if (meterEl.tag !== 'meter' && (meterEl.attrs['aria-valuenow'] == null || meterEl.attrs['aria-valuemax'] == null)) add(h.DRAW_RATIO_NOT_METER, 'Meter without its value', meterEl, 'role=meter needs aria-valuenow and aria-valuemax');
}

function alertFindings(all, dna, rules, add, h) {
  for (const el of all.filter((e) => h.componentRootOf(e) === 'Alert')) alertFindingFor(el, dna, rules, add, h);
}

function alertFindingFor(el, dna, rules, add, h) {
  const bg = h.declaredBackgroundsOf(el, rules).find((b) => !h.surfaceBackground(b.value));
  if (bg) add(h.DRAW_ALERT_ANATOMY, 'tone-filled Alert', el, `${bg.via} sets background ${bg.value}: the HeroUI Alert is bg-surface (white) with shadow-surface - its tone lives in the indicator glyph and the title, never a fill`);
  const inside = h.walkElements(el).filter((d) => !h.ancestorsOf(d).slice(0, h.ancestorsOf(d).indexOf(el)).some((a) => h.componentRootOf(a) === 'Alert'));
  const tone = h.toneOf(el);
  const wanted = tone ? h.alertActionVariantFor(tone.tone) : null;
  for (const tile of inside.filter((d) => h.componentNameOf(d) === 'IconTile')) add(h.DRAW_ALERT_ANATOMY, 'IconTile in an Alert', tile, 'an Alert carries no IconTile: its indicator is the HeroUI size-4 glyph (alert__indicator)');
  const partOf = (d) => (d.attrs[h.PART_ATTR] ?? '').trim();
  const indicator = inside.find((d) => ['alert-indicator', 'indicator'].includes(partOf(d)));
  const title = inside.find((d) => ['alert-title', 'title', 'alert-content', 'content'].includes(partOf(d)));
  indicatorAndTitleFindings(el, inside, indicator, title, add, h);
  alertActionFindings(inside, tone, wanted, dna, add, h);
}

function indicatorAndTitleFindings(el, inside, indicator, title, add, h) {
  if (indicator) {
    const px = Math.max(h.declaredPx(indicator, 'width') ?? 0, h.declaredPx(indicator, 'height') ?? 0, ...h.walkElements(indicator).map((d) => Math.max(h.declaredPx(d, 'width') ?? 0, h.declaredPx(d, 'height') ?? 0)));
    if (px >= h.ALERT_INDICATOR_MAX_PX) add(h.DRAW_ALERT_ANATOMY, 'Alert indicator as a tile', indicator, `the indicator declares ${px}px: the HeroUI indicator is a size-4 glyph with p-1, under ${h.ALERT_INDICATOR_MAX_PX}px`);
  }
  if (title && !indicator) add(h.DRAW_ALERT_ANATOMY, 'Alert without its indicator', el, 'the HeroUI Alert shows its tone glyph (alert-indicator) on the left of the title');
  if (title && indicator && (inside.indexOf(indicator) > inside.indexOf(title) || h.walkElements(title).includes(indicator))) add(h.DRAW_ALERT_ANATOMY, 'Alert indicator not left of the title', indicator, 'the indicator is the first item of the Alert row, left of the content (title, description)');
}

function alertActionFindings(inside, tone, wanted, dna, add, h) {
  for (const el of inside) {
    const name = h.componentNameOf(el);
    const interactive = el.tag === 'button' || (el.tag === 'a' && el.attrs.href != null) || String(el.attrs.role ?? '').toLowerCase() === 'button';
    if (interactive && !h.ACTION_COMPONENTS.has(name) && !h.inComponent(el, [...h.ACTION_COMPONENTS])) add(h.DRAW_ALERT_ANATOMY, 'hand-made Alert action', el, `an Alert action is the grammar Button (variant="${wanted ?? 'secondary'}" for this tone, as the grammar Alert renders it), never a hand-built control`);
    if (name === 'Button') alertButtonVariantFinding(el, tone, wanted, dna, add, h);
  }
}

function alertButtonVariantFinding(el, tone, wanted, dna, add, h) {
  const allowed = dna.components.get('Button')?.closed.get('variant')?.values;
  const vendor = h.classesOf(el).map((c) => /^button--([a-z-]+)$/.exec(c)?.[1]).find((v) => v && (!allowed || allowed.includes(v)));
  const variant = el.attrs['data-variant'] ?? el.attrs['data-grammar-variant'] ?? vendor;
  const toneWord = tone ? `${tone.raw} (${tone.tone})` : '';
  if (variant != null && allowed && !allowed.includes(variant)) add(h.DRAW_ALERT_ANATOMY, 'Alert action variant off DNA', el, `Button variant="${variant}" is not one of ${allowed.join('|')}; the Alert action is variant="${wanted ?? 'secondary'}"`);
  else if (variant != null && wanted && variant !== wanted) add(h.DRAW_ALERT_ANATOMY, 'Alert action variant off its tone', el, `a ${toneWord} Alert's action is Button variant="${wanted}" (grammar Alert 0.5.3, after HeroUI: informative -> primary, negative -> danger, else secondary), not "${variant}"`);
}

function meterTrackFindings(all, rules, add, h) {
  for (const el of all.filter((e) => h.componentRootOf(e) === 'Meter')) meterTrackFindingFor(el, rules, add, h);
}

function meterTrackFindingFor(el, rules, add, h) {
  const tracks = h.walkElements(el).filter((d) => /(^|-)track$/.test((d.attrs[h.PART_ATTR] ?? '').trim()) || h.classesOf(d).some((c) => /(^|[-_])track$/.test(c)));
  const want = h.segmentedMeter(el) ? h.METER_SEGMENTED_TRACK_PX : h.METER_TRACK_PX;
  for (const track of tracks) {
    const height = h.declaredPx(track, 'height', rules);
    if (height != null && Math.abs(height - want) > 0.5) add(h.DRAW_METER_TRACK, 'Meter track off its height', track, 'the track declares ' + height + 'px: the ' + (want === h.METER_TRACK_PX ? 'HeroUI Meter track is h-2 (' + h.METER_TRACK_PX + 'px)' : 'segmented Meter track is h-1 (' + h.METER_SEGMENTED_TRACK_PX + 'px)'));
  }
  for (const item of [el, ...tracks]) {
    const width = h.declaredPx(item, 'width', rules) ?? h.declaredPx(item, 'max-width', rules);
    if (width != null) add(h.DRAW_METER_TRACK, 'Meter as a stub', item, `a fixed ${width}px width: the Meter track spans the full width of its band (w-full), its segments dividing that width equally`);
  }
}

function artworkFindings(all, assetRequests, add, h) {
  for (const el of all) artworkFindingFor(el, assetRequests, add, h);
}

function artworkFindingFor(el, assetRequests, add, h) {
  if (h.insideSvg(el) || !h.isArtwork(el)) return;
  const slotEl = [el, ...h.ancestorsOf(el)].find((a) => (a.attrs?.[h.ASSET_SLOT_ATTR] ?? '').trim());
  if (!slotEl) {
    add(h.DRAW_ASSET_SLOT_UNDECLARED, 'artwork without an asset slot', el, `mark it ${h.ASSET_SLOT_ATTR}="<id>" (a placeholder is fine) and request it in asset-request.md: interface.asset owes the artwork, never a reused file`);
    return;
  }
  const id = slotEl.attrs[h.ASSET_SLOT_ATTR].trim();
  if (assetRequests && !assetRequests.has(id)) add(h.DRAW_ASSET_SLOT_UNDECLARED, 'asset slot without a request', slotEl, `${h.ASSET_SLOT_ATTR}="${id}" has no entry in the drawing's asset-request.md`);
}

function badgeDotFindings(all, rules, add, h) {
  for (const el of all) badgeDotFindingFor(el, rules, add, h);
}

function badgeDotFindingFor(el, rules, add, h) {
  if (h.insideSvg(el)) return;
  const part = (el.attrs[h.PART_ATTR] ?? '').trim();
  const cls = h.classesOf(el);
  const dotLike = /(^|-)dot$/.test(part) || cls.some((c) => h.DOT_CLASS.test(c));
  if (!dotLike) return;
  const dnaDot = ['badge-dot', 'dot'].includes(part) || cls.includes(h.BADGE_DOT_CLASS);
  const inBadge = h.inComponent(el, ['Badge']);
  if (!dnaDot || !inBadge) {
    add(h.DRAW_OFF_GRAMMAR_COMPONENT, 'hand-made status dot', el, `a status dot is DNA Badge isDot (data-grammar-part="badge-dot" / ${h.BADGE_DOT_CLASS} inside a Badge), never a hand-drawn dot`);
    return;
  }
  const inline = h.declsOf(el.attrs.style);
  const ruled = rules.filter((r) => h.selectorMatches(r.selector, el)).map((r) => r.decls);
  const ring = [inline, ...ruled].some((d) => ['box-shadow', 'outline', 'border'].some((key) => d[key] && !/^(none|0|0px)$/i.test(d[key].trim())))
    || cls.some((c) => /^(ring|shadow|outline)(-|$)/.test(c) && !/^(ring|shadow|outline)-none$/.test(c));
  if (ring) add(h.DRAW_OFF_GRAMMAR_COMPONENT, 'Badge dot with a halo', el, 'the Badge dot is a plain 6px solid circle in the tone colour: no box-shadow, ring, outline or border halo');
  const px = Math.max(h.declaredPx(el, 'width', rules) ?? 0, h.declaredPx(el, 'height', rules) ?? 0, Number(el.attrs.width) || 0, Number(el.attrs.height) || 0);
  if (px && Math.abs(px - h.BADGE_DOT_PX) > 0.5) add(h.DRAW_OFF_GRAMMAR_COMPONENT, 'Badge dot off its size', el, `the dot declares ${px}px: the Badge dot is ${h.BADGE_DOT_PX}px (<CircleFill width={6} />), no size variants`);
}

function groupedFindings(groups, label) {
  const out = [];
  for (const group of groups.values()) {
    out.push({ code: group.code, kind: group.kind, count: group.items.length, examples: group.items.slice(0, 8),
      detail: label + ': ' + group.items.length + ' ' + group.kind + (group.items.length > 1 ? 's' : '') + ' - ' + group.items.slice(0, 4).join('; ') + (group.items.length > 4 ? ' (+' + (group.items.length - 4) + ')' : '') });
  }
  return out;
}
