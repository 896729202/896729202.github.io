'use strict';
const rounds=[
 ['B10-R1','① 原始版 · 15分01秒'],
 ['B10-R7','② 第一轮优化 · 5分10秒'],
 ['B10-latest','③ 第二轮优化 · 多次实测']
];
module.exports=function(active=''){
 const group=['B10','B10-R1'].includes(active)?'B10-R1':/^B10-R[2-7]$/.test(active)?'B10-R7':active?'B10-latest':'';
 return `<nav class="tabs siblings" aria-label="光栅卡三个版本">${rounds.map(([id,label])=>`<a href="${id}.html"${id===group?` aria-current="${id===active?'page':'step'}"`:''}${id==='B10-latest'?' class="latest-tab"':''}>${label}</a>`).join('')}</nav>`;
};
