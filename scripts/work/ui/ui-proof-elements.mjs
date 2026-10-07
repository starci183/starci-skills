// ui-proof-elements.mjs — the element kinds a surface declares and the knowledge cases they bring into play
// (see ui-proof-brief.mjs, the owner).

// ---------------------------------------------------------------------------------------------------------
// Element kinds: how a surface declares one, and how a case's `when` names one
// ---------------------------------------------------------------------------------------------------------

const FIELD_COMPONENTS = 'Input|TextField|Textarea|NumberField|SearchField|DateField|TimeField|OtpInput|Select|ComboBox|PressableField|Checkbox|Switch|RadioGroup|Slider';
const FIELD_DETECT = new RegExp(String.raw`\b(${FIELD_COMPONENTS})\b|\bfields?\b|\bforms?\b`, 'i');
const PLAIN_COMPONENTS = 'Button|Input|Tabs|Badge|Text|Label|Heading|Icon|Tooltip|Select|Chip';
const NAMED_COMPONENT = new RegExp(String.raw`\b([A-Z][a-z]+(?:[A-Z][a-z]+)+|${PLAIN_COMPONENTS})\b`, 'g');

/** detect: read on the ui record text; trigger: read on a case's when/governs; always: every surface has it. */
const KINDS = [
  { id: 'field', detect: FIELD_DETECT, trigger: /\bfields?\b|\binputs?\b|\bforms?\b|validation|autofill|keypad|\bis filled\b/i, components: ['Input', 'Textarea', 'NumberField', 'SearchField', 'OtpInput', 'PressableField', 'Label'] },
  { id: 'button', detect: /\bButton\b|IconButton|\bsubmit\b|\bCTA\b|call to action/i, trigger: /\bbuttons?\b|\bcommands?\b|call to action|\bCTA\b|IconButton|primary action|\bactions?\b(?! band)|\bconfirm\b/i, components: ['Button', 'IconButton'] },
  { id: 'link', detect: /TextAction|\bLink\b|\bhref\b|destinations?|navigat/i, trigger: /\bdestinations?\b|\blinks?\b/i, components: ['TextAction', 'Link'] },
  { id: 'selection', detect: /\bTabs?\b|Subnav|Segment|tablist|\bselected\b|\bchoice\b|RadioGroup|Checkbox|Switch|ToggleButton|Disclosure|Accordion/i, trigger: /\btabs?\b|selection|\bselected\b|\bpeers?\b|disclosures?|\bexpanded\b|arrow-key|\bchoice/i, components: ['Tabs', 'Subnav', 'SurfaceAccordionCard'] },
  { id: 'card', detect: /SurfaceCard|SurfaceListCard|SurfaceAccordionCard|EmptyNotice|\bcards?\b|\bpanels?\b|\bbands?\b/i, trigger: /\bcards?\b|\bpanels?\b|\bbands?\b|\bcontainers?\b|\bcells?\b|flush surface|inside a surface|surface that already owns|\bcolumns\b/i, components: ['SurfaceCard', 'SurfaceListCard', 'EmptyNotice'] },
  { id: 'nested', detect: /\bnested\b|\bjoined\b|\bbands?\b|inside (a|the|its) (card|surface|panel)/i, trigger: /nested inside another|surface is nested|card nesting|\bnested\b/i, components: [] },
  { id: 'badge', detect: /\bBadge\b|\bChip\b|\bTag\b|StateMark|status pill|\bpill\b/i, trigger: /\bbadges?\b|\bchips?\b|\btags?\b|state mark/i, components: ['Badge', 'StateMark'] },
  { id: 'row', detect: /\brows?\b|\blists?\b|\btables?\b|StaticStateRow|SurfaceListCard|collection|\bitems\b|\bentries\b|\brecords\b/i, trigger: /(?<!app-owned )\brows?\b(?!\s+of\b)|\blists?\b|\btables?\b|collection|record count|representative volume|below-volume|grid row/i, components: ['SurfaceListCard', 'StaticStateRow'] },
  { id: 'image', detect: /\bimg\b|\bimages?\b|illustration|mascot|MediaFrame|artwork|Avatar|photo|picture/i, trigger: /\bimages?\b|illustration|mascot|artwork|picture|photograph|imagery|decorative (art|image)/i, components: ['MediaFrame', 'Image', 'Avatar'] },
  { id: 'icon', detect: /\bIcon\b|IconButton|IconTile|\bglyphs?\b/i, trigger: /\bglyphs?\b|\bicons?\b|icon-only/i, components: ['Icon', 'IconTile', 'IconButton'] },
  { id: 'meter', detect: /\bMeter\b|Progress|ProgressCircle|Rating|bar chart/i, trigger: /rendered as bars|\bbars?\b|\bmeasurement renders|\bmeter\b/i, components: ['Meter', 'Progress', 'ProgressCircle'] },
  { id: 'overlay', detect: /\bmodal\b|\bdrawer\b|\bdialog\b|popover|\bsheet\b|overlay|Tooltip/i, trigger: /\bmodal\b|\bdrawer\b|\bdialog\b|popover|overlay|non-modal|tooltip/i, components: ['Dialog', 'Drawer', 'Popover', 'Tooltip'] },
  { id: 'sticky', detect: /\bsticky\b/i, trigger: /\bsticky\b/i, components: [] },
  { id: 'navigation', detect: /\bnav\b|navigation|Sidebar|BottomNav|breadcrumb|TopBar|\brail\b/i, trigger: /navigation|\bnav\b|sidebar|\brails?\b|breadcrumb|conversation rail/i, components: ['Sidebar', 'BottomNav', 'Subnav', 'ChatWorkspace'] },
  { id: 'code', detect: /FencedCodeBlock|code block|\bcode\b/i, trigger: /code block/i, components: ['FencedCodeBlock'] },
  { id: 'motion', detect: /animat|transition|spinner|skeleton|highlight|\bmotion\b|shimmer/i, trigger: /animat|\bmotion\b|transition runs|movement|choreograph|\bflashes\b|duration|easing/i, components: [] },
  { id: 'loading', detect: /loading|pending|\bworking\b|\bbusy\b|skeleton|in progress|submitting/i, trigger: /\bloading\b|\bpending\b|in progress|in flight|work outlasts|\bbusy\b|waited|accepted work/i, components: ['Skeleton', 'Spinner'] },
  { id: 'empty', detect: /\bempty\b|no (items|records|data|results)/i, trigger: /\bempty\b/i, components: ['EmptyNotice'] },
  { id: 'error', detect: /\berror|refus|reject|\bfail|invalid|denied/i, trigger: /\berror|refus|reject|\binvalid|failing|wrong value|permission refusal|destructive|\bwarning\b/i, components: [] },
  { id: 'success', detect: /success|\bdone\b|completed|confirmed|\bsent\b|\bsaved\b|outcome/i, trigger: /\bsuccess|\boutcome\b|result is claimed|terminal success/i, components: [] },
  { id: 'disabled', detect: /disabled|unavailable|isDisabled|read-only/i, trigger: /\bdisabled\b|\bunavailable\b/i, components: [] },
  { id: 'dark', detect: /\bdark\b/i, trigger: /\bdark\b|theme changes|each theme|every theme/i, components: [] },
  { id: 'control', always: (present) => ['field', 'button', 'link', 'selection'].some((k) => present.has(k)), trigger: /\bcontrols?\b|interactive|\btargets?\b|\btouch\b|keyboard|\bfocus|\bhover|activat|operable|tab order|pointer/i, components: [] },
  { id: 'heading', always: () => true, trigger: /\bheadings?\b|\btitles?\b|page title|\banchor\b|outline entry/i, components: ['Heading', 'SectionHeader'] },
  { id: 'text', always: () => true, trigger: /\btext\b|\bcopy\b|\blabels?\b|paragraph|sentence|\bwords?\b|\bfont\b|characters|\bmessage\b|\bnumber\b|\bdate\b/i, components: ['Text', 'Label'] },
  { id: 'page', always: () => true, trigger: /viewport|\bnarrow|\bzoom|reflow|breakpoint|one-handed|\bthumb\b|reach zone|\bcapture\b|\bframe\b|first glance|three seconds|\bdensity\b|\bview\b|\bscreen\b|\bpage\b|\bregion\b|\blayout\b|\bsection\b/i, components: ['PageContainer'] },
  { id: 'brand', always: () => true, trigger: /\bbrand\b|colou?r|palette|\bhues?\b|saturated|\baccent\b|gradient|swatch|forced colou?rs/i, components: [] },
  { id: 'direction', always: () => true, trigger: /direction|\bprompt\b|reference render|ImageGen|grammar component|grammar package|component inventory|\banatomy\b/i, components: [] },
];
export const KIND_IDS = KINDS.map((k) => k.id);
const STATE_KINDS = new Set(['loading', 'empty', 'error', 'success', 'disabled', 'dark', 'motion']);

