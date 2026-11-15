'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const ui=require('./build-useit-short-prompts.cjs');
const pending={case:'B10-R9',prompt:'做一张猫咪魔法变身的双图光栅卡。',status:'running',summary_available:false,agent_seconds:null,model_calls:null,cost:{reference_total_usd:null}};
const waiting={...pending,summary_available:true,status:'waiting_confirmation',agent_seconds:40,confirmation_required:true,model_calls:3,generated_image_count:0,saved_face_count:0};
const saved={case:'B10-R10',prompt:'做一张海底城市光栅卡，白天变夜晚。',status:'done',summary_available:true,agent_seconds:90,wall_seconds:94,model_calls:[{},{}],tool_failure_count:1,confirmation_required:false,save_verified:true,saved_face_count:3,generated_image_count:3,
 runtime:{disjoint:true,local_total_ms:90000,items:[{key:'planning',milliseconds:20000},{key:'generation',milliseconds:40000},{key:'placement',milliseconds:25000},{key:'other',milliseconds:5000}]},
 cost:{reference_total_usd:0.21},images:[{src:'images/fixture.webp',original_src:'images/fixture.png',caption:'A < B'}],langfuse_url:'https://example.com/session/fixture',
 failures:[{tool:'canvas3d_render',duration_seconds:2,reason:'独立三维入口不支持该品类。'}],final_reply:'Actual <script> reply'};
let html=ui.renderBody({cases:[pending]});
assert(html.includes('待完整记录'));assert(html.includes('完整费用未知'));assert(!html.includes('工具失败 0 次'));assert(!html.includes('已核验保存'));
html=ui.renderBody({cases:[waiting]});
assert(html.includes('0分40秒'));assert(html.includes('仍需确认，未自动做完'));assert(!html.includes('已核验保存'));
const input={test_date:'2026-11-15',cases:[waiting,saved]};html=ui.renderBody(input);
assert(html.includes('1分30秒'));assert(html.includes('模型 2 次 · 工具失败 1 次'));assert(html.includes('已核验保存 3 面'));
assert(html.includes('20.0 秒'));assert(html.includes('40.0 秒'));assert(html.includes('25.0 秒'));assert(html.includes('5.0 秒'));
assert(html.includes('Actual &lt;script&gt; reply'));assert(!html.includes('Actual <script>'));assert(html.includes('A &lt; B'));
assert(html.includes('canvas3d_render'));assert(html.includes('独立三维入口不支持该品类'));
assert(html.includes('R8 的 1分32秒，不能直接当作普通短句的普遍速度'));
assert(html.includes('href="B10-short-prompts.html" aria-current="page"'));
assert(!/<a[^>]+href="(?:images\/|B10)[^>]+target=/.test(html));
assert(html.includes('href="https://example.com/session/fixture" target="_blank"'));
assert.equal(ui.breakdown({...saved,runtime:{...saved.runtime,local_total_ms:999999}}),null);
assert.equal(ui.breakdown({...saved,runtime:{...saved.runtime,disjoint:false}}),null);
assert.throws(()=>ui.normalizeInput({cases:[saved,saved]}),/Repeated/);
assert.throws(()=>ui.normalizeInput({cases:[]}),/nonempty/);
assert.doesNotThrow(()=>ui.validatePublicInput(input));
assert.doesNotThrow(()=>ui.validatePublicInput({url:'https://us.cloud.langfuse.com/project/foo'}));
assert.throws(()=>ui.validatePublicInput({path:'C:\\Users\\owner\\file'}),/absolute path/);
assert.throws(()=>ui.validatePublicInput({url:'https://example.com/?X-Amz-Signature=abc'}),/signed URL/);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'useit-short-report-'));
try{
 fs.writeFileSync(path.join(root,'index.html'),'<header class="site-header"><a href="./useit/index.html">USEIT</a></header>');
 assert.throws(()=>ui.build({root}),/missing/);
 const source=path.join(root,ui.DEFAULT_INPUT);fs.mkdirSync(path.dirname(source),{recursive:true});fs.writeFileSync(source,JSON.stringify(input));
 const result=ui.build({root});
 assert(fs.readFileSync(result.pageFile,'utf8').includes('href="../../../assets/site.css"'));
 assert.deepEqual(JSON.parse(fs.readFileSync(result.evidenceFile,'utf8')),input);
 assert.equal(fs.readFileSync(source,'utf8'),JSON.stringify(input));
 assert.deepEqual(fs.readdirSync(path.join(root,'useit/tests/2026-11-13')).sort(),['B10-short-prompts.html','evidence']);
}finally{
 const absolute=path.resolve(root);assert.equal(path.dirname(absolute),path.resolve(os.tmpdir()));assert(path.basename(absolute).startsWith('useit-short-report-'));fs.rmSync(absolute,{recursive:true,force:true});
}
console.log('PASS: short-prompt report preserves pending/confirmation/failure states, reconciles timing, escapes text, retains unknown costs, uses same-tab internal navigation and writes only its own page/evidence.');
