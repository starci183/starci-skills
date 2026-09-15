/**
 * What a provider is doing, read from the screen that provider renders. The kernel used to carry one union of
 * regexes for every agent it had ever seen; here each family owns its signatures (busy, idle, confirmation
 * prompt), the keystroke that accepts a confirmation once, and the markers that identify it in a screen or a
 * terminal title. `observe` turns one screen plus terminal metadata into one liveness verdict and names the
 * family it used, so the supervisor answers a dialog with the key that family understands and the kernel can
 * park a runtime the moment its provider starts refusing.
 */
export const DEFAULT_STALLED_AFTER_MS=20*60*1000;
export const PROVIDER_FAMILIES=['claude','codex','qwen','shell'];
/**
 * Families scanned when neither the caller, the screen nor the title names one. `shell` is excluded on
 * purpose: its signatures are a bare prompt character and a `(y/n)` tail, too common to classify an unknown
 * agent screen by, so a shell family is only ever used when it was selected explicitly or by title.
 */
export const SCAN_ORDER=['claude','codex','qwen'];

/** One row per family: what its screen looks like in each phase, what accepts a dialog, how it is recognized. */
export const SCREENS={
  claude:{
    // The hint bar of a young turn, and the status line of any turn: a spinner glyph, a verb with an ellipsis,
    // the elapsed time, the token counter, `thinking` - `✢ Gitifying… (7m 9s · ↓ 22.9k tokens · thinking)`. Past
    // the first minute Claude Code prints no `esc to interrupt` beside it and a Tip line replaces the hint bar,
    // which is exactly when a working tab used to be read as idle, nudged and closed mid-turn.
    busy:[/esc to interrupt/i,
      /[·✢✳✶✻✽*⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s*\S[^\n]*…\s*\(\d+(?:h\s*\d+)?(?:m\s*\d+)?s?\b/,
      /\(\d[^)\n]*·\s*[↓↑]\s*[\d.]+k?\s*tokens/i,
      /·\s*thinking\)/i],
    // The prompt box alone says idle. The footer `bypass permissions on` is on every Claude screen, working
    // or not, and is no evidence of anything; a screen with neither a status line nor a prompt falls through
    // to the silence rule, which is slower than a wrong idle but never closes a turn that is running.
    idle:[/(^|\n)\s*❯\s*$/m,/(^|\n)\s*[>❯]\s*(?:Try "|Type your message)/i],
    prompt:[/Do you want to proceed\?/i,/Allow .+ once/i],
    answer:'1',
    detect:[/bypass permissions/i,/\bClaude Code\b/i],
    title:[/\bclaude\b/i]
  },
  codex:{
    busy:[/esc to interrupt/i,/\bWorking\b/],
    // `Type your message` is Codex's own placeholder, but Qwen prints `Type your message or @path`: the
    // lookahead leaves that string to its owner so an untitled Qwen screen is never read as Codex.
    idle:[/›\s*Ask Codex/i,/Ask Codex/i,/Type your message(?! or @path)/i],
    prompt:[/Allow .+\?\s*\(y\/n\)/i,/\bApprove\b/i],
    answer:'y',
    detect:[/Ask Codex/i,/OpenAI Codex/i,/\bOpenAI\b/],
    title:[/\bcodex\b/i,/Report task outcome/i]
  },
  qwen:{
    busy:[/esc to cancel/i,/Thinking…/i,/\bThinking\.\.\./i],
    idle:[/Type your message or @path/i,/Type your message/i],
    prompt:[/Allow execution/i,/Waiting for user confirmation/i,/\(y\/n\)/i],
    answer:'1',
    detect:[/qwen3[\w.-]*/i,/Token Plan/i],
    title:[/\bqwen\b/i]
  },
  shell:{
    busy:[],
    idle:[/(^|\n)\s*(?:PS [^\n]*>|[A-Za-z]:\\[^\n]*>|\$|#|%)\s*$/],
    prompt:[/\(y\/n\)/i,/\[Y\/n\]/,/\[y\/N\]/,/Overwrite\?/i,/Press .{0,20}to continue/i],
    answer:'y',
    detect:[],
    title:[/^[^\n]{0,20}\b(?:shell|bash|zsh|powershell|pwsh|cmd)\b/i]
  }
};

/**
 * A provider that refuses mid-operation says so on its own screen. The kernel reads this before any liveness
 * rule: a rate-limited worker is neither working nor stalled, it is parked until the window reopens.
 */
/**
 * A refusal is the provider's own error sentence, never a word. `quota` and `billing` on their own once matched
 * the contract of a commerce feature and the agent's prose about it, and a working worker was closed as refused:
 * every pattern here is a phrase only an error prints (a status code, "rate limit reached", "exceeded your
 * quota", "credit balance is too low", an `_error` type). It is still read before the busy signature, so a
 * refused runtime is parked the moment its provider says so.
 */
export const RATE_LIMIT_SIGNALS=[
  ['http-429',/(?:\b|_)429\b|rate_limit_error/i],
  ['rate-limit',/rate.?limit(?:ed| reached| exceeded| hit|ing)?\b(?![^\n]*\b(?:rule|policy|design|record|feature|contract)\b)|too many requests|resource_exhausted|retry after \d/i],
  ['overloaded',/overloaded_error|is (?:currently )?overloaded|server is busy|upstream_overloaded|^\s*selected model is at capacity\.\s*please try a different model\.?\s*$/im],
  ['quota',/insufficient_quota|exceeded your (?:current )?quota|quota (?:exceeded|exhausted|reached)|out of quota|credit balance is too low|billing (?:hard )?limit|usage limit reached|you(?:'ve| have) hit your (?:usage )?limit/i]
];

/** Screens arrive as a tail array from `terminal read` or as one joined string; both are one text. */
export const flatten=screen=>Array.isArray(screen)?screen.map(line=>String(line??'')).join('\n'):String(screen??'');
const any=(patterns,text)=>(patterns??[]).some(pattern=>pattern.test(text));

/** Which family rendered this screen, from the markers only that family prints. `null` when nothing claims it. */
export function detect(screen){
  const flat=flatten(screen);
  for(const family of SCAN_ORDER)if(any(SCREENS[family].detect,flat))return family;
  return null;
}

/** Orca keeps a canonical title per task; a title that still names its agent selects the family too. */
export const terminalTitleHints=Object.fromEntries(PROVIDER_FAMILIES.map(family=>[family,SCREENS[family].title]));
export function detectFromTitle(title){
  const text=String(title??'');
  if(!text.trim())return null;
  for(const family of PROVIDER_FAMILIES)if(any(terminalTitleHints[family],text))return family;
  return null;
}

/** 429, rate limit, overloaded or quota text anywhere on the screen; the kind selects the cooldown upstream. */
export function rateLimitSignal(screen){
  const flat=flatten(screen);
  for(const [kind,pattern] of RATE_LIMIT_SIGNALS){
    const found=flat.match(pattern);
    if(found){
      // A refusal retained in scrollback must not park a newer active turn. Idle provider chrome after a refusal
      // is expected and keeps the signal current; an actual busy signature after it proves execution resumed.
      const newer=flat.slice((found.index??0)+found[0].length);
      if(PROVIDER_FAMILIES.some(family=>any(SCREENS[family].busy,newer)))continue;
      return {kind,text:found[0].trim()};
    }
  }
  return null;
}

/** Caller wins over the screen, the screen over the title: a title survives a restart, a footer does not. */
export function resolveFamily({screen,terminal,provider=null}={}){
  const named=provider&&Object.hasOwn(SCREENS,provider)?provider:null;
  return named??detect(screen)??detectFromTitle(terminal?.title)??null;
}

/**
 * One liveness verdict for one live worker. Facts outrank screen text (a closed terminal is dead, a written
 * report is a report), then the provider's own refusal, then the phase signatures in order prompt, busy, idle,
 * and finally silence. `provider` names the family the verdict came from and `answer` is the keystroke that
 * accepts that family's confirmation dialog once.
 */
export function observe({screen,terminal,now,stalledAfterMs=DEFAULT_STALLED_AFTER_MS,reported=false,provider=null}){
  const flat=flatten(screen);
  const family=resolveFamily({screen:flat,terminal,provider});
  const verdict=(liveness,reason,hit=family)=>({liveness,reason,provider:hit??null,answer:hit?SCREENS[hit].answer:null});
  if(!terminal)return verdict('dead','terminal not listed');
  if(terminal.status&&/exited|closed/i.test(terminal.status))return verdict('dead',`terminal ${terminal.status}`);
  if(reported)return verdict('reported','report file present');
  const order=family?[family]:SCAN_ORDER;
  const match=phase=>order.find(id=>any(SCREENS[id][phase],flat))??null;
  const prompted=match('prompt');
  if(prompted)return verdict('stalled-prompt','agent is waiting for an interactive confirmation',prompted);
  const limited=rateLimitSignal(flat);
  if(limited)return verdict('rate-limited',`provider refused with a ${limited.kind} signal: ${limited.text}`);
  const busy=match('busy');
  if(busy)return verdict('working','agent is running',busy);
  const idle=match('idle');
  if(idle)return verdict('stalled-idle','agent is idle at its prompt without a report',idle);
  const last=Number(terminal.lastOutputAt??0);
  if(last&&now-last>stalledAfterMs)return verdict('stalled-silent',`no output for ${Math.round((now-last)/60000)} min`);
  return verdict('working','recent output');
}