/** Cases only an evaluation lens or a running UAT observes: listed as not applicable to a drawing. */
const LENS_ONLY = /lens runs|verdict is computed|criterion has no observation|failure has been measured|lens is scored|score is recorded|audit scope selects|below-volume or data-bound|explicitly accepts a measured|every canon rule passed|taste criterion fails|references disagree with a canon|direction decision is read|placed beside those references|gap is described|declares a presentation delta|never measured|one of the two captures is missing|no store or authority|summari[sz]ed in the current/i;
const RUN_ONLY = /(?:^(the )?run\b)|\bthe run (reaches|is driven|completes|submits|presses|reloads|navigates|leaves)|returning person|\bin the run\b|mid-flow|fresh session/i;

const flatText = (v) => { if (v == null) { return ''; } if (typeof v === 'string') { return v; } if (Array.isArray(v)) { return v.map(flatText).join('\n'); } if (typeof v === 'object') { return Object.entries(v).map(([k, x]) => `${k}: ${flatText(x)}`).join('\n'); } return String(v); };

const OVERLAY_SURFACES = ['modal', 'drawer'];
const overlaySurface = (surface) => OVERLAY_SURFACES.includes(surface) || (surface && typeof surface === 'object' && Object.values(surface).some((v) => OVERLAY_SURFACES.includes(v)));

