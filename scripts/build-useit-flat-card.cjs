'use strict';

// Optional B07 integration. A missing or unverified report leaves historical
// pages alone; a verified report is built only from curated public evidence.
const fs=require('node:fs');
const path=require('node:path');
const ui=require('./useit-b07-optimization.cjs');
const INPUT='content/useit/flat-card-2026-11-16.json';
const BASE='useit/tests/2026-11-13';
const PAGE=`${BASE}/B07-R1.html`;
const EVIDENCE=`${BASE}/evidence/B07-R1-flat-card.json`;
const readJSON=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function loadReadyBundle(root=path.resolve(__dirname,'..')){
 const file=path.join(root,INPUT);
 if(!fs.existsSync(file))return null;
 const bundle=readJSON(file);
 if(!bundle||typeof bundle!=='object'||Array.isArray(bundle))throw new Error('B07 input must contain baseline and report objects.');
 if(!bundle.report||!ui.isVerified(bundle.report)||bundle.report.inspection_verified!==true||bundle.report.automatic_workflow_completed!==true)return null;
 if(bundle.report.case!=='B07-R1')throw new Error('The B07-R1 builder requires case B07-R1.');
 if(!['integration','chat_full','chat_ui','normal_chat'].includes(bundle.report.test_scope))throw new Error('B07 report must explicitly state its integration or normal-chat test scope.');
 ui.validateReport(bundle.baseline);ui.validateReport(bundle.report);
 if(!bundle.baseline)throw new Error('B07 comparison requires its recorded 11/15 baseline.');
 for(const face of ['front','back']){
  const image=bundle.report.images?.find(row=>row.face===face);
  if(!image||!/^images\/[\w.-]+\.(?:png|jpg|jpeg|webp)$/.test(image.url||''))throw new Error(`B07 ${face} needs a local public image URL under images/.`);
  if(!fs.existsSync(path.join(root,BASE,image.url)))throw new Error(`B07 ${face} image has not been copied to the public image directory.`);
 }
 if(!Number.isInteger(bundle.report.tool_errors)||bundle.report.tool_errors<0)throw new Error('B07 tool failure count must be observed.');
 return bundle;
}

function renderPage(root,bundle){
 const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const sourceHeader=home.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0];
 if(!sourceHeader)throw new Error('Existing website header was not found.');
 const prefix='../'.repeat(PAGE.split('/').length-1);
 const header=sourceHeader.replaceAll('href="./',`href="${prefix}`);
 const body=ui.render({...bundle,pageId:'B07-R1',evidenceUrl:'evidence/B07-R1-flat-card.json'});
 return `<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="description" content="普通双面卡自动流程${ui.scopeLabel(bundle.report)}：真实画稿、时间组成、费用、错误与保存核验。测试日期 ${esc(bundle.report.test_date)}。"><title>B07-R1 · 普通双面卡自动流程${ui.scopeLabel(bundle.report)} · USEIT</title><link rel="canonical" href="https://896729202.github.io/${PAGE}"><link rel="stylesheet" href="${prefix}assets/site.css"><link rel="stylesheet" href="${prefix}assets/useit.css?v=20261116-b07"><script>try{document.documentElement.dataset.theme=localStorage.getItem('notebook-theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')}catch(e){}</script><script defer src="${prefix}assets/site.js"></script><script defer src="${prefix}assets/useit.js"></script></head><body class="useit"><a class="skip-link" href="#main">跳到主要内容</a>${header}<main id="main" class="u-main">${body}</main><footer class="u-footer">USEIT / 普通双面卡真实复测 <span>北京时间 UTC+8 · 保留历史结果与验证边界</span></footer></body></html>`;
}

function build({root=path.resolve(__dirname,'..')}={}){
 const bundle=loadReadyBundle(root);
 if(!bundle)return {built:false,reason:'B07 evidence is absent or has not passed independent inspection.'};
 const originalFile=path.join(root,BASE,'B07.html');
 let original=fs.readFileSync(originalFile,'utf8');
 const navigation=/<nav class="tabs"[^>]*>[\s\S]*?<\/nav>|<nav class="tabs siblings" aria-label="普通双面卡测试版本">[\s\S]*?<\/nav>/;
 if(!navigation.test(original))throw new Error('Original B07 navigation was not found; historical page was not changed.');
 original=original.replace(navigation,()=>ui.nav('B07','B07-R1',bundle.report));
 const html=renderPage(root,bundle);
 fs.mkdirSync(path.dirname(path.join(root,EVIDENCE)),{recursive:true});
 fs.writeFileSync(path.join(root,PAGE),html);
 fs.writeFileSync(path.join(root,EVIDENCE),JSON.stringify(bundle,null,2)+'\n');
 fs.writeFileSync(originalFile,original);
 return {built:true,page:PAGE,evidence:EVIDENCE};
}

module.exports={build,loadReadyBundle,renderPage,INPUT,PAGE,EVIDENCE};
if(require.main===module){
 try{const result=build();console.log(result.built?'Built B07-R1 and the original-page navigation; nothing was published.':result.reason);}
 catch(error){console.error(error.message);process.exitCode=1;}
}
