'use strict';
const rounds=[
 ['B10-latest','最新成果 · 11/15'],
 ['B10','B10 原始'],['B10-R1','B10-R1 补测'],
 ['B10-R2','B10-R2 修复复测'],['B10-R3','B10-R3 新主题复测'],
 ['B10-R4','B10-R4 并行技术对照'],['B10-R5','B10-R5 自然语言验收'],
 ['B10-R6','B10-R6 提示词整理'],['B10-R7','B10-R7 GTA6 复测'],
 ['B10-R8','B10-R8 五项改动复测']
];
module.exports=function(active=''){
 return `<nav class="tabs siblings" aria-label="光栅卡测试与最新成果">${rounds.map(([id,label])=>`<a href="${id}.html"${id===active?' aria-current="page"':''}${id==='B10-latest'?' class="latest-tab"':''}>${label}</a>`).join('')}</nav>`;
};
