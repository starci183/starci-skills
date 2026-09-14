/**
 * What an operation's tab actually shows, read before the kernel calls that operation stalled.
 *
 * The liveness probe answers one word - `stalled-idle` - for four different situations, and "restart from
 * scratch, four times, then cool" is the right answer to none of them. A `work.author` op carrying a
 * twelve-thousand-character contract reported idle thirty-nine seconds after its launch, was nudged, settled,
 * relaunched on another runtime, settled again and cooled, and the kernel never once looked at the screen that
 * said why. The screen is the evidence, and these are the five readings the kernel takes from it:
 *
 * - `prompt-missing`   nothing was delivered: the tab is empty, or it is the agent's own banner and prompt with
 *                      no trace of the contract anywhere on it. The launch failed after Orca called it a launch
 *                      (`agent_prompt_stalled`); relaunching is right, charging a restart is not.
 * - `asked`            the turn ended on a question, or a permission prompt is on screen. That is an `ask`
 *                      outcome the operation never got to write down, and it is routed as one.
 * - `finished-unreported` the turn ended - a summary, a "done" line, a report command that errored - and no
 *                      report file exists. The last words are the finding the next attempt is given.
 * - `working`          a spinner, a tool line, a "Cogitating" - the agent is mid-turn and the probe is early.
 * - `idle`             anything else: the nudge-and-settle path the kernel already had.
 *
 * The predicates are deliberately small and literal. They read a rendered frame, and a frame is chrome plus
 * whatever the agent drew this second; anything cleverer would be a parser for four agents' private UIs.
 */

/** How many of the tab's last lines a verdict is taken from. */
export const TAB_WINDOW=40;
/** How many rows the kernel asks Orca for, so the window is full even on a tab whose lines wrap. */
export const TAB_READ_LIMIT=200;
/** The closed set of readings. Anything outside it is a defect in this module, not a new case. */
export const TAB_VERDICTS=['prompt-missing','asked','finished-unreported','working','idle'];
/** How many lines back a spinner still means "mid-turn": the live status line is always at the bottom. */
const ACTIVITY_WINDOW=8;
/** How many lines back a finished turn's marker is still the last thing that happened. */
const FINISHED_WINDOW=12;

/** The glyphs the four agents animate while a turn runs. */
const SPINNER=/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏◐◓◑◒✳]/;
/** What a running turn says in words, whatever glyph is in front of it. */
const ACTIVITY=[/\b(cogitat|ideat|thinking|pondering|deciphering|percolat|ruminat|scheming|working)\b/i,
  /\besc to (cancel|interrupt)\b/i,
  /\bRead \d+ (file|line|director)/i,
  /\bran \d+ (shell )?commands?\b/i,
  /\blisted \d+ director/i];
/**
 * A turn that ENDED prints the same glyph and the same verb, with its duration and a clock time
 * (`✳ Cogitated for 4m 4s · done 1:01 PM`). That line is the opposite of activity, so it is subtracted from
 * both rules rather than added to the finished ones alone.
 */
const COMPLETED=/·\s*done\s+\d{1,2}:\d{2}/i;

