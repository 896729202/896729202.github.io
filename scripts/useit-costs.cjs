// Recorded usage × repository-configured rates. Never present this as an invoice.
module.exports=function({costs,esc,table}){
 const money=n=>n==null?'未取得记录':`$${Number(n).toFixed(4)}`;
 const byCase=new Map(costs.cases.map(c=>[c.case,c]));
 const label=id=>{const c=byCase.get(id);return c?.reference_total_usd==null?'记录不完整':money(c.reference_total_usd);};
 function panel(id){
  const c=byCase.get(id);if(!c)return '<section id="cost"><h2>费用（USD）</h2><p>尚未取得可核算的用量记录，不能记为 $0。</p></section>';
  const models=c.tasks.flatMap(t=>(t.model_lines||[]).map(m=>[esc(m.model),m.input_tokens.toLocaleString('en-US'),(m.cache_read_tokens||0).toLocaleString('en-US'),m.output_tokens.toLocaleString('en-US'),money(m.reference_usd)]));
  const services=c.tasks.flatMap(t=>(t.service_lines||[]).map(s=>[esc(s.service+' / '+s.variant),s.units, s.key_source==='user'?'自带密钥':'平台密钥',money(s.reference_usd)]));
  return `<section id="cost" class="estimate-panel"><p class="eyebrow">COST / USD / 2026.11.14 记录</p><h2>参考费用 ${label(id)}</h2><p>模型 ${money(c.model_reference_usd)} + 生图等服务 ${money(c.service_reference_usd)}。按本次已记录用量和系统配置费率核算，<strong>不是供应商实际扣款账单</strong>。${c.reference_total_usd==null?'记录不完整；已知部分为 '+money(c.known_reference_subtotal_usd)+'，缺失项不按零元处理。':''}</p><p>生图使用自带密钥，实际账单尚未取得；这里统一按系统参考价估算（生成 $0.08 / 张，编辑 $0.04 / 张）。包含已记录的重试、取消前调用和缓存读取；不含算力、存储、流量、税费及未上报用量。</p><details><summary>查看模型、服务和各轮任务费用</summary>${table(['模型','输入 token（含缓存）','其中缓存命中','输出 token','参考 USD'],models)}${table(['服务','计费单位数','调用方式','参考 USD'],services)}${table(['任务 ID','结束状态','参考 USD'],c.tasks.map(t=>[`<code>${esc(t.task_id)}</code>`,esc(t.status||'未知'),money(t.reference_usd)]))}<p>每个任务只取最后一次累计用量，同一任务的多次累计回执不会重复相加。Langfuse 当前已计价部分为 ${money(c.langfuse_recorded_partial_usd)}，可能缺少生图、辅助模型或缓存费用，因此不作为整次任务总价。取消任务显示的是取消前已记录的参考成本。</p><p><a href="evidence/costs-2026-11-14.json" download>下载脱敏用量、配置费率和逐任务计算数据 ↓</a></p></details></section>`;
 }
 function overview(){return `<section id="cost-overview"><h2>每次任务的参考费用（美元）</h2><p>以已记录的模型用量、缓存命中和服务次数核算。<strong>这些是按系统配置费率计算的参考成本，实际账单未核验。</strong>生图使用自带密钥；包含重试与取消前消耗，未记录的费用不补猜。点击案例查看明细。</p>${table(['任务','模型 USD','生图等服务 USD','参考合计 USD'],costs.cases.map(c=>[`<a href="${esc(c.case)}.html#cost">${esc(c.case)}</a>`,money(c.model_reference_usd),money(c.service_reference_usd),label(c.case)]))}<p><a href="evidence/costs-2026-11-14.json" download>下载全部参考费用与费率依据 ↓</a></p></section>`;}
 return {money,label,panel,overview};
};
