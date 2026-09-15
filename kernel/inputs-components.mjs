/**
 * The owner page's component set, in the shadcn idiom: one neutral token sheet (light and dark by the system) and a
 * small client-side factory per component. The page composes these; it owns no styling of its own. Everything here
 * is self-contained - no remote assets, no framework - and inlined under the page's nonce.
 *
 *   ui.card({kicker,title,subtitle})      -> {root,head,body}       one bordered card, header then body
 *   ui.badge(text,tone)                   -> <span class="badge">   tone: soft | solid | ok | warn | outline
 *   ui.button(text,{variant,type})        -> <button class="btn">   variant: primary | outline | ghost
 *   ui.input({type,...})                  -> <input>                text or password, shadcn input box
 *   ui.secret({id,label,placeholder})     -> {row,input,reveal}     password input with a show/hide toggle
 *   ui.textarea({placeholder,maxLength})  -> <textarea>
 *   ui.radioGroup({name,legend,options})  -> {root,inputs}          option cards with radios, `recommended` badged
 *   ui.checkbox(text)                     -> {root,input}           one confirmation row
 *   ui.meta(rows)                         -> <dl class="meta">      label/value pairs; a value may be a node
 *   ui.field({label,status})             -> {root,labelrow,status} one credential field block
 *   ui.hint(text) / ui.note(text) / ui.feedback()                  muted line, notice box, status line
 */