/** The agent's own furniture: banner, prompt box, model footer, hint bar. Never the agent's words. */
const CHROME=[
  /^[\s│┃┌┐└┘├┤─━╭╮╰╯▌▏█>❯$#*✻✳·⏵⎿•]*$/,
  /^\s*[>❯▌]?\s*(Type your message|Try ")/i,
  /(Qwen Code|Claude Code|OpenAI Codex|Codex CLI|Gemini CLI)/i,
  /^\s*(>_|∷)/,
  /\bAsk (Codex|Claude|Qwen|Gemini)\b/i,
  /^\s*[▌│]?\s*(model|cwd|version|account|workdir|approval|sandbox|reasoning effort|directory)\s*:/i,
  /\/help for help|for shortcuts|bypass permissions|auto-accept edits|plan mode on|shift\+tab|ctrl\+/i,
  /^\s*[✻✳]?\s*Welcome to\b/i,
  /^\s*\d+\s*%\s*context left/i,
  /^\S+\s*\([^)]*\)$/];

/** A permission or approval prompt: a mechanical question, but a question, and nobody is typing an answer. */
const PERMISSION=[
  /\bDo you want to\b/i,
  /\bWould you like (me )?to\b/i,
  /\(y\/n\)|\[y\/N\]/i,
  /Yes, and don'?t ask again/i,
  /^\s*❯?\s*\d+\.\s*(Yes|No)\b/i,
  /^\s*(Allow|Deny|Approve|Reject)\b/i,
  /\ballow (this|once|always)\b/i,
  /press enter to (confirm|continue|approve)/i,
  /\bwaiting for (your )?(approval|confirmation)\b/i];

/** A turn that ended: its own summary, its own "done", or the report command failing in front of it. */
const FINISHED=[
  COMPLETED,
  /^\s*[●⏺*]?\s*(all )?(done|completed|finished)\b[.!]?\s*$/i,
  /\b(I(’|')?ve|I have) (finished|completed|written|reported)\b/i,
  /^\s*(#+\s*)?Summary\b/i,
  /\b(Cannot find module|command not found|is not recognized as|No such file or directory|MODULE_NOT_FOUND)\b/i,
  /\bError\b[^\n]*\breport\b/i,
  /\breport\b[^\n]*\b(failed|errored|rejected)\b/i];

const lines=value=>(Array.isArray(value)?value:String(value??'').split('\n')).map(line=>String(line??'').replace(/\s+$/,''));
const chrome=line=>CHROME.some(rule=>rule.test(line));
/** The agent's words with the frame's decoration taken off the front and back. */
const strip=line=>String(line??'').replace(/^[\s│┃▌>❯$#*●⏺✻✳·⏵⎿•\-]+/,'').replace(/[\s│┃▌]+$/,'');
const activity=line=>!COMPLETED.test(line)&&(SPINNER.test(line)||ACTIVITY.some(rule=>rule.test(line)));

/**
 * Whether the contract ever reached this tab. The launcher's preamble, the Dispatch, the Task and the op's own
 * id are the four marks that survive on any of the four agents' screens; one of them is enough.
 */
export function contractTrace(value,op={}){
  const text=lines(value).join('\n');
  const marks=[op?.id,op?.dispatch,op?.task,'=== TASK ===','=== PREAMBLE ==='].filter(mark=>typeof mark==='string'&&mark.trim());
  if(marks.some(mark=>text.includes(mark)))return true;
  return /\btask\s*id\b|\bdispatch\b|report\s+--run|\bcontract\b/i.test(text);
}

const verdictOf=(verdict,reason,text='',line=null,extra={})=>({verdict,reason,text,line,...extra});

/**
 * One tab, one reading. `op` is only used for the contract trace, so a fixture can be classified with none.
 */
export function classifyTab({lines:tail=[],op={}}={}){
  const window=lines(tail).slice(-TAB_WINDOW);
  const body=window.filter(line=>line.trim());
  if(!body.length)return verdictOf('prompt-missing','the tab is empty');
  const said=body.filter(line=>!chrome(line));
  const lastWords=said.slice(-6).map(strip).filter(Boolean).join('\n').slice(0,600);
  // A question first: a permission prompt is drawn over a tab that may still show its spinner, and an operation
  // waiting for an answer nobody is typing is the one stall a restart can never clear.
  const permission=window.find(line=>PERMISSION.some(rule=>rule.test(line)));
  if(permission)return verdictOf('asked','a permission or approval prompt is on screen',
    strip(permission)||lastWords,permission,{kind:'mechanical'});
  const last=said.at(-1)??null;
  if(last&&/\?\s*$/.test(strip(last)))return verdictOf('asked','the last thing the agent said is a question',
    strip(last),last,{kind:'decision'});
  if(body.slice(-ACTIVITY_WINDOW).some(activity))
    return verdictOf('working','the tab is still drawing a turn',lastWords,body.slice(-ACTIVITY_WINDOW).find(activity));
  // Banner and prompt, and no mark of the contract anywhere: the prompt was never delivered to this agent.
  if(!said.length&&!contractTrace(window,op))return verdictOf('prompt-missing','the tab shows only the agent banner and its prompt');
  const finished=body.slice(-FINISHED_WINDOW).find(line=>FINISHED.some(rule=>rule.test(line)));
  if(finished)return verdictOf('finished-unreported','the turn ended and no report was written',lastWords,finished);
  return verdictOf('idle','the tab shows no turn, no question and no ending',lastWords,last);
}