/** The record text that shows structure, and that plus the states. */
function recordTexts(record, ui) {
  const components = (ui.coverage?.map ?? []).flatMap((m) => m?.components ?? []).map(flatText);
  const structure = [flatText(components), flatText(ui.intent), flatText(ui.surfaces), flatText(record?.title), flatText(record?.surface), flatText(record?.anatomy ?? ui.anatomy), flatText(record?.regions ?? ui.regions)].join('\n');
  return { structure, text: `${structure}\n${flatText(ui.states)}` };
}

/** The kinds a `detect` pattern finds: state kinds read the states too, the rest the structure only. */
function detectedKinds({ structure, text }) {
  const present = new Map();
  for (const k of KINDS) {
    if (k.always) continue;
    const m = k.detect.exec(STATE_KINDS.has(k.id) ? text : structure);
    if (m) present.set(k.id, `record: "${m[0]}"`);
  }
  return present;
}

/** The component names the record spells, plus the first component of every present kind. */
function namedComponents(structure, present) {
  const named = new Set();
  for (const m of structure.matchAll(NAMED_COMPONENT)) named.add(m[1]);
  for (const k of KINDS) if (present.has(k.id) && k.components.length) named.add(k.components[0]);
  return named;
}

/** The element kinds and component names a surface uses, each with the record text that shows it. */
export function surfaceElements(record, { extra = [] } = {}) {
  const texts = recordTexts(record, record?.ui ?? {});
  const present = detectedKinds(texts);
  if (overlaySurface(record?.surface)) present.set('overlay', 'record: surface modal/drawer');
  if (present.has('field') && present.has('card')) present.set('nested', present.get('nested') ?? 'record: fields inside a card');
  for (const e of extra) if (KIND_IDS.includes(e)) present.set(e, '--elements');
  const keys = new Set(present.keys());
  for (const k of KINDS) if (k.always?.(keys)) { present.set(k.id, 'every surface'); keys.add(k.id); }
  return { kinds: present, components: namedComponents(texts.structure, present) };
}

const kindsIn = (text) => KINDS.filter((k) => k.trigger.test(String(text ?? ''))).map((k) => k.id);
const ownerComponents = (owner) => [...String(owner ?? '').matchAll(/`([A-Z][A-Za-z]+)`/g)].map((m) => m[1]).filter((n) => n !== 'App');

/** Classify one case: applicable (with the kinds that made it so) or not, with the reason. */
export function classifyCase(rule, c, elements) {
  const when = String(c.when ?? '');
  if (LENS_ONLY.test(when) || LENS_ONLY.test(String(rule.governs ?? ''))) return { applies: false, reason: 'evaluation lens bookkeeping' };
  if (RUN_ONLY.test(when.trim())) return { applies: false, reason: 'observed only in a running UAT' };
  // A case may name the element kinds that bring it into play (`elements`, any of them): applicability by
  // component presence, never by how its prose happens to be worded (2026-09-28: MEASURE-4 case-3 names "a
  // game table" as an example, so reading its text asked for a row and a sign-in form never got it).
  const declared = Array.isArray(c.elements) ? c.elements.filter((k) => KIND_IDS.includes(k)) : [];
  if (declared.length) {
    if (!declared.some((k) => elements.kinds.has(k))) return { applies: false, reason: `needs ${declared.join(' or ')}`, kinds: declared, from: 'elements' };
    const present = declared.filter((k) => elements.kinds.has(k));
    const owners = ownerComponents(c.owner);
    if (owners.length && !owners.some((o) => elements.components.has(o))) return { applies: false, reason: `owner ${owners.join('/')} not on this surface`, kinds: present, from: 'elements' };
    return { applies: true, kinds: present, from: 'elements', owners };
  }
  let kinds = kindsIn(when);
  let from = 'when';
  if (!kinds.length) { kinds = kindsIn(rule.governs); from = 'governs'; }
  const missing = kinds.filter((k) => !elements.kinds.has(k));
  if (missing.length) return { applies: false, reason: `needs ${missing.join(', ')}`, kinds, from };
  const owners = ownerComponents(c.owner);
  if (owners.length && !owners.some((o) => elements.components.has(o))) return { applies: false, reason: `owner ${owners.join('/')} not on this surface`, kinds, from };
  return { applies: true, kinds, from, owners };
}
