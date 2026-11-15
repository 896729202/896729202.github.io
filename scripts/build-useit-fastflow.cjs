'use strict';

// Local-only R8 build. Input must be a curated, credential-free website snapshot.
// No diagnostics discovery, image copying, API calls or publication happens here.
const fs=require('node:fs');
const path=require('node:path');
const createFastflowUI=require('./useit-fastflow.cjs');

const PAGE='useit/tests/2026-11-13/B10-R8.html';
const EVIDENCE='useit/tests/2026-11-13/evidence/B10-R8-placement.json';
const DEFAULT_INPUT='content/useit/placement-fastflow-2026-11-15.json';
const BASELINE='content/useit/placement-gta-2026-11-14.json';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readJSON=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));

function normalizeInput(value){
 if(!value||Array.isArray(value)||typeof value!=='object')throw new Error('R8 input must be a report or an evidence bundle object.');
 const bundle=Object.hasOwn(value,'report')||(!value.case&&['attempts','startupAttempts','manifest','baseline'].some(key=>Object.hasOwn(value,key)));
 const input=bundle?{...value}:{report:value,runtime:value.runtime||null};
 if(input.report!=null&&(!input.report||typeof input.report!=='object'||Array.isArray(input.report)))throw new Error('R8 report must be an object or null.');
 if(input.report?.case&&input.report.case!=='B10-R8')throw new Error('R8 builder will not render a different test case.');
 return input;
}

function renderPage(home,input){
 const header=home.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0];
 if(!header)throw new Error('The existing site header could not be found; no R8 output was written.');
 const prefix='../'.repeat(PAGE.split('/').length-1);
 const body=createFastflowUI().render(input);
 const date=input.report?.test_date||'2026-11-15';
 return `<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="description" content="USEIT B10-R8：五项代码改动复测，记录实际耗时、费用、画稿与保存回执。测试日期 ${escape(date)}。"><title>B10-R8 · 五项改动复测 · USEIT</title><link rel="canonical" href="https://896729202.github.io/${PAGE}"><link rel="stylesheet" href="${prefix}assets/site.css"><link rel="stylesheet" href="${prefix}assets/useit.css?v=20261115-4"><script>try{document.documentElement.dataset.theme=localStorage.getItem('notebook-theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')}catch(e){}</script><script defer src="${prefix}assets/site.js"></script><script defer src="${prefix}assets/useit.js"></script></head><body class="useit"><a class="skip-link" href="#main">跳到主要内容</a>${header.replaceAll('href="./',`href="${prefix}`)}<main id="main" class="u-main">${body}</main><footer class="u-footer">USEIT / 实验档案 · 2026　<span>所有时间为北京时间 UTC+8 · 正式复测与中断试跑分别记录</span></footer></body></html>`;
}

function build({root=path.resolve(__dirname,'..'),inputFile,allowPending=false}={}){
 root=path.resolve(root);
 const source=path.resolve(root,inputFile||DEFAULT_INPUT);
 let input;
 if(fs.existsSync(source))input=normalizeInput(readJSON(source));
 else if(allowPending&&!inputFile)input={report:null};
 else throw new Error(`R8 evidence is missing: ${source}. Supply curated evidence, or use --pending for an explicitly unfinished page.`);
 const baselineFile=path.join(root,BASELINE);
 if(!input.baseline&&fs.existsSync(baselineFile))input.baseline=readJSON(baselineFile);
 // Fixed public destinations keep this build isolated from other test pages.
 const publicInput={...input,evidenceUrl:'evidence/B10-R8-placement.json'};
 const html=renderPage(fs.readFileSync(path.join(root,'index.html'),'utf8'),publicInput);
 const evidence=JSON.stringify(publicInput,null,2)+'\n';
 const pageFile=path.join(root,PAGE),evidenceFile=path.join(root,EVIDENCE);
 fs.mkdirSync(path.dirname(evidenceFile),{recursive:true});
 fs.writeFileSync(evidenceFile,evidence);
 fs.writeFileSync(pageFile,html);
 return {pageFile,evidenceFile,complete:createFastflowUI().completeRun(input.report),source:fs.existsSync(source)?source:null};
}

function parseArgs(args){
 const options={};
 for(let index=0;index<args.length;index++){
  const arg=args[index];
  if(arg==='--pending')options.allowPending=true;
  else if(arg==='--input'){
   if(!args[index+1]||args[index+1].startsWith('--'))throw new Error('--input requires a curated JSON file path.');
   options.inputFile=args[++index];
  }else throw new Error(`Unknown argument: ${arg}`);
 }
 return options;
}

if(require.main===module){
 try{const result=build(parseArgs(process.argv.slice(2)));console.log(`Built ${PAGE} (${result.complete?'completed-run evidence':'pending / incomplete evidence'}). Only R8 page and evidence were written; nothing was published.`);}
 catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={build,normalizeInput,renderPage,parseArgs,PAGE,EVIDENCE,DEFAULT_INPUT};