export const COMPONENT_STYLE=`
:root{--background:0 0% 100%;--foreground:240 10% 3.9%;--card:0 0% 100%;--muted:240 4.8% 95.9%;--muted-foreground:240 3.8% 46.1%;--border:240 5.9% 90%;--input:240 5.9% 90%;--primary:240 5.9% 10%;--primary-foreground:0 0% 98%;--accent:240 4.8% 95.9%;--ring:240 5.9% 10%;--destructive:0 72% 51%;--success:142 72% 29%;--warning:38 92% 50%;--radius:.5rem;color-scheme:light}
@media(prefers-color-scheme:dark){:root{--background:240 10% 3.9%;--foreground:0 0% 98%;--card:240 10% 5.5%;--muted:240 3.7% 15.9%;--muted-foreground:240 5% 64.9%;--border:240 3.7% 15.9%;--input:240 3.7% 15.9%;--primary:0 0% 98%;--primary-foreground:240 5.9% 10%;--accent:240 3.7% 15.9%;--ring:240 4.9% 83.9%;--destructive:0 63% 51%;--success:142 60% 55%;--warning:38 92% 60%;color-scheme:dark}}
/* one type system: a single system stack, fixed sizes and weights per role */
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:hsl(var(--background));color:hsl(var(--foreground));font-family:"Segoe UI",system-ui,-apple-system,Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;font-size:14px;font-weight:400;line-height:1.5;font-synthesis:none;-webkit-font-smoothing:antialiased}
h1,h2,p,label,legend,button,input,textarea,dt,dd,summary{font-family:inherit}
.t-title{font-size:28px;line-height:1.2;letter-spacing:-.02em;font-weight:600;margin:14px 0 8px}.t-lead{font-size:15px;font-weight:400;line-height:1.5;color:hsl(var(--muted-foreground));margin:0;max-width:60ch}
.t-subject{font-size:16px;font-weight:600;letter-spacing:-.01em;line-height:1.35;margin:0}.t-body{font-size:14px;font-weight:400;line-height:1.55}.t-small{font-size:12px;font-weight:400;line-height:1.5;color:hsl(var(--muted-foreground))}.t-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}
/* card */
.card{background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:calc(var(--radius) + 4px);margin:0 0 16px;box-shadow:0 1px 2px hsl(240 10% 3.9% / .05)}.card-head{padding:18px 20px 0}.card-body{padding:14px 20px 4px}.card-foot{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex-wrap:wrap;padding:12px 20px 18px}.card-foot .t-small{margin-right:auto}.kicker{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}.subtitle{margin:4px 0 0;font-size:13px;color:hsl(var(--muted-foreground))}
/* badge */
.badge{display:inline-flex;align-items:center;gap:6px;border:1px solid hsl(var(--border));border-radius:9999px;padding:3px 10px;font-size:12px;font-weight:500;line-height:18px;background:hsl(var(--card));color:hsl(var(--foreground))}.badge.solid{background:hsl(var(--primary));color:hsl(var(--primary-foreground));border-color:transparent}.badge.soft{background:hsl(var(--muted));border-color:transparent;color:hsl(var(--muted-foreground))}.badge.ok{color:hsl(var(--success))}.badge.warn{color:hsl(var(--warning))}.badge .dot{width:6px;height:6px;border-radius:9999px;background:currentColor}
/* button */
.btn{display:inline-flex;align-items:center;justify-content:center;height:36px;padding:0 16px;border-radius:var(--radius);font-size:14px;font-weight:500;cursor:pointer;border:1px solid transparent;background:transparent;color:hsl(var(--foreground))}.btn.primary{background:hsl(var(--primary));color:hsl(var(--primary-foreground))}.btn.primary:hover{opacity:.9}.btn.outline{border-color:hsl(var(--border))}.btn.outline:hover{background:hsl(var(--accent))}.btn.ghost{height:auto;padding:6px 0;color:hsl(var(--muted-foreground));font-size:13px;font-weight:400;text-decoration:underline;text-underline-offset:3px}.btn.ghost:hover{color:hsl(var(--foreground))}.btn:disabled{opacity:.5;cursor:default}button:focus-visible{outline:2px solid hsl(var(--ring));outline-offset:2px}
/* input, textarea */
.input,textarea{width:100%;min-width:0;border:1px solid hsl(var(--input));border-radius:var(--radius);background:transparent;color:hsl(var(--foreground));font-size:14px;font-weight:400;line-height:1.5;padding:9px 12px;outline:0}textarea{min-height:96px;resize:vertical}.input:focus-visible,textarea:focus-visible,.inputrow:focus-within{box-shadow:0 0 0 2px hsl(var(--background)),0 0 0 4px hsl(var(--ring))}.input:disabled,textarea:disabled{opacity:.6}
.inputrow{display:flex;border:1px solid hsl(var(--input));border-radius:var(--radius);overflow:hidden}.inputrow .input{border:0;border-radius:0}.inputrow .input:focus-visible{box-shadow:none}.reveal{border:0;border-left:1px solid hsl(var(--border));background:transparent;color:hsl(var(--muted-foreground));min-width:56px;font-size:12px;cursor:pointer}.reveal:hover{color:hsl(var(--foreground))}
/* radio group (choice cards), checkbox */
.choices{border:0;margin:0;padding:0;display:grid;gap:8px}.choices legend{font-size:13px;font-weight:500;margin-bottom:8px;padding:0}.choice{display:flex;gap:12px;align-items:flex-start;border:1px solid hsl(var(--border));border-radius:var(--radius);padding:12px 14px;cursor:pointer;background:hsl(var(--card));transition:border-color .12s,background .12s}.choice:hover{background:hsl(var(--accent))}.choice:has(input:checked){border-color:hsl(var(--primary));box-shadow:0 0 0 1px hsl(var(--primary))}.choice:has(input:disabled){cursor:default;opacity:.6}.choice input{margin:3px 0 0;accent-color:hsl(var(--primary));flex:none;width:16px;height:16px}.choice .text{font-size:14px;font-weight:400;line-height:1.5;overflow-wrap:anywhere}.choice .tag{margin-left:8px;vertical-align:1px}
.checkrow{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:400}.checkrow input{width:16px;height:16px;accent-color:hsl(var(--primary))}
/* meta list, field, hint, note, feedback */
.meta{display:grid;grid-template-columns:minmax(120px,160px) 1fr;gap:6px 14px;font-size:13px;margin:0 0 12px}.meta dt{color:hsl(var(--muted-foreground));margin:0}.meta dd{margin:0;overflow-wrap:anywhere}.meta a,.hint a,.guide a{color:hsl(var(--foreground));text-decoration:underline;text-underline-offset:3px}
.field{padding:14px 0;border-top:1px solid hsl(var(--border))}.field:first-child{border-top:0}.labelrow{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px}.labelrow .name{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;font-weight:600;overflow-wrap:anywhere}.status{font-size:12px;color:hsl(var(--warning))}.status[data-status=saved],.status[data-status=complete]{color:hsl(var(--success))}
.hint{font-size:12px;font-weight:400;line-height:1.5;color:hsl(var(--muted-foreground));margin:6px 0 0}.guide{font-size:13px;font-weight:400;line-height:1.5;color:hsl(var(--muted-foreground));margin:8px 0 0}.note{border:1px solid hsl(var(--border));border-radius:var(--radius);background:hsl(var(--muted));padding:12px 14px;font-size:13px;color:hsl(var(--muted-foreground));margin:0 0 20px}.note:empty{display:none}.warnbox{border:1px solid hsl(var(--warning));border-radius:var(--radius);padding:8px 10px;margin:0 0 10px;font-size:13px}
.feedback{padding:0 20px 16px;font-size:13px;margin:0;color:hsl(var(--muted-foreground))}.feedback:empty{display:none}.feedback.error{color:hsl(var(--destructive))}
details.tasks summary{cursor:pointer}.other[hidden]{display:none}
@media(max-width:600px){.meta{grid-template-columns:1fr}.card-head,.card-body,.card-foot{padding-left:16px;padding-right:16px}.btn:not(.ghost){width:100%}.card-foot .t-small{margin-right:0;width:100%}}
`;

