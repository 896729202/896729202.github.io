'use strict';

module.exports=()=>`<section class="verdict" id="numeric-scope-fix" aria-labelledby="numeric-scope-fix-title">
<p class="eyebrow">2026.11.17 / 本地优化修复记录</p>
<h2 id="numeric-scope-fix-title">同一个 60 毫米，被误判成规格变化</h2>
<p><strong>原因：</strong>后端记录 <code>60.0</code>，前端保存成 <code>60</code>；比较代码按不同写法判断，误以为用户改了尺寸。</p>
<p><strong>影响：</strong>白墨已保存，自动流程却提前退出，<strong>额外调用一次模型收尾</strong>，增加等待；已保存画稿不会被取消。</p>
<p><strong>修复：</strong>比较前统一数值格式，让 <code>60.0</code> 与 <code>60</code> 等价；真正改变尺寸仍会拦截。</p>
<p class="sub">回归检查与真实回执重放通过。修正后的 R7、R8 均从短句重新生图，并由代码完成最终核验与回复。</p>
</section>`;
