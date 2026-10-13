// Companion notes: docs/notes/*.md → HTML for the Learn mode. Build-time only (no runtime dependency).
// Markdown subset: # title (first line), ## / ### headings, paragraphs, **bold**, *em*, `code`, [text](url),
// bullet and numbered lists, pipe tables, raw HTML blocks (a line starting with "<"), and three extensions:
//   $$ … $$ (own lines)        display formula → MathML (temml)
//   $ … $                      inline formula → MathML
//   {{live:key}}               a value the app fills in from the current parameters (ui/chapters.js LIVE)
//   [try: Label | {json cfg}]  a Try button; cfg as for lessons (lessonGo) or with sim:true (tryGo)
// Front matter (first lines "key: value" before the title) gives id, sys and summary.
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const temml=createRequire(import.meta.url)('./vendor/temml/temml.cjs');
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function tex(src,display){
  try{return temml.renderToString(src,{displayMode:display,throwOnError:true,strict:false});}
  catch(e){console.error('TeX error in notes:',e.message,'\n  '+src);process.exit(1);}
}
function inline(s){
  const out=[];let i=0;
  // protect inline math and code from the other substitutions
  s=s.replace(/`([^`]+)`/g,(_,c)=>{out.push(`<code>${esc(c)}</code>`);return `\u0000${out.length-1}\u0000`;});
  s=s.replace(/\$([^$\n]+?)\$/g,(_,t)=>{out.push(tex(t,false));return `\u0000${out.length-1}\u0000`;});
  s=s.replace(/\{\{live:([\w.]+)(?:\|([^}]*))?\}\}/g,(_,k,fmt)=>{out.push(`<span class="live" data-k="${k}"${fmt?` data-fmt="${esc(fmt)}"`:''}>…</span>`);return `\u0000${out.length-1}\u0000`;});
  s=s.replace(/\[try:\s*([^|\]]+?)\s*\|\s*(\{.*?\})\s*\]/g,(_,label,cfg)=>{JSON.parse(cfg);out.push(`<button type="button" class="btn small try" data-cfg='${esc(cfg).replace(/'/g,'&#39;')}'>${esc(label)}</button>`);return `\u0000${out.length-1}\u0000`;});
  s=esc(s).replace(/&lt;(\/?)(b|i|sub|sup|br)&gt;/g,'<$1$2>');
  s=s.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s.,;:)]|$)/g,'$1<i>$2</i>');
  s=s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s.replace(/\u0000(\d+)\u0000/g,(_,n)=>out[+n]);
}
function table(lines){
  // a [try: … | …] inside a cell carries a pipe of its own: hide it from the cell split
  const keep=[];const hide=l=>l.replace(/\[try:[^\]]*\]/g,m=>{keep.push(m);return `\u0001${keep.length-1}\u0001`;});
  const rows=lines.map(l=>hide(l).replace(/^\||\|$/g,'').split('|').map(c=>c.trim().replace(/\u0001(\d+)\u0001/g,(_,n)=>keep[+n])));
  const head=rows[0],body=rows.slice(2);
  return `<table class="notes-table${head.length>=8?' compact':''}"><thead><tr>${head.map(c=>`<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r=>`<tr>${r.map(c=>`<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
export function convert(md){
  const lines=md.split('\n');let i=0;const meta={};
  while(i<lines.length&&/^\w+:\s/.test(lines[i])){const m=/^(\w+):\s*(.*)$/.exec(lines[i]);meta[m[1]]=m[2];i++;}
  const blocks=[];let title='';const toc=[];
  while(i<lines.length){
    const l=lines[i];
    if(!l.trim()){i++;continue;}
    if(/^# /.test(l)){title=l.slice(2).trim();i++;continue;}
    const h=/^(##+) (.*)$/.exec(l);
    if(h){const lvl=h[1].length,text=h[2].trim(),id=text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      if(lvl===2)toc.push({id,text});blocks.push(`<h${lvl} id="n-${id}">${inline(text)}</h${lvl}>`);i++;continue;}
    if(l.trim()==='$$'){const buf=[];i++;while(i<lines.length&&lines[i].trim()!=='$$')buf.push(lines[i++]);i++;blocks.push(`<div class="math">${tex(buf.join('\n'),true)}</div>`);continue;}
    if(l.startsWith('<')){const buf=[];while(i<lines.length&&lines[i].trim())buf.push(lines[i++]);blocks.push(buf.join('\n'));continue;}
    if(/^\|/.test(l)){const buf=[];while(i<lines.length&&/^\|/.test(lines[i]))buf.push(lines[i++]);blocks.push(table(buf));continue;}
    if(/^[-*] /.test(l)){const items=[];while(i<lines.length&&/^[-*] /.test(lines[i]))items.push(lines[i++].slice(2));blocks.push(`<ul>${items.map(x=>`<li>${inline(x)}</li>`).join('')}</ul>`);continue;}
    if(/^\d+\. /.test(l)){const items=[];while(i<lines.length&&/^\d+\. /.test(lines[i]))items.push(lines[i++].replace(/^\d+\. /,''));blocks.push(`<ol>${items.map(x=>`<li>${inline(x)}</li>`).join('')}</ol>`);continue;}
    const buf=[];while(i<lines.length&&lines[i].trim()&&!/^(#|\$\$|\||[-*] |\d+\. |<)/.test(lines[i]))buf.push(lines[i++]);
    blocks.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return{id:meta.id,sys:meta.sys||'',num:meta.num||'',summary:meta.summary||'',title,toc,html:blocks.join('\n')};
}
export function buildNotes(dir='docs/notes'){
  if(!fs.existsSync(dir))return[];
  return fs.readdirSync(dir).filter(f=>f.endsWith('.md')).sort().map(f=>{const c=convert(fs.readFileSync(path.join(dir,f),'utf8'));if(!c.id)c.id=f.replace(/\.md$/,'');return c;});
}