/** The client-side factories: plain DOM, no framework; the page script receives them as `ui`. */
export const COMPONENT_SCRIPT=`
const ui=(()=>{
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined&&text!==null&&text!=='')node.textContent=text;return node;};
  const badge=(text,tone='outline')=>el('span','badge'+(tone&&tone!=='outline'?' '+tone:''),text);
  const button=(text,{variant='primary',type='button'}={})=>{const node=el('button','btn '+variant,text);node.type=type;return node;};
  const input=({type='text',id=null,placeholder='',maxLength=16384,autocomplete=null,spellcheck=null}={})=>{const node=el('input','input');node.type=type;if(id)node.id=id;if(placeholder)node.placeholder=placeholder;node.maxLength=maxLength;if(autocomplete)node.autocomplete=autocomplete;if(spellcheck!==null)node.spellcheck=spellcheck;return node;};
  const textarea=({placeholder='',maxLength=16384}={})=>{const node=el('textarea','');node.placeholder=placeholder;node.maxLength=maxLength;return node;};
  const secret=({id,label,placeholder,showText,hideText})=>{const row=el('div','inputrow'),field=input({type:'password',id,placeholder,autocomplete:'new-password',spellcheck:false}),reveal=el('button','reveal',showText);reveal.type='button';reveal.setAttribute('aria-label',showText+' '+label);reveal.addEventListener('click',()=>{field.type=field.type==='password'?'text':'password';reveal.textContent=field.type==='password'?showText:hideText;});row.append(field,reveal);return {row,input:field,reveal};};
  const radioGroup=({name,legend,options,disabled=false,recommendedText=''})=>{const root=el('fieldset','choices'),inputs=[];if(legend)root.append(el('legend','',legend));
    for(const option of options){const label=el('label','choice'),radio=el('input'),text=el('span','text',option.label);radio.type='radio';radio.name=name;radio.value=option.id;radio.disabled=disabled;if(option.recommended&&recommendedText)text.append(Object.assign(badge(recommendedText,'soft'),{className:'badge soft tag'}));label.append(radio,text);root.append(label);inputs.push(radio);}
    return {root,inputs,picked:()=>inputs.find(item=>item.checked)??null};};
  const checkbox=(text,{disabled=false}={})=>{const root=el('label','checkrow'),box=el('input');box.type='checkbox';box.disabled=disabled;root.append(box,el('span','',text));return {root,input:box};};
  const meta=rows=>{const dl=el('dl','meta');for(const [label,value] of rows){if(value===null||value===undefined||value==='')continue;const dd=el('dd');if(value instanceof Node)dd.append(value);else dd.textContent=value;dl.append(el('dt','',label),dd);}return dl.children.length?dl:null;};
  const card=({kicker=[],title,subtitle=null,tag='article'}={})=>{const root=el(tag,'card'),head=el('div','card-head'),body=el('div','card-body');if(kicker.length){const row=el('div','kicker');row.append(...kicker);head.append(row);}const heading=el('h2','t-subject',title);head.append(heading);if(subtitle)head.append(el('p','subtitle',subtitle));root.append(head,body);return {root,head,body,heading,kicker:head.querySelector('.kicker')};};
  const foot=(...nodes)=>{const node=el('div','card-foot');node.append(...nodes);return node;};
  const field=({label,forId=null,status=''})=>{const root=el('div','field'),row=el('div','labelrow'),name=el('label','name',label),state=el('span','status',status);if(forId)name.htmlFor=forId;row.append(name,state);root.append(row);return {root,labelrow:row,status:state};};
  const hint=text=>el('p','hint',text),guide=text=>el('p','guide',text),small=text=>el('span','t-small',text),warn=text=>el('p','warnbox',text);
  const feedback=()=>{const node=el('p','feedback');node.setAttribute('role','status');node.setAttribute('aria-live','polite');return node;};
  const link=(source,{strict=true}={})=>{try{const url=new URL(source.url);if(!(strict?['https:']:['https:','http:']).includes(url.protocol)||url.username||url.password||(!strict&&(url.search||url.hash)))return null;const node=el('a','',source.title||url.hostname);node.href=url.href;node.target='_blank';node.rel='noopener noreferrer';return node;}catch{return null;}};
  const joined=(nodes,separator=' · ')=>{const span=el('span');nodes.forEach((node,index)=>{if(index)span.append(separator);span.append(node);});return span;};
  return {el,badge,button,input,textarea,secret,radioGroup,checkbox,meta,card,foot,field,hint,guide,small,warn,feedback,link,joined};
})();
`;
