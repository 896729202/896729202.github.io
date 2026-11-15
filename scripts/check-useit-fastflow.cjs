'use strict';
// In-memory rendering checks only. No generated pages, app calls or publication.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=require('./useit-fastflow.cjs')();
const pending=ui.render();
assert(pending.includes('待完成正式复测'));
assert(pending.includes('时间组成待核验'));
assert(!pending.includes('$0.000000'));
assert(!pending.includes('NaN')&&!pending.includes('undefined'));
assert(pending.includes('一次原子保存尚未在本轮实现'));
assert(pending.includes('读取资料')&&pending.includes('默认规格')&&pending.includes('确认')&&pending.includes('批量派发')&&pending.includes('直接汇报'));

const sample={
 case:'B10-R8',test_date:'2026-11-15',summary_available:true,agent_seconds:40,submitted_to_local_completion_seconds:42,
 execution_runs:[{final_state:'done',agent_seconds:40}],model_calls:[{step:3},{step:4}],
 post_run_verification:{success:true},saved_image_count:3,saved_placement_count:3,
 prompt:'测试 <script>alert(1)</script>',
 images:[{src:'images/sample-a.png',face:'frame-a'},{src:'images/sample-b.png',face:'frame-b'},{src:'images/sample-back.png',face:'back'}],
 host_actions:[{name:'project_plan_write',tool_call_id:'host-plan'}],
 langfuse:{url:'https://us.cloud.langfuse.com/project/example/sessions/example',observations:[
  {id:'aggregate-id',name:'agent.run',type:'SPAN',startTime:'2026-11-15T06:00:00Z',duration_ms:40000,traceId:'trace-1'},
  {id:'host-id',name:'tool.project_plan_write',type:'SPAN',startTime:'2026-11-15T06:00:00Z',duration_ms:10,tool_call_id:'host-plan',traceId:'trace-1'}
 ]},cost:{reference_total_usd:0.2,known_reference_subtotal_usd:0.2,tasks:[]}
};
const runtime={disjoint:true,local_total_ms:40000,items:[{key:'planning',milliseconds:10000},{key:'generation',milliseconds:20000},{key:'placement',milliseconds:5000},{key:'other',milliseconds:5000}]};
assert(ui.completeRun(sample));
assert(ui.validRuntime(sample,runtime));
const complete=ui.render({report:sample,runtime,baseline:{agent_seconds:310.03}});
assert(complete.includes('运行完成，三面保存已核查'));
assert(complete.includes('width:25%'));
assert(complete.includes('这些项目相加为 40.000 秒'));
assert(complete.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
assert(!complete.includes('<script>alert(1)</script>'));
assert(complete.includes('代码保存默认产品计划'));
assert(complete.includes('data-ff-search')&&complete.includes('这一步做了什么'));
assert(!complete.includes('<details open'));
assert.equal((complete.match(/class="ff-meta"/g)||[]).length,2);
assert.equal((complete.match(/<img /g)||[]).length,3);
assert(complete.includes('id="cost"')&&complete.includes('不是供应商实际扣款账单'));
assert(complete.includes('0 个工具失败')&&complete.includes('2026-11-15'));
assert(complete.includes('15 分 01 秒')&&complete.includes('5 分 10 秒'));
for(const anchor of complete.matchAll(/<a\b[^>]*href="images\/[^"]+"[^>]*>/g))assert(!anchor[0].includes('target='),anchor[0]);
const latest=ui.render({report:sample,runtime,latestView:true});
assert(latest.includes('<h1>光栅卡最新成果</h1>'));
assert(latest.includes('<span>/</span>最新成果</nav>'));
assert(latest.includes('href="B10-latest.html" aria-current="page"'));
assert(!latest.includes('href="B10-R8.html" aria-current="page"'));
assert(complete.includes('href="B10-R8.html" aria-current="page"'));
assert.equal((latest.match(/aria-current="page"/g)||[]).length,1);
const observedNoRewrite=ui.render({report:{...sample,rewrite_observation:{observed_event_count:0,observed_duration_ms:0}}});
assert(observedNoRewrite.includes('本轮没有实际执行提示词改写'));
assert(observedNoRewrite.includes('环境开关状态未确认'));
assert(!observedNoRewrite.includes('本次提示词整理关闭'));

assert(!ui.validRuntime(sample,{...runtime,disjoint:false}));
assert(!ui.validRuntime(sample,{...runtime,local_total_ms:41000}));
assert(!ui.validRuntime(sample,{...runtime,items:[...runtime.items,{key:'nested',milliseconds:1000}]}));
assert(ui.render({report:sample,runtime:{...runtime,disjoint:false}}).includes('尚未取得与总计一致'));
const missingCost=ui.render({report:{...sample,cost:{reference_total_usd:null,known_reference_subtotal_usd:0.1}}});
assert(missingCost.includes('已记录部分小计 $0.100000'));
assert(!missingCost.includes('参考总费用 $0.100000'));

const interrupted={...sample,summary_available:false,agent_seconds:null,submitted_to_local_completion_seconds:null,run_outcome:'interrupted_no_final_summary',model_wait_ms:17330,cost:{reference_total_usd:null,known_reference_subtotal_usd:0.209810825},phase_totals_ms:{'orch.plan.run_action':49346},interruption:{trace_error_window_ms:98123}};
const partial=ui.render({attempts:[{label:'服务中断试跑',report:interrupted}],startupAttempts:[{attempt:'startup-attempt-1',status:'startup_connection_failure'}]});
assert(partial.includes('服务中断，未完整通过'));
assert(partial.includes('完整 Agent 总耗时：未知'));
assert(partial.includes('启动故障 1 次'));
assert(partial.includes('Agent 中断前的云端记录'));
assert(!partial.includes('运行完成，三面保存已核查'));
for(const html of [pending,complete,partial])for(const anchor of html.matchAll(/<a\b[^>]*href="(B10[^"#]*\.html(?:#[^"]*)?)"[^>]*>/g))assert(!anchor[0].includes('target='),anchor[0]);
assert(complete.includes('target="_blank" rel="noopener noreferrer">打开 Langfuse Session'));
assert(!ui.render({report:{...sample,images:[{src:'javascript:alert(1)'}]}}).includes('src="javascript:'));

// Source-network findings use their own measurements, never the final-run headline total.
const sourceInvestigation={faces:[{face:'A',bytes:3215371,sha256:'same-image',host_read_ms:135037,
 download:{body_wait_ms:130985,disk_backpressure_ms:270.664,commit_ms:7.828}}],
 comparison:{proxy_results:[{face:'A',bytes:3215371,sha256:'same-image',total_ms:1479.925}],
 native_fetch:{results:[{node:'22.19.0',electron:'36.9.5',total_ms:60007.234,bytes:1357354,error:'TimeoutError'}]}},
 fix:{unit_tests:7},catalog:{problem:'目录读取失败 <script>bad()</script>',
 cause:'网络失败被混入能力判断。',fix:'在有效期内复用品类目录缓存；失败不能误报 unsupported。',validation:'单元测试已通过，真实保存待核验。'}};
const investigated=ui.render({report:sample,runtime,sourceInvestigation});
assert(investigated.includes('3.22 MB')&&investigated.includes('135.037 秒')&&investigated.includes('130.985 秒'));
assert(investigated.includes('最多 <strong>0.278 秒'));
assert(investigated.includes('Electron net.fetch')&&investigated.includes('遵守系统代理'));
assert(investigated.includes('1.480 秒')&&investigated.includes('已完整下载，哈希与原图一致'));
assert(investigated.includes('60.007 秒')&&investigated.includes('到期停止，未收完整图片'));
assert(investigated.includes('在有效期内复用品类目录缓存')&&investigated.includes('失败不能误报 unsupported'));
assert(investigated.includes('&lt;script&gt;bad()&lt;/script&gt;')&&!investigated.includes('<script>bad()'));
assert(investigated.includes('精确记录 40.000 秒')&&investigated.includes('这些项目相加为 40.000 秒'));
assert(!ui.render({sourceInvestigation}).includes('精确记录 135.037 秒'));
const unmatched=ui.render({sourceInvestigation:{...sourceInvestigation,comparison:{proxy_results:[{face:'A',bytes:100,sha256:'different',total_ms:10}]}}});
assert(unmatched.includes('完整性对应关系待核验')&&!unmatched.includes('已完整下载，哈希与原图一致'));
const changed=ui.render({sourceInvestigation:{faces:[{face:'A',bytes:1000000,host_read_ms:3277,download:{body_wait_ms:2200}}]}});
assert(changed.includes('3.277 秒')&&changed.includes('1.00 MB')&&!changed.includes('135.037 秒'));
assert(!changed.includes('最多 <strong>0.000 秒'));

const placementFailure={...interrupted,functional_outcome:'placement_failed',failed_placements:[{face:'frame-a',success:false}]};
const failure=ui.render({sourceInvestigation,attempts:[{label:'网络与目录失败试跑',report:placementFailure,
 summary:{outcome:'failed_incomplete',generated_sources:3,successful_saved_faces:0,public_note:'失败记录 <unsafe>'}}]});
assert(failure.includes('装配失败，未完整通过'));
assert(failure.includes('本次生成 3 张素材，成功保存 0 面'));
assert(failure.includes('完整 Agent 总耗时：未知'));
assert(failure.includes('装配失败试跑的云端记录'));
assert(!failure.includes('服务中断，未完整通过'));
assert(!failure.includes('运行完成，三面保存已核查'));
assert(failure.includes('失败记录 &lt;unsafe&gt;'));

// Use the real interrupted evidence when present, without rewriting or copying it.
const real=path.resolve(__dirname,'../../UseIt/diagnostics/placement-fastflow-20261115/attempt-service-interruption-1/retest-report.json');
if(fs.existsSync(real)){
 const evidence=JSON.parse(fs.readFileSync(real,'utf8'));
 const html=ui.render({attempts:[{label:'真实中断试跑',report:evidence}]});
 assert(html.includes('服务中断，未完整通过'));
 assert(html.includes('完整 Agent 总耗时：未知'));
 assert(!html.includes('NaN')&&!html.includes('undefined'));
}
const networkDir=path.resolve(__dirname,'../../UseIt/diagnostics/placement-fastflow-20261115');
const networkReport=path.join(networkDir,'attempt-network-failure-1/retest-report.json');
const sourceFile=path.join(networkDir,'source-loading-investigation.json');
if(fs.existsSync(networkReport)&&fs.existsSync(sourceFile)){
 const report=JSON.parse(fs.readFileSync(networkReport,'utf8'));
 const evidence=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
 const html=ui.render({sourceInvestigation:evidence,attempts:[{label:'真实网络失败试跑',report}]});
 assert(html.includes('装配失败，未完整通过')&&html.includes('完整 Agent 总耗时：未知'));
 assert(html.includes('205.568 秒')&&html.includes('201.531 秒')&&html.includes('9.202 秒'));
 assert(!html.includes('NaN')&&!html.includes('undefined')&&!html.includes('运行完成，三面保存已核查'));
}
const publishedBundle=path.resolve(__dirname,'../content/useit/placement-fastflow-2026-11-15.json');
assert(fs.existsSync(publishedBundle),'The final R8 bundle is required for the completed rendering check');
const bundle=JSON.parse(fs.readFileSync(publishedBundle,'utf8'));
// Scheme suffixes such as the s:/ in https:// are not Windows drive paths.
const windowsAbsolutePath=/(?<![A-Za-z0-9+.-])[A-Za-z]:[\\/]/;
assert(!windowsAbsolutePath.test('https://us.cloud.langfuse.com/project/example'));
assert(windowsAbsolutePath.test('C:/Users/private'));
assert(!windowsAbsolutePath.test(JSON.stringify(bundle)));
for(const report of [bundle.report,...bundle.attempts.map(item=>item.report)]){
 assert.match(report.langfuse.url,/^https:\/\/us\.cloud\.langfuse\.com\/project\//);
 assert.equal(report.langfuse_url,report.langfuse.url);
}
const final=ui.render(bundle),latestFinal=ui.render({...bundle,latestView:true});
assert(ui.validRuntime(bundle.report,bundle.runtime));
for(const html of [final,latestFinal]){
 assert(html.includes('1 分 32 秒')&&html.includes('91.590 秒')&&html.includes('0 个工具失败'));
 assert(html.includes('2026-11-15')&&html.includes('$0.208143'));
 assert(html.includes('没有实际执行提示词改写')&&html.includes('0 个改写事件、0 秒改写耗时'));
 assert(html.includes('两个项目各自完成')&&html.includes('15 秒重叠'));
 assert(html.includes('B07 · 普通双面卡牌')&&html.includes('2 分 7 秒')&&html.includes('$0.288674'));
 assert(html.includes('真实页面 DOM 已确认')&&html.includes('本轮没有点击查看后再验收消点'));
 assert(!html.includes('真实多窗口 UI 验收待完成'));
 assert(html.includes('图片命名辅助')&&html.includes('不是供应商实际扣款账单'));
 assert(html.includes('完整 Agent 总耗时：未知')&&html.includes('已记录费用小计'));
 assert(html.includes('id="cost"')&&html.includes('id="r8-cost"'));
 assert(html.includes('这一步做了什么')&&html.includes('data-ff-search'));
 assert(html.includes('href="https://us.cloud.langfuse.com/project/')&&html.includes('打开 Langfuse Session'));
 assert(!html.includes('<details open'));
 assert(!html.includes('NaN')&&!html.includes('undefined'));
 for(const anchor of html.matchAll(/<a\b[^>]*href="(?:B10[^"#]*\.html|images\/)[^"]*"[^>]*>/g))assert(!anchor[0].includes('target='),anchor[0]);
}
assert(latestFinal.includes('href="B10-latest.html" aria-current="page"'));
assert(final.includes('href="B10-R8.html" aria-current="page"'));
console.log('PASS: R8 final and latest views; reconciled runtime; same-tab navigation/images; cost anchors; observed rewrite facts; concurrent-task and sidebar boundaries; incomplete attempts stay unknown; IDs folded and Chinese search retained. In-memory only, no page built.');
